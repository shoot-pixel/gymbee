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
  experience_level: 'intermediate',
  goal: 'strength',
};

jest.mock('../../../services/api/queries/profiles', () => ({
  useProfile: jest.fn(() => ({ data: PROFILE, isLoading: false })),
  useUploadAvatar: jest.fn(() => ({ mutateAsync: jest.fn() })),
}));

const mockUseUserPosts = jest.fn();

jest.mock('../../../services/api/queries/posts', () => {
  const actual = jest.requireActual('../../../services/api/queries/posts');
  return {
    ...actual,
    useUserPosts: (...args: unknown[]) => mockUseUserPosts(...args),
    useSignedPhotoUrls: jest.fn(() => ({ data: {} })),
  };
});

const PROGRESS_POST = {
  id: 'post-1',
  user_id: 'user-1',
  post_type: 'progress_photo' as const,
  visibility: 'private' as const,
  caption: null,
  photo_path: 'user-1/private/a.jpg',
  before_photo_path: null,
  after_photo_path: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseUserPosts.mockReturnValue({ data: [], isLoading: false });
});

describe('ProfileScreen', () => {
  it('renders profile details', async () => {
    const { getByText } = await render(<ProfileScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(getByText('Alex B.')).toBeTruthy());
    expect(getByText('alex@example.com')).toBeTruthy();
  });

  it('shows a Posts section with a VisibilityBadge reflecting each post\'s visibility', async () => {
    mockUseUserPosts.mockReturnValue({ data: [PROGRESS_POST], isLoading: false });

    const { getByText } = await render(<ProfileScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(getByText('POSTS')).toBeTruthy());
    expect(getByText('🔒 Private')).toBeTruthy();
  });

  it('navigates to PostDetail when tapping a post thumbnail', async () => {
    mockUseUserPosts.mockReturnValue({ data: [PROGRESS_POST], isLoading: false });

    const { getByLabelText } = await render(<ProfileScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(getByLabelText('Progress photo post')).toBeTruthy());

    await fireEvent.press(getByLabelText('Progress photo post'));
    expect(mockNavigate).toHaveBeenCalledWith('PostDetail', { postId: 'post-1' });
  });

  it('shows the Posts section with an empty state and no VisibilityBadge when there are no posts', async () => {
    const { getByText, queryByText } = await render(<ProfileScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(getByText('POSTS')).toBeTruthy());
    expect(getByText('No posts yet')).toBeTruthy();
    expect(queryByText('🔒 Private')).toBeNull();
  });

  it('opens the add-post sheet from the empty state action and navigates to UploadPhotoPost', async () => {
    const { getByText } = await render(<ProfileScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(getByText('Post a Photo')).toBeTruthy());

    await fireEvent.press(getByText('Post a Photo'));
    await waitFor(() => expect(getByText('Post Progress Photo')).toBeTruthy());

    await fireEvent.press(getByText('Post Progress Photo'));
    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'ProgressTab',
      params: { screen: 'UploadPhotoPost', params: { mode: 'progress' } },
    });
  });

  it('opens the add-post sheet from the "+" button and navigates for before/after', async () => {
    mockUseUserPosts.mockReturnValue({ data: [PROGRESS_POST], isLoading: false });

    const { getByLabelText, getByText } = await render(<ProfileScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(getByLabelText('Post a photo')).toBeTruthy());

    await fireEvent.press(getByLabelText('Post a photo'));
    await waitFor(() => expect(getByText('Post Before & After')).toBeTruthy());

    await fireEvent.press(getByText('Post Before & After'));
    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'ProgressTab',
      params: { screen: 'UploadPhotoPost', params: { mode: 'before_after' } },
    });
  });
});
