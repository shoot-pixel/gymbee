import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Text,
  Card,
  Button,
  Header,
  ListRow,
  LoadingState,
  Avatar,
  Icon,
  IconButton,
  PostThumbnail,
  VisibilityBadge,
  EmptyState,
  BottomSheet,
} from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useProfile, useUploadAvatar } from '../../services/api/queries/profiles';
import { useUserPosts, useSignedPhotoUrls, postPhotoPaths } from '../../services/api/queries/posts';
import { useAuth } from '../../hooks/useAuth';
import type { ProfileStackParamList, RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const theme = useTheme();
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userId = useAuthStore(state => state.userId);
  const { data: profile, isLoading } = useProfile(userId);
  const { signOut, loading: signingOut } = useAuth();
  const uploadAvatar = useUploadAvatar(userId);
  const [uploading, setUploading] = useState(false);
  const [addPostSheetOpen, setAddPostSheetOpen] = useState(false);

  const { data: posts } = useUserPosts(userId);
  const postPaths = useMemo(() => (posts ?? []).flatMap(postPhotoPaths), [posts]);
  const { data: signedUrls } = useSignedPhotoUrls(postPaths);

  const goToUploadPost = (mode: 'progress' | 'before_after') => {
    setAddPostSheetOpen(false);
    // UploadPhotoPost lives on the Progress tab's stack, not this one —
    // bubbles through the root navigator, same pattern TodayScreen uses
    // for its own cross-tab navigation.
    rootNavigation.navigate('MainTabs', {
      screen: 'ProgressTab',
      params: { screen: 'UploadPhotoPost', params: { mode } },
    });
  };

  const onChangePhoto = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.didCancel) return;
    if (result.errorCode) {
      Alert.alert('Could not open photo library', result.errorMessage ?? 'Please try again.');
      return;
    }
    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    setUploading(true);
    try {
      await uploadAvatar.mutateAsync({ uri: asset.uri, contentType: asset.type ?? 'image/jpeg' });
    } catch (err) {
      Alert.alert('Could not upload photo', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Header title="Profile" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.lg }}>
        {isLoading ? (
          <LoadingState fill={false} />
        ) : (
          <Card variant="elevated" style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <View style={{ flexShrink: 0 }}>
                <Avatar uri={profile?.avatar_url} size={72} onPress={onChangePhoto} />
                <View
                  style={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 26,
                    height: 26,
                    borderRadius: theme.radii.pill,
                    backgroundColor: theme.colors.accent.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: theme.colors.bg.surfaceElevated,
                  }}
                >
                  <Icon name="camera" size={14} color={theme.colors.text.onAccent} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="subtitle">{profile?.display_name ?? 'Athlete'}</Text>
                <Text variant="body" color="secondary">
                  {profile?.email}
                </Text>
                <Text variant="caption" color={uploading ? 'secondary' : 'tertiary'}>
                  {uploading ? 'Uploading…' : 'Tap photo to change'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing.lg, marginTop: theme.spacing.sm }}>
              <View>
                <Text variant="label" color="secondary">
                  EXPERIENCE
                </Text>
                <Text variant="body">{profile?.experience_level ?? '—'}</Text>
              </View>
              <View>
                <Text variant="label" color="secondary">
                  GOAL
                </Text>
                <Text variant="body">{profile?.goal ?? '—'}</Text>
              </View>
            </View>
          </Card>
        )}

        <Card variant="elevated" style={{ gap: 0 }}>
          <ListRow
            title="Settings"
            icon="settings"
            showChevron
            onPress={() => navigation.navigate('Settings')}
          />
          <ListRow
            title="Account"
            icon="user"
            showChevron
            onPress={() => navigation.navigate('Account')}
            style={{ borderTopWidth: 1, borderTopColor: theme.colors.border.subtle }}
          />
        </Card>

        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="label" color="secondary">
              POSTS
            </Text>
            <IconButton
              name="plus"
              variant="ghost"
              size={28}
              accessibilityLabel="Post a photo"
              onPress={() => setAddPostSheetOpen(true)}
            />
          </View>
          {posts != null && posts.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
              {posts.map(post => (
                <View key={post.id} style={{ gap: theme.spacing.xxs }}>
                  <PostThumbnail
                    post={post}
                    photoUrl={post.photo_path ? signedUrls?.[post.photo_path] : undefined}
                    beforeUrl={post.before_photo_path ? signedUrls?.[post.before_photo_path] : undefined}
                    afterUrl={post.after_photo_path ? signedUrls?.[post.after_photo_path] : undefined}
                    onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                  />
                  <VisibilityBadge visibility={post.visibility} />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="camera"
              title="No posts yet"
              description="Share a progress photo or a before & after with your friends."
              actionLabel="Post a Photo"
              onAction={() => setAddPostSheetOpen(true)}
            />
          )}
        </View>

        <Button
          label="Sign Out"
          variant="ghost"
          icon="logOut"
          loading={signingOut}
          onPress={() => signOut()}
        />
      </ScrollView>

      <BottomSheet visible={addPostSheetOpen} onClose={() => setAddPostSheetOpen(false)}>
        <ListRow title="Post Progress Photo" icon="camera" onPress={() => goToUploadPost('progress')} />
        <ListRow title="Post Before & After" icon="camera" onPress={() => goToUploadPost('before_after')} />
      </BottomSheet>
    </SafeAreaView>
  );
}
