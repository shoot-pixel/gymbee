import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Header,
  IconButton,
  Text,
  Card,
  TextField,
  ListRow,
  LoadingState,
  FriendRequestButton,
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
import { useFriendsPosts, useSignedPhotoUrls, postPhotoPaths } from '../../services/api/queries/posts';
import { PostsGrid } from './PostsGrid';
import type { CommunityStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CommunityStackParamList>;

export function CommunityPostsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore(state => state.userId);
  const [search, setSearch] = useState('');

  const { data: posts, isLoading } = useFriendsPosts(userId);
  const { data: searchResults, isLoading: searching } = useSearchProfiles(search, userId);
  const { data: relationships } = useFriendRelationships(userId);
  const { data: incomingRequests } = useIncomingFriendRequests(userId);
  const sendRequest = useSendFriendRequest(userId);
  const acceptRequest = useAcceptFriendRequest(userId);
  const declineRequest = useDeclineFriendRequest(userId);
  const removeRequest = useRemoveFriendRequest(userId);

  const actionLoading =
    sendRequest.isPending || acceptRequest.isPending || declineRequest.isPending || removeRequest.isPending;

  const photoPaths = useMemo(() => (posts ?? []).flatMap(postPhotoPaths), [posts]);
  const { data: photoUrls } = useSignedPhotoUrls(photoPaths);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <Header
        title="Community"
        right={
          <View style={{ flexDirection: 'row' }}>
            <IconButton
              name="plus"
              variant="ghost"
              accessibilityLabel="Post a photo"
              onPress={() => navigation.navigate('UploadPhotoPost', { mode: 'progress' })}
            />
            <IconButton
              name="trophy"
              variant="ghost"
              accessibilityLabel="Leaderboard"
              onPress={() => navigation.navigate('Leaderboard')}
            />
            <IconButton
              name="user"
              variant="ghost"
              accessibilityLabel="My Posts"
              onPress={() => navigation.navigate('MyPosts')}
            />
          </View>
        }
      />

      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
        <TextField
          placeholder="Find athletes by name"
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

          <PostsGrid
            posts={posts ?? []}
            photoUrls={photoUrls ?? {}}
            isLoading={isLoading}
            emptyTitle="No posts yet"
            emptyDescription="Add friends to see their posts here."
            onPressPost={postId => navigation.navigate('PostDetail', { postId })}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
