import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CommunityPostsScreen } from '../CommunityPostsScreen';

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

const mockUseFriendsPosts = jest.fn();

jest.mock('../../../services/api/queries/posts', () => {
  const actual = jest.requireActual('../../../services/api/queries/posts');
  return {
    ...actual,
    useFriendsPosts: (...args: unknown[]) => mockUseFriendsPosts(...args),
    useSignedPhotoUrls: jest.fn(() => ({ data: {} })),
  };
});

jest.mock('../../../services/api/queries/likes', () => ({
  useLikeCounts: jest.fn(() => ({ data: {}, refetch: jest.fn() })),
}));

jest.mock('../../../services/api/queries/comments', () => ({
  useCommentCounts: jest.fn(() => ({ data: {}, refetch: jest.fn() })),
}));

const mockUseSearchProfiles = jest.fn();
const mockUseIncomingFriendRequests = jest.fn();
const mockAcceptMutate = jest.fn();
const mockDeclineMutate = jest.fn();
const mockSendMutate = jest.fn();

jest.mock('../../../services/api/queries/community', () => {
  const actual = jest.requireActual('../../../services/api/queries/community');
  return {
    ...actual,
    useSearchProfiles: (...args: unknown[]) => mockUseSearchProfiles(...args),
    useFriendRelationships: jest.fn(() => ({
      data: { friendIds: new Set(), outgoingByAddressee: new Map(), incomingByRequester: new Map() },
    })),
    useIncomingFriendRequests: (...args: unknown[]) => mockUseIncomingFriendRequests(...args),
    useSendFriendRequest: jest.fn(() => ({ mutate: mockSendMutate, isPending: false })),
    useAcceptFriendRequest: jest.fn(() => ({ mutate: mockAcceptMutate, isPending: false })),
    useDeclineFriendRequest: jest.fn(() => ({ mutate: mockDeclineMutate, isPending: false })),
    useRemoveFriendRequest: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
    useBlockUser: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  };
});

jest.mock('../../../services/api/queries/reports', () => ({
  useCreateReport: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));

const mockUseProfile = jest.fn();

jest.mock('../../../services/api/queries/profiles', () => ({
  useProfile: (...args: unknown[]) => mockUseProfile(...args),
}));

const mockMarkMessagesSeenMutate = jest.fn();
const mockMarkActivitySeenMutate = jest.fn();

jest.mock('../../../services/api/queries/notifications', () => ({
  useNotificationBadges: jest.fn(() => ({ hasUnreadMessages: false, hasUnseenActivity: false })),
  useMarkMessagesSeen: jest.fn(() => ({ mutate: mockMarkMessagesSeenMutate })),
  useMarkActivitySeen: jest.fn(() => ({ mutate: mockMarkActivitySeenMutate })),
}));

const FRIEND_POST = {
  id: 'post-1',
  user_id: 'friend-1',
  post_type: 'progress_photo' as const,
  visibility: 'friends' as const,
  caption: null,
  photo_path: 'friend-1/friends/a.jpg',
  before_photo_path: null,
  after_photo_path: null,
  created_at: '2026-01-01T00:00:00.000Z',
  displayName: 'Friend One',
  avatarUrl: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseFriendsPosts.mockReturnValue({ data: [], isLoading: false });
  mockUseSearchProfiles.mockReturnValue({ data: [], isLoading: false });
  mockUseIncomingFriendRequests.mockReturnValue({ data: [] });
  mockUseProfile.mockReturnValue({ data: { avatar_url: null, messages_seen_at: '2026-01-01T00:00:00.000Z', activity_seen_at: '2026-01-01T00:00:00.000Z' }, isLoading: false });
  jest
    .requireMock('../../../services/api/queries/notifications')
    .useNotificationBadges.mockReturnValue({ hasUnreadMessages: false, hasUnseenActivity: false });
});

describe('CommunityPostsScreen', () => {
  it('renders a tile for each friend post', async () => {
    mockUseFriendsPosts.mockReturnValue({ data: [FRIEND_POST], isLoading: false });

    const { getByLabelText } = await render(<CommunityPostsScreen />);
    await waitFor(() => expect(getByLabelText('Progress photo post')).toBeTruthy());
  });

  it('navigates to PostDetail when tapping a tile', async () => {
    mockUseFriendsPosts.mockReturnValue({ data: [FRIEND_POST], isLoading: false });

    const { getByLabelText } = await render(<CommunityPostsScreen />);
    await waitFor(() => expect(getByLabelText('Progress photo post')).toBeTruthy());

    await fireEvent.press(getByLabelText('Progress photo post'));
    expect(mockNavigate).toHaveBeenCalledWith('PostDetail', { postId: 'post-1' });
  });

  it('shows an empty state when there are no friend posts', async () => {
    const { getByText } = await render(<CommunityPostsScreen />);
    await waitFor(() => expect(getByText('No posts yet')).toBeTruthy());
  });

  it('navigates to My Profile and Leaderboard from the hub row', async () => {
    const { getByLabelText } = await render(<CommunityPostsScreen />);
    await waitFor(() => expect(getByLabelText('My Profile')).toBeTruthy());

    await fireEvent.press(getByLabelText('My Profile'));
    expect(mockNavigate).toHaveBeenCalledWith('FriendProfile', { userId: 'user-1' });

    await fireEvent.press(getByLabelText('Leaderboard'));
    expect(mockNavigate).toHaveBeenCalledWith('Leaderboard');

    await fireEvent.press(getByLabelText('At My Gym'));
    expect(mockNavigate).toHaveBeenCalledWith('AtMyGym');
  });

  it('navigates to Settings from the header avatar, same as every other tab', async () => {
    const { getByLabelText } = await render(<CommunityPostsScreen />);
    await waitFor(() => expect(getByLabelText('Settings')).toBeTruthy());

    await fireEvent.press(getByLabelText('Settings'));
    expect(mockNavigate).toHaveBeenCalledWith('Profile', { screen: 'Profile' });
  });

  it('shows an incoming friend-request card and lets you accept/decline', async () => {
    mockUseIncomingFriendRequests.mockReturnValue({
      data: [{ id: 'user-3', display_name: 'Maya L.', avatar_url: null, requestId: 'req-1', createdAt: '2026-01-01' }],
    });

    const { getByText } = await render(<CommunityPostsScreen />);
    await waitFor(() => expect(getByText('Maya L.')).toBeTruthy());

    await fireEvent.press(getByText('Accept'));
    expect(mockAcceptMutate).toHaveBeenCalledWith('req-1');

    await fireEvent.press(getByText('Decline'));
    expect(mockDeclineMutate).toHaveBeenCalledWith('req-1');
  });

  it('marks messages as seen when opening Messages, only when there was something unread', async () => {
    const { useNotificationBadges } = jest.requireMock('../../../services/api/queries/notifications');
    (useNotificationBadges as jest.Mock).mockReturnValue({ hasUnreadMessages: true, hasUnseenActivity: false });

    const { getByLabelText } = await render(<CommunityPostsScreen />);
    await waitFor(() => expect(getByLabelText('Messages')).toBeTruthy());

    await fireEvent.press(getByLabelText('Messages'));

    expect(mockNavigate).toHaveBeenCalledWith('Messages');
    expect(mockMarkMessagesSeenMutate).toHaveBeenCalled();
  });

  it('does not call mark-as-seen when opening Messages/Profile with nothing unread', async () => {
    const { getByLabelText } = await render(<CommunityPostsScreen />);
    await waitFor(() => expect(getByLabelText('Messages')).toBeTruthy());

    await fireEvent.press(getByLabelText('Messages'));
    await fireEvent.press(getByLabelText('My Profile'));

    expect(mockMarkMessagesSeenMutate).not.toHaveBeenCalled();
    expect(mockMarkActivitySeenMutate).not.toHaveBeenCalled();
  });

  it('marks activity as seen when opening My Profile, only when there was something unseen', async () => {
    const { useNotificationBadges } = jest.requireMock('../../../services/api/queries/notifications');
    (useNotificationBadges as jest.Mock).mockReturnValue({ hasUnreadMessages: false, hasUnseenActivity: true });

    const { getByLabelText } = await render(<CommunityPostsScreen />);
    await waitFor(() => expect(getByLabelText('My Profile')).toBeTruthy());

    await fireEvent.press(getByLabelText('My Profile'));

    expect(mockNavigate).toHaveBeenCalledWith('FriendProfile', { userId: 'user-1' });
    expect(mockMarkActivitySeenMutate).toHaveBeenCalled();
  });

  it('searches for athletes and sends a friend request from the results', async () => {
    mockUseSearchProfiles.mockReturnValue({
      data: [{ id: 'user-4', display_name: 'Jordan K.', avatar_url: null }],
      isLoading: false,
    });

    const { getByPlaceholderText, getByText } = await render(<CommunityPostsScreen />);
    fireEvent.changeText(getByPlaceholderText('Find athletes by name or @handle'), 'Jordan');

    await waitFor(() => expect(getByText('Jordan K.')).toBeTruthy());
    await fireEvent.press(getByText('Add Friend'));
    expect(mockSendMutate).toHaveBeenCalledWith('user-4');
  });
});
