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
// SetSocial Pro gate — keep in sync with the paywall copy
// (src/screens/profile/PaywallScreen.tsx) and the approved pricing plan.
// Enforced here, not just client-side, since this is the one call in the
// app with real per-message LLM cost — a client-only check could be
// bypassed by anyone willing to hit the function directly.
const FREE_MESSAGES_PER_MONTH = 3;
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

// deno-lint-ignore no-explicit-any
type AnthropicContentBlock = any;

/** Anthropic's vision API accepts jpeg/png/gif/webp — inferred from the
 * storage path's extension (the client names the file after the picked
 * asset's real content type, same convention buildPostPhotoPath/
 * extensionFromContentType already use for post photos). Defaults to jpeg,
 * which is what react-native-image-picker returns on both platforms at the
 * quality<1 setting the composer's attach flow uses. */
function mediaTypeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/** Chunked String.fromCharCode.apply rather than one call per byte (which
 * measurably adds up over a multi-hundred-KB photo) or a single spread over
 * the whole buffer (same pattern send-push's base64url already avoids —
 * risks blowing the call stack). 8KB chunks stay well under the argument-
 * count ceiling while cutting the call count by ~4 orders of magnitude. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

/** Downloads a photo from the private chat-photos bucket and returns it as
 * an Anthropic image content block, or null if the download fails (a
 * missing/corrupt photo shouldn't crash the whole turn — the model just
 * won't see an image for that message). */
async function fetchImageBlock(admin: SupabaseClient, path: string): Promise<AnthropicContentBlock | null> {
  const { data, error } = await admin.storage.from('chat-photos').download(path);
  if (error || !data) {
    console.error('failed to download chat photo', path, error);
    return null;
  }
  const buffer = await data.arrayBuffer();
  return {
    type: 'image',
    source: { type: 'base64', media_type: mediaTypeFromPath(path), data: arrayBufferToBase64(buffer) },
  };
}

// ---------------------------------------------------------------------------
// Energy math — ported from src/utils/energyBalance.ts. Deno edge functions
// can't import from the RN app's module graph, so this is a deliberate
// duplicate of that file's constants/formulas, same posture as
// estimateOneRepMax just below (also a documented server-side duplicate of
// client math — see 0059_proactive_coach.sql's own comment on it). Keep
// both in sync if the energy formulas ever change.
// ---------------------------------------------------------------------------

const NEAT_BASELINE_CALORIES = 500;
const RESISTANCE_TRAINING_MET = 5.0;
const SEX_ADJUSTMENT: Record<'male' | 'female', number> = { male: 1, female: 0.92 };
const TARGET_NET_CALORIES_BY_GOAL: Record<string, number> = { cut: -500, bulk: 300, maintain: 0 };
const FALLBACK_BMR = 1600;

function calculateAge(birthDate: string, asOf: Date): number {
  const birth = new Date(birthDate);
  let age = asOf.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    asOf.getMonth() > birth.getMonth() || (asOf.getMonth() === birth.getMonth() && asOf.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

function calculateBmr(params: { weightKg: number; heightCm: number; age: number; sex: 'male' | 'female' }): number {
  const base = 10 * params.weightKg + 6.25 * params.heightCm - 5 * params.age;
  return Math.round(params.sex === 'male' ? base + 5 : base - 161);
}

function estimateStrengthSessionCalories(params: { durationMinutes: number; weightKg: number; sex: 'male' | 'female' | null }): number {
  const hours = params.durationMinutes / 60;
  const adjustment = params.sex ? SEX_ADJUSTMENT[params.sex] : 1;
  return Math.round(RESISTANCE_TRAINING_MET * params.weightKg * hours * adjustment);
}

/** yyyy-MM-dd for a given instant in a given IANA zone — the same
 * Intl.DateTimeFormat approach proactive-coach-sweep's localDateParts uses,
 * trimmed to just the key get_energy_stats' day-bucketing needs. */
function localDateKey(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
    instant,
  );
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
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
        "Look up everything for one specific date, checking every source that can put a workout on the calendar: whether it's already completed, an explicit rest/missed override, a one-off scheduled workout, the recurring weekly schedule, and the AI-generated program day - in that priority order (same as the app's own calendar/Home screens). Call this before removing or adding anything for a date, and whenever the athlete asks what's planned for a day - never say nothing is scheduled without calling this first, since a day can be planned via the weekly recurring schedule alone with no scheduled_workouts row at all. This is also the only way to get valid ids for remove_scheduled_workout - never guess or reuse an id from earlier in the conversation.",
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
    {
      name: 'get_workout_stats',
      description:
        "Looks up the athlete's actual logged training history: workouts completed, total sets/volume, recent personal records (PRs), and per-exercise progress (best estimated 1-rep max, most recent working set). Call this whenever the athlete asks about their stats, progress, volume, PRs, or how a specific lift is trending — never guess, estimate, or make up numbers when this tool can answer directly.",
      input_schema: {
        type: 'object',
        properties: {
          exercise_name: {
            type: ['string', 'null'],
            description:
              'Look up progress for one specific exercise (matched by a case-insensitive substring against what the athlete actually logged, so it also works for their own custom exercises not in the shared library), or null for an overall summary across everything logged.',
          },
          days: {
            type: ['integer', 'null'],
            description: 'How many days of history to include. Defaults to 90 if null.',
          },
        },
        required: ['exercise_name', 'days'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      name: 'log_food_estimate',
      description:
        "Records a calorie/macro estimate for food the athlete described or sent a photo of, as a PENDING entry — the athlete still has to confirm or edit it in the app before it counts toward their daily total, so it's fine (encouraged, even) to log your best guess rather than withholding one. If something important is genuinely ambiguous from a photo (e.g. portion size, whether a visible sauce/dressing is included, single vs. double portion), ask ONE short clarifying question in plain text first and wait for the reply instead of calling this — but don't stall on minor uncertainty; call this with your best estimate and a lower confidence instead. Works from a text description alone too, with no photo required.",
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short food name, e.g. "Grilled chicken rice bowl".' },
          calories: { type: 'integer' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            description:
              "high: the food and a reasonable portion are clear from what you were given (an ordinary photo of an identifiable dish, or a caption/reply that states what it is) - this is the default whenever nothing about the estimate is genuinely in question. Routine estimation (exact oil amount, garnish, precise cut) does not by itself drop this to medium. medium: identified, but portion size or preparation is a real guess that could swing the estimate a lot. low: genuinely unsure what this is.",
          },
          // Plain string enum, never `type: ['string', 'null']` + an enum
          // containing `null` — Anthropic's strict tool-schema validator
          // rejects that combination outright ("Invalid schema: enum value
          // ... does not match declared type"), even though it's valid
          // JSON Schema. A required enum with no null option is the fix,
          // not a workaround — model just always picks its best guess.
          meal_type: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'snack'],
            description: "Best guess from context (time of day, what was said/shown) — default to 'snack' if genuinely ambiguous, never omit.",
          },
        },
        required: ['name', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'confidence', 'meal_type'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      name: 'skip_meal',
      description:
        "Records that the athlete is intentionally NOT eating a specific meal today (skipped breakfast, fasting through lunch, etc.) - call this instead of log_food_estimate when they say they're skipping a meal, not when they simply haven't told you about it yet. Stops that meal from looking like an unlogged gap without recording any food or calories.",
      input_schema: {
        type: 'object',
        properties: {
          meal_type: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'snack'],
            description: 'Which meal is being skipped.',
          },
        },
        required: ['meal_type'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      name: 'get_energy_stats',
      description:
        "Looks up the athlete's actual logged calorie intake and burn over a recent day range — daily calories in/out/net, how many days were a deficit vs. a surplus, and average net. Call this whenever they ask how they're doing this week, about their deficit/surplus trend, or anything about recent energy balance — never guess or estimate from earlier turns when this tool can answer directly, same as get_workout_stats for training stats.",
      input_schema: {
        type: 'object',
        properties: {
          days: {
            type: ['integer', 'null'],
            description: 'How many days back to include, most recent first. Defaults to 7 (a week) if null; capped at 14.',
          },
        },
        required: ['days'],
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
  /** Storage path of a photo attached to THIS turn, or null — never a
   * historical photo from earlier in the conversation, even when one was
   * re-embedded into the model's context (see the history-mapping code
   * below). log_food_estimate only ever attributes a photo to the estimate
   * it produces when the athlete actually attached one just now. */
  photoPath: string | null;
  /** Same profile row already fetched once for the system prompt — passed
   * through rather than re-queried, for get_energy_stats' BMR/day-bucketing
   * math. */
  bodyStats: {
    timezone: string;
    nutritionGoal: string;
    heightCm: number | null;
    sex: 'male' | 'female' | null;
    birthDate: string | null;
  };
};

/**
 * Checks every source that can put a workout on this date, matching the
 * app's own single source of truth for "what's the plan for this date"
 * (resolveDayPlan, src/utils/dayPlan.ts) — previously this only checked the
 * AI-generated program and one-off scheduled_workouts, so a day planned
 * purely via the recurring weekly schedule (no scheduled_workouts row at
 * all) came back with nothing found even though Home/Calendar showed a
 * workout. Returns each source separately rather than pre-resolving one
 * winner, so the model can explain *why* when more than one applies (e.g. a
 * one-off swap overriding the usual weekly day) — but the precedence to
 * reason with, same as resolveDayPlan, is: completed > day_override >
 * scheduled_workouts > weekly_recurring > program_day.
 */
async function getDayPlan(input: Record<string, unknown>, ctx: ToolContext) {
  if (!isValidDateString(input.date)) return { error: 'date must be in YYYY-MM-DD format' };
  const date = input.date;
  const target = new Date(`${date}T00:00:00Z`);
  const dayOfWeek = target.getUTCDay();

  // Generous UTC window around the target date, then filtered precisely by
  // the athlete's own local calendar day below — same "wide window, exact
  // local filter" approach already used in proactive-coach-sweep and
  // get_energy_stats for this exact class of "did X happen on date Y in the
  // athlete's own timezone" question.
  const sinceIso = new Date(target.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const untilIso = new Date(target.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: program, error: programError },
    { data: weeklyEntry, error: weeklyError },
    { data: scheduled, error: scheduledError },
    { data: completedLogs, error: logsError },
    { data: override, error: overrideError },
  ] = await Promise.all([
    ctx.admin
      .from('programs')
      .select('start_date, weeks_count, program_weeks ( week_number, program_days ( day_of_week, title, is_rest_day, program_exercises ( exercises ( name ) ) ) )')
      .eq('user_id', ctx.userId)
      .eq('status', 'active')
      .maybeSingle(),
    ctx.admin
      .from('weekly_schedule')
      .select('day_type, workout_templates ( name, workout_template_exercises ( exercises ( name ) ) )')
      .eq('user_id', ctx.userId)
      .eq('day_of_week', dayOfWeek)
      .maybeSingle(),
    ctx.admin
      .from('scheduled_workouts')
      .select('id, name, scheduled_workout_exercises ( exercises ( name ) )')
      .eq('user_id', ctx.userId)
      .eq('scheduled_date', date)
      .limit(20),
    ctx.admin
      .from('workout_logs')
      .select('id, completed_at')
      .eq('user_id', ctx.userId)
      .not('completed_at', 'is', null)
      .gte('completed_at', sinceIso)
      .lt('completed_at', untilIso),
    ctx.admin.from('day_overrides').select('status').eq('user_id', ctx.userId).eq('date', date).maybeSingle(),
  ]);
  if (programError) throw programError;
  if (weeklyError) throw weeklyError;
  if (scheduledError) throw scheduledError;
  if (logsError) throw logsError;
  if (overrideError) throw overrideError;

  // deno-lint-ignore no-explicit-any
  let programDay: any = null;
  if (program) {
    // Ported from getProgramDayForDate (src/services/api/queries/programs.ts)
    // - UTC throughout, since this runs server-side rather than on-device.
    const start = new Date(`${program.start_date}T00:00:00Z`);
    const daysSinceStart = Math.floor((target.getTime() - start.getTime()) / 86_400_000);
    if (daysSinceStart >= 0) {
      const weekNumber = Math.floor(daysSinceStart / 7) + 1;
      if (weekNumber <= program.weeks_count) {
        // deno-lint-ignore no-explicit-any
        const week = (program.program_weeks as any[]).find(w => w.week_number === weekNumber);
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

  const completedWorkoutLogIds = (completedLogs ?? [])
    .filter(log => localDateKey(new Date(log.completed_at as string), ctx.bodyStats.timezone) === date)
    .map(log => log.id);

  // deno-lint-ignore no-explicit-any
  const weeklyTemplate = weeklyEntry?.workout_templates as any;

  return {
    date,
    completed_workout_log_ids: completedWorkoutLogIds,
    day_override: (override?.status as string | undefined) ?? null,
    scheduled_workouts: (scheduled ?? []).map(sw => ({
      id: sw.id,
      name: sw.name,
      // deno-lint-ignore no-explicit-any
      exercises: (sw.scheduled_workout_exercises as any[]).map(e => e.exercises.name),
    })),
    weekly_recurring: weeklyEntry
      ? {
          day_type: weeklyEntry.day_type,
          name: weeklyTemplate?.name ?? null,
          // deno-lint-ignore no-explicit-any
          exercises: (weeklyTemplate?.workout_template_exercises ?? []).map((te: any) => te.exercises.name),
        }
      : null,
    program_day: programDay,
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

/** Epley estimated one-rep max — same formula as the client's
 * estimateOneRepMax (src/services/api/queries/progress.ts), ported here
 * since this runs server-side against the raw tables directly. */
function estimateOneRepMax(loadKg: number, reps: number): number {
  return loadKg * (1 + reps / 30);
}

type LoggedSetRow = {
  reps: number;
  load_kg: number | null;
  logged_at: string;
  exercises: { name: string } | null;
};

async function getWorkoutStats(input: Record<string, unknown>, ctx: ToolContext) {
  const days = typeof input.days === 'number' && input.days > 0 ? Math.min(Math.floor(input.days), 365) : 90;
  const exerciseNameFilter = typeof input.exercise_name === 'string' ? input.exercise_name.toLowerCase() : null;
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data: logs, error: logsError } = await ctx.admin
    .from('workout_logs')
    .select('id')
    .eq('user_id', ctx.userId)
    .not('completed_at', 'is', null)
    .gte('completed_at', cutoff);
  if (logsError) throw logsError;

  // workout_log_sets has no user_id column of its own — RLS (bypassed here
  // by the service-role client) scopes it via workout_logs.user_id instead,
  // so the same join has to be done explicitly with !inner to filter by it.
  const { data: setRows, error: setsError } = await ctx.admin
    .from('workout_log_sets')
    .select('reps, load_kg, logged_at, exercises ( name ), workout_logs!inner ( user_id )')
    .eq('workout_logs.user_id', ctx.userId)
    .eq('completed', true)
    .eq('is_warmup', false)
    .gte('logged_at', cutoff)
    .order('logged_at', { ascending: true });
  if (setsError) throw setsError;
  const sets = (setRows ?? []) as unknown as LoggedSetRow[];

  let totalVolumeKg = 0;
  const bestE1rmByExercise = new Map<string, number>();
  const prEvents: Array<{ exercise_name: string; reps: number; load_kg: number; estimated_1rm_kg: number; achieved_at: string }> = [];
  const exerciseAgg = new Map<
    string,
    { sets: number; bestE1rm: number; latest: { reps: number; load_kg: number | null; logged_at: string } }
  >();

  for (const s of sets) {
    if (s.load_kg != null) totalVolumeKg += s.load_kg * s.reps;
    const name = s.exercises?.name ?? 'Unknown exercise';
    const agg = exerciseAgg.get(name) ?? {
      sets: 0,
      bestE1rm: 0,
      latest: { reps: s.reps, load_kg: s.load_kg, logged_at: s.logged_at },
    };
    agg.sets += 1;
    agg.latest = { reps: s.reps, load_kg: s.load_kg, logged_at: s.logged_at };
    if (s.load_kg != null && s.load_kg > 0) {
      const e1rm = estimateOneRepMax(s.load_kg, s.reps);
      if (e1rm > agg.bestE1rm) agg.bestE1rm = e1rm;
      const priorBest = bestE1rmByExercise.get(name) ?? 0;
      if (e1rm > priorBest) {
        bestE1rmByExercise.set(name, e1rm);
        prEvents.push({
          exercise_name: name,
          reps: s.reps,
          load_kg: s.load_kg,
          estimated_1rm_kg: Math.round(e1rm * 10) / 10,
          achieved_at: s.logged_at,
        });
      }
    }
    exerciseAgg.set(name, agg);
  }

  const exerciseSummary = [...exerciseAgg.entries()]
    .filter(([name]) => !exerciseNameFilter || name.toLowerCase().includes(exerciseNameFilter))
    .sort((a, b) => b[1].sets - a[1].sets)
    .slice(0, exerciseNameFilter ? 1 : 8)
    .map(([name, agg]) => ({
      exercise_name: name,
      sets_logged: agg.sets,
      best_estimated_1rm_kg: agg.bestE1rm > 0 ? Math.round(agg.bestE1rm * 10) / 10 : null,
      most_recent_set: agg.latest,
    }));

  return {
    range_days: days,
    workouts_completed: (logs ?? []).length,
    total_sets_logged: sets.length,
    total_volume_kg: Math.round(totalVolumeKg * 10) / 10,
    recent_prs: prEvents.slice(-5).reverse(),
    exercise_summary: exerciseSummary,
  };
}

const MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
const CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low']);

/** Always inserts status: 'pending' — the athlete confirms or edits in the
 * app before this counts toward their daily total (see 0063_food_photo_
 * logging.sql and EnergyTodayCard's status='confirmed' filter). ctx.
 * photoPath is only ever the CURRENT turn's photo (see ToolContext), so a
 * text-only "log a banana" call correctly stores no photo_path. */
async function logFoodEstimate(input: Record<string, unknown>, ctx: ToolContext) {
  if (typeof input.name !== 'string' || !input.name.trim()) return { error: 'name is required' };
  if (typeof input.calories !== 'number' || input.calories < 0) return { error: 'calories must be a non-negative number' };
  if (typeof input.confidence !== 'string' || !CONFIDENCE_LEVELS.has(input.confidence)) {
    return { error: 'confidence must be high, medium, or low' };
  }
  const mealType = typeof input.meal_type === 'string' && MEAL_TYPES.has(input.meal_type) ? input.meal_type : null;

  const { data: entry, error } = await ctx.admin
    .from('food_log_entries')
    .insert({
      user_id: ctx.userId,
      name: input.name.trim(),
      meal_type: mealType,
      calories: Math.round(input.calories),
      protein_g: typeof input.protein_g === 'number' ? input.protein_g : 0,
      carbs_g: typeof input.carbs_g === 'number' ? input.carbs_g : 0,
      fat_g: typeof input.fat_g === 'number' ? input.fat_g : 0,
      status: 'pending',
      confidence: input.confidence,
      photo_path: ctx.photoPath,
    })
    .select()
    .single();
  if (error) throw error;

  return {
    food_log_entry_id: entry.id,
    name: entry.name,
    calories: entry.calories,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    confidence: entry.confidence,
  };
}

/** Zero-calorie food_log_entries row, status: 'skipped' - the same signal
 * LogFoodScreen's own "Skip this meal" button writes (src/screens/log/
 * LogFoodScreen.tsx). Never counts toward totals (outside the 'confirmed'
 * filter every totals query uses) but does count as "accounted for" in
 * hasLoggedMealToday (proactive-coach-sweep), so the meal-gap reminder
 * stops nagging about it. */
async function skipMeal(input: Record<string, unknown>, ctx: ToolContext) {
  if (typeof input.meal_type !== 'string' || !MEAL_TYPES.has(input.meal_type)) {
    return { error: 'meal_type must be breakfast, lunch, dinner, or snack' };
  }

  const { data: entry, error } = await ctx.admin
    .from('food_log_entries')
    .insert({
      user_id: ctx.userId,
      name: `Skipped ${input.meal_type}`,
      meal_type: input.meal_type,
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      status: 'skipped',
    })
    .select('id')
    .single();
  if (error) throw error;

  return { food_log_entry_id: entry.id, meal_type: input.meal_type };
}

type WorkoutLogForEnergy = {
  started_at: string;
  completed_at: string;
  cardio_log_entries: Array<{ estimated_calories: number }>;
};

/**
 * Returns data only — the model narrates it in its own reply, same "tools
 * read/write real data, Claude composes the sentence" split every other
 * tool here already follows. Never confused with coachingEngine's
 * deterministic Home-card text (src/services/coaching), which stays
 * LLM-free by design; this is the opposite side of that boundary.
 */
async function getEnergyStats(input: Record<string, unknown>, ctx: ToolContext) {
  const requestedDays = typeof input.days === 'number' ? input.days : 7;
  const days = Math.min(14, Math.max(1, Math.round(requestedDays)));
  const { timezone, nutritionGoal, heightCm, sex, birthDate } = ctx.bodyStats;
  const targetNet = TARGET_NET_CALORIES_BY_GOAL[nutritionGoal] ?? 0;

  const { data: latestWeightRow } = await ctx.admin
    .from('body_metrics')
    .select('weight_kg')
    .eq('user_id', ctx.userId)
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const weightKg = (latestWeightRow?.weight_kg as number | null) ?? null;

  const hasEnoughProfileData = weightKg != null && heightCm != null && sex != null && birthDate != null;
  const bmr = hasEnoughProfileData
    ? calculateBmr({ weightKg: weightKg as number, heightCm: heightCm as number, age: calculateAge(birthDate as string, new Date()), sex: sex as 'male' | 'female' })
    : FALLBACK_BMR;
  const baseOut = bmr + NEAT_BASELINE_CALORIES;

  // A couple of days' buffer past the requested range, same "generous
  // window then filter precisely by local day" approach proactive-coach-
  // sweep's fetchCompletedDateKeys already uses.
  const sinceIso = new Date(Date.now() - (days + 2) * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: foodRows }, { data: workoutRows }] = await Promise.all([
    ctx.admin
      .from('food_log_entries')
      .select('logged_at, calories, protein_g')
      .eq('user_id', ctx.userId)
      .eq('status', 'confirmed')
      .gte('logged_at', sinceIso),
    ctx.admin
      .from('workout_logs')
      .select('started_at, completed_at, cardio_log_entries ( estimated_calories )')
      .eq('user_id', ctx.userId)
      .not('completed_at', 'is', null)
      .gte('completed_at', sinceIso),
  ]);

  const byDay = new Map<string, { caloriesIn: number; proteinG: number; workoutOut: number }>();
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = localDateKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000), timezone);
    dayKeys.push(key);
    byDay.set(key, { caloriesIn: 0, proteinG: 0, workoutOut: 0 });
  }

  for (const row of foodRows ?? []) {
    const bucket = byDay.get(localDateKey(new Date(row.logged_at as string), timezone));
    if (!bucket) continue;
    bucket.caloriesIn += (row.calories as number) ?? 0;
    bucket.proteinG += (row.protein_g as number) ?? 0;
  }

  for (const row of (workoutRows ?? []) as WorkoutLogForEnergy[]) {
    const bucket = byDay.get(localDateKey(new Date(row.completed_at), timezone));
    if (!bucket) continue;
    const cardioEntry = row.cardio_log_entries?.[0];
    if (cardioEntry) {
      bucket.workoutOut += cardioEntry.estimated_calories ?? 0;
    } else if (weightKg != null) {
      const minutes = Math.max(0, (new Date(row.completed_at).getTime() - new Date(row.started_at).getTime()) / 60_000);
      bucket.workoutOut += estimateStrengthSessionCalories({ durationMinutes: minutes, weightKg, sex });
    }
  }

  const daily = dayKeys.map(date => {
    const bucket = byDay.get(date)!;
    const caloriesOut = baseOut + bucket.workoutOut;
    return {
      date,
      calories_in: Math.round(bucket.caloriesIn),
      calories_out: Math.round(caloriesOut),
      net: Math.round(bucket.caloriesIn - caloriesOut),
      protein_g: Math.round(bucket.proteinG),
    };
  });

  const daysWithLoggedMeals = daily.filter(d => d.calories_in > 0).length;
  const deficitDays = daily.filter(d => d.net <= 0).length;
  const averageNet = daily.length > 0 ? Math.round(daily.reduce((sum, d) => sum + d.net, 0) / daily.length) : 0;

  return {
    days,
    nutrition_goal: nutritionGoal,
    target_net: targetNet,
    average_net: averageNet,
    deficit_days: deficitDays,
    surplus_days: daily.length - deficitDays,
    days_with_logged_meals: daysWithLoggedMeals,
    daily,
  };
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
    case 'get_workout_stats':
      return getWorkoutStats(input, ctx);
    case 'schedule_workout_template':
      return scheduleWorkoutTemplate(input, ctx);
    case 'log_food_estimate':
      return logFoodEstimate(input, ctx);
    case 'skip_meal':
      return skipMeal(input, ctx);
    case 'get_energy_stats':
      return getEnergyStats(input, ctx);
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
    // Storage path within the private `chat-photos` bucket, already
    // uploaded by the client before this call — a food photo the athlete
    // attached, or undefined for a plain-text message. `message` may be
    // empty when a photo carries no caption.
    const photoPath = typeof body.photo_path === 'string' && body.photo_path.trim() ? body.photo_path.trim() : null;
    // Trusted "today" comes from the client (its own local device time, the
    // same format(new Date(),'yyyy-MM-dd') convention scheduled_date already
    // uses everywhere) - this function runs in UTC with no idea what
    // timezone the athlete is actually in, so computing "today" here would
    // silently write the wrong date for anyone west of UTC late in their day.
    const todayInput = body.today as string;
    const today = isValidDateString(todayInput) ? todayInput : new Date().toISOString().slice(0, 10);
    if (!conversationId || (!message && !photoPath)) {
      return json({ error: 'conversation_id and a message or photo_path are required' }, 400);
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

    // Four independent reads, fetched together rather than one at a time —
    // none of these depend on each other's results, and each round trip was
    // previously adding its own latency to every chat-coach call before the
    // (much more expensive) Anthropic request even starts.
    const [
      { data: profile },
      { data: whoopMetrics },
      { data: historyRows, error: historyError },
      { data: exerciseRows, error: exerciseError },
    ] = await Promise.all([
      admin
        .from('profiles')
        .select(
          'display_name, goal, experience_level, days_per_week, injuries_notes, is_premium, timezone, nutrition_goal, height_cm, sex, birth_date',
        )
        .eq('id', userId)
        .single(),
      // Only present for athletes who've connected + synced Whoop (see
      // supabase/functions/whoop-sync) — absent for everyone else, which is
      // why this is spliced onto the prompt conditionally below rather than
      // folded into the fixed template like the profile fields above.
      admin
        .from('whoop_metrics')
        .select('recovery_score, sleep_performance_pct, strain, score_state, cycle_date')
        .eq('user_id', userId)
        .order('cycle_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('chat_messages')
        .select('role, content, photo_path')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT),
      // Same enum-constrained-exercise-name pattern as generate-program:
      // fetch the real (non-custom) library once, use it to build
      // curate_workout_template's tool schema, and to defensively resolve
      // names -> ids after the fact even though `strict: true` already
      // enforces the enum.
      admin.from('exercises').select('id, name').eq('is_custom', false),
    ]);
    if (historyError) throw historyError;
    if (exerciseError) throw exerciseError;
    const history = (historyRows ?? []).reverse();
    const exerciseNames = (exerciseRows ?? []).map(e => e.name as string);
    const nameToId = new Map((exerciseRows ?? []).map(e => [(e.name as string).toLowerCase(), e.id as string]));

    if (!profile?.is_premium) {
      // Approximate month boundary from the client's own local "today"
      // (see the comment on `today` above) rather than this function's UTC
      // clock — a few hours of slop at the edge of a month is fine for a
      // soft usage cap, and this stays consistent with how `today` is
      // already used everywhere else here.
      const monthStart = `${today.slice(0, 7)}-01`;
      const { count: messagesThisMonth, error: countError } = await admin
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .eq('role', 'user')
        .gte('created_at', monthStart);
      if (countError) throw countError;

      if ((messagesThisMonth ?? 0) >= FREE_MESSAGES_PER_MONTH) {
        return json(
          {
            error: `You've used your ${FREE_MESSAGES_PER_MONTH} free AI Coach messages this month. Upgrade to SetSocial Pro for unlimited access.`,
            code: 'free_limit_reached',
          },
          402,
        );
      }
    }

    const { error: insertUserError } = await admin
      .from('chat_messages')
      .insert({ conversation_id: conversationId, role: 'user', content: message || null, photo_path: photoPath });
    if (insertUserError) throw insertUserError;

    const weekdayName = WEEKDAY_NAMES[new Date(`${today}T00:00:00Z`).getUTCDay()];
    // Only present for athletes who've connected + synced Whoop and whose
    // latest cycle is fully scored — absent for everyone else, so this is
    // appended conditionally rather than folded into the fixed template
    // like the profile fields below.
    const whoopSection =
      whoopMetrics?.score_state === 'SCORED'
        ? `\n\nToday's Whoop data (${whoopMetrics.cycle_date}): recovery ${whoopMetrics.recovery_score}%, sleep performance ${whoopMetrics.sleep_performance_pct ?? 'unknown'}%, strain ${whoopMetrics.strain ?? 'unknown'}. Factor this into training and recovery advice - e.g. favor lighter intensity or extra rest on low-recovery days - and reference these numbers directly if the athlete asks how they're doing.`
        : '';
    const systemPrompt = `You are Arnold, SetSocial's AI strength coach, chatting with ${profile?.display_name ?? 'an athlete'}. If asked your name, you're Arnold.
Athlete profile - goal: ${profile?.goal ?? 'unspecified'}, experience: ${profile?.experience_level ?? 'unspecified'}, training days/week: ${profile?.days_per_week ?? 'unspecified'}, injuries/limitations: ${profile?.injuries_notes || 'none reported'}.
Answer training, recovery, and nutrition questions concisely and encouragingly. Keep replies short (a few sentences unless the question needs more). Flag when something warrants seeing a doctor or physical therapist instead of guessing.

Today is ${today} (${weekdayName}). Use this as "today" when resolving relative dates like "tomorrow", "this Friday", or "next week" - never assume or compute your own date.

You can take real actions on the athlete's schedule using the tools available to you:
- Always call get_day_plan for a date before changing anything for it, or before answering what's planned for a day - never guess an id or assume what's scheduled.
- You can cancel a workout the athlete (or you) added via the library/schedule system with remove_scheduled_workout. You CANNOT remove a day from their ongoing AI-generated training program - there is no way to delete those in this app today. If get_day_plan shows the day is a program_day (not a scheduled_workout), explain that plainly and suggest an alternative, like substituting an exercise, instead of attempting the removal.
- scheduled_workouts has no limit of one per day - if get_day_plan returns more than one for the date and it's not clear which the athlete means, ask before removing anything rather than guessing.
- If get_day_plan comes back with nothing for a date, say so rather than inventing a workout that isn't there.
- To add a themed or one-off workout (e.g. "shoulder day"), first call search_workout_templates. Only call curate_workout_template if nothing suitable already exists. A successful curate_workout_template must always be followed by schedule_workout_template - creating a template alone does not put it on the athlete's calendar.
- Always state plainly, in your reply, exactly what you removed or created and scheduled (name + date). There is no undo, so your reply is the athlete's only confirmation of what happened.
- You DO have access to the athlete's actual logged training history - call get_workout_stats whenever they ask about their stats, progress, volume, PRs, or how a specific lift is trending. Never say you don't have access to their stats or make numbers up - call the tool and report exactly what it returns, and use it to ground any recommendation in what they've actually been doing.
- When the athlete sends a food photo, or just describes something they ate, identify it and call log_food_estimate with your best calorie/macro guess - it only saves as a pending draft they still have to confirm in the app, so a reasonable estimate with honest confidence beats withholding one. A caption sent alongside a photo (e.g. "log this for breakfast, it's two eggs and toast") is real grounding, not just a meal-type hint - let it resolve exactly the ambiguity it addresses rather than estimating as if it weren't there. Ask ONE short clarifying question first only when something genuinely changes the estimate a lot (e.g. dressing on the side vs. mixed in, single vs. double portion) - don't interrogate them over minor uncertainty. Default to high confidence whenever the food and portion are reasonably clear; medium/low are for real ambiguity, not routine estimation. Always say your confidence level and briefly why in your reply, so what you say and the confidence badge they see never disagree.
- When the athlete says they're skipping a meal, fasting through it, or just not eating it - call skip_meal instead of log_food_estimate. It records nothing nutritionally, it just stops that meal from looking like an unlogged gap.
- Whenever the athlete asks how they're doing this week (or any recent stretch), about their deficit/surplus trend, or anything about recent calorie/energy balance, call get_energy_stats and ground your reply in exactly what it returns - call out specific days when it's informative (e.g. a surplus day with an obvious explanation isn't a problem, one day doesn't undo a trend), not just an average. Never estimate or recall this from earlier in the conversation when the tool can answer it directly.${whoopSection}`;

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const topic = `chat-${conversationId}`;
    const tools = buildTools(exerciseNames);
    const ctx: ToolContext = {
      userId,
      admin,
      nameToId,
      today,
      photoPath,
      bodyStats: {
        timezone: (profile?.timezone as string | null) ?? 'UTC',
        nutritionGoal: (profile?.nutrition_goal as string | null) ?? 'maintain',
        heightCm: (profile?.height_cm as number | null) ?? null,
        sex: (profile?.sex as 'male' | 'female' | null) ?? null,
        birthDate: (profile?.birth_date as string | null) ?? null,
      },
    };

    // Only re-embed the SINGLE most recent photo found in history, and only
    // when this turn didn't just bring its own — a clarifying-question
    // follow-up ("is that a single or double patty?") needs the model to
    // still see the photo it asked about, but re-fetching every historical
    // photo on every turn would be wasted work for photos no longer
    // relevant to the conversation.
    const mostRecentPhotoHistoryIndex = photoPath
      ? -1
      : (() => {
          for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].photo_path) return i;
          }
          return -1;
        })();

    // deno-lint-ignore no-explicit-any
    const historyMessages: any[] = [];
    for (let i = 0; i < history.length; i++) {
      const row = history[i];
      const role = row.role as 'user' | 'assistant';
      if (i === mostRecentPhotoHistoryIndex && row.photo_path) {
        const imageBlock = await fetchImageBlock(admin, row.photo_path as string);
        const blocks: AnthropicContentBlock[] = imageBlock ? [imageBlock] : [];
        if (row.content) blocks.push({ type: 'text', text: row.content as string });
        historyMessages.push({ role, content: blocks.length > 0 ? blocks : '[Photo]' });
      } else if (row.photo_path) {
        // A photo existed here but isn't being re-shown to the model this
        // turn — a short marker so it still knows one was part of this
        // exchange, without paying to re-fetch and re-encode it.
        historyMessages.push({ role, content: row.content ? `[Photo] ${row.content}` : '[Photo]' });
      } else {
        historyMessages.push({ role, content: (row.content as string) ?? '' });
      }
    }

    // deno-lint-ignore no-explicit-any
    let currentTurnContent: any;
    if (photoPath) {
      const imageBlock = await fetchImageBlock(admin, photoPath);
      if (!imageBlock) throw new Error('Could not read the attached photo.');
      const blocks: AnthropicContentBlock[] = [imageBlock];
      if (message) blocks.push({ type: 'text', text: message });
      currentTurnContent = blocks;
    } else {
      currentTurnContent = message;
    }

    // deno-lint-ignore no-explicit-any
    const messages: any[] = [...historyMessages, { role: 'user' as const, content: currentTurnContent }];

    const startTime = Date.now();
    let finalText = '';
    let exhaustedMidToolUse = false;
    // Set when log_food_estimate succeeds this turn — attached to the
    // assistant's persisted reply below so the client knows to render
    // FoodEstimateCard instead of plain text for this message.
    let loggedFoodEntryId: string | null = null;

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
          if (block.name === 'log_food_estimate') {
            const foodResult = result as { food_log_entry_id?: unknown };
            if (typeof foodResult.food_log_entry_id === 'string') loggedFoodEntryId = foodResult.food_log_entry_id;
          }
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
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: finalText,
        food_log_entry_id: loggedFoodEntryId,
      })
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
