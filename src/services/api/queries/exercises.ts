import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

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
