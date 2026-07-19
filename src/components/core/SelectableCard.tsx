import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

type SelectableCardProps = {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
};

export function SelectableCard({ label, description, selected, onPress }: SelectableCardProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: selected ? theme.colors.bg.surfaceElevated : theme.colors.bg.surface,
        borderRadius: theme.radii.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.colors.accent.primary : theme.colors.border.default,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="subtitle">{label}</Text>
        {description ? (
          <Text variant="caption" color="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: theme.radii.pill,
          borderWidth: 2,
          borderColor: selected ? theme.colors.accent.primary : theme.colors.border.default,
          backgroundColor: selected ? theme.colors.accent.primary : 'transparent',
        }}
      />
    </Pressable>
  );
}
