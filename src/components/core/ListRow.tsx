import React from 'react';
import { Pressable, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';

type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

/** Leading icon/avatar + title/subtitle + trailing content — shared row for
 * list-heavy screens (leaderboard, activity feed, exercise picker, settings). */
export function ListRow({
  title,
  subtitle,
  icon,
  leading,
  trailing,
  showChevron,
  onPress,
  style,
}: ListRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          opacity: pressed && onPress ? 0.7 : 1,
        },
        style,
      ]}
    >
      {leading ??
        (icon ? (
          <View
            style={{
              width: theme.sizes.iconButton,
              height: theme.sizes.iconButton,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.bg.surfaceElevated,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size="sm" color={theme.colors.text.secondary} />
          </View>
        ) : null)}
      <View style={{ flex: 1 }}>
        <Text variant="body">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {showChevron ? <Icon name="chevronRight" size="sm" color={theme.colors.text.tertiary} /> : null}
    </Pressable>
  );
}
