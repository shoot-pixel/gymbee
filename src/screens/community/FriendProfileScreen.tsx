import React, { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Text,
  StatTile,
  Header,
  LoadingState,
  FriendRequestButton,
  IconButton,
  BottomSheet,
  ListRow,
  PostThumbnail,
} from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import {
  useFriendProfile,
  useFriendRelationships,
  resolveFriendRequestState,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useRemoveFriendRequest,
  useIsBlocked,
  useBlockUser,
} from '../../services/api/queries/community';
import { useUserPosts, useSignedPhotoUrls, postPhotoPaths } from '../../services/api/queries/posts';
import { useUnitPreference } from '../../hooks/useUnitPreference';
import { formatVolume, unitLabel } from '../../utils/units';
import type { CommunityStackParamList } from '../../navigation/types';

type Route = RouteProp<CommunityStackParamList, 'FriendProfile'>;
type Nav = NativeStackNavigationProp<CommunityStackParamList>;

export function FriendProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const userId = useAuthStore(state => state.userId);
  const unitPref = useUnitPreference();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: profile, isLoading, refetch: refetchProfile } = useFriendProfile(params.userId);
  const { data: relationships } = useFriendRelationships(userId);
  const { data: isBlocked, isLoading: blockedLoading } = useIsBlocked(userId, params.userId);
  const sendRequest = useSendFriendRequest(userId);
  const acceptRequest = useAcceptFriendRequest(userId);
  const declineRequest = useDeclineFriendRequest(userId);
  const removeRequest = useRemoveFriendRequest(userId);
  const blockUser = useBlockUser(userId);

  const { data: posts, refetch: refetchPosts } = useUserPosts(params.userId);
  const postPaths = useMemo(() => (posts ?? []).flatMap(postPhotoPaths), [posts]);
  const { data: signedUrls, refetch: refetchSignedUrls } = useSignedPhotoUrls(postPaths);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchProfile(), refetchPosts(), refetchSignedUrls()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchProfile, refetchPosts, refetchSignedUrls]);

  const isSelf = params.userId === userId;
  const { state, requestId } = resolveFriendRequestState(relationships, params.userId);
  const actionLoading =
    sendRequest.isPending || acceptRequest.isPending || declineRequest.isPending || removeRequest.isPending;

  const confirmBlock = () => {
    setMenuOpen(false);
    Alert.alert(
      `Block ${profile?.display_name ?? 'this athlete'}?`,
      "They won't be able to see your profile or activity, and you won't see theirs.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => blockUser.mutate(params.userId) },
      ],
    );
  };

  if (!isSelf && !blockedLoading && isBlocked) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
        <Header title="Profile" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
          <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
            This profile is unavailable.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <Header
        title="Profile"
        right={
          !isSelf ? (
            <IconButton
              name="moreVertical"
              variant="ghost"
              accessibilityLabel="Profile options"
              onPress={() => setMenuOpen(true)}
            />
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent.primary} />}
        >
          <Text variant="title">{profile?.display_name ?? 'Athlete'}</Text>

          {!isSelf && profile?.hide_stats_from_friends ? (
            <Text variant="caption" color="tertiary">
              This athlete has made their stats private.
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <View style={{ flex: 1 }}>
                <StatTile
                  label="Volume This Month"
                  value={`${formatVolume(profile?.volumeThisMonth ?? 0, unitPref)} ${unitLabel(unitPref)}`}
                />
              </View>
              <View style={{ flex: 1 }}>
                <StatTile label="Workouts This Month" value={profile?.workoutsThisMonth ?? 0} />
              </View>
            </View>
          )}

          {!isSelf ? (
            <FriendRequestButton
              state={state}
              displayName={profile?.display_name ?? 'this athlete'}
              size="md"
              loading={actionLoading}
              onSend={() => sendRequest.mutate(params.userId)}
              onAccept={() => requestId && acceptRequest.mutate(requestId)}
              onDecline={() => requestId && declineRequest.mutate(requestId)}
              onRemove={() => requestId && removeRequest.mutate(requestId)}
            />
          ) : null}

          {posts != null && posts.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="label" color="secondary">
                POSTS
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
                {posts.map(post => (
                  <PostThumbnail
                    key={post.id}
                    post={post}
                    photoUrl={post.photo_path ? signedUrls?.[post.photo_path] : undefined}
                    beforeUrl={post.before_photo_path ? signedUrls?.[post.before_photo_path] : undefined}
                    afterUrl={post.after_photo_path ? signedUrls?.[post.after_photo_path] : undefined}
                    onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <ListRow title={`Block ${profile?.display_name ?? 'athlete'}`} icon="circleAlert" onPress={confirmBlock} />
      </BottomSheet>
    </SafeAreaView>
  );
}
