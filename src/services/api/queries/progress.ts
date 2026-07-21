import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, startOfWeek } from 'date-fns';
import { supabase } from '../supabaseClient';

export type LoggedSet = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  reps: number;
  loadKg: number | null;
  loggedAt: string;
};

type LoggedSetRow = {
  id: string;
  reps: number;
  load_kg: number | null;
  logged_at: string;
  exercise_id: string;
  exercises: { name: string } | null;
};

// RLS on workout_log_sets already scopes rows to the caller (via a join back
// to workout_logs.user_id), the same way program_days/program_exercises rely
// on RLS instead of an explicit user_id filter — there's no user_id column
// on this table to filter by directly.
async function fetchLoggedSets(): Promise<LoggedSet[]> {
  const { data, error } = await supabase
    .from('workout_log_sets')
    .select('id, reps, load_kg, logged_at, exercise_id, exercises ( name )')
    .eq('completed', true)
    .eq('is_warmup', false)
    .order('logged_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as unknown as LoggedSetRow[];
  return rows.map(row => ({
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercises?.name ?? 'Exercise',
    reps: row.reps,
    loadKg: row.load_kg,
    loggedAt: row.logged_at,
  }));
}

export function useLoggedSets(userId: string | null) {
  return useQuery({
    queryKey: ['loggedSets', userId],
    queryFn: fetchLoggedSets,
    enabled: userId != null,
  });
}

/** Epley estimated one-rep max. */
export function estimateOneRepMax(loadKg: number, reps: number): number {
  return loadKg * (1 + reps / 30);
}

export type PrEvent = {
  exerciseId: string;
  exerciseName: string;
  loadKg: number;
  reps: number;
  e1rm: number;
  loggedAt: string;
};

/**
 * Walks each exercise's sets in chronological order and flags every set that
 * beat that exercise's prior best estimated 1RM — i.e. every PR moment.
 */
export function computePrEvents(sets: LoggedSet[]): PrEvent[] {
  const bestByExercise = new Map<string, number>();
  const events: PrEvent[] = [];
  for (const set of sets) {
    if (set.loadKg == null || set.loadKg <= 0) continue;
    const e1rm = estimateOneRepMax(set.loadKg, set.reps);
    const best = bestByExercise.get(set.exerciseId) ?? 0;
    if (e1rm > best) {
      bestByExercise.set(set.exerciseId, e1rm);
      events.push({
        exerciseId: set.exerciseId,
        exerciseName: set.exerciseName,
        loadKg: set.loadKg,
        reps: set.reps,
        e1rm,
        loggedAt: set.loggedAt,
      });
    }
  }
  return events;
}

export type ExerciseE1rmPoint = { date: string; e1rm: number };
export type ExerciseE1rmHistory = { exerciseId: string; exerciseName: string; points: ExerciseE1rmPoint[] };

/**
 * Per exercise, one point per calendar day holding that day's best estimated
 * 1RM (multiple sets the same day collapse to their max, so a same-day
 * cluster of sets doesn't skew a trend fit over these points), chronological.
 */
export function computeE1rmHistories(sets: LoggedSet[]): ExerciseE1rmHistory[] {
  const byExercise = new Map<string, { exerciseName: string; byDate: Map<string, number> }>();
  for (const set of sets) {
    if (set.loadKg == null || set.loadKg <= 0) continue;
    const e1rm = estimateOneRepMax(set.loadKg, set.reps);
    const dateKey = set.loggedAt.slice(0, 10);
    const bucket = byExercise.get(set.exerciseId) ?? { exerciseName: set.exerciseName, byDate: new Map() };
    bucket.byDate.set(dateKey, Math.max(bucket.byDate.get(dateKey) ?? 0, e1rm));
    byExercise.set(set.exerciseId, bucket);
  }
  return [...byExercise.entries()].map(([exerciseId, { exerciseName, byDate }]) => ({
    exerciseId,
    exerciseName,
    points: [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, e1rm]) => ({ date, e1rm })),
  }));
}

export function computeWeeklyVolume(
  sets: LoggedSet[],
  weeks = 8,
): { weekStart: string; volume: number }[] {
  const buckets = new Map<string, number>();
  for (const set of sets) {
    if (set.loadKg == null) continue;
    const weekStart = format(startOfWeek(new Date(set.loggedAt), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    buckets.set(weekStart, (buckets.get(weekStart) ?? 0) + set.loadKg * set.reps);
  }
  const sortedWeeks = Array.from(buckets.keys()).sort();
  return sortedWeeks.slice(-weeks).map(weekStart => ({ weekStart, volume: buckets.get(weekStart) ?? 0 }));
}

export function totalVolumeThisMonth(sets: LoggedSet[]): number {
  const monthStart = startOfMonth(new Date());
  return sets
    .filter(s => s.loadKg != null && new Date(s.loggedAt) >= monthStart)
    .reduce((sum, s) => sum + (s.loadKg as number) * s.reps, 0);
}

export function prsThisMonth(events: PrEvent[]): number {
  const monthStart = startOfMonth(new Date());
  return events.filter(e => new Date(e.loggedAt) >= monthStart).length;
}
