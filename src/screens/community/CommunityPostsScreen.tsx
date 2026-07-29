import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Header,
  IconButton,
  Icon,
  type IconName,
  Text,
  Card,
  TextField,
  ListRow,
  LoadingState,
  FriendRequestButton,
  Avatar,
  Badge,
  ReportBlockSheet,
} from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import {
  useSearchProfiles,
  useFriendRelationships,
  resolveFriendRequestState,
  useIncomingFriendRequests,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useRemoveFriendRequest,
} from '../../services/api/queries/community';
import { useFriendsPosts, useSignedPhotoUrls, postPhotoPaths, type FriendPost } from '../../services/api/queries/posts';
import { useLikeCounts } from '../../services/api/queries/likes';
import { useCommentCounts } from '../../services/api/queries/comments';
import { useProfile } from '../../services/api/queries/profiles';
import {
  useNotificationBadges,
  useMarkMessagesSeen,
  useMarkActivitySeen,
} from '../../services/api/queries/notifications';
import { EditorialFeed } from './EditorialFeed';
import type { CommunityStackParamList, RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CommunityStackParamList>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

type HubTileProps = {
  icon: IconName;
  label: string;
  tint: string;
  dotVisible?: boolean;
  onPress: () => void;
};

/** One destination in the Social tab's hub — a named, color-coded tile
 * rather than a bare icon, so "where do I go" reads at a glance instead of
 * needing to decode a row of unlabeled glyphs (see the At My Gym /
 * Messages / Leaderboard row this replaced). */
function HubTile({ icon, label, tint, dotVisible, onPress }: HubTileProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={{ flex: 1, alignItems: 'center', gap: theme.spacing.xs, paddingVertical: theme.spacing.xs }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: theme.radii.md,
          backgroundColor: `${tint}1F`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size="md" color={tint} />
        <Badge visible={!!dotVisible} />
      </View>
      <Text variant="caption" color="secondary" style={{ fontWeight: '600', textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function CommunityPostsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  // Settings/Account lives on the root stack, not CommunityStack — same
  // cross-stack pattern TodayScreen uses for its own top-right avatar.
  const rootNavigation = useNavigation<RootNav>();
  const userId = useAuthStore(state => state.userId);
  const [search, setSearch] = useState('');
  const [reportingPost, setReportingPost] = useState<FriendPost | null>(null);

  const { data: posts, isLoading, refetch: refetchPosts } = useFriendsPosts(userId);
  const { data: searchResults, isLoading: searching } = useSearchProfiles(search, userId);
  const { data: relationships, refetch: refetchRelationships } = useFriendRelationships(userId);
  const { data: incomingRequests, refetch: refetchIncomingRequests } = useIncomingFriendRequests(userId);
  const sendRequest = useSendFriendRequest(userId);
  const acceptRequest = useAcceptFriendRequest(userId);
  const declineRequest = useDeclineFriendRequest(userId);
  const removeRequest = useRemoveFriendRequest(userId);

  const { data: profile } = useProfile(userId);
  const { hasUnreadMessages, hasUnseenActivity } = useNotificationBadges(userId, {
    messagesSeenAt: profile?.messages_seen_at,
    activitySeenAt: profile?.activity_seen_at,
  });
  const markMessagesSeen = useMarkMessagesSeen(userId);
  const markActivitySeen = useMarkActivitySeen(userId);

  const actionLoading =
    sendRequest.isPending || acceptRequest.isPending || declineRequest.isPending || removeRequest.isPending;

  const onOpenMessages = () => {
    navigation.navigate('Messages');
    if (hasUnreadMessages) markMessagesSeen.mutate();
  };

  const onOpenOwnProfile = () => {
    if (!userId) return;
    navigation.navigate('FriendProfile', { userId });
    if (hasUnseenActivity) markActivitySeen.mutate();
  };

  const photoPaths = useMemo(() => (posts ?? []).flatMap(postPhotoPaths), [posts]);
  const { data: photoUrls, refetch: refetchPhotoUrls } = useSignedPhotoUrls(photoPaths);

  const postIds = useMemo(() => (posts ?? []).map(p => p.id), [posts]);
  const { data: likeCounts, refetch: refetchLikeCounts } = useLikeCounts(postIds);
  const { data: commentCounts, refetch: refetchCommentCounts } = useCommentCounts(postIds);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchPosts(),
        refetchRelationships(),
        refetchIncomingRequests(),
        refetchPhotoUrls(),
        refetchLikeCounts(),
        refetchCommentCounts(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    refetchPosts,
    refetchRelationships,
    refetchIncomingRequests,
    refetchPhotoUrls,
    refetchLikeCounts,
    refetchCommentCounts,
  ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <Header
        title="Social"
        showBack={false}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <IconButton
              name="plus"
              variant="ghost"
              accessibilityLabel="Post a photo"
              onPress={() => navigation.navigate('UploadPhotoPost', { mode: 'progress' })}
            />
            <Pressable
              onPress={() => rootNavigation.navigate('Profile', { screen: 'Profile' })}
              accessibilityLabel="Settings"
            >
              <Avatar uri={profile?.avatar_url} size={40} />
            </Pressable>
          </View>
        }
      />

      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: theme.spacing.lg,
          marginBottom: theme.spacing.md,
          backgroundColor: theme.colors.bg.surface,
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: theme.colors.border.subtle,
          padding: theme.spacing.sm,
        }}
      >
        <HubTile icon="messageCircle" label="Messages" tint={theme.colors.accent.blue} dotVisible={hasUnreadMessages} onPress={onOpenMessages} />
        <HubTile icon="trophy" label="Leaderboard" tint={theme.colors.accent.purple} onPress={() => navigation.navigate('Leaderboard')} />
        <HubTile icon="mapPin" label="At My Gym" tint={theme.colors.accent.teal} onPress={() => navigation.navigate('AtMyGym')} />
        <HubTile icon="user" label="My Profile" tint={theme.colors.accent.primary} dotVisible={hasUnseenActivity} onPress={onOpenOwnProfile} />
      </View>

      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
        <TextField
          placeholder="Find athletes by name or @handle"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      {search.trim() ? (
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.xs }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {searching ? (
            <LoadingState fill={false} />
          ) : searchResults?.length === 0 ? (
            <Text variant="body" color="secondary">
              No athletes found.
            </Text>
          ) : (
            searchResults?.map(profile => {
              const { state, requestId } = resolveFriendRequestState(relationships, profile.id);
              return (
                <ListRow
                  key={profile.id}
                  title={profile.display_name ?? 'Athlete'}
                  subtitle={profile.handle ? `@${profile.handle}` : undefined}
                  leading={<Avatar uri={profile.avatar_url} size={40} />}
                  onPress={() => navigation.navigate('FriendProfile', { userId: profile.id })}
                  trailing={
                    <FriendRequestButton
                      state={state}
                      displayName={profile.display_name ?? 'this athlete'}
                      loading={actionLoading}
                      onSend={() => sendRequest.mutate(profile.id)}
                      onAccept={() => requestId && acceptRequest.mutate(requestId)}
                      onDecline={() => requestId && declineRequest.mutate(requestId)}
                      onRemove={() => requestId && removeRequest.mutate(requestId)}
                    />
                  }
                />
              );
            })
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ gap: theme.spacing.lg }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent.primary} />}
        >
          {incomingRequests && incomingRequests.length > 0 ? (
            <Card
              variant="elevated"
              style={{ gap: theme.spacing.sm, marginHorizontal: theme.spacing.lg }}
            >
              <Text variant="subtitle">Friend requests</Text>
              {incomingRequests.map((request, index) => (
                <ListRow
                  key={request.requestId}
                  title={request.display_name ?? 'Athlete'}
                  onPress={() => navigation.navigate('FriendProfile', { userId: request.id })}
                  trailing={
                    <FriendRequestButton
                      state="incoming"
                      displayName={request.display_name ?? 'this athlete'}
                      loading={actionLoading}
                      onSend={() => {}}
                      onAccept={() => acceptRequest.mutate(request.requestId)}
                      onDecline={() => declineRequest.mutate(request.requestId)}
                      onRemove={() => {}}
                    />
                  }
                  style={index > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle } : undefined}
                />
              ))}
            </Card>
          ) : null}

          <EditorialFeed
            posts={posts ?? []}
            photoUrls={photoUrls ?? {}}
            likeCounts={likeCounts ?? {}}
            commentCounts={commentCounts ?? {}}
            isLoading={isLoading}
            emptyTitle="No posts yet"
            emptyDescription="Add friends to see their posts here."
            onPressPost={postId => navigation.navigate('PostDetail', { postId })}
            onPressAuthor={authorUserId => navigation.navigate('FriendProfile', { userId: authorUserId })}
            onPressMenu={setReportingPost}
          />
        </ScrollView>
      )}

      <ReportBlockSheet
        visible={reportingPost != null}
        onClose={() => setReportingPost(null)}
        currentUserId={userId}
        targetType="post"
        targetId={reportingPost?.id ?? ''}
        reportedUserId={reportingPost?.user_id ?? ''}
        reportedUserName={reportingPost?.displayName ?? undefined}
        onBlocked={() => setReportingPost(null)}
      />
    </SafeAreaView>
  );
}
