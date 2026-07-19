import React from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

type CardProps = ViewProps & { elevated?: boolean };

export function Card({ elevated = false, style, children, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: elevated
            ? theme.colors.bg.surfaceElevated
            : theme.colors.bg.surface,
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: theme.colors.border.default,
          padding: theme.spacing.lg,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
