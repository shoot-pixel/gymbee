import React from 'react';
import { format } from 'date-fns';
import { act } from 'react-test-renderer';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import type { ReactTestRendererJSON, ReactTestRendererNode } from 'react-test-renderer';
import { TodayScreen } from '../TodayScreen';
import { useWorkoutLogsInRange } from '../../../services/api/queries/workoutLogs';
import { useScheduledWorkouts } from '../../../services/api/queries/scheduledWorkouts';
import { useLoggedSets, computePrEvents } from '../../../services/api/queries/progress';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => ({ navigate: mockNavigate }) };
});

const mockUseFriendsPosts = jest.fn();

jest.mock('../../../services/api/queries/posts', () => {
  const actual = jest.requireActual('../../../services/api/queries/posts');
  return {
    ...actual,
    useFriendsPosts: (...args: unknown[]) => mockUseFriendsPosts(...args),
    useSignedPhotoUrls: jest.fn(() => ({ data: {} })),
  };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

const mockRefetchProgram = jest.fn();
const mockRefetchWorkoutLogs = jest.fn();
const mockRefetchScheduledWorkouts = jest.fn();
const mockRefetchWeeklySchedule = jest.fn();
const mockRefetchLoggedSets = jest.fn();

const mockUseActiveProgramTree = jest.fn();

jest.mock('../../../services/api/queries/programs', () => ({
  useActiveProgramTree: (...args: unknown[]) => mockUseActiveProgramTree(...args),
  getProgramDayForDate: jest.fn(() => null),
}));

jest.mock('../../../services/api/queries/profiles', () => ({
  useProfile: jest.fn(() => ({ data: null, isLoading: false })),
}));

jest.mock('../../../services/api/queries/workoutLogs', () => ({
  useWorkoutLogsInRange: jest.fn(() => ({ data: [], isLoading: false, refetch: mockRefetchWorkoutLogs })),
}));

jest.mock('../../../services/api/queries/scheduledWorkouts', () => ({
  useScheduledWorkouts: jest.fn(() => ({ data: [], isLoading: false, refetch: mockRefetchScheduledWorkouts })),
  useStartTemplateToday: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  TODAY_RANGE_PAST_DAYS: 91,
  TODAY_RANGE_FUTURE_DAYS: 21,
}));

const mockUseWeeklySchedule = jest.fn();

jest.mock('../../../services/api/queries/weeklySchedule', () => {
  const actual = jest.requireActual('../../../services/api/queries/weeklySchedule');
  return {
    ...actual,
    useWeeklySchedule: (...args: unknown[]) => mockUseWeeklySchedule(...args),
  };
});

jest.mock('../../../services/api/queries/workoutTemplates', () => ({
  useWorkoutTemplate: jest.fn(() => ({ data: undefined, isLoading: false })),
}));

jest.mock('../../../services/api/queries/progress', () => ({
  useLoggedSets: jest.fn(() => ({ data: [], isLoading: false, refetch: mockRefetchLoggedSets })),
  computePrEvents: jest.fn(() => []),
}));

jest.mock('../../../services/api/queries/integrations', () => ({
  useIntegrationConnections: jest.fn(() => ({ data: [], isLoading: false })),
}));

const mockSyncWhoopMetricsMutate = jest.fn();

jest.mock('../../../services/api/queries/whoop', () => ({
  useSyncWhoopMetrics: jest.fn(() => ({ mutate: mockSyncWhoopMetricsMutate })),
}));

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
}));

const MOCK_PATTERN = {
  id: 'pat-1',
  user_id: 'user-1',
  pattern_key: 'inconsistent_weekday:5',
  pattern_type: 'inconsistent_weekday' as const,
  confidence: 0.8,
  title: 'Friday sessions keep getting skipped',
  detail: "You've missed 3 of 4 planned Friday sessions recently.",
  evidence_summary: '3/4 Friday sessions missed',
  status: 'active' as const,
  first_detected_at: new Date().toISOString(),
  last_detected_at: new Date().toISOString(),
  dismissed_at: null,
};

const mockSyncMutate = jest.fn();
const mockDismissMutate = jest.fn();

jest.mock('../../../services/api/queries/coachingMemory', () => ({
  useTrainingPatterns: jest.fn(() => ({
    isLoading: false,
    activePatterns: [MOCK_PATTERN],
    params: { weeklySnapshots: [], missedWeekdays: [], exerciseRpeTrends: [], dismissedKeys: [] },
  })),
  useSyncTrainingPatterns: jest.fn(() => ({ mutate: mockSyncMutate })),
  useDismissTrainingPattern: jest.fn(() => ({ mutate: mockDismissMutate })),
}));

const mockGenerateTodayFocusSummary = jest.fn((..._args: unknown[]) => ({
  headline: 'Ready to train',
  summary: 'Today is a training day.',
  band: 'high' as const,
}));

jest.mock('../../../services/coaching', () => ({
  coachingEngine: {
    detectTrainingPatterns: jest.fn(() => [
      {
        key: 'inconsistent_weekday:5',
        type: 'inconsistent_weekday',
        confidence: 0.8,
        title: MOCK_PATTERN.title,
        detail: MOCK_PATTERN.detail,
        evidenceSummary: MOCK_PATTERN.evidence_summary,
      },
    ]),
    evaluateReadiness: jest.fn(() => ({
      score: 85,
      band: 'high',
      factors: [],
      recommendedIntensity: 'full',
      recommendedRpeRange: [7, 9],
      estimatedSessionQuality: 'excellent',
      summary: 'Readiness appears strong today.',
      computedAt: '2026-01-01T00:00:00.000Z',
    })),
    generateTodayFocusSummary: (...args: unknown[]) => mockGenerateTodayFocusSummary(...args),
  },
}));

const FRIEND_POST = {
  id: 'post-1',
  user_id: 'friend-1',
  post_type: 'progress_photo' as const,
  visibility: 'friends' as const,
  caption: null,
  photo_path: 'friend-1/friends/a.jpg',
  before_photo_path: null,
  after_photo_path: null,
  created_at: '2026-01-01T00:00:00.000Z',
  displayName: 'Friend One',
  avatarUrl: null,
};

const mockedUseWorkoutLogsInRange = useWorkoutLogsInRange as jest.Mock;
const mockedUseScheduledWorkouts = useScheduledWorkouts as jest.Mock;
const mockedUseLoggedSets = useLoggedSets as jest.Mock;
const mockedComputePrEvents = computePrEvents as jest.Mock;

/** Flattens a rendered tree into its text content, in document order, so
 * relative card ordering (e.g. "Coach Insight" right under "Coach Summary")
 * can be asserted without depending on RNTL's DOM-adjacency helpers. */
function collectText(
  node: ReactTestRendererJSON | ReactTestRendererJSON[] | ReactTestRendererNode[] | string | null,
): string[] {
  if (node == null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText(node.children);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseFriendsPosts.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn() });
  mockedUseWorkoutLogsInRange.mockReturnValue({ data: [], isLoading: false, refetch: mockRefetchWorkoutLogs });
  mockedUseScheduledWorkouts.mockReturnValue({ data: [], isLoading: false, refetch: mockRefetchScheduledWorkouts });
  mockedUseLoggedSets.mockReturnValue({ data: [], isLoading: false, refetch: mockRefetchLoggedSets });
  mockedComputePrEvents.mockReturnValue([]);
  mockUseActiveProgramTree.mockReturnValue({
    data: { id: 'p1', days_per_week: 3, weeks_count: 4, start_date: '2024-01-01', program_weeks: [] },
    isLoading: false,
    refetch: mockRefetchProgram,
  });
  mockUseWeeklySchedule.mockReturnValue({ data: [], isLoading: false, refetch: mockRefetchWeeklySchedule });
});

describe('TodayScreen', () => {
  it('renders the Coach Summary card from generateTodayFocusSummary', async () => {
    const { getByText } = await render(<TodayScreen />);

    await waitFor(() => expect(getByText('Coach Summary')).toBeTruthy());
    expect(getByText('Ready to train')).toBeTruthy();
    expect(getByText('Today is a training day.')).toBeTruthy();
  });

  it('refetches program, workout logs, scheduled workouts, weekly schedule, logged sets, and friends posts on pull-to-refresh', async () => {
    const mockRefetchFriendsPosts = jest.fn();
    mockUseFriendsPosts.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: mockRefetchFriendsPosts });

    const { getByTestId, getByText } = await render(<TodayScreen />);
    await waitFor(() => expect(getByText('Coach Summary')).toBeTruthy());

    await act(async () => {
      await getByTestId('today-scroll-view').props.refreshControl.props.onRefresh();
    });

    expect(mockRefetchProgram).toHaveBeenCalled();
    expect(mockRefetchWorkoutLogs).toHaveBeenCalled();
    expect(mockRefetchScheduledWorkouts).toHaveBeenCalled();
    expect(mockRefetchWeeklySchedule).toHaveBeenCalled();
    expect(mockRefetchLoggedSets).toHaveBeenCalled();
    expect(mockRefetchFriendsPosts).toHaveBeenCalled();
  });

  it('renders the Friends Activity section from friends posts', async () => {
    mockUseFriendsPosts.mockReturnValue({ data: [FRIEND_POST], isLoading: false, isError: false, refetch: jest.fn() });

    const { getByText } = await render(<TodayScreen />);

    await waitFor(() => expect(getByText('Friends Activity')).toBeTruthy());
    expect(getByText('Friend One posted a progress photo')).toBeTruthy();
  });

  it('navigates to the community posts grid when View All is pressed', async () => {
    mockUseFriendsPosts.mockReturnValue({ data: [FRIEND_POST], isLoading: false, isError: false, refetch: jest.fn() });

    const { getByText } = await render(<TodayScreen />);
    await waitFor(() => expect(getByText('View All')).toBeTruthy());

    await fireEvent.press(getByText('View All'));
    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'CommunityTab',
      params: { screen: 'Posts' },
    });
  });

  it('renders the Coach Insight card for an active detected pattern', async () => {
    const { getByText } = await render(<TodayScreen />);

    await waitFor(() => expect(getByText('Coach Insight')).toBeTruthy());
    expect(getByText(MOCK_PATTERN.title)).toBeTruthy();
    expect(getByText(MOCK_PATTERN.detail)).toBeTruthy();
  });

  it('dismisses a pattern with its id when the dismiss button is pressed', async () => {
    const { getByLabelText } = await render(<TodayScreen />);

    await waitFor(() => expect(getByLabelText('Dismiss insight')).toBeTruthy());
    await fireEvent.press(getByLabelText('Dismiss insight'));

    expect(mockDismissMutate).toHaveBeenCalledWith({ id: 'pat-1', userId: 'user-1' });
  });

  it('renders the calendar under Coach Summary, then Coach Insight, ahead of the rest of the page', async () => {
    const { toJSON, getByText } = await render(<TodayScreen />);
    await waitFor(() => expect(getByText('Coach Insight')).toBeTruthy());

    const texts = collectText(toJSON());
    const aiSummaryIndex = texts.indexOf('Coach Summary');
    // "Month" is the calendar's static month-picker label — a stable anchor
    // for the WeekTimeline section, unlike its month-year header text which
    // depends on the actual current date.
    const calendarIndex = texts.indexOf('Month');
    const coachInsightIndex = texts.indexOf('Coach Insight');
    const laterContentIndex = texts.indexOf('Nothing logged');

    expect(aiSummaryIndex).toBeGreaterThanOrEqual(0);
    expect(calendarIndex).toBeGreaterThan(aiSummaryIndex);
    expect(coachInsightIndex).toBeGreaterThan(calendarIndex);
    expect(laterContentIndex).toBeGreaterThan(coachInsightIndex);
  });

  it('shows a real stats summary and a PR badge on a completed day, computed from workout logs and logged sets', async () => {
    const startedAt = new Date();
    startedAt.setHours(9, 0, 0, 0);
    const completedAt = new Date(startedAt.getTime() + 42 * 60_000);
    const loggedAt = new Date(startedAt.getTime() + 10 * 60_000).toISOString();

    mockedUseWorkoutLogsInRange.mockReturnValue({
      data: [
        {
          id: 'wl-1',
          programDayId: null,
          scheduledWorkoutId: null,
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
        },
      ],
      isLoading: false,
      refetch: mockRefetchWorkoutLogs,
    });
    mockedUseLoggedSets.mockReturnValue({
      data: [
        { id: 's1', exerciseId: 'ex1', exerciseName: 'Bench Press', reps: 8, loadKg: 60, loggedAt },
        { id: 's2', exerciseId: 'ex1', exerciseName: 'Bench Press', reps: 8, loadKg: 60, loggedAt },
      ],
      isLoading: false,
      refetch: mockRefetchLoggedSets,
    });
    mockedComputePrEvents.mockReturnValue([
      { exerciseId: 'ex1', exerciseName: 'Bench Press', loadKg: 60, reps: 8, e1rm: 76, loggedAt },
    ]);

    const { getByText } = await render(<TodayScreen />);

    await waitFor(() => expect(getByText("Today's workout is done")).toBeTruthy());
    expect(getByText('42 min')).toBeTruthy();
    expect(getByText('960 kg')).toBeTruthy();
    expect(getByText('New PR')).toBeTruthy();
  });

  it('shows cardio stats (not the strength summary) on a day whose only completed log is cardio, with no flip affordance', async () => {
    const startedAt = new Date();
    startedAt.setHours(9, 0, 0, 0);
    const completedAt = new Date(startedAt.getTime() + 30 * 60_000);

    mockedUseWorkoutLogsInRange.mockReturnValue({
      data: [
        {
          id: 'wl-1',
          programDayId: null,
          scheduledWorkoutId: null,
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          cardio: {
            activityName: 'Treadmill',
            durationMinutes: 30,
            distanceKm: 5,
            effort: 'moderate',
            estimatedCalories: 320,
          },
        },
      ],
      isLoading: false,
      refetch: mockRefetchWorkoutLogs,
    });

    const { getByText, queryByText } = await render(<TodayScreen />);

    await waitFor(() => expect(getByText("Today's cardio is done")).toBeTruthy());
    expect(getByText('Treadmill')).toBeTruthy();
    expect(getByText('30 min')).toBeTruthy();
    expect(getByText('~320')).toBeTruthy();
    expect(getByText('5.0 km')).toBeTruthy();
    expect(queryByText('Tap to see the full workout')).toBeNull();
  });

  it('shows the recurring training day name for today, ahead of the AI program day', async () => {
    mockUseWeeklySchedule.mockReturnValue({
      data: [
        {
          id: 'ws-1',
          day_of_week: new Date().getDay(),
          workout_template_id: 'template-1',
          workout_templates: { id: 'template-1', name: 'Ultimate Core Day', workout_template_exercises: [{ order_index: 0 }] },
        },
      ],
      isLoading: false,
      refetch: mockRefetchWeeklySchedule,
    });

    const { getByText } = await render(<TodayScreen />);
    await waitFor(() => expect(getByText('Ultimate Core Day')).toBeTruthy());
  });

  it('lets an explicit one-off scheduled workout for today override the recurring assignment', async () => {
    mockUseWeeklySchedule.mockReturnValue({
      data: [
        {
          id: 'ws-1',
          day_of_week: new Date().getDay(),
          workout_template_id: 'template-1',
          workout_templates: { id: 'template-1', name: 'Ultimate Core Day', workout_template_exercises: [{ order_index: 0 }] },
        },
      ],
      isLoading: false,
      refetch: mockRefetchWeeklySchedule,
    });
    mockedUseScheduledWorkouts.mockReturnValue({
      data: [{ id: 'sw-1', name: 'One-Off Leg Day', scheduled_date: format(new Date(), 'yyyy-MM-dd') }],
      isLoading: false,
      refetch: mockRefetchScheduledWorkouts,
    });

    const { getByText, queryByText } = await render(<TodayScreen />);
    await waitFor(() => expect(getByText('One-Off Leg Day')).toBeTruthy());
    expect(queryByText('Ultimate Core Day')).toBeNull();
  });

  it('still shows the calendar, day detail, and friends activity when there is no active program', async () => {
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false, refetch: mockRefetchProgram });
    mockUseFriendsPosts.mockReturnValue({ data: [FRIEND_POST], isLoading: false, isError: false, refetch: jest.fn() });

    const { getByText, getAllByText, toJSON } = await render(<TodayScreen />);

    await waitFor(() => expect(getByText('Set up a training day, or generate a program with AI, from the Training tab.')).toBeTruthy());
    // The week calendar strip renders regardless of a program (weekday letters M/T/W/etc).
    expect(getAllByText('M').length).toBeGreaterThan(0);
    // Selected-day card still resolves (to "nothing logged/scheduled") without a program.
    expect(getByText('Nothing logged')).toBeTruthy();
    // Friends activity is completely independent of program state.
    expect(getByText('Friends Activity')).toBeTruthy();
    expect(getByText('Friend One posted a progress photo')).toBeTruthy();

    // The no-program prompt sits at the bottom, right above Friends Activity.
    const texts = collectText(toJSON());
    const nothingLoggedIndex = texts.indexOf('Nothing logged');
    const noProgramIndex = texts.indexOf('Set up a training day, or generate a program with AI, from the Training tab.');
    const friendsActivityIndex = texts.indexOf('Friends Activity');
    expect(noProgramIndex).toBeGreaterThan(nothingLoggedIndex);
    expect(friendsActivityIndex).toBeGreaterThan(noProgramIndex);
  });
});
