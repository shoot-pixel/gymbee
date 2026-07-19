import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { Numeral } from './Numeral';
import { Text } from './Text';

type ProgressRingProps = {
  /** 0..1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  centerValue?: string;
};

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 10,
  label,
  centerValue,
}: ProgressRingProps) {
  const theme = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const dashOffset = circumference * (1 - clamped);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.border.default}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.accent.primary}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        {centerValue ? <Numeral value={centerValue} size="md" /> : null}
        {label ? (
          <Text variant="caption" color="secondary">
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
