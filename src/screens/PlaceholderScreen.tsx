import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../components/core';

type PlaceholderScreenProps = {
  title: string;
  subtitle?: string;
};

/** Generic stand-in for screens not yet built (wired up in later milestones). */
export function PlaceholderScreen({ title, subtitle }: PlaceholderScreenProps) {
  const theme = useTheme();
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: theme.colors.bg.base,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xl,
      }}
    >
      <View style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
        <Text variant="title">{title}</Text>
        {subtitle ? (
          <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
