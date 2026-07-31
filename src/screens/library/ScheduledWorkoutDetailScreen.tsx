import React from 'react';
import { Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Button, Header, IconButton, LoadingState } from '../../components/core';
import { useScheduledWorkout, useDeleteScheduledWorkout } from '../../services/api/queries/scheduledWorkouts';
import { navigateToStartWorkout, navigateToChooseVariant } from '../../navigation/startWorkoutFlow';
import { featureFlags } from '../../config/featureFlags';
import type { RootStackParamList, ProgramsStackParamList } from '../../navigation/types';

type Route = RouteProp<ProgramsStackParamList, 'ScheduledWorkoutDetail'>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

export function ScheduledWorkoutDetailScreen() {
  const theme = useTheme();
  const rootNavigation = useNavigation<RootNav>();
  const { params } = useRoute<Route>();
  const { data: scheduled, isLoading } = useScheduledWorkout(params.scheduledWorkoutId);
  const deleteScheduledWorkout = useDeleteScheduledWorkout();

  const isFutureDay = scheduled != null && scheduled.scheduled_date > format(new Date(), 'yyyy-MM-dd');

  const onDelete = () => {
    if (!scheduled) return;
    Alert.alert('Delete this workout?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteScheduledWorkout.mutateAsync(scheduled.id);
            rootNavigation.goBack();
          } catch (err) {
            Alert.alert('Could not delete workout', err instanceof Error ? err.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Header
        title={scheduled?.name ?? 'Workout'}
        right={
          scheduled ? (
            <IconButton name="trash" variant="ghost" accessibilityLabel="Delete workout" onPress={onDelete} />
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.md }}>
        {isLoading || !scheduled ? (
          <LoadingState fill={false} />
        ) : (
          <>
            <Text variant="body" color="secondary">
              {format(new Date(scheduled.scheduled_date), 'EEEE, MMM d, yyyy')}
            </Text>

            {scheduled.scheduled_workout_exercises.map(se => (
              <Card key={se.id} variant="elevated" style={{ gap: theme.spacing.xs }}>
                <Text variant="subtitle">{se.exercises.name}</Text>
                <Text variant="body" color="secondary">
                  {se.target_sets} sets × {se.target_reps_min}
                  {se.target_reps_max && se.target_reps_max !== se.target_reps_min
                    ? `-${se.target_reps_max}`
                    : ''}{' '}
                  reps
                  {se.target_rpe ? ` @ RPE ${se.target_rpe}` : ''}
                </Text>
                {se.rest_seconds ? (
                  <Text variant="caption" color="tertiary">
                    Rest {se.rest_seconds}s
                  </Text>
                ) : null}
              </Card>
            ))}

            <Button
              label="Start Workout"
              disabled={isFutureDay}
              onPress={() => navigateToStartWorkout(rootNavigation, { scheduledWorkoutId: scheduled.id })}
            />
            {isFutureDay ? (
              <Text variant="caption" color="secondary" style={{ textAlign: 'center' }}>
                Check back tomorrow!
              </Text>
            ) : null}
            {featureFlags.aiCoaching ? (
              <Button
                label="Choose a workout variant"
                variant="secondary"
                onPress={() => navigateToChooseVariant(rootNavigation, { scheduledWorkoutId: scheduled.id })}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
