import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Button, Icon, ListRow, BottomSheet, LoadingState } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import {
  useActiveWorkoutStore,
  isExerciseComplete,
  computeWorkoutStats,
  type ActiveExercise,
  type SetMetric,
  type WorkoutSource,
} from '../../store/activeWorkoutStore';
import { useProgramDay } from '../../services/api/queries/programs';
import { useScheduledWorkout } from '../../services/api/queries/scheduledWorkouts';
import { useWorkoutTemplate } from '../../services/api/queries/workoutTemplates';
import { useStartWorkoutLog } from '../../services/api/queries/workoutLogs';
import { useWorkoutAdaptations } from '../../services/api/queries/coaching';
import { useExercises } from '../../services/api/queries/exercises';
import { useProfile } from '../../services/api/queries/profiles';
import { coachingEngine, type WorkoutVariantResult } from '../../services/coaching';
import { ActiveWorkoutHeader } from './ActiveWorkoutHeader';
import { WorkoutExerciseRow } from './WorkoutExerciseRow';
import { useUnitPreference } from '../../hooks/useUnitPreference';
import { exerciseRowToMetadata } from '../../utils/exerciseMetadata';
import { buildVariantSourceExercises } from '../../utils/variantSource';
import type { LogStackParamList } from '../../navigation/types';
import type { Database, EquipmentType } from '../../types/database';

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

type Route = RouteProp<LogStackParamList, 'ActiveWorkoutOverview'>;
type Nav = NativeStackNavigationProp<LogStackParamList>;

export function ActiveWorkoutOverviewScreen() {
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
  const [optionsSheetOpen, setOptionsSheetOpen] = useState(false);

  const store = useActiveWorkoutStore();
  const startWorkoutLog = useStartWorkoutLog();
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
  const nextIncompleteIndex = store.exercises.findIndex(e => !isExerciseComplete(e));
  const todayLabel = useMemo(() => format(new Date(), 'EEE, MMM d'), []);

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
      <ActiveWorkoutHeader
        title={workoutTitle}
        dateLabel={todayLabel}
        startedAt={store.startedAt}
        stats={stats}
        onOptionsPress={() => setOptionsSheetOpen(true)}
      />

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
            marginBottom: theme.spacing.sm,
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
            marginBottom: theme.spacing.sm,
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
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.sm, paddingBottom: theme.spacing.xxl }}
      >
        {store.exercises.map((exercise, index) => (
          <WorkoutExerciseRow
            key={exercise.exerciseId}
            exercise={exercise}
            order={index + 1}
            isNext={index === nextIncompleteIndex}
            unitPref={unitPref}
            onPress={() => navigation.navigate('ActiveExercise', { exerciseId: exercise.exerciseId })}
          />
        ))}

        <Button
          label="Add Exercise"
          variant="secondary"
          icon="plus"
          onPress={() => navigation.navigate('ExercisePicker', { selectMode: true })}
        />
      </ScrollView>

      <View
        style={{
          padding: theme.spacing.lg,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.subtle,
          backgroundColor: theme.colors.bg.base,
        }}
      >
        <Button label="Finish Workout" onPress={onFinish} disabled={!allComplete} />
      </View>

      <BottomSheet visible={optionsSheetOpen} onClose={() => setOptionsSheetOpen(false)} title="Workout options">
        <ListRow
          title="Browse Exercise Library"
          icon="dumbbell"
          onPress={() => {
            setOptionsSheetOpen(false);
            navigation.navigate('ExercisePicker');
          }}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}
