import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import type { ExerciseDefaultMetric } from '../../../types/database';

async function fetchExercises(search: string) {
  let query = supabase.from('exercises').select('*').order('name');
  if (search.trim()) {
    query = query.ilike('name', `%${search.trim()}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export function useExercises(search: string) {
  return useQuery({
    queryKey: ['exercises', search],
    queryFn: () => fetchExercises(search),
  });
}

async function fetchExercise(exerciseId: string) {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('id', exerciseId)
    .single();
  if (error) throw error;
  return data;
}

export function useExercise(exerciseId: string) {
  return useQuery({
    queryKey: ['exercise', exerciseId],
    queryFn: () => fetchExercise(exerciseId),
    enabled: !!exerciseId,
  });
}

/** Custom exercises only need a name + tracked unit + optional demo video
 * from the user — the rest of the (DB-required) library fields get a
 * generic default since they only drive filtering/discovery for the
 * curated library, not a user's own private exercise. */
export function useCreateExercise(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      name: string;
      defaultMetric: ExerciseDefaultMetric;
      demoMediaUrl: string | null;
    }) => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('exercises')
        .insert({
          name: params.name,
          category: 'full_body',
          primary_muscle: 'Custom',
          equipment: 'other',
          is_custom: true,
          created_by: userId,
          default_metric: params.defaultMetric,
          demo_media_url: params.demoMediaUrl,
          demo_media_type: params.demoMediaUrl ? 'video' : null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
  });
}

/** Owner-only edit of a custom exercise (RLS: `exercises_update_own_custom`). */
export function useUpdateExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      exerciseId: string;
      name: string;
      defaultMetric: ExerciseDefaultMetric;
      demoMediaUrl: string | null;
    }) => {
      const { data, error } = await supabase
        .from('exercises')
        .update({
          name: params.name,
          default_metric: params.defaultMetric,
          demo_media_url: params.demoMediaUrl,
          demo_media_type: params.demoMediaUrl ? 'video' : null,
        })
        .eq('id', params.exerciseId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: updated => {
      queryClient.setQueryData(['exercise', updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
  });
}
