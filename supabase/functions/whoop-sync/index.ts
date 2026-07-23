// GymBee - whoop-sync Edge Function
//
// Called by the app (Stats tab, on focus) once it already knows the user is
// connected to WHOOP — see useIntegrationConnections in
// src/services/api/queries/integrations.ts. Pulls the latest cycle (for
// strain), recovery, and sleep records from the WHOOP v2 API using the
// caller's stored tokens, refreshing the access token first if it's expired,
// and upserts the result into whoop_metrics (migration 0025) keyed on
// (user_id, cycle_date). Returns the synced row directly so the client can
// update its UI without a second round-trip, but the primary read path is
// the cheap direct table read in useWhoopMetrics — this function only needs
// to succeed in the background; a stale cached row is a fine fallback if it
// doesn't.
//
// Deploy: Supabase Dashboard -> Edge Functions -> Create a new function
// named "whoop-sync" -> paste this whole file -> Deploy. Requires the same
// WHOOP_CLIENT_ID / WHOOP_CLIENT_SECRET secrets as the other whoop-*
// functions. Unlike whoop-oauth-callback, this one is invoked by the app
// itself (supabase.functions.invoke), so it keeps the platform default
// verify_jwt = true — no config.toml entry needed.
//
// WHOOP_TOKEN_URL / WHOOP_API_BASE and the endpoint paths below reflect
// WHOOP's v2 API as of this writing — confirm against your WHOOP Developer
// Dashboard / API docs before relying on this, and update if they've
// changed. In particular: this assumes each collection endpoint returns
// `{ records: [...] }` sorted newest-first, and that a Cycle/Recovery/Sleep
// record's `score` object carries `strain` / `recovery_score` /
// `sleep_performance_percentage` respectively — verify field names live.

import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const WHOOP_CLIENT_ID = Deno.env.get('WHOOP_CLIENT_ID')!;
const WHOOP_CLIENT_SECRET = Deno.env.get('WHOOP_CLIENT_SECRET')!;

const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v2';
// A token this close to expiring is refreshed proactively rather than risking
// a 401 mid-request — the sync round-trip (refresh + 3 fetches + upsert) can
// take a few seconds, so a bare `now()` check could still race an expiry.
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

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

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return typeof err === 'string' ? err : JSON.stringify(err);
}

type WhoopTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

type WhoopCollection<T> = { records: T[] };

type WhoopCycle = {
  id: number | string;
  start: string;
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
  score?: { strain?: number };
};

type WhoopRecovery = {
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
  score?: {
    recovery_score?: number;
    hrv_rmssd_milli?: number;
    resting_heart_rate?: number;
  };
};

type WhoopSleep = {
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
  score?: { sleep_performance_percentage?: number };
};

async function fetchLatest<T>(path: string, accessToken: string): Promise<T | null> {
  const res = await fetch(`${WHOOP_API_BASE}${path}?limit=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`WHOOP API ${path} failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as WhoopCollection<T>;
  return body.records[0] ?? null;
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

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: connection, error: connectionError } = await admin
      .from('integration_connections')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', userData.user.id)
      .eq('provider', 'whoop')
      .maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection?.access_token) {
      return json({ error: 'not_connected' }, 400);
    }

    let accessToken = connection.access_token;
    const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
    if (expiresAt - Date.now() < TOKEN_REFRESH_BUFFER_MS) {
      if (!connection.refresh_token) {
        return json({ error: 'Whoop connection expired. Please reconnect from the app.' }, 401);
      }
      const refreshResponse = await fetch(WHOOP_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: connection.refresh_token,
          client_id: WHOOP_CLIENT_ID,
          client_secret: WHOOP_CLIENT_SECRET,
        }),
      });
      if (!refreshResponse.ok) {
        console.error('WHOOP token refresh failed', refreshResponse.status, await refreshResponse.text());
        return json({ error: 'Whoop connection expired. Please reconnect from the app.' }, 401);
      }
      const refreshed = (await refreshResponse.json()) as WhoopTokenResponse;
      accessToken = refreshed.access_token;
      const { error: updateError } = await admin
        .from('integration_connections')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token ?? connection.refresh_token,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq('user_id', userData.user.id)
        .eq('provider', 'whoop');
      if (updateError) throw updateError;
    }

    const [cycle, recovery, sleep] = await Promise.all([
      fetchLatest<WhoopCycle>('/cycle', accessToken),
      fetchLatest<WhoopRecovery>('/recovery', accessToken),
      fetchLatest<WhoopSleep>('/activity/sleep', accessToken),
    ]);

    if (!cycle) {
      return json({ error: 'No Whoop cycle data available yet' }, 404);
    }

    const row = {
      user_id: userData.user.id,
      cycle_date: cycle.start.slice(0, 10),
      whoop_cycle_id: String(cycle.id),
      score_state: cycle.score_state,
      recovery_score: recovery?.score?.recovery_score ?? null,
      sleep_performance_pct: sleep?.score?.sleep_performance_percentage ?? null,
      strain: cycle.score?.strain ?? null,
      hrv_ms: recovery?.score?.hrv_rmssd_milli ?? null,
      resting_heart_rate: recovery?.score?.resting_heart_rate ?? null,
      synced_at: new Date().toISOString(),
    };

    const { error: upsertError } = await admin
      .from('whoop_metrics')
      .upsert(row, { onConflict: 'user_id,cycle_date' });
    if (upsertError) throw upsertError;

    return json(row, 200);
  } catch (err) {
    console.error(err);
    return json({ error: errorMessage(err) }, 500);
  }
});
