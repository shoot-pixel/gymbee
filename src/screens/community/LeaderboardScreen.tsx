import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card } from '../../components/core';

export function LeaderboardScreen() {
  const theme = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <Text variant="title">Community</Text>
        <Card>
          <Text variant="subtitle">No friends yet</Text>
          <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.xs }}>
            Follow other athletes to see leaderboards and activity here (Milestone 8).
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
