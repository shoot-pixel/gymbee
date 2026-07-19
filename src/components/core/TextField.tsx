import React from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      {label ? (
        <Text variant="label" color="secondary">
          {label.toUpperCase()}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.colors.text.tertiary}
        style={[
          {
            backgroundColor: theme.colors.bg.surface,
            borderWidth: 1,
            borderColor: error ? theme.colors.semantic.danger : theme.colors.border.default,
            borderRadius: theme.radii.md,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: 12,
            color: theme.colors.text.primary,
            fontSize: 15,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" style={{ color: theme.colors.semantic.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
