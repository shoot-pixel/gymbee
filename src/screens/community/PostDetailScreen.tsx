import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Avatar, Header, LoadingState, EmptyState, VisibilityBadge } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { usePost, useSignedPhotoUrls, postPhotoPaths } from '../../services/api/queries/posts';
import { useFriendProfile } from '../../services/api/queries/community';
import type { CommunityStackParamList, ProfileStackParamList } from '../../navigation/types';

type Route = RouteProp<CommunityStackParamList | ProfileStackParamList, 'PostDetail'>;
type Nav = NativeStackNavigationProp<CommunityStackParamList | ProfileStackParamList>;

export function PostDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const userId = useAuthStore(state => state.userId);

  const { data: post, isLoading } = usePost(params.postId);
  const { data: owner } = useFriendProfile(post?.user_id ?? null);

  const photoPaths = useMemo(() => (post ? postPhotoPaths(post) : []), [post]);
  const { data: signedUrls } = useSignedPhotoUrls(photoPaths);

  const isSelf = post != null && post.user_id === userId;

  const goToOwnerProfile = () => {
    if (!post || isSelf) return;
    // Only reachable when viewing a friend's post, which only ever happens
    // when this screen was pushed from CommunityStack (ActivityFeed or a
    // friend's own posts grid) — FriendProfile isn't a ProfileStack route.
    (navigation as NativeStackNavigationProp<CommunityStackParamList>).navigate('FriendProfile', {
      userId: post.user_id,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <Header title="Post" />
      {isLoading ? (
        <LoadingState />
      ) : !post ? (
        <EmptyState icon="circleAlert" title="Post unavailable" description="This post may have been removed." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.lg }}>
          <Pressable
            onPress={goToOwnerProfile}
            disabled={isSelf}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
          >
            <Avatar uri={owner?.avatar_url} size={40} />
            <View style={{ flex: 1 }}>
              <Text variant="subtitle">{isSelf ? 'You' : (owner?.display_name ?? 'Athlete')}</Text>
              <Text variant="caption" color="secondary">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </Text>
            </View>
            {isSelf ? <VisibilityBadge visibility={post.visibility} /> : null}
          </Pressable>

          {post.post_type === 'progress_photo' ? (
            <View
              style={{ width: '100%', aspectRatio: 1, borderRadius: theme.radii.md, overflow: 'hidden', backgroundColor: theme.colors.bg.surface }}
            >
              {signedUrls?.[post.photo_path ?? ''] ? (
                <Image
                  source={{ uri: signedUrls[post.photo_path ?? ''] }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  accessibilityLabel="Progress photo"
                />
              ) : null}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              {(
                [
                  { label: 'Before', path: post.before_photo_path },
                  { label: 'After', path: post.after_photo_path },
                ] as const
              ).map(({ label, path }) => (
                <View key={label} style={{ flex: 1, gap: theme.spacing.xs }}>
                  <Text variant="label" color="secondary">
                    {label.toUpperCase()}
                  </Text>
                  <View
                    style={{ width: '100%', aspectRatio: 0.8, borderRadius: theme.radii.md, overflow: 'hidden', backgroundColor: theme.colors.bg.surface }}
                  >
                    {path && signedUrls?.[path] ? (
                      <Image
                        source={{ uri: signedUrls[path] }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                        accessibilityLabel={`${label} photo`}
                      />
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          {post.caption ? (
            <Text variant="body" color="secondary">
              {post.caption}
            </Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
