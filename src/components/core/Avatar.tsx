import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from './Icon';

type AvatarProps = {
  uri?: string | null;
  size?: number;
  onPress?: () => void;
};

/** Circular avatar — clips the photo to a perfect circle via a matched-size
 * `overflow: hidden` container instead of relying on the image's own corner
 * radius, so it never bleeds past the edge. Falls back to a centered user
 * glyph (sized well under the container, not edge-to-edge) when there's no photo yet. */
export function Avatar({ uri, size = 40, onPress }: AvatarProps) {
  const theme = useTheme();
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      hitSlop={onPress ? 8 : undefined}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        flexShrink: 0,
        flexGrow: 0,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: theme.colors.bg.surfaceElevated,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Icon name="user" size={Math.round(size * 0.5)} color={theme.colors.text.secondary} />
      )}
    </Wrapper>
  );
}
