import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { syncWhoopMetrics } from '../edgeFunctions';
import type { Database } from '../../../types/database';

type WhoopMetricsRow = Database['public']['Tables']['whoop_metrics']['Row'];

async function fetchLatestWhoopMetrics(userId: string): Promise<WhoopMetricsRow | null> {
  const { data, error } = await supabase
    .from('whoop_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('cycle_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Cheap direct read of the last-synced row — this is the primary path the
 * Stats screen renders from, so a visit never blocks on a live Whoop API
 * round-trip. Pair with useSyncWhoopMetrics to refresh it in the background.
 */
export function useWhoopMetrics(userId: string | null) {
  return useQuery({
    queryKey: ['whoopMetrics', userId],
    queryFn: () => fetchLatestWhoopMetrics(userId as string),
    enabled: userId != null,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Triggers a live Whoop sync (token refresh + API fetch + upsert) and
 * invalidates useWhoopMetrics's cache on success so the cheap read picks up
 * the fresh row. Meant to run in the background (e.g. on screen focus) — a
 * failure here should never block rendering, since a cached row is already
 * showing.
 */
export function useSyncWhoopMetrics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => syncWhoopMetrics().then(result => ({ userId, result })),
    onSuccess: ({ userId }) => {
      queryClient.invalidateQueries({ queryKey: ['whoopMetrics', userId] });
    },
  });
}
