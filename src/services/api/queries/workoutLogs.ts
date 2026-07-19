import { useMutation } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import type { Database } from '../../../types/database';

type WorkoutLogInsert = Database['public']['Tables']['workout_logs']['Insert'];
type WorkoutLogSetInsert = Database['public']['Tables']['workout_log_sets']['Insert'];

export function useStartWorkoutLog() {
  return useMutation({
    mutationFn: async (params: { userId: string; programDayId: string | null }) => {
      const insert: WorkoutLogInsert = {
        user_id: params.userId,
        program_day_id: params.programDayId,
      };
      const { data, error } = await supabase
        .from('workout_logs')
        .insert(insert)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useLogSet() {
  return useMutation({
    mutationFn: async (set: WorkoutLogSetInsert) => {
      const { data, error } = await supabase
        .from('workout_log_sets')
        .insert(set)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useCompleteWorkoutLog() {
  return useMutation({
    mutationFn: async (params: { workoutLogId: string; overallRpe?: number }) => {
      const { data, error } = await supabase
        .from('workout_logs')
        .update({ completed_at: new Date().toISOString(), overall_rpe: params.overallRpe })
        .eq('id', params.workoutLogId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  });
}
