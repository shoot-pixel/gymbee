import React from 'react';
import { act } from 'react-test-renderer';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { format } from 'date-fns';
import { LogLandingScreen } from '../LogLandingScreen';
import { useActiveWorkoutStore } from '../../../store/activeWorkoutStore';

const todayKey = format(new Date(), 'yyyy-MM-dd');

const mockNavigate = jest.fn();
const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, replace: mockReplace, canGoBack: () => false }),
  };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

const mockUseActiveProgramTree = jest.fn();
const mockGetProgramDayForDate = jest.fn();

jest.mock('../../../services/api/queries/programs', () => ({
  useActiveProgramTree: (...args: unknown[]) => mockUseActiveProgramTree(...args),
  getProgramDayForDate: (...args: unknown[]) => mockGetProgramDayForDate(...args),
}));

const mockUseWeeklySchedule = jest.fn();

jest.mock('../../../services/api/queries/weeklySchedule', () => {
  const actual = jest.requireActual('../../../services/api/queries/weeklySchedule');
  return {
    ...actual,
    useWeeklySchedule: (...args: unknown[]) => mockUseWeeklySchedule(...args),
  };
});

const mockUseScheduledWorkouts = jest.fn();
const mockUseStartTemplateToday = jest.fn();
const mockStartTemplateTodayMutateAsync = jest.fn();

jest.mock('../../../services/api/queries/scheduledWorkouts', () => ({
  useScheduledWorkouts: (...args: unknown[]) => mockUseScheduledWorkouts(...args),
  useStartTemplateToday: () => mockUseStartTemplateToday(),
}));

const mockUseWorkoutLogsInRange = jest.fn();

jest.mock('../../../services/api/queries/workoutLogs', () => ({
  useWorkoutLogsInRange: (...args: unknown[]) => mockUseWorkoutLogsInRange(...args),
}));

const mockUseWorkoutTemplate = jest.fn();

jest.mock('../../../services/api/queries/workoutTemplates', () => ({
  useWorkoutTemplate: (...args: unknown[]) => mockUseWorkoutTemplate(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseActiveProgramTree.mockReturnValue({ data: { id: 'program-1' }, isLoading: false });
  mockUseWeeklySchedule.mockReturnValue({ data: [], isLoading: false });
  mockUseScheduledWorkouts.mockReturnValue({ data: [], isLoading: false });
  mockUseWorkoutLogsInRange.mockReturnValue({ data: [], isLoading: false });
  mockGetProgramDayForDate.mockReturnValue(null);
  mockUseWorkoutTemplate.mockReturnValue({ data: undefined, isLoading: false });
  mockUseStartTemplateToday.mockReturnValue({ mutateAsync: mockStartTemplateTodayMutateAsync, isPending: false });
});

afterEach(() => {
  useActiveWorkoutStore.getState().reset();
});

describe('LogLandingScreen', () => {
  it('resumes an in-progress session automatically — e.g. restored after the app was killed and relaunched', async () => {
    useActiveWorkoutStore.setState({
      workoutLogId: 'log-1',
      source: { type: 'programDay', id: 'day-9' },
      hasHydrated: true,
    });
    // Would otherwise offer today's (different) program day — the
    // in-progress session must win regardless of what's scheduled today.
    mockGetProgramDayForDate.mockReturnValue({
      week: { id: 'week-1' },
      day: { id: 'day-1', is_rest_day: false },
    });

    await render(<LogLandingScreen />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('ActiveWorkoutOverview', { programDayId: 'day-9' }),
    );
  });

  it('waits for the persisted session to be checked before rendering anything', async () => {
    useActiveWorkoutStore.setState({ hasHydrated: false });
    mockGetProgramDayForDate.mockReturnValue({
      week: { id: 'week-1' },
      day: { id: 'day-1', is_rest_day: false },
    });

    const { queryByText } = await render(<LogLandingScreen />);
    expect(queryByText('Log a Workout')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();

    await act(async () => {
      useActiveWorkoutStore.setState({ hasHydrated: true });
    });
    await waitFor(() => expect(queryByText('Log a Workout')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("offers today's program day without starting it, and only starts on an explicit tap", async () => {
    mockGetProgramDayForDate.mockReturnValue({
      week: { id: 'week-1' },
      day: { id: 'day-1', title: 'Push Day', is_rest_day: false },
    });

    const { getByText } = await render(<LogLandingScreen />);

    await waitFor(() => expect(getByText('Push Day')).toBeTruthy());
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    await fireEvent.press(getByText('Start Workout'));
    expect(mockNavigate).toHaveBeenCalledWith('PreWorkoutReview', { programDayId: 'day-1' });
  });

  it('offers an ad-hoc scheduled workout without starting it, and only starts on an explicit tap', async () => {
    mockUseScheduledWorkouts.mockReturnValue({
      data: [{ id: 'sw-1', name: 'Custom Session', scheduled_date: todayKey }],
      isLoading: false,
    });

    const { getByText } = await render(<LogLandingScreen />);

    await waitFor(() => expect(getByText('Custom Session')).toBeTruthy());
    expect(mockNavigate).not.toHaveBeenCalled();

    await fireEvent.press(getByText('Start Workout'));
    expect(mockNavigate).toHaveBeenCalledWith('PreWorkoutReview', { scheduledWorkoutId: 'sw-1' });
  });

  it('resolves an ad-hoc scheduled workout over a program training day for the same date', async () => {
    // Previously the program day would have won here (LogLandingScreen's
    // old precedence was program-first) — resolveDayPlan flips this to
    // match Today/Training, where an ad-hoc override always wins.
    mockGetProgramDayForDate.mockReturnValue({
      week: { id: 'week-1' },
      day: { id: 'day-1', title: 'Push Day', is_rest_day: false },
    });
    mockUseScheduledWorkouts.mockReturnValue({
      data: [{ id: 'sw-1', name: 'Custom Session', scheduled_date: todayKey }],
      isLoading: false,
    });

    const { getByText, queryByText } = await render(<LogLandingScreen />);

    await waitFor(() => expect(getByText('Custom Session')).toBeTruthy());
    expect(queryByText('Push Day')).toBeNull();

    await fireEvent.press(getByText('Start Workout'));
    expect(mockNavigate).toHaveBeenCalledWith('PreWorkoutReview', { scheduledWorkoutId: 'sw-1' });
  });

  it('offers a weekly-recurring template as target, and materializes + starts today\'s instance on tap', async () => {
    // Previously this case showed "Nothing scheduled today" — LogLandingScreen
    // never queried weekly_schedule at all before adopting resolveDayPlan.
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false });
    mockUseWeeklySchedule.mockReturnValue({
      data: [
        {
          id: 'ws-1',
          day_of_week: new Date().getDay(),
          workout_template_id: 'template-1',
          workout_templates: { id: 'template-1', name: 'Pull Day', workout_template_exercises: [{ order_index: 0 }] },
        },
      ],
      isLoading: false,
    });
    const template = { id: 'template-1', name: 'Pull Day', workout_template_exercises: [] };
    mockUseWorkoutTemplate.mockReturnValue({ data: template, isLoading: false });
    mockStartTemplateTodayMutateAsync.mockResolvedValue({ id: 'sw-materialized' });

    const { getByText } = await render(<LogLandingScreen />);
    await waitFor(() => expect(getByText('Pull Day')).toBeTruthy());

    await fireEvent.press(getByText('Start Workout'));
    await waitFor(() =>
      expect(mockStartTemplateTodayMutateAsync).toHaveBeenCalledWith({ userId: 'user-1', template }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('PreWorkoutReview', { scheduledWorkoutId: 'sw-materialized' });
  });

  it('offers a weekly cardio day as target, and goes straight to LogCardio (no PreWorkoutReview) on tap', async () => {
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false });
    mockUseWeeklySchedule.mockReturnValue({
      data: [{ id: 'ws-1', day_of_week: new Date().getDay(), workout_template_id: null, day_type: 'cardio' }],
      isLoading: false,
    });

    const { getByText } = await render(<LogLandingScreen />);
    await waitFor(() => expect(getByText('Cardio Day')).toBeTruthy());

    await fireEvent.press(getByText('Start Workout'));
    expect(mockNavigate).toHaveBeenCalledWith('LogCardio', undefined);
  });

  it('offers an AI-program cardio day as target, passing its programDayId to LogCardio', async () => {
    mockGetProgramDayForDate.mockReturnValue({
      week: { id: 'week-1' },
      day: { id: 'day-1', title: 'Cardio Day', is_rest_day: false, day_type: 'cardio' },
    });

    const { getByText } = await render(<LogLandingScreen />);
    await waitFor(() => expect(getByText('Cardio Day')).toBeTruthy());

    await fireEvent.press(getByText('Start Workout'));
    expect(mockNavigate).toHaveBeenCalledWith('LogCardio', { programDayId: 'day-1' });
  });

  it('does not offer a rest day as a target, but always offers a freestyle option', async () => {
    mockGetProgramDayForDate.mockReturnValue({
      week: { id: 'week-1' },
      day: { id: 'day-1', is_rest_day: true },
    });

    const { getByText, queryByText } = await render(<LogLandingScreen />);

    await waitFor(() => expect(getByText('Nothing scheduled today')).toBeTruthy());
    expect(queryByText('Start Workout')).toBeNull();
    expect(getByText('Start a Freestyle Workout')).toBeTruthy();
    // Picking a different workout is a Training-tab job now — Log no
    // longer offers its own library entry point.
    expect(queryByText('Browse Workout Library')).toBeNull();
  });

  it('always offers a freestyle workout as an explicit alternative, even when a target is scheduled', async () => {
    mockGetProgramDayForDate.mockReturnValue({
      week: { id: 'week-1' },
      day: { id: 'day-1', title: 'Push Day', is_rest_day: false },
    });

    const { getByText } = await render(<LogLandingScreen />);
    await waitFor(() => expect(getByText('Push Day')).toBeTruthy());

    await fireEvent.press(getByText('Start a Freestyle Workout'));
    expect(mockNavigate).toHaveBeenCalledWith('ActiveWorkoutOverview', undefined);
  });

  it('shows a plain message when there is no active program and nothing scheduled', async () => {
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false });

    const { getByText } = await render(<LogLandingScreen />);

    await waitFor(() => expect(getByText("You don't have an active program yet.")).toBeTruthy());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows today as done without re-starting it — e.g. tapping the Log tab again after saving, which would otherwise open a new session with a freshly-ticking elapsed timer', async () => {
    mockGetProgramDayForDate.mockReturnValue({
      week: { id: 'week-1' },
      day: { id: 'day-1', is_rest_day: false },
    });
    mockUseWorkoutLogsInRange.mockReturnValue({
      data: [{ id: 'log-1', completedAt: `${todayKey}T12:00:00.000Z` }],
      isLoading: false,
    });

    const { getByText } = await render(<LogLandingScreen />);

    await waitFor(() => expect(getByText("Today's workout is done")).toBeTruthy());
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    // A second session is still explicitly reachable, just never automatic.
    await fireEvent.press(getByText('Start a Freestyle Workout'));
    expect(mockNavigate).toHaveBeenCalledWith('ActiveWorkoutOverview', undefined);
  });

  it('does not re-start today’s target after it was deleted — deleting an in-progress session must not immediately spawn a new one', async () => {
    mockGetProgramDayForDate.mockReturnValue({
      week: { id: 'week-1' },
      day: { id: 'day-1', title: 'Push Day', is_rest_day: false },
    });
    // Simulates the state right after Delete Workout: no active session, no
    // completed log for today either — same shape as "never started today."
    useActiveWorkoutStore.setState({ workoutLogId: null, source: null, hasHydrated: true });
    mockUseWorkoutLogsInRange.mockReturnValue({ data: [], isLoading: false });

    const { getByText } = await render(<LogLandingScreen />);

    await waitFor(() => expect(getByText('Push Day')).toBeTruthy());
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
