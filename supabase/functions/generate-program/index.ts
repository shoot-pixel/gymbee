// GymBee - generate-program Edge Function
//
// Called by the app right after onboarding. Verifies the caller's session,
// asks Claude to design a periodized training block constrained to the
// already-seeded exercise library, then writes the full program tree
// (programs -> program_weeks -> program_days -> program_exercises) and marks
// the profile's onboarding as complete - all server-side via the service-role
// client, so the Anthropic key and the write path never touch the client app.
//
// Deploy: Supabase Dashboard -> Edge Functions -> Create a new function named
// "generate-program" -> paste this whole file -> Deploy. Then set the secret:
// Dashboard -> Edge Functions -> Secrets -> ANTHROPIC_API_KEY.

import { createClient } from 'npm:@supabase/supabase-js';
import Anthropic from 'npm:@anthropic-ai/sdk';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Deliberately not model-authored: the Edge Function owns weekly scheduling
// so every program matches the exact 7-rows-per-week shape (training days +
// explicit rest days) that Today/Calendar already assume from Milestone 3.
const WEEKDAY_PATTERNS: Record<number, number[]> = {
  1: [3],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function formatLabel(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// The model's own freeform `title` field routinely drifted from what the
// athlete actually asked for (e.g. asking for a core/obliques block and
// getting back "Advanced Hypertrophy Block", typos included) - constructing
// the title deterministically from the same inputs the athlete already
// confirmed (muscle-group emphasis if given, else the goal, plus the
// days/weeks they picked) guarantees it always matches the request instead
// of trusting free text the model was never actually constrained on.
function buildProgramTitle(params: {
  goal: string;
  emphasisMuscleGroups: string[];
  daysPerWeek: number;
  weeksCount: number;
}): string {
  const { goal, emphasisMuscleGroups, daysPerWeek, weeksCount } = params;
  const labels = emphasisMuscleGroups.map(formatLabel);
  const focusLabel =
    labels.length === 0
      ? formatLabel(goal)
      : labels.length === 1
        ? labels[0]
        : `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`;
  return `${focusLabel} — ${daysPerWeek}x/Week, ${weeksCount} Week${weeksCount === 1 ? '' : 's'}`;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    // Scoped to the caller's own JWT - used only to verify who's asking.
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Invalid session' }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const goal = body.goal as string;
    const experienceLevel = body.experience_level as string;
    const daysPerWeek = Number(body.days_per_week);
    const weeksCount = Number(body.weeks_count);
    const equipment: string[] = Array.isArray(body.equipment) ? body.equipment : [];
    const injuriesNotes: string = body.injuries_notes ?? '';
    const focusNotes: string = body.focus_notes ?? '';
    const emphasisMuscleGroups: string[] = Array.isArray(body.emphasis_muscle_groups) ? body.emphasis_muscle_groups : [];

    if (!goal || !experienceLevel || !daysPerWeek || daysPerWeek < 1 || daysPerWeek > 7) {
      return json({ error: 'Missing or invalid onboarding fields' }, 400);
    }
    if (!weeksCount || weeksCount < 1 || weeksCount > 16) {
      return json({ error: 'weeks_count must be between 1 and 16' }, 400);
    }

    // Service-role client for every DB write below - bypasses RLS by design;
    // this function is the only place besides the SQL editor that may do
    // that, since it's the trusted server-side path.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: exerciseRows, error: exerciseError } = await admin
      .from('exercises')
      .select('id, name, primary_muscle')
      .eq('is_custom', false);
    if (exerciseError) throw exerciseError;
    if (!exerciseRows || exerciseRows.length === 0) {
      return json({ error: 'Exercise library is empty - seed it before generating programs.' }, 500);
    }

    // When the athlete named muscle groups to emphasize, don't just ask the
    // model to "bias toward" them in prose - a soft instruction is exactly
    // how a core/obliques request still came back with shoulder accessories
    // padded in. Narrow the schema's exercise_name enum to only exercises
    // that actually target one of those muscles, so the model has no legal
    // way to reach outside the requested focus. Falls back to the full
    // catalog only if the emphasis somehow matches nothing (never true for
    // the seeded MUSCLE_GROUPS values, but safe if that ever changes).
    const emphasisSet = new Set(emphasisMuscleGroups.map(g => g.toLowerCase()));
    const emphasisFilteredRows =
      emphasisSet.size > 0 ? exerciseRows.filter(e => emphasisSet.has(String(e.primary_muscle ?? '').toLowerCase())) : [];
    const allowedRows = emphasisFilteredRows.length > 0 ? emphasisFilteredRows : exerciseRows;

    const exerciseNames = allowedRows.map(e => e.name as string);
    const nameToId = new Map(allowedRows.map(e => [(e.name as string).toLowerCase(), e.id as string]));

    const programSchema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        weeks: {
          // Anthropic's structured-output schema rejects minItems/maxItems
          // other than 0 or 1 on arrays, so the exact week/day counts are
          // still enforced via the prompt - but every day's exercises array
          // below gets minItems: 1 (1 is one of the two allowed values),
          // and the plan is validated against weeksCount/daysPerWeek after
          // parsing, before any row is written (see validatePlan below).
          type: 'array',
          items: {
            type: 'object',
            properties: {
              week_number: { type: 'integer' },
              focus: { type: 'string' },
              deload: { type: 'boolean' },
              days: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    exercises: {
                      type: 'array',
                      minItems: 1,
                      items: {
                        type: 'object',
                        properties: {
                          exercise_name: { type: 'string', enum: exerciseNames },
                          target_sets: { type: 'integer' },
                          target_reps_min: { type: 'integer' },
                          target_reps_max: { type: 'integer' },
                          target_rpe: { type: 'number' },
                          rest_seconds: { type: 'integer' },
                          notes: { type: 'string' },
                        },
                        required: ['exercise_name', 'target_sets', 'target_reps_min', 'target_reps_max'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['title', 'exercises'],
                  additionalProperties: false,
                },
              },
            },
            required: ['week_number', 'focus', 'deload', 'days'],
            additionalProperties: false,
          },
        },
      },
      required: ['title', 'weeks'],
      additionalProperties: false,
    };

    const emphasisApplied = emphasisFilteredRows.length > 0;

    const systemPrompt = `You are an expert strength & conditioning coach designing a periodized training block for one athlete.
Only use exercise names copied exactly from the allowed list in the schema - never invent or rename an exercise.
The plan must contain exactly ${weeksCount} week(s), and every week must contain exactly ${daysPerWeek} training day(s) - do not include rest days, those are scheduled automatically. Every training day must include at least one exercise - never return a day with an empty exercises list.
${weeksCount >= 4 ? 'Make the final week a lighter deload.' : ''}
Respect any injuries or limitations by avoiding or substituting exercises that would aggravate them.
${
  emphasisApplied
    ? `The allowed exercise list has already been narrowed server-side to only exercises matching the athlete's requested muscle-group emphasis (${emphasisMuscleGroups.join(', ')}) - every name in it is guaranteed to target one of those muscles, so build the entire block from this list alone. Vary the block through sets/reps/tempo/ordering/exercise selection across days and weeks rather than reaching for anything outside the list "for balance" or variety - a focused block is supposed to look focused, not diluted with unrelated muscle groups.`
    : `If the athlete describes what this specific program should accomplish, bias exercise selection, ordering, and volume toward that intent - without dropping other muscle groups to the point of leaving them completely untrained.`
}`;

    const userPrompt = `Athlete profile:
- Goal: ${goal}
- Experience level: ${experienceLevel}
- Training days per week: ${daysPerWeek}
- Program length: ${weeksCount} weeks
- Available equipment: ${equipment.length > 0 ? equipment.join(', ') : 'not specified, assume full gym access'}
- Injuries/limitations: ${injuriesNotes || 'none reported'}
- What this program should accomplish: ${focusNotes || 'not specified - use the goal above'}
- Muscle groups to emphasize: ${emphasisMuscleGroups.length > 0 ? emphasisMuscleGroups.join(', ') : 'no particular emphasis, keep it balanced'}

Design their program now.`;

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    // A fixed budget doesn't scale with what was actually asked for - a
    // bigger weeksCount/daysPerWeek needs proportionally more output tokens,
    // and the structured-output decoder closes the JSON at whatever fit
    // rather than erroring when it runs out, so an undersized budget doesn't
    // fail loudly - it just silently returns fewer weeks than requested
    // (exactly the "returned 1 week, expected 4" failure this replaces).
    // ~220 tokens/exercise (name + sets/reps/rpe/rest/notes + JSON overhead)
    // at up to 8 exercises/day is a deliberately generous estimate, since
    // undershooting reproduces the same bad-data problem in a different guise.
    const ESTIMATED_TOKENS_PER_EXERCISE = 220;
    const MAX_EXERCISES_PER_DAY_ESTIMATE = 8;
    const maxTokens = Math.min(
      Math.max(weeksCount * daysPerWeek * MAX_EXERCISES_PER_DAY_ESTIMATE * ESTIMATED_TOKENS_PER_EXERCISE + 4000, 20000),
      64000,
    );

    // Streamed (not .create()) purely to avoid the SDK's non-streaming
    // timeout guard and Edge Function wall-clock limits on a large,
    // multi-week structured generation - the full JSON is still accumulated
    // and parsed once before any DB writes happen.
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      // deno-lint-ignore no-explicit-any
      ...({
        output_config: { effort: 'high', format: { type: 'json_schema', schema: programSchema } },
      } as any),
    });
    const message = await stream.finalMessage();

    // A clearer, more specific message than the generic week/day-count
    // mismatch below when the real cause is that the budget above still
    // wasn't enough (e.g. an athlete picking the maximum weeks and days at
    // once) - lets the athlete know to shrink the request rather than just
    // "try again" into the same wall.
    if (message.stop_reason === 'max_tokens') {
      throw new Error('That program was too large to generate in one request. Try fewer weeks or fewer days per week.');
    }

    const textBlock = message.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error(`No structured output returned (stop_reason: ${message.stop_reason})`);
    }
    // deno-lint-ignore no-explicit-any
    const plan = JSON.parse(textBlock.text) as any;

    // The model can still under/over-shoot the requested shape despite the
    // prompt's instructions (structured-output schemas can't enforce exact
    // array lengths - see programSchema's comment above). Validate the whole
    // plan before writing anything, rather than discovering a malformed day
    // after it's already on the user's calendar as a "0 exercises" tile.
    if (!Array.isArray(plan.weeks) || plan.weeks.length !== weeksCount) {
      throw new Error(`Coach returned ${plan.weeks?.length ?? 0} week(s), expected ${weeksCount}. Please try again.`);
    }
    for (const week of plan.weeks as any[]) {
      if (!Array.isArray(week.days) || week.days.length !== daysPerWeek) {
        throw new Error(
          `Week ${week.week_number} came back with ${week.days?.length ?? 0} training day(s), expected ${daysPerWeek}. Please try again.`,
        );
      }
      for (const day of week.days as any[]) {
        if (!Array.isArray(day.exercises) || day.exercises.length === 0) {
          throw new Error(`"${day.title}" in week ${week.week_number} came back with no exercises. Please try again.`);
        }
      }
    }

    // Only one program can be `active` at a time (enforced by a partial
    // unique index, migration 0029) - archive whatever's currently active
    // first. Generation used to run exactly once per user, atomically tied
    // to finishing onboarding, so this was never reachable before; it's now
    // a repeatable, user-triggered action from the Programs tab.
    const { error: archiveError } = await admin
      .from('programs')
      .update({ status: 'archived' })
      .eq('user_id', userId)
      .eq('status', 'active');
    if (archiveError) throw archiveError;

    const { data: program, error: programError } = await admin
      .from('programs')
      .insert({
        user_id: userId,
        title: buildProgramTitle({ goal, emphasisMuscleGroups, daysPerWeek, weeksCount }),
        goal,
        source: 'ai_generated',
        status: 'active',
        weeks_count: plan.weeks.length,
        days_per_week: daysPerWeek,
      })
      .select()
      .single();
    // 23505 = unique_violation - a race with another generate/create call
    // landed first, not a real server error.
    if (programError?.code === '23505') {
      return json({ error: 'You already have an active program.' }, 409);
    }
    if (programError) throw programError;

    const trainingDaysOfWeek = WEEKDAY_PATTERNS[daysPerWeek] ?? WEEKDAY_PATTERNS[3];

    // deno-lint-ignore no-explicit-any
    for (const week of plan.weeks as any[]) {
      const { data: weekRow, error: weekError } = await admin
        .from('program_weeks')
        .insert({
          program_id: program.id,
          week_number: week.week_number,
          focus: week.focus,
          deload: week.deload,
        })
        .select()
        .single();
      if (weekError) throw weekError;

      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const isTrainingDay = trainingDaysOfWeek.includes(dayOfWeek);
        const trainingIndex = trainingDaysOfWeek.indexOf(dayOfWeek);
        const planDay = isTrainingDay ? week.days[trainingIndex] : null;

        const { data: dayRow, error: dayError } = await admin
          .from('program_days')
          .insert({
            program_week_id: weekRow.id,
            day_number: dayOfWeek + 1,
            day_of_week: dayOfWeek,
            title: isTrainingDay ? (planDay?.title ?? 'Training Day') : 'Rest',
            is_rest_day: !isTrainingDay,
          })
          .select()
          .single();
        if (dayError) throw dayError;

        if (isTrainingDay && planDay) {
          const exerciseInserts = (planDay.exercises as any[])
            .map((ex, index) => {
              const exerciseId = nameToId.get(String(ex.exercise_name).toLowerCase());
              if (!exerciseId) return null;
              return {
                program_day_id: dayRow.id,
                exercise_id: exerciseId,
                order_index: index,
                target_sets: ex.target_sets,
                target_reps_min: ex.target_reps_min,
                target_reps_max: ex.target_reps_max,
                target_rpe: ex.target_rpe ?? null,
                rest_seconds: ex.rest_seconds ?? null,
                notes: ex.notes ?? null,
              };
            })
            .filter((row): row is NonNullable<typeof row> => row != null);

          if (exerciseInserts.length > 0) {
            const { error: exInsertError } = await admin
              .from('program_exercises')
              .insert(exerciseInserts);
            if (exInsertError) throw exInsertError;
          }
        }
      }
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update({
        goal,
        experience_level: experienceLevel,
        days_per_week: daysPerWeek,
        equipment_access: equipment,
        injuries_notes: injuriesNotes || null,
        onboarding_completed: true,
      })
      .eq('id', userId);
    if (profileError) throw profileError;

    return json({ program_id: program.id }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
