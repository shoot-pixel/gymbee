import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ProgramDetailScreen } from '../ProgramDetailScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, canGoBack: () => true }),
    useRoute: () => ({ params: { programId: 'program-1' } }),
  };
});

const mockUseProgramTree = jest.fn();
const mockDeleteProgramMutateAsync = jest.fn();
const mockSetDayTypeMutate = jest.fn();

jest.mock('../../../services/api/queries/programs', () => ({
  useProgramTree: (...args: unknown[]) => mockUseProgramTree(...args),
  useDeleteProgram: jest.fn(() => ({ mutateAsync: mockDeleteProgramMutateAsync, isPending: false })),
  useSetDayType: jest.fn(() => ({ mutate: mockSetDayTypeMutate, isPending: false, variables: undefined })),
}));

const AI_PROGRAM = {
  id: 'program-1',
  title: 'Strength Block',
  goal: 'strength',
  source: 'ai_generated' as const,
  weeks_count: 4,
  days_per_week: 3,
  program_weeks: [
    {
      id: 'week-1',
      week_number: 1,
      focus: null,
      program_days: [
        { id: 'day-1', title: 'Push', is_rest_day: false, program_exercises: [] },
        { id: 'day-2', title: null, is_rest_day: true, program_exercises: [] },
      ],
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseProgramTree.mockReturnValue({ data: AI_PROGRAM, isLoading: false });
});

describe('ProgramDetailScreen', () => {
  it('shows the Delete Program option in the overflow menu', async () => {
    const { getByLabelText, getByText } = await render(<ProgramDetailScreen />);
    await waitFor(() => expect(getByText('Strength Block')).toBeTruthy());

    await fireEvent.press(getByLabelText('Program options'));
    expect(getByText('Delete Program')).toBeTruthy();
  });

  it('deletes the program after confirming and navigates back', async () => {
    mockDeleteProgramMutateAsync.mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const deleteButton = buttons?.find(b => b.text === 'Delete');
      deleteButton?.onPress?.();
    });

    const { getByLabelText, getByText } = await render(<ProgramDetailScreen />);
    await waitFor(() => expect(getByText('Strength Block')).toBeTruthy());

    await fireEvent.press(getByLabelText('Program options'));
    await fireEvent.press(getByText('Delete Program'));

    await waitFor(() => expect(mockDeleteProgramMutateAsync).toHaveBeenCalledWith('program-1'));
    expect(mockGoBack).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('shows a rest day (moon icon, tappable) instead of hiding it entirely', async () => {
    const { getByText } = await render(<ProgramDetailScreen />);
    await waitFor(() => expect(getByText('Rest Day')).toBeTruthy());
    expect(getByText('Rest — tap to add a workout')).toBeTruthy();
  });

  it('un-marks the day as rest and opens it for editing when the rest day row is tapped', async () => {
    mockSetDayTypeMutate.mockImplementation((_vars, opts) => opts?.onSuccess?.());

    const { getByText } = await render(<ProgramDetailScreen />);
    await waitFor(() => expect(getByText('Rest Day')).toBeTruthy());

    await fireEvent.press(getByText('Rest Day'));

    expect(mockSetDayTypeMutate).toHaveBeenCalledWith(
      { id: 'day-2', dayType: 'training' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('DayDetail', { programDayId: 'day-2' });
  });
});
