// GymBee - parse-checkin Edge Function
//
// Parses a free-text readiness description ("slept like garbage, 5 hours,
// shoulders are sore") into the same structured fields the manual
// PreWorkoutReviewScreen check-in form collects. This function only parses —
// it never writes to readiness_checkins itself. The client always shows the
// parsed fields back to the athlete as an editable, pre-filled form before
// calling the existing useSubmitReadinessCheckin mutation, so a bad parse is
// always caught before it's saved and the write path stays identical to the
// manual form.
//
// Deliberately no cost/usage gate (unlike chat-coach's free-message limit) —
// this replaces what's already a free manual form, so typing instead of
// tapping shouldn't introduce a new cost.
//
// Deploy: Supabase Dashboard -> Edge Functions -> Create a new function named
// "parse-checkin" -> paste this whole file -> Deploy. Reuses the same
// ANTHROPIC_API_KEY secret as chat-coach/generate-program.

import { createClient } from 'npm:@supabase/supabase-js';
import Anthropic from 'npm:@anthropic-ai/sdk';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Clamps the model's output to the range the manual form's own
 * SegmentedControl(RATING_OPTIONS) enforces (1-5) — structured-output
 * schemas can constrain type but not a numeric range, so an out-of-range or
 * missing value must be handled after parsing, not trusted from the model. */
function clampRating(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(5, Math.max(1, Math.round(value)));
}

function clampSleepHours(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(24, Math.max(0, value));
}

const checkinSchema = {
  type: 'object',
  properties: {
    sleep_hours: { type: ['number', 'null'] },
    sleep_quality: { type: ['integer', 'null'] },
    soreness: { type: ['integer', 'null'] },
    stress: { type: ['integer', 'null'] },
    has_pain: { type: 'boolean' },
    pain_notes: { type: ['string', 'null'] },
  },
  required: ['sleep_hours', 'sleep_quality', 'soreness', 'stress', 'has_pain', 'pain_notes'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You extract structured readiness check-in fields from an athlete's free-text description of how they're feeling before a workout.
- sleep_hours: hours of sleep last night, if mentioned (a plain number, e.g. 7.5). Null if not mentioned.
- sleep_quality: how well they slept, on a 1-5 scale (1 = terrible, 5 = excellent). Infer from language like "slept like garbage" (low) or "slept great" (high). Null if nothing about sleep quality is mentioned or implied.
- soreness: muscle soreness, 1-5 (1 = none, 5 = very sore). Null if not mentioned or implied.
- stress: stress level, 1-5 (1 = very relaxed, 5 = very stressed). Null if not mentioned or implied.
- has_pain: true only if they describe actual pain (not just soreness/fatigue) - joint pain, sharp pain, an injury flare-up, etc.
- pain_notes: a short paraphrase of what they said about the pain, if has_pain is true. Null otherwise.
Only infer a 1-5 value when the text actually supports it - don't invent a number for something never mentioned.`;

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

    const body = await req.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return json({ error: 'Missing check-in text' }, 400);

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
      // deno-lint-ignore no-explicit-any
      ...({
        output_config: { format: { type: 'json_schema', schema: checkinSchema } },
      } as any),
    });

    const textBlock = message.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error(`No structured output returned (stop_reason: ${message.stop_reason})`);
    }
    // deno-lint-ignore no-explicit-any
    const parsed = JSON.parse(textBlock.text) as any;

    return json(
      {
        sleepHours: clampSleepHours(parsed.sleep_hours),
        sleepQuality: clampRating(parsed.sleep_quality),
        soreness: clampRating(parsed.soreness),
        stress: clampRating(parsed.stress),
        hasPain: parsed.has_pain === true,
        painNotes: parsed.has_pain === true && typeof parsed.pain_notes === 'string' ? parsed.pain_notes : null,
      },
      200,
    );
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
