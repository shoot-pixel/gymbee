import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, addDays, startOfWeek } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Button, Header, Icon, IconButton, LoadingState, BottomSheet, ListRow } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useWorkoutTemplate } from '../../services/api/queries/workoutTemplates';
import { useRemoveWeeklySchedule } from '../../services/api/queries/weeklySchedule';
import { useStartTemplateToday } from '../../services/api/queries/scheduledWorkouts';
import { useWorkoutLogsInRange } from '../../services/api/queries/workoutLogs';
import { navigateToStartWorkout } from '../../navigation/startWorkoutFlow';
import type { ProgramsStackParamList, TodayStackParamList, RootStackParamList } from '../../navigation/types';

// Registered on both TodayStack and ProgramsStack, same reasoning as
// DayDetail — reached in-stack (no tab switch) from either Today's
// selected-day card or the Training tab's weekday list.
type Route = RouteProp<ProgramsStackParamList | TodayStackParamList, 'TrainingDayDetail'>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TrainingDayDetailScreen() {
  const theme = useTheme();
  const rootNavigation = useNavigation<RootNav>();
  const { params } = useRoute<Route>();
  const userId = useAuthStore(state => state.userId);
  const { data: template, isLoading } = useWorkoutTemplate(params.workoutTemplateId);
  const removeWeeklySchedule = useRemoveWeeklySchedule();
  const startTemplateToday = useStartTemplateToday();
  const [menuOpen, setMenuOpen] = useState(false);

  // Safety net for CalendarScreen's own lock — this screen is also reachable
  // from TodayStack, so re-check here rather than trusting the caller.
  // Completion is by calendar date (any workout logged that day), matching
  // the same rule CalendarScreen's list uses.
  const thisWeekDate = addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), params.dayOfWeek);
  const thisWeekDateKey = format(thisWeekDate, 'yyyy-MM-dd');
  const { data: logsOnThisDate } = useWorkoutLogsInRange(userId, { from: thisWeekDateKey, to: thisWeekDateKey });
  const isCompletedThisWeek = (logsOnThisDate ?? []).length > 0;

  const onStartWorkout = async () => {
    if (!userId || !template) return;
    try {
      const scheduled = await startTemplateToday.mutateAsync({ userId, template });
      navigateToStartWorkout(rootNavigation, { scheduledWorkoutId: scheduled.id });
    } catch (err) {
      Alert.alert('Could not start workout', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const onRemove = () => {
    if (!userId) return;
    setMenuOpen(false);
    Alert.alert(
      `Remove from ${WEEKDAY_NAMES[params.dayOfWeek]}?`,
      "This day will show as Rest until you assign something else.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeWeeklySchedule.mutateAsync({ id: params.weeklyScheduleId, userId });
              rootNavigation.goBack();
            } catch (err) {
              Alert.alert('Could not remove training day', err instanceof Error ? err.message : 'Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Header
        title={template?.name ?? 'Training Day'}
        right={
          template ? (
            <IconButton
              name="moreVertical"
              variant="ghost"
              accessibilityLabel="Training day options"
              onPress={() => setMenuOpen(true)}
            />
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.md }}>
        {isLoading || !template ? (
          <LoadingState fill={false} />
        ) : (
          <>
            <Text variant="body" color="secondary">
              {WEEKDAY_NAMES[params.dayOfWeek]} · every week
            </Text>

            {template.workout_template_exercises.map(te => (
              <Card key={te.id} variant="elevated" style={{ gap: theme.spacing.xs }}>
                <Text variant="subtitle">{te.exercises.name}</Text>
                <Text variant="body" color="secondary">
                  {te.target_sets} sets × {te.target_reps_min}
                  {te.target_reps_max && te.target_reps_max !== te.target_reps_min ? `-${te.target_reps_max}` : ''}{' '}
                  reps
                  {te.target_rpe ? ` @ RPE ${te.target_rpe}` : ''}
                </Text>
                {te.rest_seconds ? (
                  <Text variant="caption" color="tertiary">
                    Rest {te.rest_seconds}s
                  </Text>
                ) : null}
              </Card>
            ))}

            {isCompletedThisWeek ? (
              <Card variant="subtle" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs }}>
                <Icon name="circleCheck" size="sm" color={theme.colors.accent.primary} />
                <Text variant="body" style={{ color: theme.colors.accent.primary, fontWeight: '700' }}>
                  Completed this week
                </Text>
              </Card>
            ) : (
              <Button label="Start Workout" onPress={onStartWorkout} loading={startTemplateToday.isPending} />
            )}
          </>
        )}
      </ScrollView>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <ListRow title={`Remove from ${WEEKDAY_NAMES[params.dayOfWeek]}`} icon="trash" onPress={onRemove} />
      </BottomSheet>
    </SafeAreaView>
  );
}
