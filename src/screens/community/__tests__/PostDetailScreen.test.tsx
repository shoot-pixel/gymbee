import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PostDetailScreen } from '../PostDetailScreen';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, canGoBack: () => false }),
    useRoute: () => ({ params: { postId: 'post-1' } }),
  };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

const mockUsePost = jest.fn();

jest.mock('../../../services/api/queries/posts', () => {
  const actual = jest.requireActual('../../../services/api/queries/posts');
  return {
    ...actual,
    usePost: (...args: unknown[]) => mockUsePost(...args),
    useUpdatePost: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
    useDeletePost: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
    useSignedPhotoUrls: jest.fn(() => ({
      data: {
        'user-2/friends/progress.jpg': 'https://signed/progress.jpg',
        'user-2/friends/before.jpg': 'https://signed/before.jpg',
        'user-2/friends/after.jpg': 'https://signed/after.jpg',
      },
    })),
  };
});

jest.mock('../../../services/api/queries/community', () => ({
  useFriendProfile: jest.fn(() => ({ data: { display_name: 'Alex B.', avatar_url: null } })),
}));

const mockUseComments = jest.fn();
const mockCreateCommentMutateAsync = jest.fn();
const mockDeleteCommentMutate = jest.fn();

jest.mock('../../../services/api/queries/comments', () => ({
  useComments: (...args: unknown[]) => mockUseComments(...args),
  useCreateComment: jest.fn(() => ({ mutateAsync: mockCreateCommentMutateAsync, isPending: false })),
  useDeleteComment: jest.fn(() => ({ mutate: mockDeleteCommentMutate })),
}));

const PROGRESS_POST = {
  id: 'post-1',
  user_id: 'user-2',
  post_type: 'progress_photo' as const,
  visibility: 'friends' as const,
  caption: 'Feeling strong',
  photo_path: 'user-2/friends/progress.jpg',
  before_photo_path: null,
  after_photo_path: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

const BEFORE_AFTER_POST = {
  id: 'post-2',
  user_id: 'user-2',
  post_type: 'before_after_photo' as const,
  visibility: 'friends' as const,
  caption: null,
  photo_path: null,
  before_photo_path: 'user-2/friends/before.jpg',
  after_photo_path: 'user-2/friends/after.jpg',
  created_at: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseComments.mockReturnValue({ data: [] });
});

describe('PostDetailScreen', () => {
  it('renders a progress-photo post with its caption', async () => {
    mockUsePost.mockReturnValue({ data: PROGRESS_POST, isLoading: false });

    const { getByText, getByLabelText } = await render(<PostDetailScreen />);

    await waitFor(() => expect(getByText('Feeling strong')).toBeTruthy());
    expect(getByLabelText('Progress photo')).toBeTruthy();
  });

  it('renders a before/after post with two images', async () => {
    mockUsePost.mockReturnValue({ data: BEFORE_AFTER_POST, isLoading: false });

    const { getByLabelText } = await render(<PostDetailScreen />);

    await waitFor(() => expect(getByLabelText('Before photo')).toBeTruthy());
    expect(getByLabelText('After photo')).toBeTruthy();
  });

  it('shows the VisibilityBadge only when viewing your own post', async () => {
    mockUsePost.mockReturnValue({ data: { ...PROGRESS_POST, user_id: 'user-1' }, isLoading: false });

    const { getByText } = await render(<PostDetailScreen />);
    await waitFor(() => expect(getByText('👥 Friends')).toBeTruthy());
  });

  it('does not show a VisibilityBadge when viewing a friend\'s post', async () => {
    mockUsePost.mockReturnValue({ data: PROGRESS_POST, isLoading: false });

    const { queryByText } = await render(<PostDetailScreen />);
    await waitFor(() => expect(queryByText('👥 Friends')).toBeNull());
  });

  it('renders existing comments with author and body', async () => {
    mockUsePost.mockReturnValue({ data: PROGRESS_POST, isLoading: false });
    mockUseComments.mockReturnValue({
      data: [
        {
          id: 'comment-1',
          post_id: 'post-1',
          user_id: 'user-3',
          body: 'Great progress!',
          created_at: '2026-01-01T00:00:00.000Z',
          displayName: 'Sam K.',
          avatarUrl: null,
        },
      ],
    });

    const { getByText } = await render(<PostDetailScreen />);
    await waitFor(() => expect(getByText('Sam K.')).toBeTruthy());
    expect(getByText('Great progress!')).toBeTruthy();
  });

  it('posts a new comment and clears the composer', async () => {
    mockUsePost.mockReturnValue({ data: PROGRESS_POST, isLoading: false });
    mockCreateCommentMutateAsync.mockResolvedValue(undefined);

    const { getByPlaceholderText, getByText, getAllByText } = await render(<PostDetailScreen />);
    await waitFor(() => expect(getByText('Feeling strong')).toBeTruthy());

    const input = getByPlaceholderText('Add a comment...');
    await fireEvent.changeText(input, 'Nice work!');
    // "Post" also appears as the screen's own Header title, so scope to the
    // composer's button specifically (the second "Post" text in the tree).
    const postButtons = getAllByText('Post');
    await fireEvent.press(postButtons[postButtons.length - 1]);

    expect(mockCreateCommentMutateAsync).toHaveBeenCalledWith('Nice work!');
  });

  it('deletes a comment after confirming, only when the viewer owns it or the post', async () => {
    mockUsePost.mockReturnValue({ data: { ...PROGRESS_POST, user_id: 'user-1' }, isLoading: false });
    mockUseComments.mockReturnValue({
      data: [
        {
          id: 'comment-1',
          post_id: 'post-1',
          user_id: 'user-3',
          body: 'Nice!',
          created_at: '2026-01-01T00:00:00.000Z',
          displayName: 'Sam K.',
          avatarUrl: null,
        },
      ],
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const deleteButton = buttons?.find(b => b.text === 'Delete');
      deleteButton?.onPress?.();
    });

    const { getByLabelText } = await render(<PostDetailScreen />);
    await waitFor(() => expect(getByLabelText('Delete comment')).toBeTruthy());
    await fireEvent.press(getByLabelText('Delete comment'));

    expect(mockDeleteCommentMutate).toHaveBeenCalledWith('comment-1');
    alertSpy.mockRestore();
  });
});
