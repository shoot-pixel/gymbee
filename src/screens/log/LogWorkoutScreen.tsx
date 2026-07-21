import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Text,
  Card,
  Button,
  TextField,
  StatTile,
  Icon,
  IconButton,
  ListRow,
  BottomSheet,
  LoadingState,
  type IconName,
} from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import {
  useActiveWorkoutStore,
  isExerciseComplete,
  computeWorkoutStats,
  type ActiveExercise,
  type LoggedSet,
  type SetMetric,
  type WorkoutSource,
} from '../../store/activeWorkoutStore';
import { useProgramDay } from '../../services/api/queries/programs';
import { useScheduledWorkout } from '../../services/api/queries/scheduledWorkouts';
import { useWorkoutTemplate } from '../../services/api/queries/workoutTemplates';
import { useStartWorkoutLog, useLogSet, useUpdateSet, useDeleteSet } from '../../services/api/queries/workoutLogs';
import {
  useWorkoutAdaptations,
  useReadinessContext,
  usePreviousExercisePerformance,
  useSaveSetRecommendation,
  useSaveExerciseSubstitution,
} from '../../services/api/queries/coaching';
import { useExercises } from '../../services/api/queries/exercises';
import { useProfile, useUpdateProfile } from '../../services/api/queries/profiles';
import {
  coachingEngine,
  type ExerciseSubstitution,
  type ReadinessBand,
  type SetRecommendation,
  type WorkoutVariantResult,
} from '../../services/coaching';
import { RestTimerBanner } from './RestTimerBanner';
import { useUnitPreference } from '../../hooks/useUnitPreference';
import { formatVolume, formatWeight, parseWeightInput, unitLabel } from '../../utils/units';
import { exerciseRowToMetadata } from '../../utils/exerciseMetadata';
import { buildVariantSourceExercises } from '../../utils/variantSource';
import type { LogStackParamList } from '../../navigation/types';
import type { Database, EquipmentType, UnitPreference } from '../../types/database';

type WorkoutAdaptationRow = Database['public']['Tables']['workout_adaptations']['Row'];

/** Only fields that map onto a numeric ActiveExercise target — 'workout_type'
 * (the recovery_replacement marker) has no ActiveExercise field to write to. */
const ADAPTATION_FIELD_TO_KEY: Partial<Record<string, 'targetSets' | 'targetRepsMin' | 'targetRepsMax' | 'targetLoadKg' | 'targetRpe' | 'restSeconds'>> = {
  target_sets: 'targetSets',
  target_load_kg: 'targetLoadKg',
  target_rpe: 'targetRpe',
  rest_seconds: 'restSeconds',
};

function applyAcceptedAdaptations(
  exercises: Array<Omit<ActiveExercise, 'sets' | 'notes' | 'metric'>>,
  adaptations: WorkoutAdaptationRow[],
): Array<Omit<ActiveExercise, 'sets' | 'notes' | 'metric'>> {
  const accepted = adaptations.filter(a => a.status === 'accepted');
  if (accepted.length === 0) return exercises;
  return exercises.map(exercise => {
    let updated = exercise;
    for (const adaptation of accepted) {
      if (adaptation.target_exercise_id != null && adaptation.target_exercise_id !== exercise.exerciseId) continue;
      const key = ADAPTATION_FIELD_TO_KEY[adaptation.field_changed];
      if (!key) continue;
      const value = adaptation.updated_value;
      if (typeof value !== 'number') continue;
      updated = { ...updated, [key]: value };
    }
    return updated;
  });
}

const METRIC_OPTIONS: Array<{ value: SetMetric; label: string; disabled?: boolean }> = [
  { value: 'weight_lb', label: 'Weight (lb)' },
  { value: 'weight_kg', label: 'Weight (kg)' },
  { value: 'weight_pct', label: 'Weight (%)' },
  { value: 'reps', label: 'Reps' },
  { value: 'time', label: 'Time (coming soon)', disabled: true },
];

function metricLabel(metric: SetMetric): string {
  switch (metric) {
    case 'weight_lb':
      return 'LB';
    case 'weight_kg':
      return 'KG';
    case 'weight_pct':
      return '%';
    case 'reps':
      return 'REPS';
    case 'time':
      return 'TIME';
  }
}

function metricPlaceholder(metric: SetMetric): string {
  switch (metric) {
    case 'weight_lb':
      return 'lb';
    case 'weight_kg':
      return 'kg';
    case 'weight_pct':
      return '%';
    case 'reps':
      return 'reps';
    case 'time':
      return 'time';
  }
}

/** Storage stays the same `loadKg` field regardless of metric — only the two
 * weight modes convert it for display/entry; % and reps pass the raw number
 * through unconverted (there's no meaningful formula between them and kg). */
function formatMetricValue(loadKg: number | null, metric: SetMetric): string {
  if (loadKg == null) return '';
  if (metric === 'weight_lb') return formatWeight(loadKg, 'lb');
  if (metric === 'weight_kg') return formatWeight(loadKg, 'kg');
  return String(loadKg);
}

function parseMetricValue(text: string, metric: SetMetric): number | null {
  if (metric === 'weight_lb') return parseWeightInput(text, 'lb');
  if (metric === 'weight_kg') return parseWeightInput(text, 'kg');
  if (text.trim() === '') return null;
  const parsed = parseFloat(text);
  return Number.isNaN(parsed) ? null : parsed;
}

/** program_exercises / scheduled_workout_exercises / workout_template_exercises
 * all share this exact shape, so one mapper covers every start source. */
type TargetRow = {
  exercises: { id: string; name: string };
  target_sets: number;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_load_kg: number | null;
  target_rpe: number | null;
  rest_seconds: number | null;
};

function mapTargetsToActiveExercises(
  rows: TargetRow[],
): Array<Omit<ActiveExercise, 'sets' | 'notes' | 'metric'>> {
  return rows.map(row => ({
    exerciseId: row.exercises.id,
    exerciseName: row.exercises.name,
    targetSets: row.target_sets,
    targetRepsMin: row.target_reps_min,
    targetRepsMax: row.target_reps_max,
    targetLoadKg: row.target_load_kg,
    targetRpe: row.target_rpe,
    restSeconds: row.rest_seconds,
  }));
}

/** Normalizes a route-derived `null` (no params) to the same key as the
 * store's `{type:'freestyle', id:null}` so an in-progress freestyle session
 * doesn't look "stale" and get wiped out by the auto-start effect. */
function sourceKey(source: WorkoutSource | null): string {
  const normalized = source ?? { type: 'freestyle' as const, id: null };
  return `${normalized.type}:${normalized.id}`;
}

type Route = RouteProp<LogStackParamList, 'LogWorkout'>;
type Nav = NativeStackNavigationProp<LogStackParamList>;

/** Ticks a live mm:ss elapsed label for the workout timer, same formatting as RestTimerBanner. */
function useElapsedLabel(startedAt: number | null): string {
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => forceTick(n => n + 1), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return '0:00';
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** A set counts as "populated" once it holds any data worth confirming before losing. */
function isSetPopulated(setRow: LoggedSet): boolean {
  return setRow.completed || setRow.reps != null || setRow.loadKg != null || setRow.rpe != null;
}

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

function SetRow({
  setRow,
  metric,
  onToggle,
  onRemove,
  onChange,
}: {
  setRow: LoggedSet;
  metric: SetMetric;
  onToggle: () => void;
  onRemove: () => void;
  onChange: (patch: Partial<Pick<LoggedSet, 'reps' | 'loadKg' | 'rpe'>>) => void;
}) {
  const theme = useTheme();

  const onDeletePress = () => {
    if (!isSetPopulated(setRow)) {
      onRemove();
      return;
    }
    Alert.alert(
      'Delete set?',
      'This set has data — deleting it can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onRemove },
      ],
    );
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        opacity: setRow.completed ? 0.65 : 1,
      }}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: setRow.completed }}
        accessibilityLabel={`Set ${setRow.setNumber} ${setRow.completed ? 'complete' : 'incomplete'}`}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: theme.radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: setRow.completed ? theme.colors.accent.primary : 'transparent',
            borderWidth: setRow.completed ? 0 : 2,
            borderColor: theme.colors.border.default,
          }}
        >
          {setRow.completed ? (
            <Icon name="check" size="sm" color={theme.colors.text.onAccent} strokeWidth={3} />
          ) : null}
        </View>
      </Pressable>
      <Text variant="body" color="secondary" style={{ width: 36 }}>
        {setRow.setNumber}
      </Text>
      <View style={{ flex: 1 }}>
        <TextField
          keyboardType="number-pad"
          value={setRow.reps != null ? String(setRow.reps) : ''}
          onChangeText={text => onChange({ reps: text === '' ? null : parseInt(text, 10) || null })}
          placeholder="Reps"
          editable={!setRow.completed}
        />
      </View>
      <View style={{ flex: 1 }}>
        <TextField
          keyboardType={metric === 'weight_lb' || metric === 'weight_kg' ? 'decimal-pad' : 'numeric'}
          value={formatMetricValue(setRow.loadKg, metric)}
          onChangeText={text => onChange({ loadKg: parseMetricValue(text, metric) })}
          placeholder={metricPlaceholder(metric)}
          editable={!setRow.completed}
        />
      </View>
      <View style={{ flex: 1 }}>
        <TextField
          keyboardType="decimal-pad"
          value={setRow.rpe != null ? String(setRow.rpe) : ''}
          onChangeText={text => onChange({ rpe: text === '' ? null : parseFloat(text) || null })}
          placeholder="RPE"
          editable={!setRow.completed}
        />
      </View>
      <Pressable
        onPress={onDeletePress}
        style={({ pressed }) => [
          { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 1 : 0.55 },
        ]}
      >
        <Icon name="trash" size="sm" color={theme.colors.semantic.danger} />
      </Pressable>
    </View>
  );
}

type PendingRecommendation = {
  recommendation: SetRecommendation;
  /** The draft set number it would apply to, if any remain. */
  nextSetNumber: number | null;
  /** The set number that was just completed, prompting this recommendation. */
  afterSetNumber: number;
};

function ExerciseFocusCard({
  exercise,
  exerciseNumber,
  totalExercises,
  readinessBand,
  unitPref,
  userId,
}: {
  exercise: ActiveExercise;
  exerciseNumber: number;
  totalExercises: number;
  readinessBand: ReadinessBand | null;
  unitPref: UnitPreference;
  userId: string | null;
}) {
  const theme = useTheme();
  const workoutLogId = useActiveWorkoutStore(state => state.workoutLogId);
  const addSet = useActiveWorkoutStore(state => state.addSet);
  const updateSetDraft = useActiveWorkoutStore(state => state.updateSetDraft);
  const markSetCompleted = useActiveWorkoutStore(state => state.markSetCompleted);
  const markSetIncomplete = useActiveWorkoutStore(state => state.markSetIncomplete);
  const removeSet = useActiveWorkoutStore(state => state.removeSet);
  const setExerciseNotes = useActiveWorkoutStore(state => state.setExerciseNotes);
  const setExerciseMetric = useActiveWorkoutStore(state => state.setExerciseMetric);
  const setExerciseTargetSets = useActiveWorkoutStore(state => state.setExerciseTargetSets);
  const substituteExercise = useActiveWorkoutStore(state => state.substituteExercise);
  const startRestTimer = useActiveWorkoutStore(state => state.startRestTimer);
  const logSet = useLogSet();
  const updateSet = useUpdateSet();
  const deleteSet = useDeleteSet();
  const saveRecommendation = useSaveSetRecommendation();
  const saveSubstitution = useSaveExerciseSubstitution();
  const { data: previousPerformance } = usePreviousExercisePerformance(exercise.exerciseId, workoutLogId);
  const { data: profile } = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);
  const { data: allExercises } = useExercises('');
  const [metricSheetOpen, setMetricSheetOpen] = useState(false);
  const [swapSheetOpen, setSwapSheetOpen] = useState(false);
  const [selectedSubstitute, setSelectedSubstitute] = useState<ExerciseSubstitution | null>(null);
  const [pending, setPending] = useState<PendingRecommendation | null>(null);

  useEffect(() => {
    setPending(null);
    setSwapSheetOpen(false);
    setSelectedSubstitute(null);
  }, [exercise.exerciseId]);

  const canSwap = exercise.sets.every(s => !s.completed);
  const currentExerciseMeta = allExercises?.find(e => e.id === exercise.exerciseId);
  const substitutions = useMemo<ExerciseSubstitution[]>(() => {
    if (!currentExerciseMeta || !allExercises) return [];
    return coachingEngine.recommendExerciseSubstitution({
      exercise: exerciseRowToMetadata(currentExerciseMeta),
      candidates: allExercises.map(exerciseRowToMetadata),
      availableEquipment: (profile?.equipment_access as EquipmentType[] | undefined) ?? null,
      excludeEquipment: currentExerciseMeta.equipment,
    });
  }, [currentExerciseMeta, allExercises, profile?.equipment_access]);

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
  };

  const targetLabel =
    exercise.targetSets != null
      ? `Target: ${exercise.targetSets} × ${exercise.targetRepsMin ?? '?'}${
          exercise.targetRepsMax && exercise.targetRepsMax !== exercise.targetRepsMin
            ? `-${exercise.targetRepsMax}`
            : ''
        }${exercise.targetRpe ? ` @ RPE ${exercise.targetRpe}` : ''}`
      : null;

  const lastTimeSet = previousPerformance?.bestSet ?? previousPerformance?.sets[previousPerformance.sets.length - 1];
  const previousPerformanceLabel = lastTimeSet
    ? `Last time: ${previousPerformance?.sets.length}×${lastTimeSet.reps}${
        lastTimeSet.loadKg != null ? ` @ ${formatWeight(lastTimeSet.loadKg, unitPref)}${unitLabel(unitPref)}` : ''
      }`
    : null;

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
    <Card variant="elevated" style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="label" color="secondary">
            EXERCISE {exerciseNumber} OF {totalExercises}
          </Text>
          <Text variant="title">{exercise.exerciseName}</Text>
          {targetLabel ? (
            <Text variant="body" color="secondary">
              {targetLabel}
            </Text>
          ) : null}
          {previousPerformanceLabel ? (
            <Text variant="caption" color="tertiary">
              {previousPerformanceLabel}
            </Text>
          ) : null}
        </View>
        {canSwap ? (
          <IconButton
            name="repeat"
            variant="ghost"
            accessibilityLabel="Find a substitute exercise"
            onPress={() => setSwapSheetOpen(true)}
          />
        ) : null}
      </View>

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
          <SetRow
            key={setRow.id}
            setRow={setRow}
            metric={exercise.metric}
            onToggle={() => onToggleSet(setRow)}
            onRemove={() => onRemoveSet(setRow)}
            onChange={patch => updateSetDraft(exercise.exerciseId, setRow.id, patch)}
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
    </Card>
  );
}

export function LogWorkoutScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();

  const routeSource: WorkoutSource | null = params?.programDayId
    ? { type: 'programDay', id: params.programDayId }
    : params?.scheduledWorkoutId
      ? { type: 'scheduledWorkout', id: params.scheduledWorkoutId }
      : params?.templateId
        ? { type: 'template', id: params.templateId }
        : null;

  const userId = useAuthStore(state => state.userId);
  const { data: programDay, isLoading: dayLoading } = useProgramDay(
    routeSource?.type === 'programDay' ? routeSource.id : undefined,
  );
  const { data: scheduledWorkout, isLoading: scheduledLoading } = useScheduledWorkout(
    routeSource?.type === 'scheduledWorkout' ? routeSource.id : undefined,
  );
  const { data: template, isLoading: templateLoading } = useWorkoutTemplate(
    routeSource?.type === 'template' ? routeSource.id : undefined,
  );
  const { data: workoutAdaptations } = useWorkoutAdaptations(userId, {
    programDayId: routeSource?.type === 'programDay' ? routeSource.id : undefined,
    scheduledWorkoutId: routeSource?.type === 'scheduledWorkout' ? routeSource.id : undefined,
  });
  const acceptedAdaptationCount = (workoutAdaptations ?? []).filter(a => a.status === 'accepted').length;
  const unitPref = useUnitPreference();
  const { data: profile } = useProfile(userId);
  const { data: allExercises } = useExercises('');
  const [appliedVariant, setAppliedVariant] = useState<WorkoutVariantResult | null>(null);

  // Cache-shared with PreWorkoutReviewScreen via the same React Query keys —
  // reading it again here doesn't cost an extra network round trip.
  const readinessContext = useReadinessContext(userId);
  const readinessBand = useMemo(
    () => (readinessContext.isLoading ? null : coachingEngine.evaluateReadiness(readinessContext.inputs).band),
    [readinessContext.isLoading, readinessContext.inputs],
  );

  const store = useActiveWorkoutStore();
  const startWorkoutLog = useStartWorkoutLog();
  const elapsedLabel = useElapsedLabel(store.startedAt);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  // Guided workouts (a source is set in params) start as soon as the user
  // taps "Start Workout" elsewhere, so auto-starting here is fine. Freestyle
  // has no such prior intent signal — auto-starting on tab focus would
  // silently create a workout_logs row just from opening the Log tab, so it
  // waits for an explicit "Start Freestyle Workout" tap.
  const [freestyleStarted, setFreestyleStarted] = useState(false);

  const needsFreshStart = store.workoutLogId == null || sourceKey(store.source) !== sourceKey(routeSource);
  const sourceDataLoaded =
    routeSource == null ||
    (routeSource.type === 'programDay' && programDay != null) ||
    (routeSource.type === 'scheduledWorkout' && scheduledWorkout != null) ||
    (routeSource.type === 'template' && template != null);
  const readyToStart = !needsFreshStart || sourceDataLoaded;
  const shouldAutoStart = routeSource != null || freestyleStarted;
  const requestedVariant = params?.variantType && params.variantType !== 'full' ? params.variantType : null;
  // A variant needs the full exercise library for substitution/metadata —
  // hold off starting until it's loaded rather than silently starting the
  // unmodified workout.
  const variantDataReady = !requestedVariant || allExercises != null;

  useEffect(() => {
    if (!needsFreshStart || !userId || !readyToStart || !shouldAutoStart || !variantDataReady) return;

    let cancelled = false;
    (async () => {
      try {
        const created = await startWorkoutLog.mutateAsync({
          userId,
          programDayId: routeSource?.type === 'programDay' ? routeSource.id : null,
          scheduledWorkoutId: routeSource?.type === 'scheduledWorkout' ? routeSource.id : null,
          variantType: params?.variantType ?? null,
        });
        if (cancelled) return;

        const targets =
          routeSource?.type === 'programDay' && programDay
            ? programDay.program_exercises
            : routeSource?.type === 'scheduledWorkout' && scheduledWorkout
              ? scheduledWorkout.scheduled_workout_exercises
              : routeSource?.type === 'template' && template
                ? template.workout_template_exercises
                : [];
        const defaultMetric: SetMetric = unitPref === 'lb' ? 'weight_lb' : 'weight_kg';

        let baseTargets = mapTargetsToActiveExercises(targets);
        if (requestedVariant && allExercises) {
          const source = buildVariantSourceExercises(targets, allExercises);
          const availableEquipment = (profile?.equipment_access as EquipmentType[] | undefined) ?? null;
          const variantResult = coachingEngine.generateWorkoutVariant({
            source,
            variantType: requestedVariant,
            candidates: allExercises.map(exerciseRowToMetadata),
            availableEquipment,
          });
          baseTargets = variantResult.exercises.map(e => ({
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            targetSets: e.targetSets,
            targetRepsMin: e.targetRepsMin,
            targetRepsMax: e.targetRepsMax,
            targetLoadKg: e.targetLoadKg,
            targetRpe: e.targetRpe,
            restSeconds: e.restSeconds,
          }));
          setAppliedVariant(variantResult);
        }

        const adaptedTargets = applyAcceptedAdaptations(baseTargets, workoutAdaptations ?? []);
        const exercises = adaptedTargets.map(e => ({ ...e, metric: defaultMetric }));

        store.startWorkout({
          workoutLogId: created.id,
          source: routeSource ?? { type: 'freestyle', id: null },
          exercises,
        });
        setExerciseIndex(0);
      } catch (err) {
        if (cancelled) return;
        Alert.alert(
          'Could not start workout',
          err instanceof Error ? err.message : 'Please try again.',
        );
        setFreestyleStarted(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    needsFreshStart,
    userId,
    readyToStart,
    shouldAutoStart,
    variantDataReady,
    routeSource?.type,
    routeSource?.id,
    programDay,
    scheduledWorkout,
    template,
    workoutAdaptations,
    requestedVariant,
    allExercises,
    profile?.equipment_access,
  ]);

  // Reset the freestyle intent flag once the session actually ends (store
  // reset happens on the Workout Summary screen after saving), otherwise a
  // stale `freestyleStarted` would silently auto-start a new session the
  // next time this screen is focused.
  useEffect(() => {
    if (store.workoutLogId == null) setFreestyleStarted(false);
  }, [store.workoutLogId]);

  const stats = computeWorkoutStats(store.exercises);
  const allComplete = stats.totalExercises > 0 && store.exercises.every(isExerciseComplete);
  const clampedIndex = Math.min(exerciseIndex, Math.max(store.exercises.length - 1, 0));
  const currentExercise = store.exercises[clampedIndex];

  const onFinish = () => {
    navigation.navigate('WorkoutSummary');
  };

  if (routeSource == null && !shouldAutoStart) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.colors.bg.base,
          padding: theme.spacing.lg,
          justifyContent: 'center',
          gap: theme.spacing.md,
        }}
      >
        <Card variant="elevated" style={{ gap: theme.spacing.md, alignItems: 'center', paddingVertical: theme.spacing.xl }}>
          <Text variant="title">Log a Workout</Text>
          <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
            Start a freestyle session and add exercises as you go.
          </Text>
          <View style={{ width: '100%' }}>
            <Button label="Start Freestyle Workout" onPress={() => setFreestyleStarted(true)} />
          </View>
        </Card>
        <Button
          label="Browse Exercise Library"
          variant="secondary"
          onPress={() => navigation.navigate('ExercisePicker')}
        />
        <Button
          label="Browse Workout Library"
          variant="secondary"
          onPress={() => navigation.navigate('Library')}
        />
      </SafeAreaView>
    );
  }

  if (
    dayLoading ||
    scheduledLoading ||
    templateLoading ||
    (needsFreshStart && !readyToStart) ||
    store.workoutLogId == null
  ) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  const workoutTitle = programDay?.title ?? scheduledWorkout?.name ?? template?.name ?? 'Freestyle Workout';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <View style={{ paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.sm, gap: theme.spacing.sm }}>
        <Text variant="title" style={{ paddingHorizontal: theme.spacing.lg }}>
          {workoutTitle}
        </Text>

        {acceptedAdaptationCount > 0 ? (
          <Pressable
            onPress={() =>
              Alert.alert(
                'Adapted for today',
                (workoutAdaptations ?? [])
                  .filter(a => a.status === 'accepted')
                  .map(a => `• ${a.reason}`)
                  .join('\n'),
              )
            }
            style={{
              marginHorizontal: theme.spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.xs,
              backgroundColor: theme.colors.accent.subtle,
              borderRadius: theme.radii.sm,
              paddingVertical: theme.spacing.xs,
              paddingHorizontal: theme.spacing.sm,
            }}
          >
            <Icon name="zap" size="sm" color={theme.colors.accent.primary} />
            <Text variant="caption" color="secondary">
              Adapted for today — tap to view changes
            </Text>
          </Pressable>
        ) : null}

        {appliedVariant ? (
          <Pressable
            onPress={() =>
              Alert.alert(
                appliedVariant.label,
                appliedVariant.changes.map(c => `• ${c.reason}`).join('\n'),
              )
            }
            style={{
              marginHorizontal: theme.spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.xs,
              backgroundColor: theme.colors.accent.subtle,
              borderRadius: theme.radii.sm,
              paddingVertical: theme.spacing.xs,
              paddingHorizontal: theme.spacing.sm,
            }}
          >
            <Icon name="repeat" size="sm" color={theme.colors.accent.primary} />
            <Text variant="caption" color="secondary">
              Variant: {appliedVariant.label} — tap to view changes
            </Text>
          </Pressable>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            gap: theme.spacing.sm,
          }}
        >
          <View style={{ width: 92 }}>
            <StatTile label="Elapsed" value={elapsedLabel} />
          </View>
          <View style={{ width: 92 }}>
            <StatTile label="Exercises" value={`${stats.completedExercises}/${stats.totalExercises}`} />
          </View>
          <View style={{ width: 72 }}>
            <StatTile label="Sets" value={stats.totalSets} />
          </View>
          <View style={{ width: 72 }}>
            <StatTile label="Reps" value={stats.totalReps} />
          </View>
          <View style={{ width: 104 }}>
            <StatTile
              label="Volume"
              value={`${formatVolume(stats.totalVolumeKg, unitPref)} ${unitLabel(unitPref)}`}
            />
          </View>
        </ScrollView>

        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <RestTimerBanner />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        {currentExercise ? (
          <ExerciseFocusCard
            exercise={currentExercise}
            exerciseNumber={clampedIndex + 1}
            totalExercises={store.exercises.length}
            readinessBand={readinessBand}
            unitPref={unitPref}
            userId={userId}
          />
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg }}>
          <IconButton
            name="chevronLeft"
            onPress={() => setExerciseIndex(i => Math.max(0, i - 1))}
            disabled={clampedIndex === 0}
          />
          <Text variant="caption" color="secondary">
            EXERCISE {clampedIndex + 1} OF {store.exercises.length}
          </Text>
          <IconButton
            name="chevronRight"
            onPress={() => setExerciseIndex(i => Math.min(store.exercises.length - 1, i + 1))}
            disabled={clampedIndex >= store.exercises.length - 1}
          />
        </View>

        <Button
          label="Add Exercise"
          variant="secondary"
          icon="plus"
          onPress={() => navigation.navigate('ExercisePicker', { selectMode: true })}
        />

        <Button label="Finish Workout" onPress={onFinish} disabled={!allComplete} />
      </ScrollView>
    </SafeAreaView>
  );
}
