import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { LoadingState, EmptyState, PostThumbnail } from '../../components/core';
import type { Post } from '../../services/api/queries/posts';

const COLUMNS = 3;

type PostsGridProps = {
  posts: Post[];
  /** Signed photo URLs, keyed by storage path — batched upstream, never fetched per-tile. */
  photoUrls: Record<string, string>;
  isLoading: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  onPressPost: (postId: string) => void;
};

/** Full-bleed 3-column grid (Instagram-style) shared by CommunityPostsScreen (friends' posts) and MyPostsScreen (your own). */
export function PostsGrid({ posts, photoUrls, isLoading, emptyTitle, emptyDescription, onPressPost }: PostsGridProps) {
  const { width } = useWindowDimensions();
  const tileSize = width / COLUMNS;

  if (isLoading) return <LoadingState />;
  if (posts.length === 0) {
    return <EmptyState icon="camera" title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {posts.map(post => (
        <View key={post.id} style={{ padding: 1 }}>
          <PostThumbnail
            post={post}
            photoUrl={post.photo_path ? photoUrls[post.photo_path] : undefined}
            beforeUrl={post.before_photo_path ? photoUrls[post.before_photo_path] : undefined}
            afterUrl={post.after_photo_path ? photoUrls[post.after_photo_path] : undefined}
            size={tileSize - 2}
            onPress={() => onPressPost(post.id)}
          />
        </View>
      ))}
    </View>
  );
}
