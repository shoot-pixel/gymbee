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

export function sendChatMessage(
  conversationId: string,
  message: string,
): Promise<{ message_id: string }> {
  return invokeFunction('chat-coach', { conversation_id: conversationId, message });
}
