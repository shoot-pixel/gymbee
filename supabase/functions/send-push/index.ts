// SetSocial - send-push Edge Function
//
// The single fan-in point for every push notification the app sends. Never
// called by the client — only by Postgres triggers (via push_dispatch() in
// 0043_push_notifications.sql / 0044_push_batching.sql, over pg_net) and by
// generate-program on completion. Each caller passes a `type` plus just
// enough ids to look everything else up; this function resolves the
// recipient, checks their per-category preference, builds the title/body
// from the templates in the reviewed design spec, and posts to APNs
// directly over HTTP/2 (Deno's fetch negotiates HTTP/2 via ALPN
// automatically — no APNs SDK needed).
//
// Deploy: Supabase Dashboard -> Edge Functions -> Create a new function
// named "send-push" -> paste this whole file -> Deploy. Requires these
// secrets (Dashboard -> Edge Functions -> Secrets):
//   APNS_TEAM_ID       - Apple Developer Team ID
//   APNS_KEY_ID        - Key ID of the APNs Auth Key (.p8)
//   APNS_PRIVATE_KEY   - full contents of the .p8 file, PEM-encoded
//   APNS_BUNDLE_ID     - defaults to com.soset.app if unset
//   APNS_ENVIRONMENT   - 'sandbox' (default) or 'production'
// Also requires, run once against the database (see 0043's header comment):
//   alter database postgres set app.settings.supabase_functions_url = '...';
//   alter database postgres set app.settings.service_role_key = '...';
// Until secrets + those two settings are all in place, calls here either
// no-op (pg_net side) or fail closed (APNs 403, logged, no throw) — nothing
// crashes, notifications just don't go out yet.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID')!;
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID')!;
const APNS_PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY')!;
const APNS_BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID') || 'com.soset.app';
const APNS_ENVIRONMENT = Deno.env.get('APNS_ENVIRONMENT') || 'sandbox';
const APNS_HOST = APNS_ENVIRONMENT === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';

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

function truncate(text: string, max: number): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

type Admin = SupabaseClient;

type ResolvedNotification = {
  recipientId: string;
  title: string;
  body: string;
  screen: string;
  params: Record<string, unknown>;
  collapseId?: string;
  priority: '5' | '10';
  interruptionLevel: 'passive' | 'active' | 'time-sensitive';
};

// ---------------------------------------------------------------------------
// APNs auth (JWT, ES256) — signed with Web Crypto directly rather than a
// dependency; APNs auth tokens are reusable for up to an hour, so this is
// cached at module scope and only re-signed once it's ~50 minutes old.

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let cachedJwt: { token: string; issuedAt: number } | null = null;

async function getApnsJwt(): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (cachedJwt && nowSeconds - cachedJwt.issuedAt < 50 * 60) return cachedJwt.token;

  const signingInput = `${base64url(JSON.stringify({ alg: 'ES256', kid: APNS_KEY_ID }))}.${base64url(
    JSON.stringify({ iss: APNS_TEAM_ID, iat: nowSeconds }),
  )}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(APNS_PRIVATE_KEY),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  // WebCrypto's ECDSA sign() returns the raw (r || s) IEEE P1363 signature,
  // which is exactly the format JOSE's ES256 wants — no DER re-encoding.
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput));

  const jwt = `${signingInput}.${base64url(signature)}`;
  cachedJwt = { token: jwt, issuedAt: nowSeconds };
  return jwt;
}

async function sendApns(admin: Admin, deviceToken: string, n: ResolvedNotification) {
  const jwt = await getApnsJwt();
  const headers: Record<string, string> = {
    authorization: `bearer ${jwt}`,
    'apns-topic': APNS_BUNDLE_ID,
    'apns-push-type': 'alert',
    'apns-priority': n.priority,
    'content-type': 'application/json',
  };
  if (n.collapseId) headers['apns-collapse-id'] = n.collapseId;

  const res = await fetch(`https://${APNS_HOST}/3/device/${deviceToken}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      aps: {
        alert: { title: n.title, body: n.body },
        sound: 'default',
        'interruption-level': n.interruptionLevel,
      },
      screen: n.screen,
      params: n.params,
    }),
  });

  if (!res.ok) {
    const reason = await res.text();
    console.error('APNs send failed', res.status, reason);
    // Apple reports a dead token either way — clean it up so future sends
    // (and the recipient's token count) don't keep carrying dead weight.
    if (res.status === 410 || reason.includes('BadDeviceToken') || reason.includes('Unregistered')) {
      await admin.from('push_tokens').delete().eq('token', deviceToken);
    }
  }
}

// ---------------------------------------------------------------------------
// Per-type resolvers — each turns a trigger's minimal payload into the
// actual recipient + copy, or null if the push should be skipped (category
// disabled, no data left to report, etc). Names fall back display_name ->
// handle -> 'Someone' since either profile field can be null.

async function profileName(admin: Admin, userId: string): Promise<string> {
  const { data } = await admin.from('profiles').select('display_name, handle').eq('id', userId).single();
  return data?.display_name ?? data?.handle ?? 'Someone';
}

async function resolveMessage(admin: Admin, payload: Record<string, unknown>): Promise<ResolvedNotification | null> {
  const { data: message } = await admin
    .from('dm_messages')
    .select('sender_id, conversation_id, body')
    .eq('id', payload.message_id as string)
    .single();
  if (!message) return null;

  const { data: conversation } = await admin
    .from('dm_conversations')
    .select('requester_id, recipient_id')
    .eq('id', message.conversation_id)
    .single();
  if (!conversation) return null;

  const recipientId = conversation.requester_id === message.sender_id ? conversation.recipient_id : conversation.requester_id;

  const { data: recipient } = await admin.from('profiles').select('push_messages_enabled').eq('id', recipientId).single();
  if (!recipient?.push_messages_enabled) return null;

  return {
    recipientId,
    title: await profileName(admin, message.sender_id),
    body: message.body ? truncate(message.body, 80) : '📷 Sent a photo',
    screen: 'Conversation',
    params: { conversationId: message.conversation_id },
    collapseId: `conversation-${message.conversation_id}`,
    priority: '10',
    interruptionLevel: 'time-sensitive',
  };
}

async function friendRequestBody(admin: Admin, addresseeId: string, requesterId: string, requesterName: string): Promise<string> {
  const { count } = await admin
    .from('friend_requests')
    .select('id', { count: 'exact', head: true })
    .eq('addressee_id', addresseeId)
    .eq('status', 'pending');
  const total = count ?? 1;
  if (total <= 1) return `${requesterName} wants to connect on SetSocial`;

  const { data: others } = await admin
    .from('friend_requests')
    .select('requester_id')
    .eq('addressee_id', addresseeId)
    .eq('status', 'pending')
    .neq('requester_id', requesterId)
    .order('created_at', { ascending: false })
    .limit(1);
  const secondName = others?.[0] ? await profileName(admin, others[0].requester_id) : 'someone else';

  if (total === 2) return `${requesterName} and ${secondName} want to connect`;
  const remaining = total - 2;
  return `${requesterName}, ${secondName}, and ${remaining} other${remaining === 1 ? '' : 's'} want to connect`;
}

async function resolveFriendRequest(admin: Admin, payload: Record<string, unknown>): Promise<ResolvedNotification | null> {
  const { data: request } = await admin
    .from('friend_requests')
    .select('requester_id, addressee_id')
    .eq('id', payload.request_id as string)
    .single();
  if (!request) return null;

  const { data: recipient } = await admin.from('profiles').select('push_friends_enabled').eq('id', request.addressee_id).single();
  if (!recipient?.push_friends_enabled) return null;

  const requesterName = await profileName(admin, request.requester_id);

  return {
    recipientId: request.addressee_id,
    title: 'New friend request',
    body: await friendRequestBody(admin, request.addressee_id, request.requester_id, requesterName),
    screen: 'FriendsList',
    params: { userId: request.addressee_id, title: 'Friends' },
    collapseId: `friend-requests-${request.addressee_id}`,
    priority: '10',
    interruptionLevel: 'active',
  };
}

async function resolveFriendRequestAccepted(admin: Admin, payload: Record<string, unknown>): Promise<ResolvedNotification | null> {
  const { data: request } = await admin
    .from('friend_requests')
    .select('requester_id, addressee_id')
    .eq('id', payload.request_id as string)
    .single();
  if (!request) return null;

  const { data: recipient } = await admin.from('profiles').select('push_friends_enabled').eq('id', request.requester_id).single();
  if (!recipient?.push_friends_enabled) return null;

  const acceptorName = await profileName(admin, request.addressee_id);

  return {
    recipientId: request.requester_id,
    title: `${acceptorName} accepted your request`,
    body: "You're connected — check out their profile and PRs",
    screen: 'FriendProfile',
    params: { userId: request.addressee_id },
    priority: '10',
    interruptionLevel: 'active',
  };
}

async function resolvePostLike(admin: Admin, payload: Record<string, unknown>): Promise<ResolvedNotification | null> {
  const postId = payload.post_id as string;
  const ownerId = payload.owner_id as string;

  const { data: owner } = await admin.from('profiles').select('push_activity_enabled').eq('id', ownerId).single();
  if (!owner?.push_activity_enabled) return null;

  const { data: likers, count } = await admin
    .from('post_likes')
    .select('user_id', { count: 'exact' })
    .eq('post_id', postId)
    .neq('user_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(1);
  const total = count ?? 0;
  if (total === 0 || !likers?.[0]) return null;

  const likerName = await profileName(admin, likers[0].user_id);
  const { data: post } = await admin.from('posts').select('caption').eq('id', postId).single();

  return {
    recipientId: ownerId,
    title: total === 1 ? `${likerName} liked your photo` : `${likerName} and ${total - 1} other${total - 1 === 1 ? '' : 's'} liked your photo`,
    body: post?.caption ? truncate(post.caption, 80) : 'Your photo is getting love 🔥',
    screen: 'PostDetail',
    params: { postId },
    collapseId: `post-activity-${postId}`,
    priority: '5',
    interruptionLevel: 'passive',
  };
}

async function resolvePostComment(admin: Admin, payload: Record<string, unknown>): Promise<ResolvedNotification | null> {
  const postId = payload.post_id as string;
  const ownerId = payload.owner_id as string;

  const { data: owner } = await admin.from('profiles').select('push_activity_enabled').eq('id', ownerId).single();
  if (!owner?.push_activity_enabled) return null;

  const { data: comments } = await admin
    .from('post_comments')
    .select('user_id, body')
    .eq('post_id', postId)
    .neq('user_id', ownerId)
    .gte('created_at', payload.window_start as string)
    .order('created_at', { ascending: true });
  if (!comments || comments.length === 0) return null;

  let title: string;
  let body: string;
  if (comments.length === 1) {
    title = `${await profileName(admin, comments[0].user_id)} commented on your photo`;
    body = `"${truncate(comments[0].body, 80)}"`;
  } else {
    title = `${comments.length} new comments on your photo`;
    const { data: post } = await admin.from('posts').select('caption').eq('id', postId).single();
    body = post?.caption ? truncate(post.caption, 80) : 'Catch up on what people are saying';
  }

  return {
    recipientId: ownerId,
    title,
    body,
    screen: 'PostDetail',
    params: { postId },
    collapseId: `post-activity-${postId}`,
    priority: '10',
    interruptionLevel: 'active',
  };
}

async function resolveAiProgramReady(admin: Admin, payload: Record<string, unknown>): Promise<ResolvedNotification | null> {
  const userId = payload.user_id as string;
  const { data: profile } = await admin.from('profiles').select('push_ai_coach_enabled').eq('id', userId).single();
  if (!profile?.push_ai_coach_enabled) return null;

  return {
    recipientId: userId,
    title: "Your program's ready",
    body: "This week's plan is adjusted for your recovery — take a look",
    screen: 'ProgramDetail',
    params: payload.program_id ? { programId: payload.program_id } : {},
    priority: '10',
    interruptionLevel: 'active',
  };
}

const RESOLVERS: Record<string, (admin: Admin, payload: Record<string, unknown>) => Promise<ResolvedNotification | null>> = {
  message: resolveMessage,
  friend_request: resolveFriendRequest,
  friend_request_accepted: resolveFriendRequestAccepted,
  post_like: resolvePostLike,
  post_comment: resolvePostComment,
  ai_program_ready: resolveAiProgramReady,
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload = await req.json();
    const type = payload.type as string;

    const resolve = RESOLVERS[type];
    if (!resolve) return json({ error: `Unknown notification type: ${type}` }, 400);

    const notification = await resolve(admin, payload);
    if (!notification) return json({ skipped: true }, 200);

    const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', notification.recipientId);
    if (!tokens || tokens.length === 0) return json({ skipped: true, reason: 'no_tokens' }, 200);

    await Promise.all(tokens.map(t => sendApns(admin, t.token, notification)));

    return json({ sent: tokens.length }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
