import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { startWhoopConnect } from '../edgeFunctions';
import type { Database, IntegrationProvider } from '../../../types/database';

type IntegrationConnectionRow = Database['public']['Tables']['integration_connections']['Row'];

async function fetchIntegrationConnections(userId: string): Promise<IntegrationConnectionRow[]> {
  const { data, error } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

export function useIntegrationConnections(userId: string | null) {
  return useQuery({
    queryKey: ['integrationConnections', userId],
    queryFn: () => fetchIntegrationConnections(userId as string),
    enabled: userId != null,
  });
}

/**
 * Kicks off the WHOOP OAuth handshake: the whoop-oauth-start edge function
 * mints a one-time state token server-side and returns WHOOP's authorization
 * URL, which the caller opens in the system browser. WHOOP redirects back to
 * whoop-oauth-callback (also server-side) to complete the token exchange —
 * the client never sees a client secret or an access/refresh token directly.
 */
export function useStartWhoopConnect() {
  return useMutation({
    mutationFn: () => startWhoopConnect(),
  });
}

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { userId: string; provider: IntegrationProvider }) => {
      const { error } = await supabase
        .from('integration_connections')
        .delete()
        .eq('user_id', params.userId)
        .eq('provider', params.provider);
      if (error) throw error;
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: ['integrationConnections', params.userId] });
    },
  });
}
