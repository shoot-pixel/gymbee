import React from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { format } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Button, Header, IconButton, LoadingState } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useProgramDay, useRemoveProgramExercise, useSetDayType } from '../../services/api/queries/programs';
import { useCreateTemplateFromProgramDay } from '../../services/api/queries/workoutTemplates';
import { navigateToStartWorkout, navigateToChooseVariant, navigateToStartCardio } from '../../navigation/startWorkoutFlow';
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
  const removeProgramExercise = useRemoveProgramExercise();
  const setDayType = useSetDayType();
  const isFutureDay = params.date != null && params.date > format(new Date(), 'yyyy-MM-dd');

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

  const onAddExercise = () => {
    if (!day) return;
    // DayDetail lives on both TodayStack and ProgramsStack, but ExercisePicker
    // is only registered on ProgramsStack/LogStack — go via the root
    // navigator so this works regardless of which stack hosts this screen,
    // same reasoning as onSaveToLibrary's cross-stack navigate above.
    rootNavigation.navigate('MainTabs', {
      screen: 'ProgramsTab',
      params: { screen: 'ExercisePicker', params: { programDayId: day.id } },
    });
  };

  const onRemoveExercise = (exerciseId: string, exerciseName: string) => {
    if (!day) return;
    Alert.alert(`Remove ${exerciseName}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeProgramExercise.mutate({ id: exerciseId, programDayId: day.id }),
      },
    ]);
  };

  const onLogCardio = () => {
    if (!day) return;
    setDayType.mutate(
      { id: day.id, dayType: 'cardio' },
      { onSuccess: () => navigateToStartCardio(rootNavigation, { programDayId: day.id }) },
    );
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

            {day.day_type !== 'cardio'
              ? day.program_exercises.map(pe => (
                  <Card key={pe.id} variant="elevated" style={{ gap: theme.spacing.xs }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Text variant="subtitle">{pe.exercises.name}</Text>
                      <IconButton
                        name="trash"
                        variant="ghost"
                        size={20}
                        accessibilityLabel={`Remove ${pe.exercises.name}`}
                        onPress={() => onRemoveExercise(pe.id, pe.exercises.name)}
                      />
                    </View>
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
                ))
              : null}

            {day.day_type === 'cardio' ? (
              <Card variant="subtle" style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.lg }}>
                <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
                  This day is set to cardio. Pick an activity and log it when you start.
                </Text>
                <Button label="Start Cardio" onPress={() => navigateToStartCardio(rootNavigation, { programDayId: day.id })} />
                <Button
                  label="Switch to a strength workout"
                  variant="secondary"
                  onPress={() => setDayType.mutate({ id: day.id, dayType: 'training' })}
                  loading={setDayType.isPending}
                />
              </Card>
            ) : day.day_type === 'rest' ? (
              <Card variant="subtle" style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.lg }}>
                <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
                  This day is set to rest. Change your mind?
                </Text>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm, width: '100%' }}>
                  <Button
                    label="Add Workout"
                    onPress={() => setDayType.mutate({ id: day.id, dayType: 'training' })}
                    loading={setDayType.isPending}
                    style={{ flex: 1 }}
                  />
                  <Button label="Log Cardio" variant="secondary" onPress={onLogCardio} style={{ flex: 1 }} />
                </View>
              </Card>
            ) : (
              <>
                <Button label="Add Exercise" variant="secondary" onPress={onAddExercise} />

                <Button
                  label="Start Workout"
                  disabled={isFutureDay}
                  onPress={() => navigateToStartWorkout(rootNavigation, { programDayId: day.id })}
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
                    onPress={() => navigateToChooseVariant(rootNavigation, { programDayId: day.id })}
                  />
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
