import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Button, Header, LoadingState } from '../../components/core';
import { useScheduledWorkout } from '../../services/api/queries/scheduledWorkouts';
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Header title={scheduled?.name ?? 'Workout'} />
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
              onPress={() => navigateToStartWorkout(rootNavigation, { scheduledWorkoutId: scheduled.id })}
            />
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
