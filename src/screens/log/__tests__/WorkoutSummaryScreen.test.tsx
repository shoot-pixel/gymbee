import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { WorkoutSummaryScreen } from '../WorkoutSummaryScreen';
import { useActiveWorkoutStore } from '../../../store/activeWorkoutStore';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate }),
  };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

jest.mock('../../../hooks/useUnitPreference', () => ({
  useUnitPreference: () => 'kg',
}));

const mockCompleteWorkoutLogMutateAsync = jest.fn().mockResolvedValue({ id: 'wl-1' });

jest.mock('../../../services/api/queries/workoutLogs', () => ({
  useCompleteWorkoutLog: jest.fn(() => ({ mutateAsync: mockCompleteWorkoutLogMutateAsync, isPending: false })),
}));

jest.mock('../../../services/api/queries/progress', () => {
  const actual = jest.requireActual('../../../services/api/queries/progress');
  return { ...actual, useLoggedSets: jest.fn(() => ({ data: [], isLoading: false })) };
});

jest.mock('../../../services/api/queries/coaching', () => ({
  usePreviousPerformanceForExercises: jest.fn(() => ({ data: {}, isLoading: false })),
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
}));

const SUMMARY_RESULT = {
  totalVolumeKg: 1200,
  volumeChangeKg: 200,
  volumeChangePercent: 20,
  newPersonalRecords: [
    { exerciseId: 'ex1', exerciseName: 'Bench Press', loadKg: 100, reps: 5, e1rm: 116.7, loggedAt: new Date().toISOString() },
  ],
  bestSet: { exerciseId: 'ex1', exerciseName: 'Bench Press', loadKg: 100, reps: 5, e1rm: 116.7 },
  improvedExercises: [{ exerciseId: 'ex1', exerciseName: 'Bench Press', direction: 'improved' as const, detail: 'Estimated 1RM up ~15% from last time.' }],
  declinedExercises: [],
  rpeAdherence: { ratedSetCount: 2, averageDelta: 0.5, onTargetSetCount: 2 },
  readinessVsPerformance: 'You trained at an average RPE of 8.0, right within today\'s recommended 6-8 range.',
  estimatedRecoveryNeeds: 'normal' as const,
  suggestedNextAction: 'Great session — keep the same approach next time.',
  painOrFatigueConcern: null,
  summary: 'You moved 1,200kg of total volume today, up 20% from last time. You set 1 new personal record — nice work.',
};

jest.mock('../../../services/coaching', () => ({
  coachingEngine: {
    evaluateReadiness: jest.fn(() => ({
      score: 80,
      band: 'high',
      factors: [],
      recommendedIntensity: 'full',
      recommendedRpeRange: [6, 8],
      estimatedSessionQuality: 'excellent',
      summary: '',
      computedAt: new Date().toISOString(),
    })),
    assessPainRisk: jest.fn(() => ({ riskLevel: 'none', recommendation: '', stopAndSeekMedicalAttention: false })),
    generatePostWorkoutSummary: jest.fn(),
  },
}));

import { coachingEngine } from '../../../services/coaching';

const mockedGeneratePostWorkoutSummary = coachingEngine.generatePostWorkoutSummary as jest.Mock;

function seedCompletedWorkout() {
  useActiveWorkoutStore.setState({
    workoutLogId: 'wl-1',
    source: { type: 'programDay', id: 'day-1' },
    startedAt: Date.now() - 30 * 60 * 1000,
    restSecondsRemaining: 0,
    restRunning: false,
    exercises: [
      {
        exerciseId: 'ex1',
        exerciseName: 'Bench Press',
        targetSets: 2,
        targetRepsMin: 5,
        targetRepsMax: 5,
        targetLoadKg: 100,
        targetRpe: 8,
        restSeconds: 90,
        metric: 'weight_kg',
        notes: '',
        sets: [
          { id: 'set-1', dbId: 'dbset-1', setNumber: 1, reps: 5, loadKg: 100, rpe: 8, isWarmup: false, completed: true },
          { id: 'set-2', dbId: 'dbset-2', setNumber: 2, reps: 5, loadKg: 100, rpe: 8, isWarmup: false, completed: true },
        ],
      },
    ],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCompleteWorkoutLogMutateAsync.mockResolvedValue({ id: 'wl-1' });
  mockedGeneratePostWorkoutSummary.mockReturnValue(SUMMARY_RESULT);
  seedCompletedWorkout();
});

describe('WorkoutSummaryScreen', () => {
  it('renders the computed coaching summary', async () => {
    const { getByText, getAllByText } = await render(<WorkoutSummaryScreen />);

    await waitFor(() => expect(getByText(SUMMARY_RESULT.summary)).toBeTruthy());
    expect(getByText('New personal records')).toBeTruthy();
    expect(getAllByText('Bench Press').length).toBeGreaterThan(0);
    expect(getByText('Best set')).toBeTruthy();
    expect(getByText('Compared with last time')).toBeTruthy();
    expect(getByText(SUMMARY_RESULT.suggestedNextAction)).toBeTruthy();
  });

  it('still saves the rating/notes form, resets the session, and navigates home', async () => {
    const { getByText } = await render(<WorkoutSummaryScreen />);
    await waitFor(() => expect(getByText(SUMMARY_RESULT.summary)).toBeTruthy());

    await fireEvent.press(getByText('Save Workout'));

    await waitFor(() => expect(mockCompleteWorkoutLogMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockCompleteWorkoutLogMutateAsync.mock.calls[0][0]).toMatchObject({ workoutLogId: 'wl-1' });
    expect(useActiveWorkoutStore.getState().workoutLogId).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', { screen: 'TodayTab', params: { screen: 'Today' } });
  });
});
