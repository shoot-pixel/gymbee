import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import RNFS from 'react-native-fs';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../supabaseClient';
import { fetchFriendIds, fetchPublicProfiles } from './community';
import type { Database, PostVisibility } from '../../../types/database';

export type Post = Database['public']['Tables']['posts']['Row'];
export type FriendPost = Post & { displayName: string | null; avatarUrl: string | null };

type PhotoInput = { uri: string; contentType: string };

type CreatePhotoPostParams =
  | { mode: 'progress'; visibility: PostVisibility; caption: string | null; photo: PhotoInput }
  | {
      mode: 'before_after';
      visibility: PostVisibility;
      caption: string | null;
      beforePhoto: PhotoInput;
      afterPhoto: PhotoInput;
    };

/**
 * `{userId}/{visibility}/{filename}` — visibility is encoded directly in
 * the storage path so Storage RLS (post_photos_friends_select) never needs
 * to join back to the posts table to know whether a given file is private.
 */
export function buildPostPhotoPath(userId: string, visibility: PostVisibility, extension: string): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${userId}/${visibility}/${unique}.${extension}`;
}

function extensionFromContentType(contentType: string): string {
  return contentType.split('/')[1] ?? 'jpg';
}

async function uploadPostPhoto(userId: string, visibility: PostVisibility, photo: PhotoInput): Promise<string> {
  const path = buildPostPhotoPath(userId, visibility, extensionFromContentType(photo.contentType));
  // `fetch(uri).arrayBuffer()` on a local file:// URI is unreliable in
  // release iOS builds — it can reject with "Network request failed" (this
  // screen's reported bug) or hang indefinitely. Read the file natively
  // instead, matching the avatar upload fix in profiles.ts.
  const base64 = await RNFS.readFile(photo.uri, 'base64');
  const { error } = await supabase.storage
    .from('post-photos')
    .upload(path, decode(base64), { contentType: photo.contentType });
  if (error) throw error;
  return path;
}

export function useCreatePhotoPost(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: CreatePhotoPostParams) => {
      if (!userId) throw new Error('Not signed in');

      if (params.mode === 'progress') {
        const photoPath = await uploadPostPhoto(userId, params.visibility, params.photo);
        const { error } = await supabase.from('posts').insert({
          user_id: userId,
          post_type: 'progress_photo',
          visibility: params.visibility,
          caption: params.caption,
          photo_path: photoPath,
        });
        if (error) throw error;
        return;
      }

      const [beforePhotoPath, afterPhotoPath] = await Promise.all([
        uploadPostPhoto(userId, params.visibility, params.beforePhoto),
        uploadPostPhoto(userId, params.visibility, params.afterPhoto),
      ]);
      const { error } = await supabase.from('posts').insert({
        user_id: userId,
        post_type: 'before_after_photo',
        visibility: params.visibility,
        caption: params.caption,
        before_photo_path: beforePhotoPath,
        after_photo_path: afterPhotoPath,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', userId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Reading posts back — RLS on `posts` already guarantees a private post is
// only ever returned to its owner, so these queries need no client-side
// visibility filtering: the same fetchUserPosts works for "my own profile"
// (owner sees everything) and "a friend's profile" (their private posts are
// silently excluded server-side).
// ---------------------------------------------------------------------------

async function fetchUserPosts(userId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export function useUserPosts(userId: string | null) {
  return useQuery({
    queryKey: ['posts', userId],
    queryFn: () => fetchUserPosts(userId as string),
    enabled: userId != null,
  });
}

const FRIENDS_POSTS_LIMIT = 60;

/** No pagination yet — same scope-limit call feed.ts's FEED_LIMIT made, just posts-only now. */
async function fetchFriendsPosts(userId: string): Promise<FriendPost[]> {
  const friendIds = await fetchFriendIds(userId);
  if (friendIds.length === 0) return [];

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .in('user_id', friendIds)
    .order('created_at', { ascending: false })
    .limit(FRIENDS_POSTS_LIMIT);
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

/** Backs both Home's 3-post preview and the Community "Posts" grid — one query, sliced differently by each caller. */
export function useFriendsPosts(userId: string | null) {
  return useQuery({
    queryKey: ['friendsPosts', userId],
    queryFn: () => fetchFriendsPosts(userId as string),
    enabled: userId != null,
  });
}

/** Every storage path a post references, for batching into a single useSignedPhotoUrls call. */
export function postPhotoPaths(post: Post): string[] {
  if (post.post_type === 'progress_photo') return post.photo_path ? [post.photo_path] : [];
  return [post.before_photo_path, post.after_photo_path].filter((p): p is string => p != null);
}

async function fetchPost(postId: string): Promise<Post | null> {
  const { data, error } = await supabase.from('posts').select('*').eq('id', postId).maybeSingle();
  if (error) throw error;
  return data;
}

export function usePost(postId: string | null) {
  return useQuery({
    queryKey: ['post', postId],
    queryFn: () => fetchPost(postId as string),
    enabled: postId != null,
  });
}

async function fetchSignedPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from('post-photos').createSignedUrls(paths, 3600);
  if (error) throw error;
  const result: Record<string, string> = {};
  for (const item of data) {
    if (item.signedUrl && item.path) result[item.path] = item.signedUrl;
  }
  return result;
}

/** One batched signed-URL request for however many photo paths a screen needs, not one request per photo. */
export function useSignedPhotoUrls(paths: string[]) {
  const key = [...paths].sort().join(',');
  return useQuery({
    queryKey: ['signedPhotoUrls', key],
    queryFn: () => fetchSignedPhotoUrls(paths),
    enabled: paths.length > 0,
    // Signed URLs are valid for the 3600s requested above — treat them as
    // fresh for a while so switching screens doesn't re-request the same URLs.
    staleTime: 30 * 60 * 1000,
  });
}
