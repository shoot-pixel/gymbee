import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Button, LoadingState } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useActiveProgramTree, getProgramDayForDate } from '../../services/api/queries/programs';
import { useScheduledWorkouts } from '../../services/api/queries/scheduledWorkouts';
import { featureFlags } from '../../config/featureFlags';
import type { LogStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<LogStackParamList>;

function dateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * The Log tab's actual initial route. Tapping the "Log" tab bar icon has no
 * program-day/scheduled-workout context of its own (unlike "Start Workout"
 * on Today/DayDetail/ScheduledWorkoutDetail, which always knows one) — this
 * screen resolves today's workout the same way Today does and forwards
 * straight into the normal PreWorkoutReview/ActiveWorkoutOverview flow, or falls back
 * to a plain "nothing to log" state with a way out when there isn't one.
 */
export function LogLandingScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore(state => state.userId);
  const today = useMemo(() => new Date(), []);
  const todayKey = dateKey(today);

  const { data: program, isLoading: programLoading } = useActiveProgramTree(userId);
  const { data: scheduledWorkouts, isLoading: scheduledLoading } = useScheduledWorkouts(userId, {
    from: todayKey,
    to: todayKey,
  });
  const isLoading = programLoading || scheduledLoading;

  const resolvedToday = getProgramDayForDate(program, today);
  const isTrainingDay = resolvedToday != null && !resolvedToday.day.is_rest_day;
  const scheduledToday = scheduledWorkouts?.[0] ?? null;
  const hasTarget = isTrainingDay || scheduledToday != null;

  useEffect(() => {
    if (isLoading || !hasTarget) return;
    const source = isTrainingDay
      ? { programDayId: resolvedToday!.day.id }
      : { scheduledWorkoutId: scheduledToday!.id };
    if (featureFlags.aiCoaching) {
      navigation.replace('PreWorkoutReview', source);
    } else {
      navigation.replace('ActiveWorkoutOverview', source);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, hasTarget]);

  if (isLoading || hasTarget) {
    return <LoadingState />;
  }

  const message = !program
    ? "You don't have an active program yet."
    : resolvedToday?.day.is_rest_day
      ? 'Today is a rest day in your program.'
      : "You don't have a workout scheduled for today.";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.xl,
          gap: theme.spacing.md,
        }}
      >
        <Text variant="title">Nothing to log today</Text>
        <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
          {message}
        </Text>
        <Button label="Browse Library" onPress={() => navigation.navigate('Library')} />
      </View>
    </SafeAreaView>
  );
}
