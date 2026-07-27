import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { GenerateProgramScreen } from '../GenerateProgramScreen';

const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => ({ replace: mockReplace, canGoBack: () => true }) };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

const mockUseProfile = jest.fn();

jest.mock('../../../services/api/queries/profiles', () => ({
  useProfile: (...args: unknown[]) => mockUseProfile(...args),
}));

const mockGenerateProgram = jest.fn();

jest.mock('../../../services/api/edgeFunctions', () => ({
  generateProgram: (...args: unknown[]) => mockGenerateProgram(...args),
}));

const PROFILE = {
  goal: 'strength',
  experience_level: 'intermediate',
  days_per_week: 4,
  equipment_access: ['barbell'],
  injuries_notes: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseProfile.mockReturnValue({ data: PROFILE });
});

describe('GenerateProgramScreen', () => {
  it('generates from the persisted profile and navigates to the new program', async () => {
    mockGenerateProgram.mockResolvedValue({ program_id: 'program-1' });

    await render(<GenerateProgramScreen />);

    await waitFor(() =>
      expect(mockGenerateProgram).toHaveBeenCalledWith({
        goal: 'strength',
        experience_level: 'intermediate',
        days_per_week: 4,
        equipment: ['barbell'],
        injuries_notes: '',
      }),
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('ProgramDetail', { programId: 'program-1' }));
  });

  it('shows an error with a retry button when generation fails', async () => {
    mockGenerateProgram.mockRejectedValue(new Error('You already have an active program.'));

    const { getByText } = await render(<GenerateProgramScreen />);

    await waitFor(() => expect(getByText('You already have an active program.')).toBeTruthy());
    expect(getByText('Try Again')).toBeTruthy();
  });

  it('shows a guard error when required profile fields are missing, without calling generateProgram', async () => {
    mockUseProfile.mockReturnValue({ data: { ...PROFILE, goal: null } });

    const { getByText } = await render(<GenerateProgramScreen />);

    await waitFor(() => expect(getByText(/set your goal, experience, and days per week/i)).toBeTruthy());
    expect(mockGenerateProgram).not.toHaveBeenCalled();
  });
});
