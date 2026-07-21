import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Avatar, Icon } from '../../components/core';
import type { FriendPost } from '../../services/api/queries/posts';

type FriendActivityCardProps = {
  post: FriendPost;
  /** Already-resolved signed URL — batched upstream by the screen, never fetched per-card. For a before/after post, this is the "before" photo (a compact preview only ever needs one image). */
  thumbnailUrl?: string;
  onPress: () => void;
};

function subtitleFor(post: FriendPost): string {
  return post.post_type === 'progress_photo' ? 'posted a progress photo' : 'posted a before & after';
}

function FriendActivityCardImpl({ post, thumbnailUrl, onPress }: FriendActivityCardProps) {
  const theme = useTheme();
  const name = post.displayName ?? 'Athlete';
  const timestamp = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} ${subtitleFor(post)}, ${timestamp}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.sm,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.bg.surfaceElevated,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Avatar uri={post.avatarUrl} size={40} />
      <View style={{ flex: 1 }}>
        <Text variant="body" numberOfLines={1}>
          <Text variant="body" style={{ fontWeight: '700' }}>
            {name}{' '}
          </Text>
          {subtitleFor(post)}
        </Text>
        <Text variant="caption" color="secondary">
          {timestamp}
        </Text>
      </View>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: theme.radii.sm,
          overflow: 'hidden',
          backgroundColor: theme.colors.bg.surface,
        }}
      >
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="camera" size="sm" color={theme.colors.text.tertiary} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

export const FriendActivityCard = React.memo(FriendActivityCardImpl);
