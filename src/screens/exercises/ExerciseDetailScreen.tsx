import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Header, ListRow, LoadingState } from '../../components/core';
import { useExercise, useExercises } from '../../services/api/queries/exercises';
import { useAuthStore } from '../../store/authStore';
import { useProfile } from '../../services/api/queries/profiles';
import { coachingEngine } from '../../services/coaching';
import { exerciseRowToMetadata } from '../../utils/exerciseMetadata';
import type { LogStackParamList, TodayStackParamList } from '../../navigation/types';
import type { EquipmentType } from '../../types/database';

type Route = RouteProp<LogStackParamList | TodayStackParamList, 'ExerciseDetail'>;
type Nav = NativeStackNavigationProp<LogStackParamList | TodayStackParamList>;

export function ExerciseDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { data: exercise, isLoading } = useExercise(params.exerciseId);
  const userId = useAuthStore(state => state.userId);
  const { data: profile } = useProfile(userId);
  const { data: allExercises } = useExercises('');

  const alternatives = useMemo(() => {
    if (!exercise || !allExercises) return [];
    return coachingEngine.recommendExerciseSubstitution({
      exercise: exerciseRowToMetadata(exercise),
      candidates: allExercises.map(exerciseRowToMetadata),
      availableEquipment: (profile?.equipment_access as EquipmentType[] | undefined) ?? null,
    });
  }, [exercise, allExercises, profile?.equipment_access]);

  const explanation = useMemo(() => {
    if (!exercise) return null;
    return coachingEngine.generateExerciseExplanation({ exercise: exerciseRowToMetadata(exercise) });
  }, [exercise]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Header title={exercise?.name ?? 'Exercise'} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.lg }}>
        {isLoading || !exercise ? (
          <LoadingState fill={false} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.lg }}>
              <View>
                <Text variant="label" color="secondary">
                  CATEGORY
                </Text>
                <Text variant="body">{exercise.category}</Text>
              </View>
              <View>
                <Text variant="label" color="secondary">
                  EQUIPMENT
                </Text>
                <Text variant="body">{exercise.equipment}</Text>
              </View>
              <View>
                <Text variant="label" color="secondary">
                  MUSCLE
                </Text>
                <Text variant="body">{exercise.primary_muscle}</Text>
              </View>
              {exercise.movement_pattern ? (
                <View>
                  <Text variant="label" color="secondary">
                    PATTERN
                  </Text>
                  <Text variant="body">{exercise.movement_pattern.replace('_', ' ')}</Text>
                </View>
              ) : null}
              {exercise.difficulty ? (
                <View>
                  <Text variant="label" color="secondary">
                    DIFFICULTY
                  </Text>
                  <Text variant="body">{exercise.difficulty}</Text>
                </View>
              ) : null}
              {exercise.joint_stress ? (
                <View>
                  <Text variant="label" color="secondary">
                    JOINT STRESS
                  </Text>
                  <Text variant="body">{exercise.joint_stress}</Text>
                </View>
              ) : null}
            </View>

            {exercise.secondary_muscles.length > 0 ? (
              <Text variant="caption" color="tertiary">
                Also works: {exercise.secondary_muscles.join(', ')}
              </Text>
            ) : null}

            <Card variant="elevated">
              <Text variant="subtitle">How to perform it</Text>
              <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.xs }}>
                {exercise.instructions ?? 'No instructions yet.'}
              </Text>
            </Card>

            {!exercise.demo_media_url ? (
              <Text variant="caption" color="tertiary">
                Demo video/image coming later — this exercise doesn't have one yet.
              </Text>
            ) : null}

            {explanation && explanation.purpose ? (
              <Card variant="elevated" style={{ gap: theme.spacing.sm }}>
                <Text variant="subtitle">Why this exercise</Text>
                <Text variant="body" color="secondary">
                  {explanation.purpose}
                </Text>
                <View>
                  <Text variant="label" color="secondary">
                    WHEN TO PROGRESS
                  </Text>
                  <Text variant="body" color="secondary" style={{ marginTop: 2 }}>
                    {explanation.progressionCriteria}
                  </Text>
                </View>
                <View>
                  <Text variant="label" color="secondary">
                    WHEN TO SCALE BACK
                  </Text>
                  <Text variant="body" color="secondary" style={{ marginTop: 2 }}>
                    {explanation.regressionCriteria}
                  </Text>
                </View>
              </Card>
            ) : null}

            {alternatives.length > 0 ? (
              <Card variant="flat" style={{ gap: theme.spacing.xs }}>
                <Text variant="subtitle">Suitable alternatives</Text>
                {alternatives.map(alt => (
                  <ListRow
                    key={alt.exerciseId}
                    title={alt.exerciseName}
                    subtitle={alt.reason}
                    showChevron
                    onPress={() => navigation.push('ExerciseDetail', { exerciseId: alt.exerciseId })}
                  />
                ))}
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
