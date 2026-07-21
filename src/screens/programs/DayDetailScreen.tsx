import React from 'react';
import { Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Button, Header, IconButton, LoadingState } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useProgramDay } from '../../services/api/queries/programs';
import { useCreateTemplateFromProgramDay } from '../../services/api/queries/workoutTemplates';
import { navigateToStartWorkout, navigateToChooseVariant } from '../../navigation/startWorkoutFlow';
import { featureFlags } from '../../config/featureFlags';
import type { ProgramsStackParamList, TodayStackParamList, RootStackParamList } from '../../navigation/types';

// DayDetail is registered on both TodayStack and ProgramsStack with identical
// params — either param list satisfies the route shape we read here.
type Route = RouteProp<ProgramsStackParamList | TodayStackParamList, 'DayDetail'>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

export function DayDetailScreen() {
  const theme = useTheme();
  const rootNavigation = useNavigation<RootNav>();
  const { params } = useRoute<Route>();
  const { data: day, isLoading } = useProgramDay(params.programDayId);
  const userId = useAuthStore(state => state.userId);
  const createTemplateFromDay = useCreateTemplateFromProgramDay();

  const onSaveToLibrary = async () => {
    if (!userId || !day) return;
    try {
      const created = await createTemplateFromDay.mutateAsync({ userId, day });
      rootNavigation.navigate('MainTabs', {
        screen: 'ProgramsTab',
        params: { screen: 'TemplateEditor', params: { templateId: created.id } },
      });
    } catch (err) {
      Alert.alert('Could not save workout', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Header
        title={day?.title ?? 'Day'}
        right={
          day ? <IconButton name="bookmark" variant="ghost" onPress={onSaveToLibrary} /> : undefined
        }
      />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.md }}>
        {isLoading || !day ? (
          <LoadingState fill={false} />
        ) : (
          <>
            <Text variant="body" color="secondary">
              {day.program_weeks.programs.title} · Week {day.program_weeks.week_number}
            </Text>

            {day.program_exercises.map(pe => (
              <Card key={pe.id} variant="elevated" style={{ gap: theme.spacing.xs }}>
                <Text variant="subtitle">{pe.exercises.name}</Text>
                <Text variant="body" color="secondary">
                  {pe.target_sets} sets × {pe.target_reps_min}
                  {pe.target_reps_max && pe.target_reps_max !== pe.target_reps_min
                    ? `-${pe.target_reps_max}`
                    : ''}{' '}
                  reps
                  {pe.target_rpe ? ` @ RPE ${pe.target_rpe}` : ''}
                </Text>
                {pe.rest_seconds ? (
                  <Text variant="caption" color="tertiary">
                    Rest {pe.rest_seconds}s
                  </Text>
                ) : null}
              </Card>
            ))}

            <Button
              label="Start Workout"
              onPress={() => navigateToStartWorkout(rootNavigation, { programDayId: day.id })}
            />
            {featureFlags.aiCoaching ? (
              <Button
                label="Choose a workout variant"
                variant="secondary"
                onPress={() => navigateToChooseVariant(rootNavigation, { programDayId: day.id })}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
