import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from './Icon';
import type { Post } from '../../services/api/queries/posts';

type PostThumbnailProps = {
  post: Post;
  /** Already-resolved signed URLs — batched upstream (useSignedPhotoUrls), never fetched per-thumbnail. */
  photoUrl?: string;
  beforeUrl?: string;
  afterUrl?: string;
  size?: number;
  onPress?: () => void;
};

/** Square photo tile used in both profile screens' posts grids — before/after posts show a split before|after preview. */
export function PostThumbnail({ post, photoUrl, beforeUrl, afterUrl, size = 108, onPress }: PostThumbnailProps) {
  const theme = useTheme();
  const isBeforeAfter = post.post_type === 'before_after_photo';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={isBeforeAfter ? 'Before and after photo post' : 'Progress photo post'}
      style={{
        width: size,
        height: size,
        borderRadius: theme.radii.sm,
        overflow: 'hidden',
        backgroundColor: theme.colors.bg.surface,
        flexDirection: 'row',
      }}
    >
      {isBeforeAfter ? (
        <>
          <View style={{ flex: 1 }}>
            {beforeUrl ? (
              <Image source={{ uri: beforeUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : null}
          </View>
          <View style={{ width: 1, backgroundColor: theme.colors.bg.base }} />
          <View style={{ flex: 1 }}>
            {afterUrl ? (
              <Image source={{ uri: afterUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : null}
          </View>
        </>
      ) : photoUrl ? (
        <Image source={{ uri: photoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="camera" size="md" color={theme.colors.text.tertiary} />
        </View>
      )}
    </Pressable>
  );
}
