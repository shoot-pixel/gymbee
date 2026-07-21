import { useMemo } from 'react';
import { format } from 'date-fns';
import { useActiveProgramTree } from './programs';
import { useWorkoutLogsInRange } from './workoutLogs';
import { useLoggedSets, computePrEvents, estimateOneRepMax } from './progress';
import { useExercises } from './exercises';
import { useReadinessCheckinsInRange } from './coaching';
import { coachingEngine } from '../../coaching';
import type { GenerateWeeklyReviewParams, WeeklyCheckinInput, WeeklySetInput } from '../../coaching';
import { walkScheduledDays } from '../../../utils/trainingScheduleWalk';

function dateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Aggregates everything generateWeeklyReview() needs for the given week from
 * data this app already fetches elsewhere. The screen calls
 * coachingEngine.generateWeeklyReview(params) itself — this hook only
 * aggregates, mirroring useReadinessContext's split.
 */
export function useWeeklyReviewData(userId: string | null, weekStart: Date, weekEnd: Date) {
  const from = dateKey(weekStart);
  const to = dateKey(weekEnd);

  const { data: program, isLoading: programLoading } = useActiveProgramTree(userId);
  const { data: workoutLogs, isLoading: logsLoading } = useWorkoutLogsInRange(userId, { from, to });
  const { data: loggedSets, isLoading: setsLoading } = useLoggedSets(userId);
  const { data: exercises, isLoading: exercisesLoading } = useExercises('');
  const { data: checkinRows, isLoading: checkinsLoading } = useReadinessCheckinsInRange(userId, from, to);

  const isLoading = programLoading || logsLoading || setsLoading || exercisesLoading || checkinsLoading;

  const params = useMemo<GenerateWeeklyReviewParams | null>(() => {
    if (!loggedSets || !exercises || !checkinRows) return null;

    const primaryMuscleByExerciseId = new Map(exercises.map(exercise => [exercise.id, exercise.primary_muscle]));

    const weekSets: WeeklySetInput[] = loggedSets
      .filter(set => set.loggedAt.slice(0, 10) >= from && set.loggedAt.slice(0, 10) <= to)
      .map(set => ({
        exerciseId: set.exerciseId,
        exerciseName: set.exerciseName,
        primaryMuscle: primaryMuscleByExerciseId.get(set.exerciseId) ?? 'other',
        reps: set.reps,
        loadKg: set.loadKg,
      }));

    const priorBestE1rmByExercise: Record<string, number> = {};
    for (const set of loggedSets) {
      if (set.loggedAt.slice(0, 10) >= from || set.loadKg == null) continue;
      const e1rm = estimateOneRepMax(set.loadKg, set.reps);
      if (!priorBestE1rmByExercise[set.exerciseId] || e1rm > priorBestE1rmByExercise[set.exerciseId]) {
        priorBestE1rmByExercise[set.exerciseId] = e1rm;
      }
    }

    const weekPrEvents = computePrEvents(loggedSets).filter(
      event => event.loggedAt.slice(0, 10) >= from && event.loggedAt.slice(0, 10) <= to,
    );

    const workoutsCompleted = workoutLogs?.length ?? 0;

    const completedDates = new Set((workoutLogs ?? []).map(log => log.completedAt.slice(0, 10)));
    const workoutsMissed = walkScheduledDays(program, completedDates, weekStart, weekEnd).filter(
      day => day.isTrainingDay && !day.completed,
    ).length;

    const checkins: WeeklyCheckinInput[] = checkinRows.map(row => {
      const readinessScore = coachingEngine.evaluateReadiness({
        checkin: {
          sleepHours: row.sleep_hours,
          sleepQuality: row.sleep_quality,
          soreness: row.soreness,
          stress: row.stress,
          hasPain: row.has_pain,
          painNotes: row.pain_notes,
        },
        wearable: null,
        trainingLoad: { acuteVolumeKg: 0, chronicAvgVolumeKg: 0, loadRatio: null, classification: 'unknown' },
        daysSinceLastWorkout: null,
        missedWorkoutsLast14Days: 0,
      }).score;

      return {
        date: row.checkin_date,
        sleepHours: row.sleep_hours,
        soreness: row.soreness,
        stress: row.stress,
        hasPain: row.has_pain,
        painNotes: row.pain_notes,
        readinessScore,
      };
    });

    const trainingLoad = coachingEngine.calculateTrainingLoad(loggedSets, weekEnd);

    return {
      weekStart: from,
      weekEnd: to,
      workoutsCompleted,
      workoutsMissed,
      weekSets,
      priorBestE1rmByExercise,
      weekPrEvents,
      checkins,
      trainingLoad,
    };
  }, [loggedSets, exercises, checkinRows, workoutLogs, program, from, to, weekStart, weekEnd]);

  return { isLoading, params };
}
