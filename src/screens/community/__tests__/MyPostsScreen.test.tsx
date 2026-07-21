import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MyPostsScreen } from '../MyPostsScreen';

const mockNavigate = jest.fn();

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

const mockUseUserPosts = jest.fn();

jest.mock('../../../services/api/queries/posts', () => {
  const actual = jest.requireActual('../../../services/api/queries/posts');
  return {
    ...actual,
    useUserPosts: (...args: unknown[]) => mockUseUserPosts(...args),
    useSignedPhotoUrls: jest.fn(() => ({ data: {} })),
  };
});

const MY_POST = {
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
});

describe('MyPostsScreen', () => {
  it('renders a tile for each of your own posts', async () => {
    mockUseUserPosts.mockReturnValue({ data: [MY_POST], isLoading: false });

    const { getByLabelText } = await render(<MyPostsScreen />);
    await waitFor(() => expect(getByLabelText('Progress photo post')).toBeTruthy());
  });

  it('navigates to PostDetail when tapping a tile', async () => {
    mockUseUserPosts.mockReturnValue({ data: [MY_POST], isLoading: false });

    const { getByLabelText } = await render(<MyPostsScreen />);
    await waitFor(() => expect(getByLabelText('Progress photo post')).toBeTruthy());

    await fireEvent.press(getByLabelText('Progress photo post'));
    expect(mockNavigate).toHaveBeenCalledWith('PostDetail', { postId: 'post-1' });
  });

  it('shows an empty state when there are no posts', async () => {
    mockUseUserPosts.mockReturnValue({ data: [], isLoading: false });

    const { getByText } = await render(<MyPostsScreen />);
    await waitFor(() => expect(getByText('No posts yet')).toBeTruthy());
  });
});
