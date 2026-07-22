import { create } from 'zustand';

export type LoggedSet = {
  /** Stable local key, independent of persistence state. */
  id: string;
  /** Set once this row has been saved to workout_log_sets. */
  dbId: string | null;
  setNumber: number;
  reps: number | null;
  loadKg: number | null;
  rpe: number | null;
  isWarmup: boolean;
  completed: boolean;
};

/** Which metric the weight column tracks for a given exercise this session.
 * Only weight_lb <-> weight_kg convert the underlying value; the rest just
 * relabel the column going forward (see setExerciseMetric). Ephemeral —
 * never persisted, re-derived from the global unit preference each start. */
export type SetMetric = 'weight_lb' | 'weight_kg' | 'weight_pct' | 'reps' | 'time';

export type ActiveExercise = {
  exerciseId: string;
  exerciseName: string;
  targetSets?: number;
  targetRepsMin?: number | null;
  targetRepsMax?: number | null;
  targetLoadKg?: number | null;
  targetRpe?: number | null;
  restSeconds?: number | null;
  metric: SetMetric;
  notes: string;
  sets: LoggedSet[];
};

/** What an active workout was started from — determines where its exercises
 * are sourced from and what workout_logs FK (if any) gets set. */
export type WorkoutSource =
  | { type: 'programDay'; id: string }
  | { type: 'scheduledWorkout'; id: string }
  | { type: 'template'; id: string }
  | { type: 'freestyle'; id: null };

type ExerciseTargets = Pick<
  ActiveExercise,
  'targetSets' | 'targetRepsMin' | 'targetLoadKg' | 'targetRpe'
>;

/** One draft row per targeted set, prefilled from the program's targets so the user can just confirm or edit. */
function buildDraftSets(exercise: ExerciseTargets): LoggedSet[] {
  const count = exercise.targetSets ?? 1;
  return Array.from({ length: count }, (_, i) => ({
    id: `draft-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    dbId: null,
    setNumber: i + 1,
    reps: exercise.targetRepsMin ?? null,
    loadKg: exercise.targetLoadKg ?? null,
    rpe: exercise.targetRpe ?? null,
    isWarmup: false,
    completed: false,
  }));
}

/** A target's set count is met once that many sets are checked off; extra/short sets are handled gracefully. */
export function isExerciseComplete(exercise: ActiveExercise): boolean {
  if (exercise.sets.length === 0) return false;
  const required = exercise.targetSets ?? exercise.sets.length;
  return exercise.sets.filter(s => s.completed).length >= required;
}

export type WorkoutStats = {
  totalExercises: number;
  completedExercises: number;
  totalSets: number;
  totalReps: number;
  totalVolumeKg: number;
};

export function computeWorkoutStats(exercises: ActiveExercise[]): WorkoutStats {
  const completedSets = exercises.flatMap(e => e.sets).filter(s => s.completed);
  return {
    totalExercises: exercises.length,
    completedExercises: exercises.filter(isExerciseComplete).length,
    totalSets: completedSets.length,
    totalReps: completedSets.reduce((sum, s) => sum + (s.reps ?? 0), 0),
    totalVolumeKg: completedSets.reduce((sum, s) => sum + (s.reps ?? 0) * (s.loadKg ?? 0), 0),
  };
}

type ActiveWorkoutState = {
  workoutLogId: string | null;
  source: WorkoutSource | null;
  exercises: ActiveExercise[];
  startedAt: number | null;
  restSecondsRemaining: number;
  restRunning: boolean;

  startWorkout: (params: {
    workoutLogId: string;
    source: WorkoutSource;
    exercises: Array<Omit<ActiveExercise, 'sets' | 'notes' | 'metric'> & { metric?: SetMetric }>;
  }) => void;
  addExercise: (
    exercise: Omit<ActiveExercise, 'sets' | 'notes' | 'metric'> & { metric?: SetMetric },
  ) => void;
  removeExercise: (exerciseId: string) => void;
  addSet: (exerciseId: string) => void;
  updateSetDraft: (
    exerciseId: string,
    setId: string,
    patch: Partial<Pick<LoggedSet, 'reps' | 'loadKg' | 'rpe'>>,
  ) => void;
  markSetCompleted: (exerciseId: string, setId: string, dbId: string) => void;
  markSetIncomplete: (exerciseId: string, setId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  setExerciseNotes: (exerciseId: string, notes: string) => void;
  setExerciseMetric: (exerciseId: string, metric: SetMetric) => void;
  setExerciseTargetSets: (exerciseId: string, targetSets: number) => void;
  substituteExercise: (exerciseId: string, next: { exerciseId: string; exerciseName: string }) => void;
  startRestTimer: (seconds: number) => void;
  tickRestTimer: () => void;
  skipRestTimer: () => void;
  reset: () => void;
};

const initialState = {
  workoutLogId: null,
  source: null,
  exercises: [],
  startedAt: null,
  restSecondsRemaining: 0,
  restRunning: false,
} satisfies Partial<ActiveWorkoutState>;

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
  ...initialState,

  startWorkout: ({ workoutLogId, source, exercises }) =>
    set({
      workoutLogId,
      source,
      exercises: exercises.map(e => ({
        ...e,
        metric: e.metric ?? 'weight_kg',
        notes: '',
        sets: buildDraftSets(e),
      })),
      startedAt: Date.now(),
      restSecondsRemaining: 0,
      restRunning: false,
    }),

  addExercise: exercise =>
    set(state => {
      if (state.exercises.some(e => e.exerciseId === exercise.exerciseId)) return state;
      return {
        exercises: [
          ...state.exercises,
          { ...exercise, metric: exercise.metric ?? 'weight_kg', notes: '', sets: buildDraftSets(exercise) },
        ],
      };
    }),

  removeExercise: exerciseId =>
    set(state => ({
      exercises: state.exercises.filter(exercise => exercise.exerciseId !== exerciseId),
    })),

  addSet: exerciseId =>
    set(state => ({
      exercises: state.exercises.map(exercise => {
        if (exercise.exerciseId !== exerciseId) return exercise;
        const draft = buildDraftSets({
          targetSets: 1,
          targetRepsMin: exercise.targetRepsMin,
          targetLoadKg: exercise.targetLoadKg,
          targetRpe: exercise.targetRpe,
        })[0];
        draft.setNumber = exercise.sets.length + 1;
        return { ...exercise, sets: [...exercise.sets, draft] };
      }),
    })),

  updateSetDraft: (exerciseId, setId, patch) =>
    set(state => ({
      exercises: state.exercises.map(exercise =>
        exercise.exerciseId === exerciseId
          ? { ...exercise, sets: exercise.sets.map(s => (s.id === setId ? { ...s, ...patch } : s)) }
          : exercise,
      ),
    })),

  markSetCompleted: (exerciseId, setId, dbId) =>
    set(state => ({
      exercises: state.exercises.map(exercise =>
        exercise.exerciseId === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map(s => (s.id === setId ? { ...s, completed: true, dbId } : s)),
            }
          : exercise,
      ),
    })),

  markSetIncomplete: (exerciseId, setId) =>
    set(state => ({
      exercises: state.exercises.map(exercise =>
        exercise.exerciseId === exerciseId
          ? { ...exercise, sets: exercise.sets.map(s => (s.id === setId ? { ...s, completed: false } : s)) }
          : exercise,
      ),
    })),

  removeSet: (exerciseId, setId) =>
    set(state => ({
      exercises: state.exercises.map(exercise =>
        exercise.exerciseId === exerciseId
          ? { ...exercise, sets: exercise.sets.filter(s => s.id !== setId) }
          : exercise,
      ),
    })),

  setExerciseNotes: (exerciseId, notes) =>
    set(state => ({
      exercises: state.exercises.map(exercise =>
        exercise.exerciseId === exerciseId ? { ...exercise, notes } : exercise,
      ),
    })),

  setExerciseMetric: (exerciseId, metric) =>
    set(state => ({
      exercises: state.exercises.map(exercise =>
        exercise.exerciseId === exerciseId ? { ...exercise, metric } : exercise,
      ),
    })),

  /** Caps the exercise's required-set count at what was actually done —
   * used when a "stop this exercise" recommendation is accepted, so
   * isExerciseComplete stops expecting the originally-planned set count. */
  setExerciseTargetSets: (exerciseId, targetSets) =>
    set(state => ({
      exercises: state.exercises.map(exercise =>
        exercise.exerciseId === exerciseId ? { ...exercise, targetSets } : exercise,
      ),
    })),

  /** Swaps the exercise's identity in place, keeping its targets (sets/reps/
   * RPE/rest carry over — the substitute wasn't independently programmed, so
   * approximate difficulty/progression is preserved) except target load,
   * which doesn't meaningfully transfer to a different movement/equipment.
   * Only ever called from a UI path already guarded to zero completed sets —
   * swapping after sets are logged would orphan those workout_log_sets rows. */
  substituteExercise: (exerciseId, next) =>
    set(state => ({
      exercises: state.exercises.map(exercise => {
        if (exercise.exerciseId !== exerciseId) return exercise;
        const updated: ActiveExercise = {
          ...exercise,
          exerciseId: next.exerciseId,
          exerciseName: next.exerciseName,
          targetLoadKg: null,
        };
        return { ...updated, sets: buildDraftSets(updated) };
      }),
    })),

  startRestTimer: seconds => set({ restSecondsRemaining: seconds, restRunning: seconds > 0 }),

  tickRestTimer: () => {
    const remaining = get().restSecondsRemaining - 1;
    if (remaining <= 0) {
      set({ restSecondsRemaining: 0, restRunning: false });
    } else {
      set({ restSecondsRemaining: remaining });
    }
  },

  skipRestTimer: () => set({ restSecondsRemaining: 0, restRunning: false }),

  reset: () => set(initialState),
}));
