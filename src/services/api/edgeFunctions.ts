import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { TrainingGoal, ExperienceLevel, EquipmentType } from '../../types/database';

async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // FunctionsHttpError's own message is just "non-2xx status code" — the
    // actual reason is in the response body our function returned.
    if (error instanceof FunctionsHttpError) {
      let serverMessage: string | null = null;
      try {
        const errorBody = await error.context.json();
        serverMessage = errorBody?.error ?? null;
      } catch {
        // Response body wasn't JSON — fall through to the generic error.
      }
      throw new Error(serverMessage ?? error.message);
    }
    throw error;
  }
  return data as T;
}

export type GenerateProgramInput = {
  goal: TrainingGoal;
  experience_level: ExperienceLevel;
  days_per_week: number;
  /** How many weeks the generated block should run — asked explicitly by
   * the Ask Coach flow before generation, never inferred by the model. */
  weeks_count: number;
  equipment: EquipmentType[];
  injuries_notes: string;
  /** Free-text answer to "what are you trying to accomplish?" — optional,
   * same as injuries_notes. */
  focus_notes: string;
  /** MuscleGroup values (see constants/muscleGroups.ts) the athlete picked
   * to emphasize this program — optional, may be empty. */
  emphasis_muscle_groups: string[];
};

export function generateProgram(input: GenerateProgramInput): Promise<{ program_id: string }> {
  return invokeFunction('generate-program', input);
}

export function deleteAccount(): Promise<void> {
  return invokeFunction('delete-account', {});
}

/** `today` must be the caller's own local-device date (format(new Date(),
 * 'yyyy-MM-dd')) — the edge function runs in UTC with no idea what timezone
 * the athlete is in, and needs a trusted "today" to resolve relative dates
 * ("tomorrow", "this Friday") onto the same scheduled_date convention the
 * rest of the app already uses. */
export function sendChatMessage(
  conversationId: string,
  message: string,
  today: string,
): Promise<{ message_id: string }> {
  return invokeFunction('chat-coach', { conversation_id: conversationId, message, today });
}

/** Mints a one-time OAuth state token server-side and returns WHOOP's
 * authorization URL — see supabase/functions/whoop-oauth-start. */
export function startWhoopConnect(): Promise<{ url: string }> {
  return invokeFunction('whoop-oauth-start', {});
}

/** Mints a one-time OAuth state token server-side and returns Spotify's
 * authorization URL — see supabase/functions/spotify-oauth-start. */
export function startSpotifyConnect(): Promise<{ url: string }> {
  return invokeFunction('spotify-oauth-start', {});
}

export type WhoopSyncResult = {
  cycle_date: string;
  whoop_cycle_id: string;
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
  recovery_score: number | null;
  sleep_performance_pct: number | null;
  strain: number | null;
  hrv_ms: number | null;
  resting_heart_rate: number | null;
  synced_at: string;
};

/** Pulls the caller's latest recovery/sleep/strain from WHOOP and upserts it
 * into whoop_metrics server-side — see supabase/functions/whoop-sync. Only
 * call this when the user is already known to be connected (see
 * useIntegrationConnections); the real read path for display is
 * useWhoopMetrics's direct table read, not this function's response. */
export function syncWhoopMetrics(): Promise<WhoopSyncResult> {
  return invokeFunction('whoop-sync', {});
}

export type SpotifyPlayerAction = 'now_playing' | 'play' | 'pause' | 'next' | 'previous';

/** Spotify's own /me/player response shape, trimmed to the fields a "now
 * playing" widget needs — see supabase/functions/spotify-player. `result` is
 * `null` when nothing is currently playing on any device (Spotify's 204). */
export type SpotifyPlayerResult = {
  action: SpotifyPlayerAction;
  result: {
    is_playing: boolean;
    progress_ms: number | null;
    item: {
      name: string;
      duration_ms: number;
      artists: { name: string }[];
      album: { images: { url: string }[] };
    } | null;
  } | null;
};

/** Reads or controls Spotify playback via the caller's stored tokens — see
 * supabase/functions/spotify-player. Only call this when the user is
 * already known to be connected (see useIntegrationConnections); the client
 * never sees the Spotify access token itself. */
export function spotifyPlayerAction(action: SpotifyPlayerAction): Promise<SpotifyPlayerResult> {
  return invokeFunction('spotify-player', { action });
}

export type SpotifyPlaylistSummary = {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number;
  ownerName: string | null;
};

/** Lists the caller's Spotify playlists — see
 * supabase/functions/spotify-playlists. Only call this when the user is
 * already known to be connected (see useIntegrationConnections). */
export function fetchSpotifyPlaylists(): Promise<{ playlists: SpotifyPlaylistSummary[] }> {
  return invokeFunction('spotify-playlists', {});
}
