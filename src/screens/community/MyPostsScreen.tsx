import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Header } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useUserPosts, useSignedPhotoUrls, postPhotoPaths } from '../../services/api/queries/posts';
import { PostsGrid } from './PostsGrid';
import type { CommunityStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CommunityStackParamList>;

export function MyPostsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore(state => state.userId);
  const { data: posts, isLoading, refetch: refetchPosts } = useUserPosts(userId);

  const photoPaths = useMemo(() => (posts ?? []).flatMap(postPhotoPaths), [posts]);
  const { data: photoUrls, refetch: refetchPhotoUrls } = useSignedPhotoUrls(photoPaths);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchPosts(), refetchPhotoUrls()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchPosts, refetchPhotoUrls]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <Header title="My Posts" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent.primary} />}
      >
        <PostsGrid
          posts={posts ?? []}
          photoUrls={photoUrls ?? {}}
          isLoading={isLoading}
          emptyTitle="No posts yet"
          emptyDescription="Post a progress photo or a before & after to see it here."
          onPressPost={postId => navigation.navigate('PostDetail', { postId })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
