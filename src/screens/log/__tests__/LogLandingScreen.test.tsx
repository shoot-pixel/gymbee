import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LogLandingScreen } from '../LogLandingScreen';

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

const mockUseScheduledWorkouts = jest.fn();

jest.mock('../../../services/api/queries/scheduledWorkouts', () => ({
  useScheduledWorkouts: (...args: unknown[]) => mockUseScheduledWorkouts(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseActiveProgramTree.mockReturnValue({ data: { id: 'program-1' }, isLoading: false });
  mockUseScheduledWorkouts.mockReturnValue({ data: [], isLoading: false });
  mockGetProgramDayForDate.mockReturnValue(null);
});

describe('LogLandingScreen', () => {
  it("forwards straight into today's program day when one exists, without crashing on missing route params", async () => {
    mockGetProgramDayForDate.mockReturnValue({
      week: { id: 'week-1' },
      day: { id: 'day-1', is_rest_day: false },
    });

    await render(<LogLandingScreen />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('PreWorkoutReview', { programDayId: 'day-1' }));
  });

  it('forwards into an ad-hoc scheduled workout when there is no program day today', async () => {
    mockUseScheduledWorkouts.mockReturnValue({ data: [{ id: 'sw-1' }], isLoading: false });

    await render(<LogLandingScreen />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('PreWorkoutReview', { scheduledWorkoutId: 'sw-1' }),
    );
  });

  it('does not forward on a rest day, and offers a way to the library instead', async () => {
    mockGetProgramDayForDate.mockReturnValue({
      week: { id: 'week-1' },
      day: { id: 'day-1', is_rest_day: true },
    });

    const { getByText } = await render(<LogLandingScreen />);

    await waitFor(() => expect(getByText('Nothing to log today')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();

    await fireEvent.press(getByText('Browse Library'));
    expect(mockNavigate).toHaveBeenCalledWith('Library');
  });

  it('does not forward when there is no active program and nothing scheduled', async () => {
    mockUseActiveProgramTree.mockReturnValue({ data: null, isLoading: false });

    const { getByText } = await render(<LogLandingScreen />);

    await waitFor(() => expect(getByText("You don't have an active program yet.")).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
