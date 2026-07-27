import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { format, addDays, startOfWeek } from 'date-fns';
import { CalendarScreen } from '../CalendarScreen';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useEffect } = require('react');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, canGoBack: () => false }),
    // The real hook needs a live NavigationContainer to know about focus
    // events — for these tests, running the callback once like a plain
    // effect is enough to cover the reset-segment-on-focus behavior.
    useFocusEffect: (callback: () => void) => useEffect(callback, [callback]),
  };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

const mockUseActiveProgramTree = jest.fn();

jest.mock('../../../services/api/queries/programs', () => {
  const actual = jest.requireActual('../../../services/api/queries/programs');
  return {
    ...actual,
    useActiveProgramTree: (...args: unknown[]) => mockUseActiveProgramTree(...args),
  };
});

const mockUseScheduledWorkouts = jest.fn();

jest.mock('../../../services/api/queries/scheduledWorkouts', () => ({
  useScheduledWorkouts: (...args: unknown[]) => mockUseScheduledWorkouts(...args),
}));

const mockUseWeeklySchedule = jest.fn();

jest.mock('../../../services/api/queries/weeklySchedule', () => {
  const actual = jest.requireActual('../../../services/api/queries/weeklySchedule');
  return {
    ...actual,
    useWeeklySchedule: (...args: unknown[]) => mockUseWeeklySchedule(...args),
  };
});

const mockUseWorkoutLogsInRange = jest.fn();

jest.mock('../../../services/api/queries/workoutLogs', () => ({
  useWorkoutLogsInRange: (...args: unknown[]) => mockUseWorkoutLogsInRange(...args),
}));

const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
const thisWeekDate = (dayOfWeek: number) => addDays(thisWeekStart, dayOfWeek);

beforeEach(() => {
  jest.clearAllMocks();
  mockUseWeeklySchedule.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
  mockUseWorkoutLogsInRange.mockReturnValue({ data: [], refetch: jest.fn() });
  mockUseScheduledWorkouts.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
});

describe('CalendarScreen', () => {
  it('shows the Training header and a segmented control defaulting to This Week', async () => {
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false });

    const { getByText, getByLabelText } = await render(<CalendarScreen />);
    await waitFor(() => expect(getByText('Training')).toBeTruthy());

    const thisWeekOption = getByLabelText('This Week');
    expect(thisWeekOption.props.accessibilityState.selected).toBe(true);
  });

  it('navigates to Library when the Library segment is tapped', async () => {
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false });

    const { getByLabelText } = await render(<CalendarScreen />);
    await fireEvent.press(getByLabelText('Library'));

    expect(mockNavigate).toHaveBeenCalledWith('Library', undefined);
  });

  it('navigates to GenerateProgram from the Program segment when there is no active program', async () => {
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false });

    const { getByLabelText } = await render(<CalendarScreen />);
    await fireEvent.press(getByLabelText('Program'));

    expect(mockNavigate).toHaveBeenCalledWith('GenerateProgram');
  });

  it('navigates to ProgramDetail from the Program segment when a program exists', async () => {
    mockUseActiveProgramTree.mockReturnValue({
      data: { id: 'program-1', title: 'Strength Block', weeks_count: 4, days_per_week: 3, program_weeks: [] },
      isLoading: false,
    });

    const { getByLabelText } = await render(<CalendarScreen />);
    await fireEvent.press(getByLabelText('Program'));

    expect(mockNavigate).toHaveBeenCalledWith('ProgramDetail', { programId: 'program-1' });
  });

  it('shows an empty state and an Add a Training Day button when nothing is set up', async () => {
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false });

    const { getByText } = await render(<CalendarScreen />);
    await waitFor(() => expect(getByText('No training days set up yet')).toBeTruthy());

    await fireEvent.press(getByText('Add a Training Day'));
    expect(mockNavigate).toHaveBeenCalledWith('AssignTrainingDay');
  });

  it('lists all 7 weekdays once a training day is assigned, navigating to detail for a training day and to Assign (pre-filled) for a rest day', async () => {
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false });
    mockUseWeeklySchedule.mockReturnValue({
      data: [
        {
          id: 'ws-1',
          day_of_week: 3,
          workout_template_id: 'template-1',
          workout_templates: { id: 'template-1', name: 'Ultimate Core Day', workout_template_exercises: [{ order_index: 0 }] },
        },
      ],
      isLoading: false,
      refetch: jest.fn(),
    });

    const { getByText } = await render(<CalendarScreen />);
    await waitFor(() => expect(getByText('Wednesday')).toBeTruthy());
    expect(getByText('Ultimate Core Day · 1 exercises')).toBeTruthy();
    expect(getByText(format(thisWeekDate(3), 'MMM d'))).toBeTruthy();
    expect(getByText('Sunday')).toBeTruthy();

    await fireEvent.press(getByText('Wednesday'));
    expect(mockNavigate).toHaveBeenCalledWith('TrainingDayDetail', {
      weeklyScheduleId: 'ws-1',
      workoutTemplateId: 'template-1',
      dayOfWeek: 3,
    });

    await fireEvent.press(getByText('Sunday'));
    expect(getByText('Assign a Workout')).toBeTruthy();
    await fireEvent.press(getByText('Assign a Workout'));
    expect(mockNavigate).toHaveBeenCalledWith('AssignTrainingDay', { initialDayOfWeek: 0 });
  });

  it('offers a choice between assigning a workout or logging cardio when a rest day is tapped', async () => {
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false });
    mockUseWeeklySchedule.mockReturnValue({
      data: [
        {
          id: 'ws-1',
          day_of_week: 3,
          workout_template_id: 'template-1',
          workout_templates: { id: 'template-1', name: 'Ultimate Core Day', workout_template_exercises: [{ order_index: 0 }] },
        },
      ],
      isLoading: false,
      refetch: jest.fn(),
    });

    const { getByText } = await render(<CalendarScreen />);
    await waitFor(() => expect(getByText('Sunday')).toBeTruthy());

    await fireEvent.press(getByText('Sunday'));
    expect(getByText('Assign a Workout')).toBeTruthy();
    expect(getByText('Log Cardio')).toBeTruthy();

    await fireEvent.press(getByText('Log Cardio'));
    expect(mockNavigate).toHaveBeenCalledWith('AssignCardioDay', { initialDayOfWeek: 0 });
  });

  it('shows a cardio weekday as "Cardio Day" and starts a session on tap, not the assign/cardio choice sheet', async () => {
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false });
    mockUseWeeklySchedule.mockReturnValue({
      data: [{ id: 'ws-1', day_of_week: 3, workout_template_id: null, day_type: 'cardio' }],
      isLoading: false,
      refetch: jest.fn(),
    });

    const { getByText, queryByText } = await render(<CalendarScreen />);
    await waitFor(() => expect(getByText('Wednesday')).toBeTruthy());
    expect(getByText('Cardio Day')).toBeTruthy();

    await fireEvent.press(getByText('Wednesday'));
    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'LogTab',
      params: { screen: 'LogCardio', params: { date: format(thisWeekDate(3), 'yyyy-MM-dd') } },
    });
    expect(queryByText('Assign a Workout')).toBeNull();
  });

  it('shows a day as Completed and opens its log detail on tap, once this week\'s workout for that day is logged', async () => {
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false });
    mockUseWeeklySchedule.mockReturnValue({
      data: [
        {
          id: 'ws-1',
          day_of_week: 3,
          workout_template_id: 'template-1',
          workout_templates: { id: 'template-1', name: 'Ultimate Core Day', workout_template_exercises: [{ order_index: 0 }] },
        },
      ],
      isLoading: false,
      refetch: jest.fn(),
    });
    const thisWednesday = thisWeekDate(3);
    mockUseWorkoutLogsInRange.mockReturnValue({
      data: [{ id: 'log-1', programDayId: null, scheduledWorkoutId: null, startedAt: '', completedAt: `${format(thisWednesday, 'yyyy-MM-dd')}T12:00:00.000Z` }],
      refetch: jest.fn(),
    });

    const { getByText, queryByText } = await render(<CalendarScreen />);
    await waitFor(() => expect(getByText('Completed')).toBeTruthy());

    await fireEvent.press(getByText('Wednesday'));
    expect(mockNavigate).toHaveBeenCalledWith('WorkoutLogDetail', {
      workoutLogIds: ['log-1'],
      title: 'Ultimate Core Day',
      dateLabel: format(thisWednesday, 'EEEE, MMM d'),
    });

    // A rest day is still tappable (offers the assign/cardio choice) even
    // when a different day this week is already completed.
    await fireEvent.press(getByText('Sunday'));
    await fireEvent.press(getByText('Assign a Workout'));
    expect(mockNavigate).toHaveBeenCalledWith('AssignTrainingDay', { initialDayOfWeek: 0 });
    // The completed row keeps showing its resolved title alongside the
    // "Completed" trailing badge — it doesn't disappear.
    expect(queryByText('Ultimate Core Day')).toBeTruthy();
  });

  it('shows a one-off badge when an ad-hoc scheduled workout overrides a normal training day this week', async () => {
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false });
    mockUseWeeklySchedule.mockReturnValue({
      data: [
        {
          id: 'ws-1',
          day_of_week: 3,
          workout_template_id: 'template-1',
          workout_templates: { id: 'template-1', name: 'Pull Day', workout_template_exercises: [{ order_index: 0 }] },
        },
      ],
      isLoading: false,
      refetch: jest.fn(),
    });
    const thisWednesday = thisWeekDate(3);
    mockUseScheduledWorkouts.mockReturnValue({
      data: [{ id: 'sw-1', name: 'Recovery Mobility Flow', scheduled_date: format(thisWednesday, 'yyyy-MM-dd') }],
      isLoading: false,
      refetch: jest.fn(),
    });

    const { getByText } = await render(<CalendarScreen />);
    await waitFor(() => expect(getByText('Recovery Mobility Flow')).toBeTruthy());
    expect(getByText('ONE-OFF')).toBeTruthy();
    expect(getByText('usually Pull Day')).toBeTruthy();

    await fireEvent.press(getByText('Recovery Mobility Flow'));
    expect(mockNavigate).toHaveBeenCalledWith('ScheduledWorkoutDetail', { scheduledWorkoutId: 'sw-1' });
  });

  it('shows a one-off badge with "usually Rest" when an ad-hoc workout is added to a normally-rest day', async () => {
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false });
    const thisSaturday = thisWeekDate(6);
    mockUseScheduledWorkouts.mockReturnValue({
      data: [{ id: 'sw-2', name: 'Mobility Session', scheduled_date: format(thisSaturday, 'yyyy-MM-dd') }],
      isLoading: false,
      refetch: jest.fn(),
    });

    const { getByText } = await render(<CalendarScreen />);
    await waitFor(() => expect(getByText('Mobility Session')).toBeTruthy());
    expect(getByText('usually Rest')).toBeTruthy();
  });

  it('shows an UPCOMING section only for scheduled workouts beyond this week, not within it', async () => {
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false });
    const withinThisWeek = thisWeekDate(5);
    const beyondThisWeek = addDays(thisWeekDate(6), 5);
    mockUseScheduledWorkouts.mockReturnValue({
      data: [
        { id: 'sw-within', name: 'This Week Session', scheduled_date: format(withinThisWeek, 'yyyy-MM-dd') },
        { id: 'sw-future', name: 'Future Session', scheduled_date: format(beyondThisWeek, 'yyyy-MM-dd') },
      ],
      isLoading: false,
      refetch: jest.fn(),
    });

    const { getByText, queryByText, getAllByText } = await render(<CalendarScreen />);
    await waitFor(() => expect(getByText('UPCOMING')).toBeTruthy());
    expect(getByText('Future Session')).toBeTruthy();
    // "This Week Session" appears once, in its weekday row — not duplicated
    // under UPCOMING.
    expect(getAllByText('This Week Session')).toHaveLength(1);
    expect(queryByText(format(withinThisWeek, 'EEEE, MMM d'))).toBeNull();
  });

  it('shows a secondary AI-generate link when there is no active program', async () => {
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false });

    const { getByText } = await render(<CalendarScreen />);
    await waitFor(() => expect(getByText('Generate a periodized program with AI')).toBeTruthy());

    await fireEvent.press(getByText('Generate a periodized program with AI'));
    expect(mockNavigate).toHaveBeenCalledWith('GenerateProgram');
  });

  it('shows the program summary card (linking into the full Program view) instead of the AI-generate link once a program exists', async () => {
    mockUseActiveProgramTree.mockReturnValue({
      data: {
        id: 'program-1',
        title: 'Strength Block',
        weeks_count: 4,
        days_per_week: 3,
        program_weeks: [],
      },
      isLoading: false,
    });

    const { getByText, queryByText } = await render(<CalendarScreen />);
    await waitFor(() => expect(getByText('Strength Block')).toBeTruthy());
    expect(queryByText('Generate a periodized program with AI')).toBeNull();

    await fireEvent.press(getByText('Strength Block'));
    expect(mockNavigate).toHaveBeenCalledWith('ProgramDetail', { programId: 'program-1' });
  });
});
