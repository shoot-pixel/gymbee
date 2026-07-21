import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Button, EmptyState } from '../../components/core';
import { FriendActivityCard } from './FriendActivityCard';
import { FriendsActivitySkeleton } from './FriendsActivitySkeleton';
import type { FriendPost } from '../../services/api/queries/posts';

type FriendsActivitySectionProps = {
  posts: FriendPost[];
  /** Signed photo URLs, keyed by storage path — batched upstream, never fetched per-card. */
  photoUrls: Record<string, string>;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onCardPress: (post: FriendPost) => void;
  onViewAllPress: () => void;
};

function photoUrlFor(post: FriendPost, photoUrls: Record<string, string>): string | undefined {
  const path = post.post_type === 'progress_photo' ? post.photo_path : post.before_photo_path;
  return path ? photoUrls[path] : undefined;
}

/** Home's preview of friends' recent posts — data fetching lives in TodayScreen, this just renders it (same split WeekTimeline already uses). */
export function FriendsActivitySection({
  posts,
  photoUrls,
  isLoading,
  isError,
  onRetry,
  onCardPress,
  onViewAllPress,
}: FriendsActivitySectionProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="subtitle">Friends Activity</Text>
        {!isLoading && !isError && posts.length > 0 ? (
          <Button
            label="View All"
            variant="ghost"
            size="sm"
            icon="chevronRight"
            iconPosition="trailing"
            onPress={onViewAllPress}
          />
        ) : null}
      </View>

      {isLoading ? (
        <FriendsActivitySkeleton />
      ) : isError ? (
        <EmptyState
          icon="circleAlert"
          title="Couldn't load Friends Activity."
          actionLabel="Retry"
          onAction={onRetry}
        />
      ) : posts.length === 0 ? (
        <EmptyState
          icon="users"
          title="No friend activity yet"
          description="Add friends to see their posts here."
        />
      ) : (
        posts.map(post => (
          <FriendActivityCard
            key={post.id}
            post={post}
            thumbnailUrl={photoUrlFor(post, photoUrls)}
            onPress={() => onCardPress(post)}
          />
        ))
      )}
    </View>
  );
}
