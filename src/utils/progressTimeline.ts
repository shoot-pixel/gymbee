import type { PrEvent } from '../services/api/queries/progress';
import type { CompletedWorkoutLog } from '../services/api/queries/workoutLogs';

export type ProgressTimelineBodyMetricInput = { logged_at: string; weight_kg: number };

export type TimelineEntry =
  | { type: 'pr'; date: string; exerciseId: string; exerciseName: string; loadKg: number; reps: number }
  | { type: 'body_metric'; date: string; weightKg: number }
  | { type: 'workout_completed'; date: string; title: string; rating: number | null }
  | { type: 'milestone'; date: string; count: number };

const MILESTONE_THRESHOLDS = [10, 25, 50, 100, 250, 500];

function dateKey(date: string): string {
  return date.slice(0, 10);
}

/**
 * Merges PRs, body-metric logs, and completed workouts into one
 * reverse-chronological feed, plus a workout-count milestone entry whenever
 * a completed workout lands on a MILESTONE_THRESHOLDS count. Pure and
 * hook-free — the screen supplies already-fetched data.
 */
export function buildProgressTimeline(
  prEvents: PrEvent[],
  bodyMetrics: ProgressTimelineBodyMetricInput[],
  workoutLogs: CompletedWorkoutLog[],
): TimelineEntry[] {
  const prEntries: TimelineEntry[] = prEvents.map(event => ({
    type: 'pr',
    date: event.loggedAt,
    exerciseId: event.exerciseId,
    exerciseName: event.exerciseName,
    loadKg: event.loadKg,
    reps: event.reps,
  }));

  const bodyMetricEntries: TimelineEntry[] = bodyMetrics.map(metric => ({
    type: 'body_metric',
    date: metric.logged_at,
    weightKg: metric.weight_kg,
  }));

  const workoutEntries: TimelineEntry[] = workoutLogs.map(log => ({
    type: 'workout_completed',
    date: log.completedAt,
    title: log.title,
    rating: log.rating,
  }));

  const chronological = [...workoutLogs].sort((a, b) => dateKey(a.completedAt).localeCompare(dateKey(b.completedAt)));
  const milestoneEntries: TimelineEntry[] = [];
  chronological.forEach((log, index) => {
    const count = index + 1;
    if (MILESTONE_THRESHOLDS.includes(count)) {
      milestoneEntries.push({ type: 'milestone', date: log.completedAt, count });
    }
  });

  return [...prEntries, ...bodyMetricEntries, ...workoutEntries, ...milestoneEntries].sort((a, b) =>
    dateKey(b.date).localeCompare(dateKey(a.date)),
  );
}
