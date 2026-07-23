import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card } from '../../components/core';
import { ExerciseProgressIndicator } from './ExerciseProgressIndicator';
import { formatWeight, unitLabel } from '../../utils/units';
import type { ActiveExercise } from '../../store/activeWorkoutStore';
import type { UnitPreference } from '../../types/database';

type WorkoutExerciseRowProps = {
  exercise: ActiveExercise;
  order: number;
  isNext: boolean;
  unitPref: UnitPreference;
  onPress: () => void;
};

function repsLabel(exercise: ActiveExercise): string | null {
  if (exercise.targetRepsMin == null) return null;
  if (exercise.targetRepsMax != null && exercise.targetRepsMax !== exercise.targetRepsMin) {
    return `${exercise.targetRepsMin}-${exercise.targetRepsMax} reps`;
  }
  return `${exercise.targetRepsMin} reps`;
}

/** Compact, scannable summary row for the workout overview — replaces
 * showing every exercise as a full editable card. Tapping opens the focused
 * ActiveExercise screen for just this exercise. */
export function WorkoutExerciseRow({ exercise, order, isNext, unitPref, onPress }: WorkoutExerciseRowProps) {
  const theme = useTheme();
  const totalSets = exercise.targetSets ?? exercise.sets.length;
  const completedSets = exercise.sets.filter(s => s.completed).length;
  const complete = totalSets > 0 && completedSets >= totalSets;
  const reps = repsLabel(exercise);

  const setsWeights = exercise.sets
    .filter(s => s.completed && s.loadKg != null)
    .map(s => formatWeight(s.loadKg, unitPref))
    .join(', ');

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${exercise.exerciseName}, ${completedSets} of ${totalSets} sets complete`}>
      {({ pressed }) => (
        <Card
          variant={isNext ? 'elevated' : 'flat'}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            opacity: pressed ? 0.85 : 1,
            borderColor: isNext ? theme.colors.accent.primary : theme.colors.border.subtle,
            borderWidth: isNext ? 1.5 : 1,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.bg.surfaceElevated,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="caption" color="secondary" style={{ fontWeight: '700' }}>
              {order}
            </Text>
          </View>

          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="subtitle" numberOfLines={1}>
              {exercise.exerciseName}
            </Text>
            <Text variant="caption" color="secondary">
              {totalSets} set{totalSets === 1 ? '' : 's'}
              {reps ? ` · ${reps}` : ''}
            </Text>
            {setsWeights ? (
              <Text variant="caption" color="tertiary" numberOfLines={1}>
                {setsWeights} {unitLabel(unitPref)}
              </Text>
            ) : null}
            <Text
              variant="caption"
              style={{ color: complete ? theme.colors.accent.primary : theme.colors.text.secondary, fontWeight: '600' }}
            >
              {completedSets} of {totalSets} set{totalSets === 1 ? '' : 's'} complete
            </Text>
          </View>

          <ExerciseProgressIndicator completedSets={completedSets} totalSets={totalSets} />
        </Card>
      )}
    </Pressable>
  );
}
