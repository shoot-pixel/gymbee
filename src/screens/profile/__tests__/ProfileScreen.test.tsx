import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ProfileScreen } from '../ProfileScreen';

const mockNavigate = jest.fn();
const navigation = { navigate: mockNavigate } as never;
const route = { key: 'profile', name: 'Profile' as const, params: undefined };

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, canGoBack: () => false }),
  };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

jest.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ signOut: jest.fn(), loading: false }),
}));

const PROFILE = {
  id: 'user-1',
  display_name: 'Alex B.',
  email: 'alex@example.com',
  avatar_url: null,
};

jest.mock('../../../services/api/queries/profiles', () => ({
  useProfile: jest.fn(() => ({ data: PROFILE, isLoading: false })),
}));

describe('ProfileScreen', () => {
  it('renders the account identity card', async () => {
    const { getByText } = await render(<ProfileScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(getByText('Alex B.')).toBeTruthy());
    expect(getByText('alex@example.com')).toBeTruthy();
  });

  it('navigates to Settings and Account', async () => {
    const { getByText } = await render(<ProfileScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(getByText('Settings')).toBeTruthy());

    await fireEvent.press(getByText('Settings'));
    expect(mockNavigate).toHaveBeenCalledWith('Settings');

    await fireEvent.press(getByText('Account'));
    expect(mockNavigate).toHaveBeenCalledWith('Account');
  });

  it('does not render posts, bio, or followers/following — that content lives in the Community tab', async () => {
    const { getByText, queryByText } = await render(<ProfileScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(getByText('Alex B.')).toBeTruthy());
    expect(queryByText('POSTS')).toBeNull();
    expect(queryByText('Followers')).toBeNull();
    expect(queryByText('Add a bio')).toBeNull();
  });
});
