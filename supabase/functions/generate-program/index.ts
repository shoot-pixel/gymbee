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
    const equipment: string[] = Array.isArray(body.equipment) ? body.equipment : [];
    const injuriesNotes: string = body.injuries_notes ?? '';

    if (!goal || !experienceLevel || !daysPerWeek || daysPerWeek < 1 || daysPerWeek > 7) {
      return json({ error: 'Missing or invalid onboarding fields' }, 400);
    }

    // Service-role client for every DB write below - bypasses RLS by design;
    // this function is the only place besides the SQL editor that may do
    // that, since it's the trusted server-side path.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: exerciseRows, error: exerciseError } = await admin
      .from('exercises')
      .select('id, name')
      .eq('is_custom', false);
    if (exerciseError) throw exerciseError;
    if (!exerciseRows || exerciseRows.length === 0) {
      return json({ error: 'Exercise library is empty - seed it before generating programs.' }, 500);
    }

    const exerciseNames = exerciseRows.map(e => e.name as string);
    const nameToId = new Map(exerciseRows.map(e => [(e.name as string).toLowerCase(), e.id as string]));

    const programSchema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        weeks: {
          // Anthropic's structured-output schema rejects minItems/maxItems
          // other than 0 or 1 on arrays - the 4-6 week / exactly-N-days-per-
          // week constraints are enforced via the prompt instead, and the
          // insert loop below tolerates the model over- or under-shooting.
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

    const systemPrompt = `You are an expert strength & conditioning coach designing a periodized training block for one athlete.
Only use exercise names copied exactly from the allowed list in the schema - never invent or rename an exercise.
Every week must contain exactly ${daysPerWeek} training day(s) - do not include rest days, those are scheduled automatically.
Design a 4-6 week block appropriate to the athlete's goal and experience level. If the block is 4 or more weeks, make the final week a lighter deload.
Respect any injuries or limitations by avoiding or substituting exercises that would aggravate them.`;

    const userPrompt = `Athlete profile:
- Goal: ${goal}
- Experience level: ${experienceLevel}
- Training days per week: ${daysPerWeek}
- Available equipment: ${equipment.length > 0 ? equipment.join(', ') : 'not specified, assume full gym access'}
- Injuries/limitations: ${injuriesNotes || 'none reported'}

Design their program now.`;

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    // Streamed (not .create()) purely to avoid the SDK's non-streaming
    // timeout guard and Edge Function wall-clock limits on a large,
    // multi-week structured generation - the full JSON is still accumulated
    // and parsed once before any DB writes happen.
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 20000,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      // deno-lint-ignore no-explicit-any
      ...({
        output_config: { effort: 'high', format: { type: 'json_schema', schema: programSchema } },
      } as any),
    });
    const message = await stream.finalMessage();

    const textBlock = message.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error(`No structured output returned (stop_reason: ${message.stop_reason})`);
    }
    // deno-lint-ignore no-explicit-any
    const plan = JSON.parse(textBlock.text) as any;

    const { data: program, error: programError } = await admin
      .from('programs')
      .insert({
        user_id: userId,
        title: plan.title,
        goal,
        source: 'ai_generated',
        status: 'active',
        weeks_count: plan.weeks.length,
        days_per_week: daysPerWeek,
      })
      .select()
      .single();
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
