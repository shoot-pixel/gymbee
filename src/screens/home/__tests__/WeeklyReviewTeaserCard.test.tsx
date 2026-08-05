import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { WeeklyReviewTeaserCard } from '../WeeklyReviewTeaserCard';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => ({ navigate: mockNavigate }) };
});

jest.mock('../../../hooks/useUnitPreference', () => ({
  useUnitPreference: () => 'kg',
}));

const mockUseProfile = jest.fn();

jest.mock('../../../services/api/queries/profiles', () => ({
  useProfile: (...args: unknown[]) => mockUseProfile(...args),
}));

const mockUseWeeklyReviewData = jest.fn();

jest.mock('../../../services/api/queries/weeklyReview', () => ({
  useWeeklyReviewData: (...args: unknown[]) => mockUseWeeklyReviewData(...args),
}));

const mockGenerateWeeklyReview = jest.fn();

jest.mock('../../../services/coaching', () => ({
  coachingEngine: {
    generateWeeklyReview: (...args: unknown[]) => mockGenerateWeeklyReview(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseProfile.mockReturnValue({ data: null, isLoading: false });
  mockUseWeeklyReviewData.mockReturnValue({ isLoading: false, params: null });
  mockGenerateWeeklyReview.mockReturnValue(null);
});

describe('WeeklyReviewTeaserCard', () => {
  it('renders nothing while the profile is loading', async () => {
    mockUseProfile.mockReturnValue({ data: null, isLoading: true });
    const { toJSON } = await render(<WeeklyReviewTeaserCard userId="user-1" />);
    expect(toJSON()).toBeNull();
  });

  it('shows a locked upsell for a free account, without fetching the review data', async () => {
    mockUseProfile.mockReturnValue({ data: { is_premium: false }, isLoading: false });

    const { getByText } = await render(<WeeklyReviewTeaserCard userId="user-1" />);
    await waitFor(() => expect(getByText('Weekly Review')).toBeTruthy());
    expect(getByText('Unlock with Pro')).toBeTruthy();
    // Skips the aggregation entirely for an account that can never see the result.
    expect(mockUseWeeklyReviewData).toHaveBeenCalledWith(null, expect.anything(), expect.anything(), 'kg');

    await fireEvent.press(getByText('Unlock with Pro'));
    expect(mockNavigate).toHaveBeenCalledWith('Paywall', { trigger: 'analytics' });
  });

  it('renders nothing for a Pro account with no completed workouts this week', async () => {
    mockUseProfile.mockReturnValue({ data: { is_premium: true }, isLoading: false });
    mockUseWeeklyReviewData.mockReturnValue({ isLoading: false, params: { some: 'params' } });
    mockGenerateWeeklyReview.mockReturnValue({ workoutsCompleted: 0, consistencyPercent: null, mostImprovedExercise: null });

    const { toJSON } = await render(<WeeklyReviewTeaserCard userId="user-1" />);
    expect(toJSON()).toBeNull();
  });

  it('shows the teaser stats and navigates to Weekly Review on tap for a Pro account', async () => {
    mockUseProfile.mockReturnValue({ data: { is_premium: true }, isLoading: false });
    mockUseWeeklyReviewData.mockReturnValue({ isLoading: false, params: { some: 'params' } });
    mockGenerateWeeklyReview.mockReturnValue({
      workoutsCompleted: 4,
      consistencyPercent: 80,
      mostImprovedExercise: { exerciseName: 'Squat', changePercent: 8.2 },
    });

    const { getByText } = await render(<WeeklyReviewTeaserCard userId="user-1" />);
    await waitFor(() => expect(getByText(/THIS WEEK.S REVIEW IS READY/)).toBeTruthy());
    expect(getByText('4 sessions · 80% consistency · Squat up ~8%')).toBeTruthy();

    await fireEvent.press(getByText(/THIS WEEK.S REVIEW IS READY/));
    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', { screen: 'ProgressTab', params: { screen: 'WeeklyReview' } });
  });

  it('omits the most-improved clause when there is none', async () => {
    mockUseProfile.mockReturnValue({ data: { is_premium: true }, isLoading: false });
    mockUseWeeklyReviewData.mockReturnValue({ isLoading: false, params: { some: 'params' } });
    mockGenerateWeeklyReview.mockReturnValue({ workoutsCompleted: 2, consistencyPercent: null, mostImprovedExercise: null });

    const { getByText } = await render(<WeeklyReviewTeaserCard userId="user-1" />);
    await waitFor(() => expect(getByText('2 sessions')).toBeTruthy());
  });

  describe('asRow', () => {
    it('renders a ListRow with a PRO badge for a free account, and reports itself as visible', async () => {
      mockUseProfile.mockReturnValue({ data: { is_premium: false }, isLoading: false });
      const onVisibilityChange = jest.fn();

      const { getByText } = await render(<WeeklyReviewTeaserCard userId="user-1" asRow onVisibilityChange={onVisibilityChange} />);
      await waitFor(() => expect(getByText('Weekly Review')).toBeTruthy());
      expect(getByText('Part of SetSocial Pro')).toBeTruthy();
      expect(getByText('PRO')).toBeTruthy();
      expect(onVisibilityChange).toHaveBeenCalledWith(true);

      await fireEvent.press(getByText('Weekly Review'));
      expect(mockNavigate).toHaveBeenCalledWith('Paywall', { trigger: 'analytics' });
    });

    it('renders a ListRow with the teaser stats for a Pro account with a completed week', async () => {
      mockUseProfile.mockReturnValue({ data: { is_premium: true }, isLoading: false });
      mockUseWeeklyReviewData.mockReturnValue({ isLoading: false, params: { some: 'params' } });
      mockGenerateWeeklyReview.mockReturnValue({
        workoutsCompleted: 4,
        consistencyPercent: 80,
        mostImprovedExercise: { exerciseName: 'Squat', changePercent: 8.2 },
      });
      const onVisibilityChange = jest.fn();

      const { getByText } = await render(<WeeklyReviewTeaserCard userId="user-1" asRow onVisibilityChange={onVisibilityChange} />);
      await waitFor(() => expect(getByText("This week's review is ready")).toBeTruthy());
      expect(getByText('4 sessions · 80% consistency · Squat up ~8%')).toBeTruthy();
      expect(onVisibilityChange).toHaveBeenCalledWith(true);

      await fireEvent.press(getByText("This week's review is ready"));
      expect(mockNavigate).toHaveBeenCalledWith('MainTabs', { screen: 'ProgressTab', params: { screen: 'WeeklyReview' } });
    });

    it('reports itself as not visible for a Pro account with no completed workouts yet', async () => {
      mockUseProfile.mockReturnValue({ data: { is_premium: true }, isLoading: false });
      mockUseWeeklyReviewData.mockReturnValue({ isLoading: false, params: { some: 'params' } });
      mockGenerateWeeklyReview.mockReturnValue({ workoutsCompleted: 0, consistencyPercent: null, mostImprovedExercise: null });
      const onVisibilityChange = jest.fn();

      await render(<WeeklyReviewTeaserCard userId="user-1" asRow onVisibilityChange={onVisibilityChange} />);
      await waitFor(() => expect(onVisibilityChange).toHaveBeenCalledWith(false));
    });
  });
});
