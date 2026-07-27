import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { LoadingState, EmptyState } from '../../components/core';
import { FeedPostCard } from './FeedPostCard';
import type { FriendPost } from '../../services/api/queries/posts';

type EditorialFeedProps = {
  posts: FriendPost[];
  /** Signed photo URLs, keyed by storage path — batched upstream, never fetched per-card. */
  photoUrls: Record<string, string>;
  /** Batched like/comment counts, keyed by post id — same "fetch once upstream" convention as photoUrls. */
  likeCounts: Record<string, number>;
  commentCounts: Record<string, number>;
  isLoading: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  onPressPost: (postId: string) => void;
  onPressAuthor: (userId: string) => void;
};

/** The "Editorial Feed" — a vertical stream of FeedPostCards, replacing the
 * bare 3-column PostsGrid this screen used to render. */
export function EditorialFeed({
  posts,
  photoUrls,
  likeCounts,
  commentCounts,
  isLoading,
  emptyTitle,
  emptyDescription,
  onPressPost,
  onPressAuthor,
}: EditorialFeedProps) {
  const theme = useTheme();

  if (isLoading) return <LoadingState />;
  if (posts.length === 0) {
    return <EmptyState icon="camera" title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      {posts.map(post => (
        <FeedPostCard
          key={post.id}
          post={post}
          photoUrl={post.photo_path ? photoUrls[post.photo_path] : undefined}
          beforeUrl={post.before_photo_path ? photoUrls[post.before_photo_path] : undefined}
          afterUrl={post.after_photo_path ? photoUrls[post.after_photo_path] : undefined}
          likeCount={likeCounts[post.id] ?? 0}
          commentCount={commentCounts[post.id] ?? 0}
          onPress={() => onPressPost(post.id)}
          onPressAuthor={() => onPressAuthor(post.user_id)}
        />
      ))}
    </View>
  );
}
