import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

const CARD_HEIGHT = 64;

/**
 * Static placeholder — no shimmer, so it needs no reduced-motion handling
 * and can't itself cause the layout shift it exists to prevent. Sized to
 * match FriendActivityCard so swapping to real content doesn't jump.
 */
export function FriendsActivitySkeleton() {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel="Loading friends activity"
      style={{ gap: theme.spacing.sm }}
    >
      <View importantForAccessibility="no-hide-descendants" style={{ gap: theme.spacing.sm }}>
        {[0, 1, 2].map(i => (
          <View
            key={i}
            style={{
              height: CARD_HEIGHT,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.bg.surfaceElevated,
            }}
          />
        ))}
      </View>
    </View>
  );
}
