import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { InjuriesScreen } from '../InjuriesScreen';
import { useOnboardingStore } from '../../../store/onboardingStore';

const navigation = {} as never;
const route = { key: 'injuries', name: 'Injuries' as const, params: undefined };

const mockSetSession = jest.fn();

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null; setSession: (...args: unknown[]) => void }) => unknown) =>
    selector({ userId: 'user-1', setSession: mockSetSession }),
}));

const mockUpdateProfileMutateAsync = jest.fn();

jest.mock('../../../services/api/queries/profiles', () => ({
  useUpdateProfile: jest.fn(() => ({ mutateAsync: mockUpdateProfileMutateAsync, isPending: false })),
}));

const mockLogBodyMetricMutateAsync = jest.fn();

jest.mock('../../../services/api/queries/bodyMetrics', () => ({
  useLogBodyMetric: jest.fn(() => ({ mutateAsync: mockLogBodyMetricMutateAsync, isPending: false })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingStore.setState({
    sex: 'female',
    heightFeet: 5,
    heightInches: 6,
    weightLb: 140,
    goal: 'strength',
    experienceLevel: 'intermediate',
    daysPerWeek: 4,
    equipment: ['barbell', 'dumbbell'],
    injuriesNotes: '',
  });
});

describe('InjuriesScreen', () => {
  it('finishes onboarding by saving the profile directly, with no program generated', async () => {
    mockUpdateProfileMutateAsync.mockResolvedValue(undefined);
    mockLogBodyMetricMutateAsync.mockResolvedValue(undefined);

    const { getByText } = await render(<InjuriesScreen navigation={navigation} route={route} />);
    await fireEvent.press(getByText('Finish'));

    await waitFor(() =>
      expect(mockUpdateProfileMutateAsync).toHaveBeenCalledWith({
        goal: 'strength',
        experience_level: 'intermediate',
        days_per_week: 4,
        equipment_access: ['barbell', 'dumbbell'],
        injuries_notes: null,
        sex: 'female',
        height_cm: 167.6,
        onboarding_completed: true,
      }),
    );
    expect(mockLogBodyMetricMutateAsync).toHaveBeenCalledWith({ weightKg: expect.closeTo(63.5, 1) });
    expect(mockSetSession).toHaveBeenCalledWith({ userId: 'user-1', onboardingCompleted: true });
  });

  it('shows an inline error and does not complete onboarding when answers are missing', async () => {
    useOnboardingStore.setState({ daysPerWeek: null });

    const { getByText } = await render(<InjuriesScreen navigation={navigation} route={route} />);
    await fireEvent.press(getByText('Finish'));

    await waitFor(() => expect(getByText(/please go back and complete every step/i)).toBeTruthy());
    expect(mockUpdateProfileMutateAsync).not.toHaveBeenCalled();
    expect(mockSetSession).not.toHaveBeenCalled();
  });
});
