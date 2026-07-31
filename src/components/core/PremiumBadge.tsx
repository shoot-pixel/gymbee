import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from './Icon';

type PremiumBadgeProps = {
  size?: number;
};

/** Small gold crown pip shown next to a display name wherever one already
 * renders for a Premium athlete — leaderboard rows, feed post authors,
 * search results, profile headers. Purely decorative (no press target); the
 * caller decides whether to render it at all based on `profile.is_premium`. */
export function PremiumBadge({ size = 15 }: PremiumBadgeProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.gradients.premium[1],
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityLabel="SetSocial Premium"
    >
      <Icon name="crown" size={size * 0.6} color={theme.colors.bg.base} />
    </View>
  );
}
