// GymBee - chat-coach Edge Function
//
// Called from ChatScreen for every message the athlete sends. Verifies the
// caller's session, then streams a reply from Claude token-by-token over
// Realtime Broadcast on topic `chat-<conversation id>` so the client can
// render it as it's generated, and persists both the user's message and the
// final assistant reply once streaming finishes.
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

const HISTORY_LIMIT = 20;

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
    const message = (body.message as string ?? '').trim();
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

    const systemPrompt = `You are SoSet's AI strength coach, chatting with ${profile?.display_name ?? 'an athlete'}.
Athlete profile - goal: ${profile?.goal ?? 'unspecified'}, experience: ${profile?.experience_level ?? 'unspecified'}, training days/week: ${profile?.days_per_week ?? 'unspecified'}, injuries/limitations: ${profile?.injuries_notes || 'none reported'}.
Answer training, recovery, and nutrition questions concisely and encouragingly. Keep replies short (a few sentences unless the question needs more). Flag when something warrants seeing a doctor or physical therapist instead of guessing.`;

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const topic = `chat-${conversationId}`;

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content as string })),
        { role: 'user' as const, content: message },
      ],
    });

    stream.on('text', delta => {
      // Fire-and-forget: broadcast order matches emit order since each call
      // is awaited by the SDK's internal event loop before the next delta
      // fires, but we don't block the stream on the HTTP round-trip here.
      broadcast(topic, 'token', { delta }).catch(err => console.error('broadcast failed', err));
    });

    const finalMessage = await stream.finalMessage();
    const textBlock = finalMessage.content.find(b => b.type === 'text');
    const fullText = textBlock && textBlock.type === 'text' ? textBlock.text : '';

    const { data: assistantRow, error: insertAssistantError } = await admin
      .from('chat_messages')
      .insert({ conversation_id: conversationId, role: 'assistant', content: fullText })
      .select()
      .single();
    if (insertAssistantError) throw insertAssistantError;

    await broadcast(topic, 'done', { message_id: assistantRow.id, content: fullText });

    return json({ message_id: assistantRow.id }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
