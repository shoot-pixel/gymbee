import React, { useEffect, useMemo } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Button, Icon, LoadingState } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useActiveProgramTree } from '../../services/api/queries/programs';
import { useWeeklySchedule } from '../../services/api/queries/weeklySchedule';
import { useScheduledWorkouts, useStartTemplateToday } from '../../services/api/queries/scheduledWorkouts';
import { useWorkoutLogsInRange } from '../../services/api/queries/workoutLogs';
import { useWorkoutTemplate } from '../../services/api/queries/workoutTemplates';
import { resolveDayPlan } from '../../utils/dayPlan';
import { useActiveWorkoutStore } from '../../store/activeWorkoutStore';
import { featureFlags } from '../../config/featureFlags';
import { sourceToActiveWorkoutParams } from '../../navigation/startWorkoutFlow';
import type { LogStackParamList, RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<LogStackParamList>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

function dateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * The Log tab's actual initial route. Deliberately does not auto-start
 * anything — it used to forward straight into today's resolved target
 * (program day / scheduled workout) the instant this screen mounted, which
 * meant just tapping the Log tab bar icon silently created a workout_logs
 * row. That bit hardest right after deleting an in-progress session (see
 * ActiveWorkoutOverviewScreen's Delete Workout): resetting the store and
 * landing back here would immediately kick off a brand new session for the
 * same target, as if the delete never happened. The athlete should always be
 * the one who decides a workout starts, so this screen only ever *offers*
 * today's target (via an explicit Start Workout button) and always offers a
 * freestyle session alongside it — never navigates on their behalf.
 *
 * "Today's target" is read from `resolveDayPlan` — the same resolver Training
 * uses — instead of being recomputed here, so this screen can no longer
 * disagree with what Training/Today already show for today.
 *
 * The one exception is an already in-progress session — restored from a
 * previous app launch (see activeWorkoutStore's persist middleware) or just
 * left mid-workout — which still forwards automatically: that's resuming
 * work already in flight, not starting something new, and there'd be no
 * sense in making the athlete re-tap into it.
 */
export function LogLandingScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const rootNavigation = useNavigation<RootNav>();
  const userId = useAuthStore(state => state.userId);
  const today = useMemo(() => new Date(), []);
  const todayKey = dateKey(today);

  const hasHydrated = useActiveWorkoutStore(state => state.hasHydrated);
  const activeWorkoutLogId = useActiveWorkoutStore(state => state.workoutLogId);
  const activeSource = useActiveWorkoutStore(state => state.source);
  const hasActiveWorkout = activeWorkoutLogId != null;

  const { data: program, isLoading: programLoading } = useActiveProgramTree(userId);
  const { data: weeklySchedule, isLoading: weeklyScheduleLoading } = useWeeklySchedule(userId);
  const { data: scheduledWorkouts, isLoading: scheduledLoading } = useScheduledWorkouts(userId, {
    from: todayKey,
    to: todayKey,
  });
  const { data: workoutLogsToday, isLoading: workoutLogsLoading } = useWorkoutLogsInRange(userId, {
    from: todayKey,
    to: todayKey,
  });
  const isLoading = programLoading || weeklyScheduleLoading || scheduledLoading || workoutLogsLoading;

  const plan = useMemo(
    () => resolveDayPlan({ date: today, program, weeklySchedule, scheduledWorkouts, workoutLogs: workoutLogsToday }),
    [today, program, weeklySchedule, scheduledWorkouts, workoutLogsToday],
  );
  const hasTarget =
    plan.kind === 'scheduled' ||
    plan.kind === 'weeklyRecurring' ||
    plan.kind === 'programTraining' ||
    plan.kind === 'weeklyCardio' ||
    plan.kind === 'programCardio';

  // A weekly-recurring day has no scheduled_workouts row of its own yet —
  // starting it means materializing "today's instance" first, the same way
  // TodayScreen's onStartWeeklyTemplate does.
  const { data: weeklyTemplate } = useWorkoutTemplate(
    plan.kind === 'weeklyRecurring' ? (plan.entry.workout_template_id ?? undefined) : undefined,
  );
  const startTemplateToday = useStartTemplateToday();

  useEffect(() => {
    if (!hasHydrated || !hasActiveWorkout) return;
    navigation.replace('ActiveWorkoutOverview', sourceToActiveWorkoutParams(activeSource));
  }, [hasHydrated, hasActiveWorkout, activeSource, navigation]);

  if (!hasHydrated || hasActiveWorkout || isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  const onStartTarget = async () => {
    // Cardio skips PreWorkoutReview/ActiveWorkoutOverview entirely — those
    // are strength-specific (readiness adaptation, exercise variants), and
    // LogCardio lives on this same stack, so no cross-tab helper is needed.
    if (plan.kind === 'weeklyCardio') {
      navigation.navigate('LogCardio', undefined);
      return;
    }
    if (plan.kind === 'programCardio') {
      navigation.navigate('LogCardio', { programDayId: plan.day.id });
      return;
    }

    let source: { programDayId: string } | { scheduledWorkoutId: string } | null = null;

    if (plan.kind === 'scheduled') {
      source = { scheduledWorkoutId: plan.scheduledWorkout.id };
    } else if (plan.kind === 'programTraining') {
      source = { programDayId: plan.day.id };
    } else if (plan.kind === 'weeklyRecurring') {
      if (!userId || !weeklyTemplate) return;
      try {
        const scheduled = await startTemplateToday.mutateAsync({ userId, template: weeklyTemplate });
        source = { scheduledWorkoutId: scheduled.id };
      } catch (err) {
        Alert.alert('Could not start workout', err instanceof Error ? err.message : 'Please try again.');
        return;
      }
    }
    if (!source) return;

    if (featureFlags.aiCoaching) {
      navigation.navigate('PreWorkoutReview', source);
    } else {
      navigation.navigate('ActiveWorkoutOverview', source);
    }
  };

  const targetTitle =
    plan.kind === 'scheduled'
      ? plan.scheduledWorkout.name
      : plan.kind === 'weeklyRecurring'
        ? (plan.entry.workout_templates?.name ?? 'Today’s workout')
        : plan.kind === 'programTraining'
          ? (plan.day.title ?? 'Today’s workout')
          : plan.kind === 'weeklyCardio' || plan.kind === 'programCardio'
            ? 'Cardio Day'
            : 'Today’s workout';
  const noTargetMessage = !program
    ? "You don't have an active program yet."
    : plan.kind === 'programRest'
      ? 'Today is a rest day in your program.'
      : "You don't have a workout scheduled for today.";

  // Cross-tab hop to the Training tab's editable detail — same destination,
  // and same reasoning for going via the root navigator instead of this
  // stack's own, as CompletedWorkoutCard's onEditWorkout on the Today tab.
  const onEditTodayWorkout = (workoutLogIds: string[], title: string | null) => {
    rootNavigation.navigate('MainTabs', {
      screen: 'ProgramsTab',
      params: {
        screen: 'WorkoutLogDetail',
        params: { workoutLogIds, title, dateLabel: format(today, 'EEEE, MMM d') },
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <View>
          <Text variant="label" color="secondary">
            {format(today, 'EEEE, MMM d').toUpperCase()}
          </Text>
          <Text variant="title">Log a Workout</Text>
        </View>

        {plan.kind === 'completed' ? (
          <Card variant="elevated" style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xl }}>
            <Icon name="circleCheck" size="lg" color={theme.colors.accent.primary} />
            <Text variant="subtitle">Today's workout is done</Text>
            <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
              Nice work. Start another session below if you want a second one today.
            </Text>
            <View style={{ width: '100%' }}>
              <Button
                label="Edit Workout"
                variant="secondary"
                onPress={() => onEditTodayWorkout(plan.workoutLogIds, plan.title)}
              />
            </View>
          </Card>
        ) : hasTarget ? (
          <Card variant="elevated" style={{ gap: theme.spacing.sm }}>
            <Text variant="label" color="secondary">
              TODAY'S PLAN
            </Text>
            <Text variant="title">{targetTitle}</Text>
            <Button label="Start Workout" onPress={onStartTarget} loading={startTemplateToday.isPending} />
          </Card>
        ) : (
          <Card variant="elevated" style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xl }}>
            <Icon name="calendar" size="lg" color={theme.colors.text.secondary} />
            <Text variant="subtitle">Nothing scheduled today</Text>
            <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
              {noTargetMessage}
            </Text>
          </Card>
        )}

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" color="secondary">
            OR START SOMETHING ELSE
          </Text>
          <Button
            label="Start a Freestyle Workout"
            variant="secondary"
            icon="plus"
            onPress={() => navigation.navigate('ActiveWorkoutOverview', undefined)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
