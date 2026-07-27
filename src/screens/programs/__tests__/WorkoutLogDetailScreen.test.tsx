import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { WorkoutLogDetailScreen } from '../WorkoutLogDetailScreen';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
let mockCanGoBack = true;

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, canGoBack: () => mockCanGoBack }),
    useRoute: () => ({ params: { workoutLogIds: ['wl-1'], title: 'Push Day', dateLabel: 'Monday, Mar 4' } }),
  };
});

const mockUseWorkoutLogDetail = jest.fn();
const mockUpdateSetMutate = jest.fn();
const mockDeleteSetMutate = jest.fn();
const mockDeleteWorkoutLogMutateAsync = jest.fn();

jest.mock('../../../services/api/queries/workoutLogs', () => ({
  useWorkoutLogDetail: (...args: unknown[]) => mockUseWorkoutLogDetail(...args),
  useUpdateSet: () => ({ mutate: mockUpdateSetMutate }),
  useDeleteSet: () => ({ mutate: mockDeleteSetMutate }),
  useDeleteWorkoutLog: () => ({ mutateAsync: mockDeleteWorkoutLogMutateAsync }),
}));

const mockUseUnitPreference = jest.fn();

jest.mock('../../../hooks/useUnitPreference', () => ({
  useUnitPreference: () => mockUseUnitPreference(),
}));

const DETAIL = {
  id: 'wl-1',
  startedAt: '2026-03-04T09:00:00.000Z',
  completedAt: '2026-03-04T09:42:00.000Z',
  title: 'Push Day',
  sets: [
    {
      id: 'set-1',
      exerciseId: 'ex1',
      exerciseName: 'Bench Press',
      setNumber: 1,
      reps: 8,
      loadKg: 60,
      rpe: 7.5,
      durationSeconds: null,
      isWarmup: false,
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack = true;
  mockUseWorkoutLogDetail.mockReturnValue({ data: DETAIL, isLoading: false });
  mockUseUnitPreference.mockReturnValue('kg');
});

describe('WorkoutLogDetailScreen', () => {
  it('has a working back arrow that goes back when this stack has history', async () => {
    const { getByLabelText } = await render(<WorkoutLogDetailScreen />);

    await fireEvent.press(getByLabelText('Back'));

    expect(mockGoBack).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('falls back to Today when reached cross-tab with no back history on this stack', async () => {
    mockCanGoBack = false;

    const { getByLabelText } = await render(<WorkoutLogDetailScreen />);

    await fireEvent.press(getByLabelText('Back'));

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', { screen: 'TodayTab', params: { screen: 'Today' } });
  });

  it('shows the date label and per-set editable fields', async () => {
    const { getByText, getByDisplayValue } = await render(<WorkoutLogDetailScreen />);

    expect(getByText('Monday, Mar 4')).toBeTruthy();
    expect(getByText('Bench Press')).toBeTruthy();
    expect(getByDisplayValue('8')).toBeTruthy();
  });

  it('saves an edited rep count on blur', async () => {
    const { getByDisplayValue } = await render(<WorkoutLogDetailScreen />);

    const repsField = getByDisplayValue('8');
    await fireEvent.changeText(repsField, '10');
    await fireEvent(repsField, 'blur');

    expect(mockUpdateSetMutate).toHaveBeenCalledWith({ id: 'set-1', reps: 10 });
  });

  it('shows weight in kg by default, matching the KG column label', async () => {
    const { getByText, getByDisplayValue } = await render(<WorkoutLogDetailScreen />);

    expect(getByText('KG')).toBeTruthy();
    expect(getByDisplayValue('60')).toBeTruthy();
  });

  it('shows and edits weight in pounds when that is the athlete\'s unit preference', async () => {
    mockUseUnitPreference.mockReturnValue('lb');

    const { getByText, getByDisplayValue } = await render(<WorkoutLogDetailScreen />);

    expect(getByText('LB')).toBeTruthy();
    // 60kg -> ~132.28lb, rounded to the nearest 0.5lb plate increment.
    const weightField = getByDisplayValue('132.5');
    expect(weightField).toBeTruthy();

    await fireEvent.changeText(weightField, '135');
    await fireEvent(weightField, 'blur');

    // 135lb back to kg for storage.
    expect(mockUpdateSetMutate).toHaveBeenCalledWith({ id: 'set-1', load_kg: 135 * 0.45359237 });
  });

  it('does not re-save an untouched weight field purely due to kg<->lb rounding', async () => {
    mockUseUnitPreference.mockReturnValue('lb');

    const { getByDisplayValue } = await render(<WorkoutLogDetailScreen />);

    const weightField = getByDisplayValue('132.5');
    await fireEvent(weightField, 'blur');

    expect(mockUpdateSetMutate).not.toHaveBeenCalled();
  });

  it('deletes a set', async () => {
    const { getByLabelText } = await render(<WorkoutLogDetailScreen />);

    await fireEvent.press(getByLabelText('Remove set 1'));

    expect(mockDeleteSetMutate).toHaveBeenCalledWith('set-1');
  });

  it('deletes the whole workout after confirming, then goes back', async () => {
    mockDeleteWorkoutLogMutateAsync.mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const deleteButton = buttons?.find(b => b.text === 'Delete');
      deleteButton?.onPress?.();
    });

    const { getByText } = await render(<WorkoutLogDetailScreen />);
    await fireEvent.press(getByText('Delete Workout'));

    await waitFor(() => expect(mockDeleteWorkoutLogMutateAsync).toHaveBeenCalledWith('wl-1'));
    expect(mockGoBack).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
