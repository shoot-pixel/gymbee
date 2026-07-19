import React, { useEffect, useState } from 'react';
import { ScrollView, View, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Button, TextField } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useActiveWorkoutStore, type ActiveExercise } from '../../store/activeWorkoutStore';
import { useProgramDay } from '../../services/api/queries/programs';
import { useStartWorkoutLog, useLogSet, useCompleteWorkoutLog } from '../../services/api/queries/workoutLogs';
import { RestTimerBanner } from './RestTimerBanner';
import type { LogStackParamList, RootStackParamList } from '../../navigation/types';

type Route = RouteProp<LogStackParamList, 'LogWorkout'>;
type Nav = NativeStackNavigationProp<LogStackParamList>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

function ExerciseLogCard({ exercise }: { exercise: ActiveExercise }) {
  const theme = useTheme();
  const logSet = useLogSet();
  const startRestTimer = useActiveWorkoutStore(state => state.startRestTimer);
  const addLoggedSet = useActiveWorkoutStore(state => state.addLoggedSet);
  const removeLoggedSet = useActiveWorkoutStore(state => state.removeLoggedSet);
  const workoutLogId = useActiveWorkoutStore(state => state.workoutLogId);

  const [reps, setReps] = useState('');
  const [load, setLoad] = useState('');
  const [rpe, setRpe] = useState('');

  const targetLabel =
    exercise.targetSets != null
      ? `Target: ${exercise.targetSets} × ${exercise.targetRepsMin ?? '?'}${
          exercise.targetRepsMax && exercise.targetRepsMax !== exercise.targetRepsMin
            ? `-${exercise.targetRepsMax}`
            : ''
        }${exercise.targetRpe ? ` @ RPE ${exercise.targetRpe}` : ''}`
      : null;

  const onLogSet = async () => {
    const repsNum = parseInt(reps, 10);
    if (!workoutLogId || !repsNum || repsNum <= 0) {
      Alert.alert('Enter reps', 'Reps must be a positive number.');
      return;
    }
    const loadNum = load ? parseFloat(load) : null;
    const rpeNum = rpe ? parseFloat(rpe) : null;
    const tempId = `local-${Date.now()}`;
    const setNumber = exercise.sets.length + 1;

    addLoggedSet(exercise.exerciseId, {
      id: tempId,
      setNumber,
      reps: repsNum,
      loadKg: loadNum,
      rpe: rpeNum,
      isWarmup: false,
    });
    setReps('');
    setLoad('');
    setRpe('');
    startRestTimer(exercise.restSeconds ?? 90);

    try {
      await logSet.mutateAsync({
        workout_log_id: workoutLogId,
        exercise_id: exercise.exerciseId,
        set_number: setNumber,
        reps: repsNum,
        load_kg: loadNum,
        rpe: rpeNum,
        is_warmup: false,
      });
    } catch (err) {
      removeLoggedSet(exercise.exerciseId, tempId);
      Alert.alert('Set not saved', 'Could not save that set — check your connection and try again.');
    }
  };

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <Text variant="subtitle">{exercise.exerciseName}</Text>
      {targetLabel ? (
        <Text variant="caption" color="secondary">
          {targetLabel}
        </Text>
      ) : null}

      {exercise.sets.map(set => (
        <View
          key={set.id}
          style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}
        >
          <Text variant="body" color="secondary">
            Set {set.setNumber}
          </Text>
          <Text variant="body">
            {set.reps} reps{set.loadKg != null ? ` @ ${set.loadKg}kg` : ''}
            {set.rpe != null ? ` · RPE ${set.rpe}` : ''}
          </Text>
        </View>
      ))}

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Reps"
            keyboardType="number-pad"
            value={reps}
            onChangeText={setReps}
            placeholder="8"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Load (kg)"
            keyboardType="decimal-pad"
            value={load}
            onChangeText={setLoad}
            placeholder="60"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="RPE"
            keyboardType="decimal-pad"
            value={rpe}
            onChangeText={setRpe}
            placeholder="8"
          />
        </View>
      </View>
      <Button label="Log Set" variant="secondary" onPress={onLogSet} loading={logSet.isPending} />
    </Card>
  );
}

export function LogWorkoutScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const rootNavigation = useNavigation<RootNav>();
  const { params } = useRoute<Route>();
  const programDayId = params?.programDayId ?? null;

  const userId = useAuthStore(state => state.userId);
  const { data: programDay, isLoading: dayLoading } = useProgramDay(programDayId ?? undefined);

  const store = useActiveWorkoutStore();
  const startWorkoutLog = useStartWorkoutLog();
  const completeWorkoutLog = useCompleteWorkoutLog();
  const [finished, setFinished] = useState(false);
  // Guided workouts (programDayId set) start as soon as the user taps "Log
  // This Workout" on a day, so auto-starting here is fine. Freestyle has no
  // such prior intent signal — auto-starting on tab focus would silently
  // create a workout_logs row just from opening the Log tab, so it waits for
  // an explicit "Start Freestyle Workout" tap.
  const [freestyleStarted, setFreestyleStarted] = useState(false);

  const needsFreshStart = store.workoutLogId == null || store.programDayId !== programDayId;
  const readyToStart = !needsFreshStart || programDayId == null || programDay != null;
  const shouldAutoStart = programDayId != null || freestyleStarted;

  useEffect(() => {
    if (!needsFreshStart || !userId || !readyToStart || !shouldAutoStart || finished) return;

    let cancelled = false;
    (async () => {
      try {
        const created = await startWorkoutLog.mutateAsync({ userId, programDayId });
        if (cancelled) return;

        const exercises: ActiveExercise[] =
          programDayId && programDay
            ? programDay.program_exercises.map(pe => ({
                exerciseId: pe.exercises.id,
                exerciseName: pe.exercises.name,
                targetSets: pe.target_sets,
                targetRepsMin: pe.target_reps_min,
                targetRepsMax: pe.target_reps_max,
                targetLoadKg: pe.target_load_kg,
                targetRpe: pe.target_rpe,
                restSeconds: pe.rest_seconds,
                sets: [],
              }))
            : [];

        store.startWorkout({ workoutLogId: created.id, programDayId, exercises });
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
  }, [needsFreshStart, userId, readyToStart, shouldAutoStart, programDayId, programDay, finished]);

  const onFinish = async () => {
    if (!store.workoutLogId) return;
    await completeWorkoutLog.mutateAsync({ workoutLogId: store.workoutLogId });
    store.reset();
    setFreestyleStarted(false);
    setFinished(true);
  };

  if (finished) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.colors.bg.base,
          padding: theme.spacing.xl,
          justifyContent: 'center',
          gap: theme.spacing.md,
        }}
      >
        <Text variant="numeralLg">🎉</Text>
        <Text variant="title">Workout complete</Text>
        <Text variant="body" color="secondary">
          Nice work. Your sets are saved.
        </Text>
        <Button
          label="Done"
          onPress={() => {
            setFinished(false);
            rootNavigation.navigate('MainTabs', { screen: 'TodayTab', params: { screen: 'Today' } });
          }}
        />
      </SafeAreaView>
    );
  }

  if (programDayId == null && !shouldAutoStart) {
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
        <Card style={{ gap: theme.spacing.md, alignItems: 'center' }}>
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
      </SafeAreaView>
    );
  }

  if (dayLoading || (needsFreshStart && !readyToStart) || store.workoutLogId == null) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.bg.base, alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator color={theme.colors.accent.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <Text variant="title">{programDay?.title ?? 'Freestyle Workout'}</Text>

        <RestTimerBanner />

        {store.exercises.map(exercise => (
          <ExerciseLogCard key={exercise.exerciseId} exercise={exercise} />
        ))}

        <Button
          label="Add Exercise"
          variant="secondary"
          onPress={() => navigation.navigate('ExercisePicker', { selectMode: true })}
        />

        <Button label="Finish Workout" onPress={onFinish} loading={completeWorkoutLog.isPending} />
      </ScrollView>
    </SafeAreaView>
  );
}
