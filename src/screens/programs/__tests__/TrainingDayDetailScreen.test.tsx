import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { format, addDays, startOfWeek } from 'date-fns';
import { TrainingDayDetailScreen } from '../TrainingDayDetailScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, canGoBack: () => true }),
    useRoute: () => ({ params: { weeklyScheduleId: 'ws-1', workoutTemplateId: 'template-1', dayOfWeek: 3 } }),
  };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

const mockUseWorkoutTemplate = jest.fn();

jest.mock('../../../services/api/queries/workoutTemplates', () => ({
  useWorkoutTemplate: (...args: unknown[]) => mockUseWorkoutTemplate(...args),
}));

const mockRemoveMutateAsync = jest.fn();

jest.mock('../../../services/api/queries/weeklySchedule', () => ({
  useRemoveWeeklySchedule: jest.fn(() => ({ mutateAsync: mockRemoveMutateAsync, isPending: false })),
}));

const mockStartTemplateTodayMutateAsync = jest.fn();

jest.mock('../../../services/api/queries/scheduledWorkouts', () => ({
  useStartTemplateToday: jest.fn(() => ({ mutateAsync: mockStartTemplateTodayMutateAsync, isPending: false })),
}));

const mockUseWorkoutLogsInRange = jest.fn();

jest.mock('../../../services/api/queries/workoutLogs', () => ({
  useWorkoutLogsInRange: (...args: unknown[]) => mockUseWorkoutLogsInRange(...args),
}));

const TEMPLATE = {
  id: 'template-1',
  name: 'Ultimate Core Day',
  workout_template_exercises: [
    {
      id: 'te-1',
      target_sets: 3,
      target_reps_min: 8,
      target_reps_max: 12,
      target_rpe: null,
      rest_seconds: 60,
      exercises: { name: 'Plank' },
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseWorkoutTemplate.mockReturnValue({ data: TEMPLATE, isLoading: false });
  mockUseWorkoutLogsInRange.mockReturnValue({ data: [] });
});

describe('TrainingDayDetailScreen', () => {
  it('renders the template name, weekday, and exercises', async () => {
    const { getByText } = await render(<TrainingDayDetailScreen />);
    await waitFor(() => expect(getByText('Ultimate Core Day')).toBeTruthy());
    expect(getByText('Wednesday · every week')).toBeTruthy();
    expect(getByText('Plank')).toBeTruthy();
  });

  it('starts a scheduled workout and navigates to it', async () => {
    mockStartTemplateTodayMutateAsync.mockResolvedValue({ id: 'sw-1' });

    const { getByText } = await render(<TrainingDayDetailScreen />);
    await waitFor(() => expect(getByText('Start Workout')).toBeTruthy());

    await fireEvent.press(getByText('Start Workout'));

    await waitFor(() =>
      expect(mockStartTemplateTodayMutateAsync).toHaveBeenCalledWith({ userId: 'user-1', template: TEMPLATE }),
    );
  });

  it('shows a completed indicator instead of Start Workout once this week\'s date is already logged', async () => {
    const thisWednesday = addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 3);
    mockUseWorkoutLogsInRange.mockReturnValue({
      data: [{ id: 'log-1', completedAt: `${format(thisWednesday, 'yyyy-MM-dd')}T12:00:00.000Z`, title: 'Ultimate Core Day', rating: null }],
    });

    const { getByText, queryByText } = await render(<TrainingDayDetailScreen />);
    await waitFor(() => expect(getByText('Completed this week')).toBeTruthy());
    expect(queryByText('Start Workout')).toBeNull();
  });

  it('removes the training day after confirming from the overflow menu', async () => {
    mockRemoveMutateAsync.mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const removeButton = buttons?.find(b => b.text === 'Remove');
      removeButton?.onPress?.();
    });

    const { getByLabelText, getByText } = await render(<TrainingDayDetailScreen />);
    await waitFor(() => expect(getByText('Ultimate Core Day')).toBeTruthy());

    await fireEvent.press(getByLabelText('Training day options'));
    await fireEvent.press(getByText('Remove from Wednesday'));

    await waitFor(() => expect(mockRemoveMutateAsync).toHaveBeenCalledWith({ id: 'ws-1', userId: 'user-1' }));
    expect(mockGoBack).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
