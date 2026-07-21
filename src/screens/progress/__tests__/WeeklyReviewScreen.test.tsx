import React from 'react';
import { Share } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { WeeklyReviewScreen } from '../WeeklyReviewScreen';

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

jest.mock('../../../hooks/useUnitPreference', () => ({
  useUnitPreference: () => 'kg',
}));

const PARAMS = {
  weekStart: '2026-01-05',
  weekEnd: '2026-01-11',
  workoutsCompleted: 3,
  workoutsMissed: 1,
  weekSets: [],
  priorBestE1rmByExercise: {},
  weekPrEvents: [],
  checkins: [
    { date: '2026-01-05', sleepHours: 7, soreness: 2, stress: 2, hasPain: false, painNotes: null, readinessScore: 80 },
    { date: '2026-01-06', sleepHours: 6, soreness: 3, stress: 3, hasPain: false, painNotes: null, readinessScore: 70 },
  ],
  trainingLoad: { acuteVolumeKg: 1000, chronicAvgVolumeKg: 1000, loadRatio: 1, classification: 'normal' as const },
};

const REVIEW_RESULT = {
  weekStart: '2026-01-05',
  weekEnd: '2026-01-11',
  workoutsCompleted: 3,
  workoutsMissed: 1,
  consistencyPercent: 75,
  totalVolumeKg: 2000,
  volumeByMuscleGroup: [{ muscle: 'quadriceps', volumeKg: 2000 }],
  newPersonalRecords: [
    { exerciseId: 'ex1', exerciseName: 'Squat', loadKg: 100, reps: 5, e1rm: 116.7, loggedAt: '2026-01-06T00:00:00.000Z' },
  ],
  mostImprovedExercise: { exerciseId: 'ex1', exerciseName: 'Squat', changePercent: 12 },
  mostInconsistentExercise: null,
  averageReadinessScore: 75,
  averageSleepHours: 6.5,
  averageSoreness: 2.5,
  averageStress: 2.5,
  painReportCount: 0,
  trainingLoadClassification: 'normal' as const,
  habitObservation: null,
  recommendedChangesNextWeek: "Keep the same approach — it's working.",
  summary: 'You completed 3 workouts this week and missed 1, moving 2,000kg of total volume.',
  shareableSummary: '3 workouts completed this week · 2,000kg total volume · 1 new PR · 75% consistency',
};

jest.mock('../../../services/api/queries/weeklyReview', () => ({
  useWeeklyReviewData: jest.fn(() => ({ isLoading: false, params: PARAMS })),
}));

jest.mock('../../../services/coaching', () => ({
  coachingEngine: {
    generateWeeklyReview: jest.fn(() => REVIEW_RESULT),
  },
}));

describe('WeeklyReviewScreen', () => {
  it('renders the summary and stat cards from the computed review', async () => {
    const { getByText } = await render(<WeeklyReviewScreen />);

    await waitFor(() => expect(getByText(REVIEW_RESULT.summary)).toBeTruthy());
    expect(getByText('This Week')).toBeTruthy();
    expect(getByText('Personal records')).toBeTruthy();
    expect(getByText('Squat')).toBeTruthy();
    expect(getByText(REVIEW_RESULT.recommendedChangesNextWeek)).toBeTruthy();
  });

  it('changes the displayed range when navigating to the previous week', async () => {
    const { getByText, getByLabelText } = await render(<WeeklyReviewScreen />);
    await waitFor(() => expect(getByText('This Week')).toBeTruthy());

    await fireEvent.press(getByLabelText('Previous week'));

    await waitFor(() => expect(getByText(/Week of/)).toBeTruthy());
  });

  it('shares exactly the shareable summary text, not the full private summary', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    const { getByText } = await render(<WeeklyReviewScreen />);
    await waitFor(() => expect(getByText(REVIEW_RESULT.summary)).toBeTruthy());

    await fireEvent.press(getByText('Share Summary'));

    expect(shareSpy).toHaveBeenCalledWith({ message: REVIEW_RESULT.shareableSummary });
    shareSpy.mockRestore();
  });
});
