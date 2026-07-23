import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { fetchPublicProfiles } from './community';
import type { Database } from '../../../types/database';

export type Comment = Database['public']['Tables']['post_comments']['Row'] & {
  displayName: string | null;
  avatarUrl: string | null;
};

async function fetchComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const authorIds = Array.from(new Set(data.map(row => row.user_id)));
  const profiles = await fetchPublicProfiles(authorIds);
  const profileById = new Map(profiles.map(profile => [profile.id, profile]));

  return data.map(row => ({
    ...row,
    displayName: profileById.get(row.user_id)?.display_name ?? null,
    avatarUrl: profileById.get(row.user_id)?.avatar_url ?? null,
  }));
}

export function useComments(postId: string | null) {
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: () => fetchComments(postId as string),
    enabled: postId != null,
  });
}

export function useCreateComment(postId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      if (!postId || !userId) throw new Error('Not signed in');
      const { error } = await supabase.from('post_comments').insert({ post_id: postId, user_id: userId, body });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    },
  });
}

export function useDeleteComment(postId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    },
  });
}
