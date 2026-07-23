import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ActiveExerciseScreen } from '../ActiveExerciseScreen';
import { useActiveWorkoutStore } from '../../../store/activeWorkoutStore';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockSetParams = jest.fn();
const mockUseRoute = jest.fn((): { params: { exerciseId: string } } => ({
  params: { exerciseId: 'ex1' },
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      setParams: mockSetParams,
      canGoBack: () => true,
    }),
    useRoute: () => mockUseRoute(),
  };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

jest.mock('../../../hooks/useUnitPreference', () => ({
  useUnitPreference: () => 'kg',
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
const mockUpdateSetMutate = jest.fn();
const mockUpdateSetMutateAsync = jest.fn();
const mockDeleteSetMutateAsync = jest.fn();

jest.mock('../../../services/api/queries/workoutLogs', () => ({
  useLogSet: jest.fn(() => ({ mutateAsync: mockLogSetMutateAsync })),
  useUpdateSet: jest.fn(() => ({ mutate: mockUpdateSetMutate, mutateAsync: mockUpdateSetMutateAsync })),
  useDeleteSet: jest.fn(() => ({ mutateAsync: mockDeleteSetMutateAsync })),
}));

jest.mock('../../../services/api/queries/progress', () => {
  const actual = jest.requireActual('../../../services/api/queries/progress');
  return {
    ...actual,
    useLoggedSets: jest.fn(() => ({ data: [], isLoading: false })),
  };
});

const mockSaveRecommendationMutate = jest.fn();
const mockSaveSubstitutionMutate = jest.fn();

jest.mock('../../../services/api/queries/coaching', () => ({
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
  },
}));

import { coachingEngine } from '../../../services/coaching';

const mockedRecommendNextSet = coachingEngine.recommendNextSet as jest.Mock;
const mockedRecommendExerciseSubstitution = coachingEngine.recommendExerciseSubstitution as jest.Mock;

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
  mockUseRoute.mockReturnValue({ params: { exerciseId: 'ex1' } });
  mockedRecommendNextSet.mockReturnValue(RECOMMENDATION);
  mockedRecommendExerciseSubstitution.mockReturnValue([SUBSTITUTION]);
  seedActiveWorkout();
});

describe('ActiveExerciseScreen — live set recommendations', () => {
  it('shows a recommendation after completing a set, and applies it to the next set on accept', async () => {
    const { getByLabelText, getByText, queryByText } = await render(<ActiveExerciseScreen />);

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
    const { getByLabelText, getByText, queryByText } = await render(<ActiveExerciseScreen />);

    await fireEvent.press(getByLabelText('Set 1 incomplete'));
    await waitFor(() => expect(getByText(RECOMMENDATION.reason)).toBeTruthy());

    await fireEvent.press(getByText('Ignore'));

    await waitFor(() => expect(mockSaveRecommendationMutate).toHaveBeenCalledTimes(1));
    expect(mockSaveRecommendationMutate.mock.calls[0][0]).toMatchObject({ accepted: false });

    const secondSet = useActiveWorkoutStore.getState().exercises[0].sets[1];
    expect(secondSet.loadKg).toBe(60);
    expect(queryByText(RECOMMENDATION.reason)).toBeNull();
  });

  it('keeps a completed set editable and pushes edits back to the persisted set', async () => {
    useActiveWorkoutStore.setState(state => ({
      exercises: state.exercises.map(exercise => ({
        ...exercise,
        sets: exercise.sets.map((s, i) => (i === 0 ? { ...s, completed: true, dbId: 'dbset-1' } : s)),
      })),
    }));

    const { getAllByPlaceholderText } = await render(<ActiveExerciseScreen />);

    const repsInput = getAllByPlaceholderText('Reps')[0];
    expect(repsInput.props.editable).not.toBe(false);

    await fireEvent.changeText(repsInput, '9');

    expect(useActiveWorkoutStore.getState().exercises[0].sets[0].reps).toBe(9);
    await waitFor(() =>
      expect(mockUpdateSetMutate).toHaveBeenCalledWith(expect.objectContaining({ id: 'dbset-1', reps: 9 })),
    );
  });
});

describe('ActiveExerciseScreen — exercise substitution', () => {
  it('swaps the exercise for this workout only and follows it to the new identity', async () => {
    const { getByLabelText, getByText } = await render(<ActiveExerciseScreen />);

    await fireEvent.press(getByLabelText('Exercise options'));
    await fireEvent.press(getByText('Find a substitute exercise'));
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
    expect(mockSetParams).toHaveBeenCalledWith({ exerciseId: 'ex2' });
  });

  it('permanently removes the original equipment from the profile when that scope is chosen', async () => {
    const { getByLabelText, getByText } = await render(<ActiveExerciseScreen />);

    await fireEvent.press(getByLabelText('Exercise options'));
    await fireEvent.press(getByText('Find a substitute exercise'));
    await waitFor(() => expect(getByText('Dumbbell Bench Press')).toBeTruthy());
    await fireEvent.press(getByText('Dumbbell Bench Press'));
    await fireEvent.press(getByText('Swap + remove barbell from my equipment'));

    await waitFor(() => expect(mockSaveSubstitutionMutate).toHaveBeenCalledTimes(1));
    expect(mockSaveSubstitutionMutate.mock.calls[0][0]).toMatchObject({ scope: 'permanent' });
    expect(mockUpdateProfileMutate).toHaveBeenCalledWith({ equipment_access: ['dumbbell'] });
  });

  it('hides the swap option once the exercise has a completed set', async () => {
    useActiveWorkoutStore.setState(state => ({
      exercises: state.exercises.map(exercise => ({
        ...exercise,
        sets: exercise.sets.map((s, i) => (i === 0 ? { ...s, completed: true, dbId: 'dbset-1' } : s)),
      })),
    }));

    const { getByLabelText, queryByText } = await render(<ActiveExerciseScreen />);

    await fireEvent.press(getByLabelText('Exercise options'));
    expect(queryByText('Find a substitute exercise')).toBeNull();
  });
});

describe('ActiveExerciseScreen — navigation', () => {
  it('the down-chevron returns to the overview without touching workout state', async () => {
    const { getByLabelText } = await render(<ActiveExerciseScreen />);

    await fireEvent.press(getByLabelText('Back to workout overview'));

    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(useActiveWorkoutStore.getState().workoutLogId).toBe('wl-1');
  });

  it('removing the exercise returns to the overview', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const removeButton = buttons?.find(b => b.text === 'Remove');
      removeButton?.onPress?.();
    });

    const { getByLabelText, getByText } = await render(<ActiveExerciseScreen />);

    await fireEvent.press(getByLabelText('Exercise options'));
    await fireEvent.press(getByText('Remove exercise from workout'));

    await waitFor(() => expect(useActiveWorkoutStore.getState().exercises).toHaveLength(0));
    expect(mockGoBack).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
