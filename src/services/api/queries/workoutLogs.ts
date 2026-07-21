import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import type { Database } from '../../../types/database';

type WorkoutLogInsert = Database['public']['Tables']['workout_logs']['Insert'];
type WorkoutLogSetInsert = Database['public']['Tables']['workout_log_sets']['Insert'];

export type WorkoutLogSummary = {
  id: string;
  programDayId: string | null;
  scheduledWorkoutId: string | null;
  startedAt: string;
  completedAt: string;
};

/** Completed workout_logs within a date range (inclusive), keyed by
 * completed_at — used by the Home calendar, streak, and weekly-consistency
 * ring so they all read from the same single fetch. */
async function fetchWorkoutLogsInRange(
  userId: string,
  from: string,
  to: string,
): Promise<WorkoutLogSummary[]> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('id, program_day_id, scheduled_workout_id, started_at, completed_at')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .gte('completed_at', from)
    .lte('completed_at', to)
    .order('completed_at');

  if (error) throw error;
  return data.map(row => ({
    id: row.id,
    programDayId: row.program_day_id,
    scheduledWorkoutId: row.scheduled_workout_id,
    startedAt: row.started_at,
    completedAt: row.completed_at as string,
  }));
}

export function useWorkoutLogsInRange(userId: string | null, range: { from: string; to: string }) {
  return useQuery({
    queryKey: ['workoutLogs', 'range', userId, range.from, range.to],
    queryFn: () => fetchWorkoutLogsInRange(userId as string, range.from, range.to),
    enabled: userId != null,
  });
}

export type CompletedWorkoutLog = {
  id: string;
  completedAt: string;
  title: string;
  rating: number | null;
};

type WorkoutLogWithTitleRow = {
  id: string;
  completed_at: string;
  rating: number | null;
  program_days: { title: string | null } | null;
  scheduled_workouts: { name: string } | null;
};

/** Every completed workout_log ever, for the progress timeline — the only
 * other workout-log hook is range-bounded. Matches the "just fetch it all"
 * convention useLoggedSets/useBodyMetrics already use for all-time data. */
async function fetchAllWorkoutLogs(userId: string): Promise<CompletedWorkoutLog[]> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('id, completed_at, rating, program_days ( title ), scheduled_workouts ( name )')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as WorkoutLogWithTitleRow[];
  return rows.map(row => ({
    id: row.id,
    completedAt: row.completed_at,
    title: row.program_days?.title ?? row.scheduled_workouts?.name ?? 'Workout',
    rating: row.rating,
  }));
}

export function useAllWorkoutLogs(userId: string | null) {
  return useQuery({
    queryKey: ['workoutLogs', 'all', userId],
    queryFn: () => fetchAllWorkoutLogs(userId as string),
    enabled: userId != null,
  });
}

export function useStartWorkoutLog() {
  return useMutation({
    mutationFn: async (params: {
      userId: string;
      programDayId?: string | null;
      scheduledWorkoutId?: string | null;
      variantType?: Database['public']['Tables']['workout_logs']['Row']['variant_type'];
    }) => {
      const insert: WorkoutLogInsert = {
        user_id: params.userId,
        program_day_id: params.programDayId ?? null,
        scheduled_workout_id: params.scheduledWorkoutId ?? null,
        variant_type: params.variantType ?? null,
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

export function useUpdateSet() {
  return useMutation({
    mutationFn: async (params: {
      id: string;
      reps?: number;
      load_kg?: number | null;
      rpe?: number | null;
      completed?: boolean;
    }) => {
      const { id, ...patch } = params;
      const { data, error } = await supabase
        .from('workout_log_sets')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useDeleteSet() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workout_log_sets').delete().eq('id', id);
      if (error) throw error;
    },
  });
}

export function useCompleteWorkoutLog() {
  return useMutation({
    mutationFn: async (params: {
      workoutLogId: string;
      overallRpe?: number;
      notes?: string;
      rating?: number;
    }) => {
      const { data, error } = await supabase
        .from('workout_logs')
        .update({
          completed_at: new Date().toISOString(),
          overall_rpe: params.overallRpe,
          notes: params.notes,
          rating: params.rating,
        })
        .eq('id', params.workoutLogId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  });
}
