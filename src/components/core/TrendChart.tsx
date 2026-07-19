import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

type TrendChartProps = {
  points: number[];
  height?: number;
  emptyLabel?: string;
};

export function TrendChart({ points, height = 120, emptyLabel = 'Not enough data yet' }: TrendChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  if (points.length < 2) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="caption" color="secondary">
          {emptyLabel}
        </Text>
      </View>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const padding = 8;

  const coords =
    width > 0
      ? points.map((p, i) => ({
          x: padding + (i * (width - padding * 2)) / (points.length - 1),
          y: padding + (1 - (p - min) / range) * (height - padding * 2),
        }))
      : [];
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`
      : '';

  return (
    <View style={{ height }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Path d={areaPath} fill={theme.colors.accent.primary} fillOpacity={0.12} />
          <Path
            d={linePath}
            stroke={theme.colors.accent.primary}
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}
