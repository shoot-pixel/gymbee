import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Button } from '../../components/core';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAuthStore } from '../../store/authStore';
import { generateProgram } from '../../services/api/edgeFunctions';

export function GeneratingProgramScreen() {
  const theme = useTheme();
  const userId = useAuthStore(state => state.userId);
  const setSession = useAuthStore(state => state.setSession);
  const { goal, experienceLevel, daysPerWeek, equipment, injuriesNotes, reset } =
    useOnboardingStore();

  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const run = useCallback(async () => {
    if (!userId || !goal || !experienceLevel || !daysPerWeek) {
      setError('Missing onboarding answers — please go back and complete every step.');
      return;
    }
    setError(null);
    try {
      await generateProgram({
        goal,
        experience_level: experienceLevel,
        days_per_week: daysPerWeek,
        equipment,
        injuries_notes: injuriesNotes,
      });
      reset();
      // Flips RootNavigator from Onboarding to MainTabs — the edge function
      // already set profiles.onboarding_completed = true server-side.
      setSession({ userId, onboardingCompleted: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong generating your program.');
    }
    // Re-run only when the user explicitly retries (attempt changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(() => {
    run();
  }, [run]);

  if (error) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.colors.bg.base,
          padding: theme.spacing.xl,
          justifyContent: 'center',
          gap: theme.spacing.md,
        }}
      >
        <Text variant="title">Couldn't build your program</Text>
        <Text variant="body" color="secondary">
          {error}
        </Text>
        <Button label="Try Again" onPress={() => setAttempt(a => a + 1)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: theme.colors.bg.base,
        padding: theme.spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.lg,
      }}
    >
      <ActivityIndicator size="large" color={theme.colors.accent.primary} />
      <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
        <Text variant="title">Building your program…</Text>
        <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
          Your coach is designing a plan around your goals. This can take a minute.
        </Text>
      </View>
    </SafeAreaView>
  );
}
