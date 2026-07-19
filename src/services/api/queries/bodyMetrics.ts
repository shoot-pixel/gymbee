import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import type { Database } from '../../../types/database';

type BodyMetricRow = Database['public']['Tables']['body_metrics']['Row'];

async function fetchBodyMetrics(userId: string): Promise<BodyMetricRow[]> {
  const { data, error } = await supabase
    .from('body_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function useBodyMetrics(userId: string | null) {
  return useQuery({
    queryKey: ['bodyMetrics', userId],
    queryFn: () => fetchBodyMetrics(userId as string),
    enabled: userId != null,
  });
}

export function useLogBodyMetric(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { weightKg: number; notes?: string | null }) => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('body_metrics')
        // One row per user per day — logging again today overwrites today's entry.
        .upsert(
          {
            user_id: userId,
            logged_at: new Date().toISOString().slice(0, 10),
            weight_kg: params.weightKg,
            notes: params.notes ?? null,
          },
          { onConflict: 'user_id,logged_at' },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bodyMetrics', userId] });
    },
  });
}
