import { create } from 'zustand';

export type LoggedSet = {
  id: string;
  setNumber: number;
  reps: number;
  loadKg: number | null;
  rpe: number | null;
  isWarmup: boolean;
};

export type ActiveExercise = {
  exerciseId: string;
  exerciseName: string;
  targetSets?: number;
  targetRepsMin?: number | null;
  targetRepsMax?: number | null;
  targetLoadKg?: number | null;
  targetRpe?: number | null;
  restSeconds?: number | null;
  sets: LoggedSet[];
};

type ActiveWorkoutState = {
  workoutLogId: string | null;
  programDayId: string | null;
  exercises: ActiveExercise[];
  restSecondsRemaining: number;
  restRunning: boolean;

  startWorkout: (params: {
    workoutLogId: string;
    programDayId: string | null;
    exercises: ActiveExercise[];
  }) => void;
  addExercise: (exercise: Omit<ActiveExercise, 'sets'>) => void;
  addLoggedSet: (exerciseId: string, set: LoggedSet) => void;
  removeLoggedSet: (exerciseId: string, setId: string) => void;
  startRestTimer: (seconds: number) => void;
  tickRestTimer: () => void;
  skipRestTimer: () => void;
  reset: () => void;
};

const initialState = {
  workoutLogId: null,
  programDayId: null,
  exercises: [],
  restSecondsRemaining: 0,
  restRunning: false,
} satisfies Partial<ActiveWorkoutState>;

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
  ...initialState,

  startWorkout: ({ workoutLogId, programDayId, exercises }) =>
    set({ workoutLogId, programDayId, exercises, restSecondsRemaining: 0, restRunning: false }),

  addExercise: exercise =>
    set(state => {
      if (state.exercises.some(e => e.exerciseId === exercise.exerciseId)) return state;
      return { exercises: [...state.exercises, { ...exercise, sets: [] }] };
    }),

  addLoggedSet: (exerciseId, loggedSet) =>
    set(state => ({
      exercises: state.exercises.map(exercise =>
        exercise.exerciseId === exerciseId
          ? { ...exercise, sets: [...exercise.sets, loggedSet] }
          : exercise,
      ),
    })),

  removeLoggedSet: (exerciseId, setId) =>
    set(state => ({
      exercises: state.exercises.map(exercise =>
        exercise.exerciseId === exerciseId
          ? { ...exercise, sets: exercise.sets.filter(s => s.id !== setId) }
          : exercise,
      ),
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
