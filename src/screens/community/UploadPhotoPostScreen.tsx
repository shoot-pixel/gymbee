import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Button, Header, TextField, Icon, VisibilitySelector } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useCreatePhotoPost } from '../../services/api/queries/posts';
import type { CommunityStackParamList } from '../../navigation/types';
import type { PostVisibility } from '../../types/database';

type Route = RouteProp<CommunityStackParamList, 'UploadPhotoPost'>;
type Nav = NativeStackNavigationProp<CommunityStackParamList>;

type PickedPhoto = { uri: string; contentType: string };

function PhotoPicker({ label, photo, onPick }: { label: string; photo: PickedPhoto | null; onPick: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPick}
      accessibilityRole="button"
      accessibilityLabel={photo ? `${label}, photo selected. Tap to change.` : `${label}, no photo selected. Tap to add.`}
      style={{
        height: 180,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.border.default,
        backgroundColor: theme.colors.bg.surface,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {photo ? (
        <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <Icon name="camera" size="lg" color={theme.colors.text.secondary} />
          <Text variant="caption" color="secondary">
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function UploadPhotoPostScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const userId = useAuthStore(state => state.userId);
  const createPost = useCreatePhotoPost(userId);

  const [visibility, setVisibility] = useState<PostVisibility>('friends');
  const [caption, setCaption] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [beforePhoto, setBeforePhoto] = useState<PickedPhoto | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<PickedPhoto | null>(null);

  const isBeforeAfter = params.mode === 'before_after';
  const title = isBeforeAfter ? 'Post Before & After' : 'Post Progress Photo';
  const canSubmit = isBeforeAfter ? beforePhoto != null && afterPhoto != null : photo != null;

  const pick = async (onPicked: (photo: PickedPhoto) => void) => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.didCancel) return;
    if (result.errorCode) {
      Alert.alert('Could not open photo library', result.errorMessage ?? 'Please try again.');
      return;
    }
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    onPicked({ uri: asset.uri, contentType: asset.type ?? 'image/jpeg' });
  };

  const onSubmit = async () => {
    try {
      if (isBeforeAfter) {
        if (!beforePhoto || !afterPhoto) return;
        await createPost.mutateAsync({
          mode: 'before_after',
          visibility,
          caption: caption.trim() || null,
          beforePhoto,
          afterPhoto,
        });
      } else {
        if (!photo) return;
        await createPost.mutateAsync({
          mode: 'progress',
          visibility,
          caption: caption.trim() || null,
          photo,
        });
      }
      Alert.alert('Posted!', undefined, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert('Could not post', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <Header title={title} />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {isBeforeAfter ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}>
              <PhotoPicker label="Before" photo={beforePhoto} onPick={() => pick(setBeforePhoto)} />
            </View>
            <View style={{ flex: 1 }}>
              <PhotoPicker label="After" photo={afterPhoto} onPick={() => pick(setAfterPhoto)} />
            </View>
          </View>
        ) : (
          <PhotoPicker label="Add Photo" photo={photo} onPick={() => pick(setPhoto)} />
        )}

        <TextField
          label="Caption"
          placeholder="Add a caption (optional)"
          value={caption}
          onChangeText={setCaption}
          multiline
        />

        <Card variant="elevated">
          <VisibilitySelector value={visibility} onChange={setVisibility} />
        </Card>

        <Button label="Post" onPress={onSubmit} disabled={!canSubmit} loading={createPost.isPending} />
      </ScrollView>
    </SafeAreaView>
  );
}
