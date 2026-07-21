import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import type { Database } from '../../../types/database';

type ScheduledWorkoutRow = Database['public']['Tables']['scheduled_workouts']['Row'];
type ScheduledExerciseRow = Database['public']['Tables']['scheduled_workout_exercises']['Row'];
type ExerciseRow = Database['public']['Tables']['exercises']['Row'];

/** Common shape shared by program_exercises / workout_template_exercises rows
 * — anything with this shape can be copied into a scheduled workout. */
export type ScheduleExerciseInput = {
  exercise_id: string;
  order_index: number;
  target_sets: number;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_load_kg: number | null;
  target_rpe: number | null;
  rest_seconds: number | null;
  notes: string | null;
};

export type ScheduledExerciseWithExercise = ScheduledExerciseRow & {
  exercises: Pick<ExerciseRow, 'id' | 'name' | 'category' | 'primary_muscle'>;
};
export type ScheduledWorkoutTree = ScheduledWorkoutRow & {
  scheduled_workout_exercises: ScheduledExerciseWithExercise[];
};

async function fetchScheduledWorkouts(
  userId: string,
  from: string,
  to: string,
): Promise<ScheduledWorkoutRow[]> {
  const { data, error } = await supabase
    .from('scheduled_workouts')
    .select('*')
    .eq('user_id', userId)
    .gte('scheduled_date', from)
    .lte('scheduled_date', to)
    .order('scheduled_date');

  if (error) throw error;
  return data;
}

export function useScheduledWorkouts(userId: string | null, range: { from: string; to: string }) {
  return useQuery({
    queryKey: ['scheduledWorkouts', userId, range.from, range.to],
    queryFn: () => fetchScheduledWorkouts(userId as string, range.from, range.to),
    enabled: userId != null,
  });
}

async function fetchScheduledWorkout(scheduledWorkoutId: string): Promise<ScheduledWorkoutTree> {
  const { data, error } = await supabase
    .from('scheduled_workouts')
    .select(
      `*,
      scheduled_workout_exercises (
        *,
        exercises ( id, name, category, primary_muscle )
      )`,
    )
    .eq('id', scheduledWorkoutId)
    .order('order_index', { foreignTable: 'scheduled_workout_exercises' })
    .single();

  if (error) throw error;
  return data as ScheduledWorkoutTree;
}

export function useScheduledWorkout(scheduledWorkoutId: string | undefined) {
  return useQuery({
    queryKey: ['scheduledWorkout', scheduledWorkoutId],
    queryFn: () => fetchScheduledWorkout(scheduledWorkoutId as string),
    enabled: scheduledWorkoutId != null,
  });
}

/** The independent-copy operation — the scheduled workout gets its own
 * exercise rows, never a reference back to the source template/program day.
 * Works from either source since both share the same target-column shape. */
export function useCreateScheduledWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      userId: string;
      scheduledDate: string;
      name: string;
      sourceTemplateId?: string | null;
      exercises: ScheduleExerciseInput[];
    }) => {
      const insert: Database['public']['Tables']['scheduled_workouts']['Insert'] = {
        user_id: params.userId,
        scheduled_date: params.scheduledDate,
        name: params.name,
        source_template_id: params.sourceTemplateId ?? null,
      };
      const { data: scheduled, error } = await supabase
        .from('scheduled_workouts')
        .insert(insert)
        .select()
        .single();
      if (error) throw error;

      if (params.exercises.length > 0) {
        const rows: Database['public']['Tables']['scheduled_workout_exercises']['Insert'][] =
          params.exercises.map(ex => ({
            scheduled_workout_id: scheduled.id,
            exercise_id: ex.exercise_id,
            order_index: ex.order_index,
            target_sets: ex.target_sets,
            target_reps_min: ex.target_reps_min,
            target_reps_max: ex.target_reps_max,
            target_load_kg: ex.target_load_kg,
            target_rpe: ex.target_rpe,
            rest_seconds: ex.rest_seconds,
            notes: ex.notes,
          }));
        const { error: exercisesError } = await supabase.from('scheduled_workout_exercises').insert(rows);
        if (exercisesError) throw exercisesError;
      }
      return scheduled;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledWorkouts'] });
    },
  });
}

export function useRescheduleScheduledWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; scheduledDate: string }) => {
      const { data, error } = await supabase
        .from('scheduled_workouts')
        .update({ scheduled_date: params.scheduledDate })
        .eq('id', params.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledWorkouts'] });
    },
  });
}

export function useDeleteScheduledWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('scheduled_workouts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledWorkouts'] });
    },
  });
}
