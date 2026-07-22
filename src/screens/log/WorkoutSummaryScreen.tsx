import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Button, TextField, SegmentedControl, StatTile, Icon, ListRow, LoadingState } from '../../components/core';
import { useActiveWorkoutStore, computeWorkoutStats, type ActiveExercise } from '../../store/activeWorkoutStore';
import { useAuthStore } from '../../store/authStore';
import { useCompleteWorkoutLog } from '../../services/api/queries/workoutLogs';
import { useLoggedSets, computePrEvents } from '../../services/api/queries/progress';
import { usePreviousPerformanceForExercises, useReadinessContext } from '../../services/api/queries/coaching';
import { coachingEngine, type PostWorkoutSummaryResult } from '../../services/coaching';
import { useUnitPreference } from '../../hooks/useUnitPreference';
import { formatVolume, formatWeight, unitLabel } from '../../utils/units';
import type { RootStackParamList } from '../../navigation/types';

type RootNav = NativeStackNavigationProp<RootStackParamList>;

const RATING_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
];

const RECOVERY_LABEL: Record<PostWorkoutSummaryResult['estimatedRecoveryNeeds'], string> = {
  normal: 'Normal — back on schedule.',
  light_next_session: 'Light — you could push a bit harder next time.',
  extra_rest: 'Higher than usual — consider extra rest before your next session.',
};

function formatElapsed(startedAt: number | null): string {
  if (!startedAt) return '0:00';
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Per-exercise notes have nowhere of their own in the schema, so they're
 * folded into the single workout_logs.notes field ahead of the athlete's
 * own summary notes rather than adding a new column. */
function buildNotes(exercises: ActiveExercise[], summaryNotes: string): string | undefined {
  const exerciseNotes = exercises
    .filter(e => e.notes.trim())
    .map(e => `${e.exerciseName}: ${e.notes.trim()}`)
    .join('\n');
  const combined = [exerciseNotes, summaryNotes.trim()].filter(Boolean).join('\n\n');
  return combined || undefined;
}

export function WorkoutSummaryScreen() {
  const theme = useTheme();
  const rootNavigation = useNavigation<RootNav>();
  const store = useActiveWorkoutStore();
  const completeWorkoutLog = useCompleteWorkoutLog();
  const unitPref = useUnitPreference();
  const userId = useAuthStore(state => state.userId);

  const [rating, setRating] = useState('');
  const [rpe, setRpe] = useState('');
  const [notes, setNotes] = useState('');

  // Captured once on mount — the workout is already over, so this shouldn't
  // keep ticking the way the in-progress elapsed label on the Active Workout
  // screen does.
  const [totalTime] = useState(() => formatElapsed(store.startedAt));
  const stats = computeWorkoutStats(store.exercises);

  const { data: loggedSets } = useLoggedSets(userId);
  const exerciseIds = store.exercises.map(e => e.exerciseId);
  const { data: previousPerformance } = usePreviousPerformanceForExercises(exerciseIds, store.workoutLogId);
  const readinessContext = useReadinessContext(userId);

  // Computed from `store.exercises` while it's still in memory — onSave()
  // resets the store, which would otherwise wipe this data before it's shown.
  const coachingSummary = useMemo<PostWorkoutSummaryResult | null>(() => {
    if (!loggedSets || !previousPerformance || readinessContext.isLoading) return null;

    const sessionPrEvents = computePrEvents(loggedSets).filter(
      e => store.startedAt != null && new Date(e.loggedAt).getTime() >= store.startedAt,
    );
    const readiness = coachingEngine.evaluateReadiness(readinessContext.inputs);
    const checkin = readinessContext.inputs.checkin;
    const painRisk = coachingEngine.assessPainRisk(checkin?.hasPain ?? false, checkin?.painNotes ?? null);

    const previousVolumeByExercise: Record<string, number> = {};
    const previousBestE1rmByExercise: Record<string, number> = {};
    for (const [exerciseId, perf] of Object.entries(previousPerformance)) {
      previousVolumeByExercise[exerciseId] = perf.volumeKg;
      previousBestE1rmByExercise[exerciseId] = perf.bestE1rm;
    }

    return coachingEngine.generatePostWorkoutSummary({
      exercises: store.exercises.map(e => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        targetRpe: e.targetRpe ?? null,
        sets: e.sets
          .filter(s => s.completed && !s.isWarmup)
          .map(s => ({ reps: s.reps ?? 0, loadKg: s.loadKg, rpe: s.rpe })),
      })),
      previousVolumeByExercise,
      previousBestE1rmByExercise,
      sessionPrEvents,
      readiness,
      trainingLoad: readinessContext.inputs.trainingLoad,
      painRisk,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedSets, previousPerformance, readinessContext.isLoading, readinessContext.inputs]);

  const onSave = async () => {
    if (!store.workoutLogId) return;
    try {
      await completeWorkoutLog.mutateAsync({
        workoutLogId: store.workoutLogId,
        overallRpe: rpe ? parseFloat(rpe) : undefined,
        notes: buildNotes(store.exercises, notes),
        rating: rating ? Number(rating) : undefined,
      });
    } catch (err) {
      Alert.alert(
        'Could not save workout',
        err instanceof Error ? err.message : 'Please try again.',
      );
      return;
    }
    store.reset();
    rootNavigation.navigate('MainTabs', { screen: 'TodayTab', params: { screen: 'Today' } });
  };

  if (!store.workoutLogId) {
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
        <Text variant="title">No active workout</Text>
        <Button
          label="Back to Today"
          onPress={() =>
            rootNavigation.navigate('MainTabs', { screen: 'TodayTab', params: { screen: 'Today' } })
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View>
          <LinearGradient
            colors={[...theme.gradients.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 48,
              height: 48,
              borderRadius: theme.radii.lg,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: theme.spacing.sm,
            }}
          >
            <Icon name="partyPopper" size="lg" color={theme.colors.text.onAccent} />
          </LinearGradient>
          <Text variant="title">Workout complete</Text>
          <Text variant="body" color="secondary">
            Nice work. Log how it went before you save it.
          </Text>
        </View>

        {!coachingSummary ? (
          <LoadingState fill={false} label="Putting your summary together…" />
        ) : (
          <>
            <Card variant="elevated" style={{ gap: theme.spacing.xs }}>
              <Text variant="label" color="secondary">
                COACHING SUMMARY
              </Text>
              <Text variant="body">{coachingSummary.summary}</Text>
            </Card>

            {coachingSummary.painOrFatigueConcern ? (
              <Card
                variant="flat"
                style={{ gap: theme.spacing.xs, borderColor: theme.colors.semantic.danger, borderWidth: 1 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <Icon name="circleAlert" size="md" color={theme.colors.semantic.danger} />
                  <Text variant="subtitle" style={{ color: theme.colors.semantic.danger, flex: 1 }}>
                    Worth a look
                  </Text>
                </View>
                <Text variant="body" color="secondary">
                  {coachingSummary.painOrFatigueConcern}
                </Text>
              </Card>
            ) : null}

            {coachingSummary.newPersonalRecords.length > 0 ? (
              <Card variant="flat" style={{ gap: theme.spacing.xs }}>
                <Text variant="subtitle">New personal records</Text>
                {coachingSummary.newPersonalRecords.map(pr => (
                  <ListRow
                    key={`${pr.exerciseId}-${pr.loggedAt}`}
                    title={pr.exerciseName}
                    subtitle={`${formatWeight(pr.loadKg, unitPref)}${unitLabel(unitPref)} × ${pr.reps} (est. 1RM ${Math.round(pr.e1rm)}${unitLabel(unitPref)})`}
                    icon="trophy"
                  />
                ))}
              </Card>
            ) : null}

            {coachingSummary.bestSet ? (
              <Card variant="flat" style={{ gap: theme.spacing.xs }}>
                <Text variant="subtitle">Best set</Text>
                <Text variant="body" color="secondary">
                  {coachingSummary.bestSet.exerciseName} — {formatWeight(coachingSummary.bestSet.loadKg, unitPref)}
                  {unitLabel(unitPref)} × {coachingSummary.bestSet.reps}
                </Text>
              </Card>
            ) : null}

            {coachingSummary.improvedExercises.length > 0 || coachingSummary.declinedExercises.length > 0 ? (
              <Card variant="flat" style={{ gap: theme.spacing.xs }}>
                <Text variant="subtitle">Compared with last time</Text>
                {coachingSummary.improvedExercises.map(e => (
                  <ListRow key={e.exerciseId} title={e.exerciseName} subtitle={e.detail} icon="trendingUp" />
                ))}
                {coachingSummary.declinedExercises.map(e => (
                  <ListRow key={e.exerciseId} title={e.exerciseName} subtitle={e.detail} icon="trendingDown" />
                ))}
              </Card>
            ) : null}

            <Card variant="flat" style={{ gap: theme.spacing.sm }}>
              <ListRow
                title="Volume"
                subtitle={
                  coachingSummary.volumeChangePercent != null
                    ? `${coachingSummary.volumeChangePercent >= 0 ? '+' : ''}${Math.round(coachingSummary.volumeChangePercent)}% vs. last time`
                    : 'No prior session to compare yet'
                }
                trailing={
                  <Text variant="body">
                    {formatVolume(coachingSummary.totalVolumeKg, unitPref)} {unitLabel(unitPref)}
                  </Text>
                }
              />
              <ListRow
                title="Target RPE adherence"
                subtitle={
                  coachingSummary.rpeAdherence.ratedSetCount > 0
                    ? `${coachingSummary.rpeAdherence.onTargetSetCount}/${coachingSummary.rpeAdherence.ratedSetCount} sets within 1 of target`
                    : 'No target RPE to compare'
                }
              />
              {coachingSummary.readinessVsPerformance ? (
                <ListRow title="Readiness vs. performance" subtitle={coachingSummary.readinessVsPerformance} />
              ) : null}
              <ListRow title="Estimated recovery needs" subtitle={RECOVERY_LABEL[coachingSummary.estimatedRecoveryNeeds]} />
              <ListRow title="Suggested next action" subtitle={coachingSummary.suggestedNextAction} />
            </Card>
          </>
        )}

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}>
            <StatTile label="Total Time" value={totalTime} />
          </View>
          <View style={{ flex: 1 }}>
            <StatTile label="Exercises" value={`${stats.completedExercises}/${stats.totalExercises}`} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}>
            <StatTile label="Sets" value={stats.totalSets} />
          </View>
          <View style={{ flex: 1 }}>
            <StatTile label="Reps" value={stats.totalReps} />
          </View>
        </View>

        <Card variant="elevated" style={{ gap: theme.spacing.md }}>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" color="secondary">
              WORKOUT RATING — HOW DID IT FEEL?
            </Text>
            <SegmentedControl options={RATING_OPTIONS} value={rating} onChange={setRating} />
          </View>

          <TextField
            label="Performance Rating (RPE)"
            keyboardType="decimal-pad"
            value={rpe}
            onChangeText={setRpe}
            placeholder="8"
          />

          <TextField
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="How did the session go?"
            multiline
          />
        </Card>

        <Button label="Save Workout" onPress={onSave} loading={completeWorkoutLog.isPending} />
      </ScrollView>
    </SafeAreaView>
  );
}
