import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

async function fetchOrCreateConversation(userId: string) {
  const { data: existing, error: selectError } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from('chat_conversations')
    .insert({ user_id: userId })
    .select()
    .single();
  if (insertError) throw insertError;
  return created;
}

export function useConversation(userId: string | null) {
  return useQuery({
    queryKey: ['chat_conversation', userId],
    queryFn: () => fetchOrCreateConversation(userId as string),
    enabled: userId != null,
  });
}

async function fetchMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['chat_messages', conversationId],
    queryFn: () => fetchMessages(conversationId as string),
    enabled: conversationId != null,
  });
}

export function useInvalidateMessages(conversationId: string | null) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['chat_messages', conversationId] });
}
