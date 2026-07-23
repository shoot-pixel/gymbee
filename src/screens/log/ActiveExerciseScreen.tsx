import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Button, TextField, Icon, ListRow, BottomSheet, LoadingState } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import {
  useActiveWorkoutStore,
  type LoggedSet,
  type SetMetric,
} from '../../store/activeWorkoutStore';
import { useLogSet, useUpdateSet, useDeleteSet } from '../../services/api/queries/workoutLogs';
import {
  useReadinessContext,
  usePreviousExercisePerformance,
  useSaveSetRecommendation,
  useSaveExerciseSubstitution,
} from '../../services/api/queries/coaching';
import { useExercises } from '../../services/api/queries/exercises';
import { useProfile, useUpdateProfile } from '../../services/api/queries/profiles';
import { useLoggedSets, computePrEvents } from '../../services/api/queries/progress';
import {
  coachingEngine,
  type ExerciseSubstitution,
  type SetRecommendation,
} from '../../services/coaching';
import { FocusedExerciseHeader } from './FocusedExerciseHeader';
import { ExerciseHistorySummary } from './ExerciseHistorySummary';
import { RestTimerBanner } from './RestTimerBanner';
import {
  WorkoutSetRow,
  metricLabel,
  isSetPopulated,
} from './WorkoutSetRow';
import { useUnitPreference } from '../../hooks/useUnitPreference';
import { formatWeight, unitLabel } from '../../utils/units';
import { exerciseRowToMetadata } from '../../utils/exerciseMetadata';
import type { LogStackParamList } from '../../navigation/types';
import type { EquipmentType, UnitPreference } from '../../types/database';
import type { IconName } from '../../components/core';

type Route = RouteProp<LogStackParamList, 'ActiveExercise'>;
type Nav = NativeStackNavigationProp<LogStackParamList>;

const METRIC_OPTIONS: Array<{ value: SetMetric; label: string; disabled?: boolean }> = [
  { value: 'weight_lb', label: 'Weight (lb)' },
  { value: 'weight_kg', label: 'Weight (kg)' },
  { value: 'weight_pct', label: 'Weight (%)' },
  { value: 'reps', label: 'Reps' },
  { value: 'time', label: 'Time (coming soon)', disabled: true },
];

const RECOMMENDATION_ACTION_LABELS: Record<SetRecommendation['type'], { accept: string; ignore: string }> = {
  increase_weight: { accept: 'Apply to next set', ignore: 'Ignore' },
  reduce_weight: { accept: 'Apply to next set', ignore: 'Ignore' },
  keep_weight: { accept: 'Apply to next set', ignore: 'Ignore' },
  adjust_reps: { accept: 'Apply to next set', ignore: 'Ignore' },
  increase_rest: { accept: 'Add rest', ignore: 'Ignore' },
  remove_last_set: { accept: 'Remove that set', ignore: 'Keep it' },
  stop_exercise: { accept: 'Stop this exercise', ignore: 'Continue anyway' },
};

const RECOMMENDATION_ICON: Record<SetRecommendation['type'], IconName> = {
  increase_weight: 'trendingUp',
  reduce_weight: 'trendingDown',
  keep_weight: 'check',
  adjust_reps: 'repeat',
  increase_rest: 'timer',
  remove_last_set: 'minus',
  stop_exercise: 'circleAlert',
};

function recommendationDetail(rec: SetRecommendation, unitPref: UnitPreference): string | null {
  switch (rec.type) {
    case 'increase_weight':
    case 'reduce_weight':
      return rec.recommendedLoadKg != null ? `Try ${formatWeight(rec.recommendedLoadKg, unitPref)}${unitLabel(unitPref)} next set` : null;
    case 'keep_weight':
      return rec.recommendedReps != null
        ? `Repeat ${rec.recommendedReps} reps${rec.recommendedLoadKg != null ? ` @ ${formatWeight(rec.recommendedLoadKg, unitPref)}${unitLabel(unitPref)}` : ''}`
        : null;
    case 'adjust_reps':
      return rec.recommendedReps != null ? `Aim for ${rec.recommendedReps} reps next set` : null;
    case 'increase_rest':
      return rec.recommendedRestSeconds != null ? `Rest ${rec.recommendedRestSeconds}s before your next set` : null;
    case 'remove_last_set':
    case 'stop_exercise':
      return null;
  }
}

type PendingRecommendation = {
  recommendation: SetRecommendation;
  /** The draft set number it would apply to, if any remain. */
  nextSetNumber: number | null;
  /** The set number that was just completed, prompting this recommendation. */
  afterSetNumber: number;
};

/**
 * Focused, single-exercise entry screen. Reads and writes the same
 * `useActiveWorkoutStore` the overview reads — this screen holds no
 * editable workout data in local state, only ephemeral UI state (which
 * sheet is open, the pending coaching recommendation), so nothing is lost
 * by navigating away and the overview reflects every change immediately.
 */
export function ActiveExerciseScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const userId = useAuthStore(state => state.userId);
  const unitPref = useUnitPreference();

  const workoutLogId = useActiveWorkoutStore(state => state.workoutLogId);
  const exercises = useActiveWorkoutStore(state => state.exercises);
  const addSet = useActiveWorkoutStore(state => state.addSet);
  const updateSetDraft = useActiveWorkoutStore(state => state.updateSetDraft);
  const markSetCompleted = useActiveWorkoutStore(state => state.markSetCompleted);
  const markSetIncomplete = useActiveWorkoutStore(state => state.markSetIncomplete);
  const removeSet = useActiveWorkoutStore(state => state.removeSet);
  const removeExercise = useActiveWorkoutStore(state => state.removeExercise);
  const setExerciseNotes = useActiveWorkoutStore(state => state.setExerciseNotes);
  const setExerciseMetric = useActiveWorkoutStore(state => state.setExerciseMetric);
  const setExerciseTargetSets = useActiveWorkoutStore(state => state.setExerciseTargetSets);
  const substituteExercise = useActiveWorkoutStore(state => state.substituteExercise);
  const startRestTimer = useActiveWorkoutStore(state => state.startRestTimer);

  const exerciseIndex = exercises.findIndex(e => e.exerciseId === params.exerciseId);
  const exercise = exerciseIndex >= 0 ? exercises[exerciseIndex] : undefined;

  const logSet = useLogSet();
  const updateSet = useUpdateSet();
  const deleteSet = useDeleteSet();
  const saveRecommendation = useSaveSetRecommendation();
  const saveSubstitution = useSaveExerciseSubstitution();
  const { data: previousPerformance } = usePreviousExercisePerformance(exercise?.exerciseId ?? null, workoutLogId);
  const { data: profile } = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);
  const { data: allExercises } = useExercises('');
  const { data: loggedSets } = useLoggedSets(userId);
  const readinessContext = useReadinessContext(userId);
  const readinessBand = useMemo(
    () => (readinessContext.isLoading ? null : coachingEngine.evaluateReadiness(readinessContext.inputs).band),
    [readinessContext.isLoading, readinessContext.inputs],
  );

  const [optionsSheetOpen, setOptionsSheetOpen] = useState(false);
  const [metricSheetOpen, setMetricSheetOpen] = useState(false);
  const [swapSheetOpen, setSwapSheetOpen] = useState(false);
  const [selectedSubstitute, setSelectedSubstitute] = useState<ExerciseSubstitution | null>(null);
  const [pending, setPending] = useState<PendingRecommendation | null>(null);

  // The exercise this screen was opened for can disappear out from under it
  // (removed, or the workout itself was reset) — bail to the overview rather
  // than render a dead screen.
  useEffect(() => {
    if (!exercise) navigation.goBack();
  }, [exercise, navigation]);

  useEffect(() => {
    setPending(null);
    setSwapSheetOpen(false);
    setSelectedSubstitute(null);
    setOptionsSheetOpen(false);
  }, [params.exerciseId]);

  const personalRecord = useMemo(() => {
    if (!loggedSets || !exercise) return null;
    const events = computePrEvents(loggedSets).filter(e => e.exerciseId === exercise.exerciseId);
    return events.length > 0 ? events[events.length - 1] : null;
  }, [loggedSets, exercise]);

  if (!exercise) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  const canSwap = exercise.sets.every(s => !s.completed);
  const currentExerciseMeta = allExercises?.find(e => e.id === exercise.exerciseId);
  const substitutions: ExerciseSubstitution[] = (() => {
    if (!currentExerciseMeta || !allExercises) return [];
    return coachingEngine.recommendExerciseSubstitution({
      exercise: exerciseRowToMetadata(currentExerciseMeta),
      candidates: allExercises.map(exerciseRowToMetadata),
      availableEquipment: (profile?.equipment_access as EquipmentType[] | undefined) ?? null,
      excludeEquipment: currentExerciseMeta.equipment,
    });
  })();

  const previousExercise = exerciseIndex > 0 ? exercises[exerciseIndex - 1] : null;
  const nextExercise = exerciseIndex < exercises.length - 1 ? exercises[exerciseIndex + 1] : null;
  const completedSets = exercise.sets.filter(s => s.completed).length;
  const totalSets = exercise.targetSets ?? exercise.sets.length;

  const onConfirmSwap = (scope: 'workout_only' | 'permanent') => {
    if (!selectedSubstitute || !currentExerciseMeta) return;
    substituteExercise(exercise.exerciseId, {
      exerciseId: selectedSubstitute.exerciseId,
      exerciseName: selectedSubstitute.exerciseName,
    });
    if (userId) {
      saveSubstitution.mutate({
        userId,
        workoutLogId,
        originalExerciseId: currentExerciseMeta.id,
        substitution: selectedSubstitute,
        scope,
      });
    }
    if (scope === 'permanent' && userId && profile) {
      const remaining = (profile.equipment_access ?? []).filter(e => e !== currentExerciseMeta.equipment);
      updateProfile.mutate({ equipment_access: remaining });
    }
    setSwapSheetOpen(false);
    setSelectedSubstitute(null);
    // Follow the exercise's new identity rather than bouncing to the
    // overview — this is the same screen instance, just re-pointed.
    navigation.setParams({ exerciseId: selectedSubstitute.exerciseId });
  };

  const onRemoveSet = async (setRow: LoggedSet) => {
    if (setRow.dbId) {
      try {
        await deleteSet.mutateAsync(setRow.dbId);
      } catch {
        Alert.alert('Could not remove set', 'Check your connection and try again.');
        return;
      }
    }
    removeSet(exercise.exerciseId, setRow.id);
  };

  const onRemoveExercise = () => {
    const hasData = exercise.sets.some(isSetPopulated);
    Alert.alert(
      `Remove ${exercise.exerciseName}?`,
      hasData
        ? 'This removes the exercise and every set logged for it from this workout — it can’t be undone.'
        : 'This removes the exercise from this workout.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const savedSets = exercise.sets.filter(s => s.dbId);
            await Promise.all(
              savedSets.map(s => (s.dbId ? deleteSet.mutateAsync(s.dbId).catch(() => undefined) : undefined)),
            );
            removeExercise(exercise.exerciseId);
            navigation.goBack();
          },
        },
      ],
    );
  };

  // Keeps a completed set's persisted workout_log_sets row in sync when its
  // reps/weight/RPE are edited after the fact — completion no longer locks
  // the inputs, but onToggleSet only ever pushes reps/load/rpe to the
  // backend at the moment of completion, so post-completion edits need their
  // own write here or the DB copy (which history/PR queries read from)
  // would silently drift from what's shown in the active workout.
  const onChangeSet = (setRow: LoggedSet, patch: Partial<Pick<LoggedSet, 'reps' | 'loadKg' | 'rpe'>>) => {
    updateSetDraft(exercise.exerciseId, setRow.id, patch);
    if (setRow.completed && setRow.dbId) {
      const merged = { ...setRow, ...patch };
      updateSet.mutate({
        id: setRow.dbId,
        ...(merged.reps != null ? { reps: merged.reps } : {}),
        load_kg: merged.loadKg,
        rpe: merged.rpe,
      });
    }
  };

  const onToggleSet = async (setRow: LoggedSet) => {
    if (setRow.completed) {
      markSetIncomplete(exercise.exerciseId, setRow.id);
      if (setRow.dbId) updateSet.mutate({ id: setRow.dbId, completed: false });
      return;
    }
    if (!workoutLogId || !setRow.reps || setRow.reps <= 0) {
      Alert.alert('Enter reps', 'Reps must be a positive number.');
      return;
    }
    try {
      if (setRow.dbId) {
        await updateSet.mutateAsync({
          id: setRow.dbId,
          reps: setRow.reps,
          load_kg: setRow.loadKg,
          rpe: setRow.rpe,
          completed: true,
        });
        markSetCompleted(exercise.exerciseId, setRow.id, setRow.dbId);
      } else {
        const created = await logSet.mutateAsync({
          workout_log_id: workoutLogId,
          exercise_id: exercise.exerciseId,
          set_number: setRow.setNumber,
          reps: setRow.reps,
          load_kg: setRow.loadKg,
          rpe: setRow.rpe,
          is_warmup: setRow.isWarmup,
        });
        markSetCompleted(exercise.exerciseId, setRow.id, created.id);
      }
      startRestTimer(exercise.restSeconds ?? 90);

      if (!setRow.isWarmup) {
        const updatedSets = exercise.sets.map(s =>
          s.id === setRow.id ? { ...s, completed: true, reps: setRow.reps, loadKg: setRow.loadKg, rpe: setRow.rpe } : s,
        );
        const completedWorkingSets = updatedSets
          .filter(s => s.completed && !s.isWarmup)
          .sort((a, b) => a.setNumber - b.setNumber);
        const nextDraft = updatedSets
          .filter(s => !s.completed)
          .sort((a, b) => a.setNumber - b.setNumber)[0];
        const nextSetNumber = nextDraft ? nextDraft.setNumber : null;

        const recommendation = coachingEngine.recommendNextSet({
          target: {
            exerciseId: exercise.exerciseId,
            targetSets: exercise.targetSets ?? updatedSets.length,
            targetRepsMin: exercise.targetRepsMin ?? null,
            targetRepsMax: exercise.targetRepsMax ?? null,
            targetLoadKg: exercise.targetLoadKg ?? null,
            targetRpe: exercise.targetRpe ?? null,
            restSeconds: exercise.restSeconds ?? null,
          },
          completedSets: completedWorkingSets.map(s => ({
            setNumber: s.setNumber,
            reps: s.reps ?? 0,
            loadKg: s.loadKg,
            rpe: s.rpe,
          })),
          nextSetNumber,
          readinessBand,
        });

        setPending(
          recommendation ? { recommendation, nextSetNumber, afterSetNumber: setRow.setNumber } : null,
        );
      }
    } catch {
      Alert.alert('Set not saved', 'Could not save that set — check your connection and try again.');
    }
  };

  const onRespondToRecommendation = async (accepted: boolean) => {
    if (!pending) return;
    const { recommendation: rec, nextSetNumber, afterSetNumber } = pending;

    if (accepted) {
      switch (rec.type) {
        case 'increase_weight':
        case 'reduce_weight':
        case 'keep_weight':
        case 'adjust_reps': {
          const target = nextSetNumber != null
            ? exercise.sets.find(s => s.setNumber === nextSetNumber && !s.completed)
            : undefined;
          if (target) {
            updateSetDraft(exercise.exerciseId, target.id, {
              reps: rec.recommendedReps ?? target.reps,
              loadKg: rec.recommendedLoadKg ?? target.loadKg,
            });
          }
          break;
        }
        case 'increase_rest':
          startRestTimer(rec.recommendedRestSeconds ?? exercise.restSeconds ?? 90);
          break;
        case 'remove_last_set': {
          const target = exercise.sets.find(s => s.setNumber === afterSetNumber);
          if (target) await onRemoveSet(target);
          break;
        }
        case 'stop_exercise': {
          const remaining = exercise.sets.filter(s => !s.completed);
          for (const setRow of remaining) {
            if (setRow.dbId) {
              try {
                await deleteSet.mutateAsync(setRow.dbId);
              } catch {
                // Best-effort — still remove it locally so the exercise reads as done.
              }
            }
            removeSet(exercise.exerciseId, setRow.id);
          }
          setExerciseTargetSets(exercise.exerciseId, afterSetNumber);
          break;
        }
      }
    }

    if (userId && workoutLogId) {
      saveRecommendation.mutate({
        userId,
        workoutLogId,
        exerciseId: exercise.exerciseId,
        afterSetNumber,
        recommendation: rec,
        accepted,
      });
    }
    setPending(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <FocusedExerciseHeader
        exerciseName={exercise.exerciseName}
        exerciseNumber={exerciseIndex + 1}
        totalExercises={exercises.length}
        completedSets={completedSets}
        totalSets={totalSets}
        onBack={() => navigation.goBack()}
        onPrevious={previousExercise ? () => navigation.setParams({ exerciseId: previousExercise.exerciseId }) : undefined}
        onNext={nextExercise ? () => navigation.setParams({ exerciseId: nextExercise.exerciseId }) : undefined}
        onOptionsPress={() => setOptionsSheetOpen(true)}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.lg }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <ExerciseHistorySummary
            exercise={exercise}
            previousPerformance={previousPerformance}
            personalRecord={personalRecord}
            unitPref={unitPref}
          />

          <RestTimerBanner />

          {pending ? (
            <Card variant="subtle" style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <Icon
                  name={RECOMMENDATION_ICON[pending.recommendation.type]}
                  size="sm"
                  color={theme.colors.accent.primary}
                />
                <Text variant="body" style={{ flex: 1, fontWeight: '700' }}>
                  {recommendationDetail(pending.recommendation, unitPref) ?? 'Coaching suggestion'}
                </Text>
              </View>
              <Text variant="caption" color="secondary">
                {pending.recommendation.reason}
              </Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={RECOMMENDATION_ACTION_LABELS[pending.recommendation.type].accept}
                    size="sm"
                    onPress={() => onRespondToRecommendation(true)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label={RECOMMENDATION_ACTION_LABELS[pending.recommendation.type].ignore}
                    variant="ghost"
                    size="sm"
                    onPress={() => onRespondToRecommendation(false)}
                  />
                </View>
              </View>
            </Card>
          ) : null}

          <View style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <View style={{ width: 44 }} />
              <Text variant="label" color="secondary" style={{ width: 36 }} />
              <Text variant="label" color="secondary" style={{ flex: 1 }}>
                REPS
              </Text>
              <Pressable
                onPress={() => setMetricSheetOpen(true)}
                accessibilityLabel={`Change tracked metric, currently ${metricLabel(exercise.metric)}`}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs }}
              >
                <Text variant="label" color="secondary">
                  {metricLabel(exercise.metric)}
                </Text>
                <Icon name="chevronDown" size="sm" color={theme.colors.text.tertiary} />
              </Pressable>
              <Text variant="label" color="secondary" style={{ flex: 1 }}>
                RPE
              </Text>
              <View style={{ width: 44 }} />
            </View>

            {exercise.sets.map(setRow => (
              <WorkoutSetRow
                key={setRow.id}
                setRow={setRow}
                metric={exercise.metric}
                onToggle={() => onToggleSet(setRow)}
                onRemove={() => onRemoveSet(setRow)}
                onChange={patch => onChangeSet(setRow, patch)}
              />
            ))}
          </View>

          <Button label="Add Set" variant="secondary" onPress={() => addSet(exercise.exerciseId)} />

          <TextField
            label="Notes (optional)"
            value={exercise.notes}
            onChangeText={text => setExerciseNotes(exercise.exerciseId, text)}
            placeholder="How did this exercise feel?"
            multiline
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet
        visible={optionsSheetOpen}
        onClose={() => setOptionsSheetOpen(false)}
        title={exercise.exerciseName}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <ListRow
            title="View exercise details"
            icon="info"
            onPress={() => {
              setOptionsSheetOpen(false);
              navigation.navigate('ExerciseDetail', { exerciseId: exercise.exerciseId });
            }}
          />
          {canSwap ? (
            <ListRow
              title="Find a substitute exercise"
              icon="repeat"
              onPress={() => {
                setOptionsSheetOpen(false);
                setSwapSheetOpen(true);
              }}
            />
          ) : null}
          <ListRow
            title="Remove exercise from workout"
            icon="trash"
            onPress={() => {
              setOptionsSheetOpen(false);
              onRemoveExercise();
            }}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={metricSheetOpen}
        onClose={() => setMetricSheetOpen(false)}
        title="Track this exercise by"
      >
        <View style={{ gap: theme.spacing.xs }}>
          {METRIC_OPTIONS.map(option => (
            <ListRow
              key={option.value}
              title={option.label}
              onPress={
                option.disabled
                  ? undefined
                  : () => {
                      setExerciseMetric(exercise.exerciseId, option.value);
                      setMetricSheetOpen(false);
                    }
              }
              style={option.disabled ? { opacity: 0.4 } : undefined}
              trailing={
                exercise.metric === option.value ? (
                  <Icon name="check" size="sm" color={theme.colors.accent.primary} />
                ) : null
              }
            />
          ))}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={swapSheetOpen}
        onClose={() => {
          setSwapSheetOpen(false);
          setSelectedSubstitute(null);
        }}
        title="Find a substitute"
      >
        <View style={{ gap: theme.spacing.md }}>
          {substitutions.length === 0 ? (
            <Text variant="body" color="secondary">
              No close substitute in the library yet.
            </Text>
          ) : (
            <View style={{ gap: theme.spacing.xs }}>
              {substitutions.map(substitution => (
                <ListRow
                  key={substitution.exerciseId}
                  title={substitution.exerciseName}
                  subtitle={substitution.reason}
                  onPress={() => setSelectedSubstitute(substitution)}
                  trailing={
                    selectedSubstitute?.exerciseId === substitution.exerciseId ? (
                      <Icon name="check" size="sm" color={theme.colors.accent.primary} />
                    ) : null
                  }
                />
              ))}
            </View>
          )}

          {selectedSubstitute ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Button label="Swap for this workout" onPress={() => onConfirmSwap('workout_only')} />
              {currentExerciseMeta ? (
                <Button
                  label={`Swap + remove ${currentExerciseMeta.equipment} from my equipment`}
                  variant="secondary"
                  onPress={() => onConfirmSwap('permanent')}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
