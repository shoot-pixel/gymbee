import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LogWorkoutScreen } from '../LogWorkoutScreen';
import { useActiveWorkoutStore } from '../../../store/activeWorkoutStore';

const mockNavigate = jest.fn();
const mockUseRoute = jest.fn(
  (): { params: { programDayId?: string; scheduledWorkoutId?: string; variantType?: string } } => ({
    params: { programDayId: 'day-1' },
  }),
);

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, canGoBack: () => false }),
    useRoute: () => mockUseRoute(),
  };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

jest.mock('../../../hooks/useUnitPreference', () => ({
  useUnitPreference: () => 'kg',
}));

const PROGRAM_DAY_WITH_TARGETS = {
  id: 'day-1',
  title: 'Push Day',
  program_exercises: [
    {
      id: 'pe-1',
      exercise_id: 'ex1',
      exercises: { id: 'ex1', name: 'Bench Press' },
      target_sets: 3,
      target_reps_min: 8,
      target_reps_max: 10,
      target_load_kg: 60,
      target_rpe: 8,
      rest_seconds: 90,
    },
  ],
};

jest.mock('../../../services/api/queries/programs', () => ({
  useProgramDay: jest.fn(() => ({ data: { id: 'day-1', title: 'Push Day' }, isLoading: false })),
}));

jest.mock('../../../services/api/queries/scheduledWorkouts', () => ({
  useScheduledWorkout: jest.fn(() => ({ data: undefined, isLoading: false })),
}));

jest.mock('../../../services/api/queries/workoutTemplates', () => ({
  useWorkoutTemplate: jest.fn(() => ({ data: undefined, isLoading: false })),
}));

const EXERCISE_LIBRARY = [
  {
    id: 'ex1',
    name: 'Bench Press',
    category: 'push',
    primary_muscle: 'chest',
    equipment: 'barbell',
    secondary_muscles: ['triceps'],
    movement_pattern: 'push_horizontal',
    difficulty: 'intermediate',
    joint_stress: 'moderate',
    skill_requirement: 'moderate',
    instructions: null,
    demo_media_url: null,
    demo_media_type: null,
    is_custom: false,
    created_by: null,
    created_at: '',
  },
  {
    id: 'ex2',
    name: 'Dumbbell Bench Press',
    category: 'push',
    primary_muscle: 'chest',
    equipment: 'dumbbell',
    secondary_muscles: ['triceps'],
    movement_pattern: 'push_horizontal',
    difficulty: 'beginner',
    joint_stress: 'low',
    skill_requirement: 'low',
    instructions: null,
    demo_media_url: null,
    demo_media_type: null,
    is_custom: false,
    created_by: null,
    created_at: '',
  },
];

jest.mock('../../../services/api/queries/exercises', () => ({
  useExercises: jest.fn(() => ({ data: EXERCISE_LIBRARY, isLoading: false })),
}));

const mockUpdateProfileMutate = jest.fn();

jest.mock('../../../services/api/queries/profiles', () => ({
  useProfile: jest.fn(() => ({ data: { id: 'user-1', equipment_access: ['barbell', 'dumbbell'] }, isLoading: false })),
  useUpdateProfile: jest.fn(() => ({ mutate: mockUpdateProfileMutate })),
}));

const mockLogSetMutateAsync = jest.fn().mockResolvedValue({ id: 'dbset-1' });
const mockStartWorkoutLogMutateAsync = jest.fn().mockResolvedValue({ id: 'wl-1' });

jest.mock('../../../services/api/queries/workoutLogs', () => ({
  useStartWorkoutLog: jest.fn(() => ({ mutateAsync: mockStartWorkoutLogMutateAsync })),
  useLogSet: jest.fn(() => ({ mutateAsync: mockLogSetMutateAsync })),
  useUpdateSet: jest.fn(() => ({ mutate: jest.fn(), mutateAsync: jest.fn() })),
  useDeleteSet: jest.fn(() => ({ mutateAsync: jest.fn() })),
}));

const mockSaveRecommendationMutate = jest.fn();
const mockSaveSubstitutionMutate = jest.fn();

jest.mock('../../../services/api/queries/coaching', () => ({
  useWorkoutAdaptations: jest.fn(() => ({ data: [], isLoading: false })),
  useReadinessContext: jest.fn(() => ({
    isLoading: false,
    inputs: {
      checkin: null,
      wearable: null,
      trainingLoad: { acuteVolumeKg: 0, chronicAvgVolumeKg: 0, loadRatio: null, classification: 'unknown' },
      daysSinceLastWorkout: null,
      missedWorkoutsLast14Days: 0,
    },
    hasCheckin: false,
    checkinId: null,
  })),
  usePreviousExercisePerformance: jest.fn(() => ({ data: null, isLoading: false })),
  useSaveSetRecommendation: jest.fn(() => ({ mutate: mockSaveRecommendationMutate })),
  useSaveExerciseSubstitution: jest.fn(() => ({ mutate: mockSaveSubstitutionMutate })),
}));

const RECOMMENDATION = {
  id: 'rec-1',
  type: 'increase_weight' as const,
  recommendedReps: null,
  recommendedLoadKg: 65,
  recommendedRpe: null,
  recommendedRestSeconds: null,
  reason: 'You hit the top of your rep range comfortably — try a bit more weight next set.',
  confidence: 0.6,
  source: 'rule_engine' as const,
};

const SUBSTITUTION = {
  id: 'sub-1',
  exerciseId: 'ex2',
  exerciseName: 'Dumbbell Bench Press',
  reason: 'Same push horizontal pattern and chest focus — uses dumbbell instead of barbell.',
  confidence: 0.8,
  matchedOn: ['movement_pattern', 'primary_muscle', 'category'] as const,
};

jest.mock('../../../services/coaching', () => ({
  coachingEngine: {
    evaluateReadiness: jest.fn(() => ({
      score: 70,
      band: 'moderate',
      factors: [],
      recommendedIntensity: 'reduced',
      recommendedRpeRange: [6, 8],
      estimatedSessionQuality: 'good',
      summary: '',
      computedAt: new Date().toISOString(),
    })),
    recommendNextSet: jest.fn(() => RECOMMENDATION),
    recommendExerciseSubstitution: jest.fn(() => [SUBSTITUTION]),
    generateWorkoutVariant: jest.fn(),
  },
}));

import { coachingEngine } from '../../../services/coaching';
import { useProgramDay } from '../../../services/api/queries/programs';

const mockedRecommendNextSet = coachingEngine.recommendNextSet as jest.Mock;
const mockedRecommendExerciseSubstitution = coachingEngine.recommendExerciseSubstitution as jest.Mock;
const mockedGenerateWorkoutVariant = coachingEngine.generateWorkoutVariant as jest.Mock;
const mockedUseProgramDay = useProgramDay as jest.Mock;

function seedActiveWorkout() {
  useActiveWorkoutStore.setState({
    workoutLogId: 'wl-1',
    source: { type: 'programDay', id: 'day-1' },
    startedAt: Date.now(),
    restSecondsRemaining: 0,
    restRunning: false,
    exercises: [
      {
        exerciseId: 'ex1',
        exerciseName: 'Bench Press',
        targetSets: 2,
        targetRepsMin: 8,
        targetRepsMax: 10,
        targetLoadKg: 60,
        targetRpe: 8,
        restSeconds: 90,
        metric: 'weight_kg',
        notes: '',
        sets: [
          { id: 'set-1', dbId: null, setNumber: 1, reps: 8, loadKg: 60, rpe: null, isWarmup: false, completed: false },
          { id: 'set-2', dbId: null, setNumber: 2, reps: 8, loadKg: 60, rpe: null, isWarmup: false, completed: false },
        ],
      },
    ],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLogSetMutateAsync.mockResolvedValue({ id: 'dbset-1' });
  mockStartWorkoutLogMutateAsync.mockResolvedValue({ id: 'wl-1' });
  mockUseRoute.mockReturnValue({ params: { programDayId: 'day-1' } });
  mockedUseProgramDay.mockReturnValue({ data: { id: 'day-1', title: 'Push Day' }, isLoading: false });
  mockedRecommendNextSet.mockReturnValue(RECOMMENDATION);
  mockedRecommendExerciseSubstitution.mockReturnValue([SUBSTITUTION]);
  seedActiveWorkout();
});

describe('LogWorkoutScreen — live set recommendations', () => {
  it('shows a recommendation after completing a set, and applies it to the next set on accept', async () => {
    const { getByLabelText, getByText, queryByText } = await render(<LogWorkoutScreen />);

    await fireEvent.press(getByLabelText('Set 1 incomplete'));

    await waitFor(() => expect(getByText(RECOMMENDATION.reason)).toBeTruthy());
    expect(getByText('Try 65kg next set')).toBeTruthy();

    await fireEvent.press(getByText('Apply to next set'));

    await waitFor(() => expect(mockSaveRecommendationMutate).toHaveBeenCalledTimes(1));
    const call = mockSaveRecommendationMutate.mock.calls[0][0];
    expect(call).toMatchObject({
      userId: 'user-1',
      workoutLogId: 'wl-1',
      exerciseId: 'ex1',
      afterSetNumber: 1,
      accepted: true,
    });

    const secondSet = useActiveWorkoutStore.getState().exercises[0].sets[1];
    expect(secondSet.loadKg).toBe(65);
    expect(queryByText(RECOMMENDATION.reason)).toBeNull();
  });

  it('dismisses the recommendation without changing the next set when ignored', async () => {
    const { getByLabelText, getByText, queryByText } = await render(<LogWorkoutScreen />);

    await fireEvent.press(getByLabelText('Set 1 incomplete'));
    await waitFor(() => expect(getByText(RECOMMENDATION.reason)).toBeTruthy());

    await fireEvent.press(getByText('Ignore'));

    await waitFor(() => expect(mockSaveRecommendationMutate).toHaveBeenCalledTimes(1));
    expect(mockSaveRecommendationMutate.mock.calls[0][0]).toMatchObject({ accepted: false });

    const secondSet = useActiveWorkoutStore.getState().exercises[0].sets[1];
    expect(secondSet.loadKg).toBe(60);
    expect(queryByText(RECOMMENDATION.reason)).toBeNull();
  });
});

describe('LogWorkoutScreen — exercise substitution', () => {
  it('swaps the exercise for this workout only, without touching the user\'s equipment', async () => {
    const { getByLabelText, getByText } = await render(<LogWorkoutScreen />);

    await fireEvent.press(getByLabelText('Find a substitute exercise'));
    await waitFor(() => expect(getByText('Dumbbell Bench Press')).toBeTruthy());
    await fireEvent.press(getByText('Dumbbell Bench Press'));
    await fireEvent.press(getByText('Swap for this workout'));

    await waitFor(() => expect(mockSaveSubstitutionMutate).toHaveBeenCalledTimes(1));
    expect(mockSaveSubstitutionMutate.mock.calls[0][0]).toMatchObject({
      userId: 'user-1',
      workoutLogId: 'wl-1',
      originalExerciseId: 'ex1',
      scope: 'workout_only',
    });
    expect(mockUpdateProfileMutate).not.toHaveBeenCalled();

    const swappedExercise = useActiveWorkoutStore.getState().exercises[0];
    expect(swappedExercise.exerciseId).toBe('ex2');
    expect(swappedExercise.exerciseName).toBe('Dumbbell Bench Press');
    expect(swappedExercise.targetLoadKg).toBeNull();
    expect(swappedExercise.sets.every(s => !s.completed && s.dbId === null)).toBe(true);
  });

  it('permanently removes the original equipment from the profile when that scope is chosen', async () => {
    const { getByLabelText, getByText } = await render(<LogWorkoutScreen />);

    await fireEvent.press(getByLabelText('Find a substitute exercise'));
    await waitFor(() => expect(getByText('Dumbbell Bench Press')).toBeTruthy());
    await fireEvent.press(getByText('Dumbbell Bench Press'));
    await fireEvent.press(getByText('Swap + remove barbell from my equipment'));

    await waitFor(() => expect(mockSaveSubstitutionMutate).toHaveBeenCalledTimes(1));
    expect(mockSaveSubstitutionMutate.mock.calls[0][0]).toMatchObject({ scope: 'permanent' });
    expect(mockUpdateProfileMutate).toHaveBeenCalledWith({ equipment_access: ['dumbbell'] });
  });

  it('hides the swap button once the exercise has a completed set', async () => {
    useActiveWorkoutStore.setState(state => ({
      exercises: state.exercises.map(exercise => ({
        ...exercise,
        sets: exercise.sets.map((s, i) => (i === 0 ? { ...s, completed: true, dbId: 'dbset-1' } : s)),
      })),
    }));

    const { queryByLabelText } = await render(<LogWorkoutScreen />);

    expect(queryByLabelText('Find a substitute exercise')).toBeNull();
  });
});

describe('LogWorkoutScreen — workout variants', () => {
  const VARIANT_RESULT = {
    variantType: 'bodyweight' as const,
    label: 'Bodyweight Version',
    summary: 'Swapped every exercise for a bodyweight-only version.',
    estimatedMinutes: 20,
    exercises: [
      {
        exerciseId: 'ex2',
        exerciseName: 'Push-Up',
        targetSets: 3,
        targetRepsMin: 8,
        targetRepsMax: 10,
        targetLoadKg: null,
        targetRpe: 8,
        restSeconds: 90,
      },
    ],
    changes: [
      {
        exerciseId: 'ex1',
        type: 'substituted' as const,
        reason: 'Same push horizontal pattern — uses bodyweight instead of barbell.',
      },
    ],
  };

  it('applies a chosen variant when starting a fresh session and shows it was applied', async () => {
    useActiveWorkoutStore.setState({
      workoutLogId: null,
      source: null,
      exercises: [],
      startedAt: null,
      restSecondsRemaining: 0,
      restRunning: false,
    });
    mockUseRoute.mockReturnValue({ params: { programDayId: 'day-1', variantType: 'bodyweight' } });
    mockedUseProgramDay.mockReturnValue({ data: PROGRAM_DAY_WITH_TARGETS, isLoading: false });
    mockedGenerateWorkoutVariant.mockReturnValue(VARIANT_RESULT);

    const { getByText } = await render(<LogWorkoutScreen />);

    await waitFor(() => expect(mockedGenerateWorkoutVariant).toHaveBeenCalledTimes(1));
    expect(mockedGenerateWorkoutVariant.mock.calls[0][0]).toMatchObject({ variantType: 'bodyweight' });
    expect(mockStartWorkoutLogMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ variantType: 'bodyweight' }));

    await waitFor(() => expect(getByText('Variant: Bodyweight Version — tap to view changes')).toBeTruthy());

    const state = useActiveWorkoutStore.getState();
    expect(state.exercises).toHaveLength(1);
    expect(state.exercises[0].exerciseId).toBe('ex2');
    expect(state.exercises[0].exerciseName).toBe('Push-Up');
    expect(state.exercises[0].targetLoadKg).toBeNull();
  });
});
