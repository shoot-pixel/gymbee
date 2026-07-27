import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AssignTrainingDayScreen } from '../AssignTrainingDayScreen';

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ goBack: mockGoBack, canGoBack: () => true }),
    useRoute: () => ({ params: undefined }),
  };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

const mockUseWorkoutTemplates = jest.fn();

jest.mock('../../../services/api/queries/workoutTemplates', () => ({
  useWorkoutTemplates: (...args: unknown[]) => mockUseWorkoutTemplates(...args),
}));

const mockAssignMutateAsync = jest.fn();

jest.mock('../../../services/api/queries/weeklySchedule', () => ({
  useAssignWeeklySchedule: jest.fn(() => ({ mutateAsync: mockAssignMutateAsync, isPending: false })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseWorkoutTemplates.mockReturnValue({
    data: [{ id: 'template-1', name: 'Ultimate Core Day', workout_template_exercises: [{ order_index: 0 }, { order_index: 1 }] }],
    isLoading: false,
  });
});

describe('AssignTrainingDayScreen', () => {
  it('disables Assign until both a day and a workout are picked, then assigns and goes back', async () => {
    const { getByText } = await render(<AssignTrainingDayScreen />);
    await waitFor(() => expect(getByText('Ultimate Core Day')).toBeTruthy());

    await fireEvent.press(getByText('Assign'));
    expect(mockAssignMutateAsync).not.toHaveBeenCalled();

    await fireEvent.press(getByText('W'));
    await fireEvent.press(getByText('Ultimate Core Day'));
    await fireEvent.press(getByText('Assign'));

    await waitFor(() =>
      expect(mockAssignMutateAsync).toHaveBeenCalledWith({ userId: 'user-1', dayOfWeek: 3, workoutTemplateId: 'template-1' }),
    );
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows an empty state when there are no saved workout templates', async () => {
    mockUseWorkoutTemplates.mockReturnValue({ data: [], isLoading: false });

    const { getByText } = await render(<AssignTrainingDayScreen />);
    await waitFor(() => expect(getByText('No saved workouts yet')).toBeTruthy());
  });
});
