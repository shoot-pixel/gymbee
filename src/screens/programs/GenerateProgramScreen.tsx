import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Button } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useProfile } from '../../services/api/queries/profiles';
import { generateProgram } from '../../services/api/edgeFunctions';
import type { ProgramsStackParamList } from '../../navigation/types';
import type { EquipmentType } from '../../types/database';

type Nav = NativeStackNavigationProp<ProgramsStackParamList>;

/** User-triggered AI generation, reachable from the Programs tab's empty
 * state — adapted from the onboarding flow's old auto-triggered version,
 * but sourced from the persisted profile (onboarding already saved these
 * fields directly) rather than the transient onboarding store, since
 * generation is no longer tied to finishing onboarding. */
export function GenerateProgramScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore(state => state.userId);
  const { data: profile } = useProfile(userId);

  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const run = useCallback(async () => {
    if (!userId || !profile?.goal || !profile.experience_level || !profile.days_per_week) {
      setError('Missing profile info — set your goal, experience, and days per week in Settings first.');
      return;
    }
    setError(null);
    try {
      const { program_id } = await generateProgram({
        goal: profile.goal,
        experience_level: profile.experience_level,
        days_per_week: profile.days_per_week,
        equipment: profile.equipment_access as EquipmentType[],
        injuries_notes: profile.injuries_notes ?? '',
      });
      navigation.replace('ProgramDetail', { programId: program_id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong generating your program.');
    }
    // Re-run only when the user explicitly retries (attempt changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, userId, profile]);

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
