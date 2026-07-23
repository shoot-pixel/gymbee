// GymBee - chat-coach Edge Function
//
// Called from ChatScreen for every message the athlete sends. Verifies the
// caller's session, then runs a tool-use loop against Claude so the coach can
// actually act on the athlete's schedule (look up a day's plan, cancel a
// one-off scheduled workout, search/curate/schedule a workout template) - not
// just chat about it - streaming the reply token-by-token over Realtime
// Broadcast on topic `chat-<conversation id>` exactly as before, and
// persisting the final assistant reply once the loop finishes.
//
// Tool-use turns and the final answer share the same broadcast stream: the
// client sees one continuous run of 'token' events (narration before a tool
// call, then the final reply, all concatenated) followed by one 'done' - the
// client-side contract is unchanged from the pre-tool-use version of this
// function.
//
// Removal is intentionally scoped to one-off `scheduled_workouts` only -
// there is no delete/mutate path for the recurring AI-generated
// `program_days` anywhere in this app (not even in the UI), and building one
// is out of scope here. No in-chat confirmation step exists either - actions
// execute immediately once the model has looked up real current state via
// get_day_plan.
//
// Broadcast is sent via the REST endpoint below rather than opening a
// realtime websocket connection from the function itself (which would add a
// connect/join round-trip to every request). This is a public (non-private)
// broadcast topic - the conversation id in the topic name is the access
// boundary, not Realtime Authorization. Fine for a per-user coach thread;
// revisit if topics ever need to be shared across users.
//
// Deploy: Supabase Dashboard -> Edge Functions -> Create a new function named
// "chat-coach" -> paste this whole file -> Deploy. Reuses the
// ANTHROPIC_API_KEY secret already set for generate-program.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js';
import Anthropic from 'npm:@anthropic-ai/sdk';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HISTORY_LIMIT = 20;
const MAX_TOOL_ITERATIONS = 8;
// Supabase Edge Functions are wall-clock limited (150s free / 400s paid), not
// CPU limited (async I/O like these DB/Anthropic calls doesn't count against
// the 2s CPU cap) - a hard platform kill past that limit means no broadcast,
// no graceful anything. This soft budget is checked between loop iterations
// so a slow run finalizes gracefully well before that ever happens.
const SOFT_DEADLINE_MS = 100_000;
const FALLBACK_TEXT = 'I made a change to your schedule — check your calendar or library to confirm.';
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function broadcast(topic: string, event: string, payload: unknown) {
  await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ messages: [{ topic, event, payload }] }),
  });
}

function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value);
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

/** Every tool: strict:true + additionalProperties:false + every property in
 * `required` (optional fields are typed nullable rather than omitted - under
 * strict mode "required" means "key must be present", not "must be
 * non-null"). No tool takes a user_id/owner input - that's always injected
 * server-side from the verified JWT, never accepted from the model. */
function buildTools(exerciseNames: string[]) {
  return [
    {
      name: 'get_day_plan',
      description:
        "Look up everything scheduled for one specific date - both the athlete's recurring AI-generated program day (if any) and any one-off scheduled workouts. Call this before removing or adding anything for a date, and whenever the athlete asks what's planned for a day. This is also the only way to get valid ids for remove_scheduled_workout - never guess or reuse an id from earlier in the conversation.",
      input_schema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD format.' },
        },
        required: ['date'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      name: 'remove_scheduled_workout',
      description:
        'Cancels/removes a one-off scheduled workout by its id, from a prior get_day_plan call in THIS conversation turn. Call this whenever the athlete asks to cancel, remove, delete, or skip a workout that get_day_plan showed as a scheduled_workout. Cannot remove a recurring AI-generated program day - if get_day_plan showed the day as a program_day instead, explain that it can\'t be removed and suggest an alternative (like substituting an exercise) instead of calling this.',
      input_schema: {
        type: 'object',
        properties: {
          scheduled_workout_id: {
            type: 'string',
            description: 'The id of a scheduled_workouts entry returned by get_day_plan.',
          },
        },
        required: ['scheduled_workout_id'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      name: 'search_workout_templates',
      description:
        "Searches the athlete's saved workout library by name. Always call this before curate_workout_template, so an existing matching workout is reused instead of duplicated.",
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search text, e.g. "shoulder" or "push day".' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      name: 'curate_workout_template',
      description:
        "Creates a brand-new saved workout template built only from the athlete's real exercise library. Only call this after search_workout_templates found nothing suitable. Design 4-7 exercises appropriate to the requested focus and the athlete's experience level. This does NOT put it on the calendar - always follow a successful call with schedule_workout_template.",
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'e.g. "Shoulder Day"' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                exercise_name: { type: 'string', enum: exerciseNames },
                target_sets: { type: 'integer' },
                target_reps_min: { type: 'integer' },
                target_reps_max: { type: 'integer' },
                target_rpe: { type: ['number', 'null'], description: 'Target RPE, or null if not specified.' },
                rest_seconds: { type: ['integer', 'null'], description: 'Rest between sets in seconds, or null.' },
              },
              required: ['exercise_name', 'target_sets', 'target_reps_min', 'target_reps_max', 'target_rpe', 'rest_seconds'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'exercises'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      name: 'schedule_workout_template',
      description:
        "Puts an existing (or just-curated) workout template onto the athlete's schedule for a specific date.",
      input_schema: {
        type: 'object',
        properties: {
          template_id: { type: 'string' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD format. Must be today or later.' },
        },
        required: ['template_id', 'date'],
        additionalProperties: false,
      },
      strict: true,
    },
    // deno-lint-ignore no-explicit-any
  ] as any;
}

// ---------------------------------------------------------------------------
// Tool executors
// ---------------------------------------------------------------------------

type ToolContext = {
  userId: string;
  admin: SupabaseClient;
  nameToId: Map<string, string>;
  today: string;
};

async function getDayPlan(input: Record<string, unknown>, ctx: ToolContext) {
  if (!isValidDateString(input.date)) return { error: 'date must be in YYYY-MM-DD format' };
  const date = input.date;

  const { data: program, error: programError } = await ctx.admin
    .from('programs')
    .select('start_date, weeks_count, program_weeks ( week_number, program_days ( day_of_week, title, is_rest_day, program_exercises ( exercises ( name ) ) ) )')
    .eq('user_id', ctx.userId)
    .eq('status', 'active')
    .maybeSingle();
  if (programError) throw programError;

  // deno-lint-ignore no-explicit-any
  let programDay: any = null;
  if (program) {
    // Ported from getProgramDayForDate (src/services/api/queries/programs.ts)
    // - UTC throughout, since this runs server-side rather than on-device.
    const start = new Date(`${program.start_date}T00:00:00Z`);
    const target = new Date(`${date}T00:00:00Z`);
    const daysSinceStart = Math.floor((target.getTime() - start.getTime()) / 86_400_000);
    if (daysSinceStart >= 0) {
      const weekNumber = Math.floor(daysSinceStart / 7) + 1;
      if (weekNumber <= program.weeks_count) {
        // deno-lint-ignore no-explicit-any
        const week = (program.program_weeks as any[]).find(w => w.week_number === weekNumber);
        const dayOfWeek = target.getUTCDay();
        // deno-lint-ignore no-explicit-any
        const day = week?.program_days.find((d: any) => d.day_of_week === dayOfWeek);
        if (day) {
          programDay = {
            title: day.title,
            is_rest_day: day.is_rest_day,
            // deno-lint-ignore no-explicit-any
            exercises: day.program_exercises.map((pe: any) => pe.exercises.name),
          };
        }
      }
    }
  }

  const { data: scheduled, error: scheduledError } = await ctx.admin
    .from('scheduled_workouts')
    .select('id, name, scheduled_workout_exercises ( exercises ( name ) )')
    .eq('user_id', ctx.userId)
    .eq('scheduled_date', date)
    .limit(20);
  if (scheduledError) throw scheduledError;

  return {
    date,
    program_day: programDay,
    scheduled_workouts: (scheduled ?? []).map(sw => ({
      id: sw.id,
      name: sw.name,
      // deno-lint-ignore no-explicit-any
      exercises: (sw.scheduled_workout_exercises as any[]).map(e => e.exercises.name),
    })),
  };
}

async function removeScheduledWorkout(input: Record<string, unknown>, ctx: ToolContext) {
  if (typeof input.scheduled_workout_id !== 'string') {
    return { error: 'scheduled_workout_id is required' };
  }
  const scheduledWorkoutId = input.scheduled_workout_id;

  // Refuse rather than orphan a completed log's link back to what it fulfilled.
  const { data: linkedLog, error: logError } = await ctx.admin
    .from('workout_logs')
    .select('id')
    .eq('scheduled_workout_id', scheduledWorkoutId)
    .not('completed_at', 'is', null)
    .maybeSingle();
  if (logError) throw logError;
  if (linkedLog) {
    return { error: 'That workout is already logged as completed - it can’t be removed.' };
  }

  // Ownership check lives IN the delete statement, not a separate SELECT -
  // .select() afterward is what lets us tell "0 rows matched" (wrong id, or
  // someone else's row) apart from "1 row deleted". Without it a foreign id
  // would silently no-op and this would incorrectly report success.
  const { data, error } = await ctx.admin
    .from('scheduled_workouts')
    .delete()
    .eq('id', scheduledWorkoutId)
    .eq('user_id', ctx.userId)
    .select('name, scheduled_date');
  if (error) throw error;
  if (!data || data.length === 0) return { error: 'No matching scheduled workout found for this athlete.' };

  return { removed: true, name: data[0].name, date: data[0].scheduled_date };
}

async function searchWorkoutTemplates(input: Record<string, unknown>, ctx: ToolContext) {
  if (typeof input.query !== 'string') return { error: 'query is required' };

  const { data, error } = await ctx.admin
    .from('workout_templates')
    .select('id, name, workout_template_exercises ( exercises ( name ) )')
    .eq('user_id', ctx.userId)
    .ilike('name', `%${input.query}%`)
    .limit(20);
  if (error) throw error;

  return {
    matches: (data ?? []).map(t => ({
      id: t.id,
      name: t.name,
      // deno-lint-ignore no-explicit-any
      exercises: (t.workout_template_exercises as any[]).map(e => e.exercises.name),
    })),
  };
}

async function curateWorkoutTemplate(input: Record<string, unknown>, ctx: ToolContext) {
  if (typeof input.name !== 'string' || !Array.isArray(input.exercises)) {
    return { error: 'name and exercises are required' };
  }

  const rows = input.exercises
    // deno-lint-ignore no-explicit-any
    .map((ex: any, index: number) => {
      const exerciseId = ctx.nameToId.get(String(ex.exercise_name).toLowerCase());
      if (!exerciseId) return null;
      return {
        exercise_id: exerciseId,
        order_index: index,
        target_sets: ex.target_sets,
        target_reps_min: ex.target_reps_min,
        target_reps_max: ex.target_reps_max,
        target_load_kg: null,
        target_rpe: ex.target_rpe ?? null,
        rest_seconds: ex.rest_seconds ?? null,
        notes: null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (rows.length === 0) return { error: 'None of the requested exercises matched the exercise library.' };

  const { data: template, error } = await ctx.admin
    .from('workout_templates')
    .insert({ user_id: ctx.userId, name: input.name })
    .select()
    .single();
  if (error) throw error;

  const { error: exercisesError } = await ctx.admin
    .from('workout_template_exercises')
    .insert(rows.map(row => ({ ...row, workout_template_id: template.id })));
  if (exercisesError) throw exercisesError;

  return { template_id: template.id, name: template.name, exercise_count: rows.length };
}

async function scheduleWorkoutTemplate(input: Record<string, unknown>, ctx: ToolContext) {
  if (typeof input.template_id !== 'string' || !isValidDateString(input.date)) {
    return { error: 'template_id and a valid date are required' };
  }
  if (input.date < ctx.today) return { error: 'Cannot schedule a workout in the past.' };

  const { data: template, error } = await ctx.admin
    .from('workout_templates')
    .select('id, name, workout_template_exercises ( * )')
    .eq('id', input.template_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (error) throw error;
  if (!template) return { error: 'Template not found for this athlete.' };

  const { data: scheduled, error: scheduleError } = await ctx.admin
    .from('scheduled_workouts')
    .insert({
      user_id: ctx.userId,
      scheduled_date: input.date,
      name: template.name,
      source_template_id: template.id,
    })
    .select()
    .single();
  if (scheduleError) throw scheduleError;

  const templateExercises = template.workout_template_exercises as Array<Record<string, unknown>>;
  if (templateExercises.length > 0) {
    const rows = templateExercises.map(te => ({
      scheduled_workout_id: scheduled.id,
      exercise_id: te.exercise_id,
      order_index: te.order_index,
      target_sets: te.target_sets,
      target_reps_min: te.target_reps_min,
      target_reps_max: te.target_reps_max,
      target_load_kg: te.target_load_kg,
      target_rpe: te.target_rpe,
      rest_seconds: te.rest_seconds,
      notes: te.notes,
    }));
    const { error: insertError } = await ctx.admin.from('scheduled_workout_exercises').insert(rows);
    if (insertError) throw insertError;
  }

  return { scheduled_workout_id: scheduled.id, name: scheduled.name, date: scheduled.scheduled_date };
}

function executeTool(name: string, input: Record<string, unknown>, ctx: ToolContext) {
  switch (name) {
    case 'get_day_plan':
      return getDayPlan(input, ctx);
    case 'remove_scheduled_workout':
      return removeScheduledWorkout(input, ctx);
    case 'search_workout_templates':
      return searchWorkoutTemplates(input, ctx);
    case 'curate_workout_template':
      return curateWorkoutTemplate(input, ctx);
    case 'schedule_workout_template':
      return scheduleWorkoutTemplate(input, ctx);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ---------------------------------------------------------------------------

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Invalid session' }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const conversationId = body.conversation_id as string;
    const message = ((body.message as string) ?? '').trim();
    // Trusted "today" comes from the client (its own local device time, the
    // same format(new Date(),'yyyy-MM-dd') convention scheduled_date already
    // uses everywhere) - this function runs in UTC with no idea what
    // timezone the athlete is actually in, so computing "today" here would
    // silently write the wrong date for anyone west of UTC late in their day.
    const todayInput = body.today as string;
    const today = isValidDateString(todayInput) ? todayInput : new Date().toISOString().slice(0, 10);
    if (!conversationId || !message) {
      return json({ error: 'conversation_id and message are required' }, 400);
    }

    // Service-role client for every DB write below - bypasses RLS by design,
    // so ownership is checked explicitly instead of relying on policies.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: conversation, error: conversationError } = await admin
      .from('chat_conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .single();
    if (conversationError || !conversation || conversation.user_id !== userId) {
      return json({ error: 'Conversation not found' }, 404);
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('display_name, goal, experience_level, days_per_week, injuries_notes')
      .eq('id', userId)
      .single();

    // Only present for athletes who've connected + synced Whoop (see
    // supabase/functions/whoop-sync) — absent for everyone else, which is
    // why this is spliced onto the prompt conditionally below rather than
    // folded into the fixed template like the profile fields above.
    const { data: whoopMetrics } = await admin
      .from('whoop_metrics')
      .select('recovery_score, sleep_performance_pct, strain, score_state, cycle_date')
      .eq('user_id', userId)
      .order('cycle_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: historyRows, error: historyError } = await admin
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);
    if (historyError) throw historyError;
    const history = (historyRows ?? []).reverse();

    const { error: insertUserError } = await admin
      .from('chat_messages')
      .insert({ conversation_id: conversationId, role: 'user', content: message });
    if (insertUserError) throw insertUserError;

    // Same enum-constrained-exercise-name pattern as generate-program: fetch
    // the real (non-custom) library once, use it to build curate_workout_
    // template's tool schema, and to defensively resolve names -> ids after
    // the fact even though `strict: true` already enforces the enum.
    const { data: exerciseRows, error: exerciseError } = await admin
      .from('exercises')
      .select('id, name')
      .eq('is_custom', false);
    if (exerciseError) throw exerciseError;
    const exerciseNames = (exerciseRows ?? []).map(e => e.name as string);
    const nameToId = new Map((exerciseRows ?? []).map(e => [(e.name as string).toLowerCase(), e.id as string]));

    const weekdayName = WEEKDAY_NAMES[new Date(`${today}T00:00:00Z`).getUTCDay()];
    // Only present for athletes who've connected + synced Whoop and whose
    // latest cycle is fully scored — absent for everyone else, so this is
    // appended conditionally rather than folded into the fixed template
    // like the profile fields below.
    const whoopSection =
      whoopMetrics?.score_state === 'SCORED'
        ? `\n\nToday's Whoop data (${whoopMetrics.cycle_date}): recovery ${whoopMetrics.recovery_score}%, sleep performance ${whoopMetrics.sleep_performance_pct ?? 'unknown'}%, strain ${whoopMetrics.strain ?? 'unknown'}. Factor this into training and recovery advice - e.g. favor lighter intensity or extra rest on low-recovery days - and reference these numbers directly if the athlete asks how they're doing.`
        : '';
    const systemPrompt = `You are SoSet's AI strength coach, chatting with ${profile?.display_name ?? 'an athlete'}.
Athlete profile - goal: ${profile?.goal ?? 'unspecified'}, experience: ${profile?.experience_level ?? 'unspecified'}, training days/week: ${profile?.days_per_week ?? 'unspecified'}, injuries/limitations: ${profile?.injuries_notes || 'none reported'}.
Answer training, recovery, and nutrition questions concisely and encouragingly. Keep replies short (a few sentences unless the question needs more). Flag when something warrants seeing a doctor or physical therapist instead of guessing.

Today is ${today} (${weekdayName}). Use this as "today" when resolving relative dates like "tomorrow", "this Friday", or "next week" - never assume or compute your own date.

You can take real actions on the athlete's schedule using the tools available to you:
- Always call get_day_plan for a date before changing anything for it, or before answering what's planned for a day - never guess an id or assume what's scheduled.
- You can cancel a workout the athlete (or you) added via the library/schedule system with remove_scheduled_workout. You CANNOT remove a day from their ongoing AI-generated training program - there is no way to delete those in this app today. If get_day_plan shows the day is a program_day (not a scheduled_workout), explain that plainly and suggest an alternative, like substituting an exercise, instead of attempting the removal.
- scheduled_workouts has no limit of one per day - if get_day_plan returns more than one for the date and it's not clear which the athlete means, ask before removing anything rather than guessing.
- If get_day_plan comes back with nothing for a date, say so rather than inventing a workout that isn't there.
- To add a themed or one-off workout (e.g. "shoulder day"), first call search_workout_templates. Only call curate_workout_template if nothing suitable already exists. A successful curate_workout_template must always be followed by schedule_workout_template - creating a template alone does not put it on the athlete's calendar.
- Always state plainly, in your reply, exactly what you removed or created and scheduled (name + date). There is no undo, so your reply is the athlete's only confirmation of what happened.${whoopSection}`;

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const topic = `chat-${conversationId}`;
    const tools = buildTools(exerciseNames);
    const ctx: ToolContext = { userId, admin, nameToId, today };

    // deno-lint-ignore no-explicit-any
    const messages: any[] = [
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content as string })),
      { role: 'user' as const, content: message },
    ];

    const startTime = Date.now();
    let finalText = '';
    let exhaustedMidToolUse = false;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      if (Date.now() - startTime > SOFT_DEADLINE_MS) {
        exhaustedMidToolUse = true;
        break;
      }

      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-5',
        max_tokens: 2048,
        thinking: { type: 'disabled' },
        system: systemPrompt,
        tools,
        messages,
      });

      stream.on('text', delta => {
        // Fire-and-forget: broadcast order matches emit order since each call
        // is awaited by the SDK's internal event loop before the next delta
        // fires, but we don't block the stream on the HTTP round-trip here.
        broadcast(topic, 'token', { delta }).catch(err => console.error('broadcast failed', err));
      });

      const response = await stream.finalMessage();

      if (response.stop_reason !== 'tool_use') {
        // A turn can contain more than one text block (narration ahead of
        // each of several tool calls) - concatenate all of them rather than
        // .find()-ing just the first, which would silently drop the rest.
        finalText = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map(block => block.text)
          .join('');
        exhaustedMidToolUse = false;
        break;
      }

      exhaustedMidToolUse = true;
      messages.push({ role: 'assistant', content: response.content });

      // Every tool_use in this turn gets executed, and every result is
      // batched into ONE subsequent user message - the API pairs tool_use/
      // tool_result by id within adjacent turns, and splitting results
      // across multiple messages measurably discourages future parallel
      // tool calls.
      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        try {
          const result = await executeTool(block.name, block.input as Record<string, unknown>, ctx);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
        } catch (err) {
          console.error(`tool ${block.name} failed`, err);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
            is_error: true,
          });
        }
      }
      messages.push({ role: 'user', content: toolResults });
    }

    // The loop only exits mid tool-use via the iteration cap or soft
    // deadline - in that case `finalText` was never assigned (the last turn
    // was a bare tool_use block, not a reply), so a completed mutation is
    // never silently left unconfirmed. Also guards the degenerate case of a
    // normal completion whose final turn happened to carry no text blocks.
    if (exhaustedMidToolUse || !finalText) {
      finalText = FALLBACK_TEXT;
    }

    const { data: assistantRow, error: insertAssistantError } = await admin
      .from('chat_messages')
      .insert({ conversation_id: conversationId, role: 'assistant', content: finalText })
      .select()
      .single();
    if (insertAssistantError) throw insertAssistantError;

    await broadcast(topic, 'done', { message_id: assistantRow.id, content: finalText });

    return json({ message_id: assistantRow.id }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
