import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { TrainingGoal, ExperienceLevel, EquipmentType } from '../../types/database';

export type GenerateProgramInput = {
  goal: TrainingGoal;
  experience_level: ExperienceLevel;
  days_per_week: number;
  equipment: EquipmentType[];
  injuries_notes: string;
};

export async function generateProgram(
  input: GenerateProgramInput,
): Promise<{ program_id: string }> {
  const { data, error } = await supabase.functions.invoke('generate-program', { body: input });
  if (error) {
    // FunctionsHttpError's own message is just "non-2xx status code" — the
    // actual reason is in the response body our function returned.
    if (error instanceof FunctionsHttpError) {
      let serverMessage: string | null = null;
      try {
        const body = await error.context.json();
        serverMessage = body?.error ?? null;
      } catch {
        // Response body wasn't JSON — fall through to the generic error.
      }
      throw new Error(serverMessage ?? error.message);
    }
    throw error;
  }
  return data as { program_id: string };
}

export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      let serverMessage: string | null = null;
      try {
        const body = await error.context.json();
        serverMessage = body?.error ?? null;
      } catch {
        // Response body wasn't JSON — fall through to the generic error.
      }
      throw new Error(serverMessage ?? error.message);
    }
    throw error;
  }
}
