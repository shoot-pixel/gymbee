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
  equipment: EquipmentType[];
  injuries_notes: string;
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
