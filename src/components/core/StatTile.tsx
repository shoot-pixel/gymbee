import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from './Card';
import { Numeral } from './Numeral';
import { Text } from './Text';

type StatTileProps = {
  label: string;
  value: string | number;
  trend?: { direction: 'up' | 'down' | 'flat'; label: string };
};

export function StatTile({ label, value, trend }: StatTileProps) {
  const theme = useTheme();
  const trendColor =
    trend?.direction === 'up'
      ? theme.colors.semantic.success
      : trend?.direction === 'down'
        ? theme.colors.semantic.danger
        : theme.colors.text.secondary;
  const trendGlyph = trend?.direction === 'up' ? '▲' : trend?.direction === 'down' ? '▼' : '▬';

  return (
    <Card style={{ gap: theme.spacing.xs }}>
      <Text variant="label" color="secondary">
        {label.toUpperCase()}
      </Text>
      <Numeral value={value} size="md" />
      {trend ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text variant="caption" style={{ color: trendColor }}>
            {trendGlyph} {trend.label}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
