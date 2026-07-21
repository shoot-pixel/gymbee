import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { FriendProfileScreen } from '../FriendProfileScreen';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ canGoBack: () => false }),
    useRoute: () => ({ params: { userId: 'user-2' } }),
  };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

jest.mock('../../../hooks/useUnitPreference', () => ({
  useUnitPreference: () => 'kg',
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

const PROFILE = { id: 'user-2', display_name: 'Alex B.', avatar_url: null, volumeThisMonth: 1000, workoutsThisMonth: 4 };

const mockUseFriendRelationships = jest.fn();
const mockUseIsBlocked = jest.fn();
const mockSendMutate = jest.fn();
const mockAcceptMutate = jest.fn();
const mockDeclineMutate = jest.fn();
const mockRemoveMutate = jest.fn();
const mockBlockMutate = jest.fn();

jest.mock('../../../services/api/queries/community', () => {
  const actual = jest.requireActual('../../../services/api/queries/community');
  return {
    ...actual,
    useFriendProfile: jest.fn(() => ({ data: PROFILE, isLoading: false })),
    useFriendRelationships: (...args: unknown[]) => mockUseFriendRelationships(...args),
    useIsBlocked: (...args: unknown[]) => mockUseIsBlocked(...args),
    useSendFriendRequest: jest.fn(() => ({ mutate: mockSendMutate, isPending: false })),
    useAcceptFriendRequest: jest.fn(() => ({ mutate: mockAcceptMutate, isPending: false })),
    useDeclineFriendRequest: jest.fn(() => ({ mutate: mockDeclineMutate, isPending: false })),
    useRemoveFriendRequest: jest.fn(() => ({ mutate: mockRemoveMutate, isPending: false })),
    useBlockUser: jest.fn(() => ({ mutate: mockBlockMutate, isPending: false })),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseIsBlocked.mockReturnValue({ data: false, isLoading: false });
  mockUseUserPosts.mockReturnValue({ data: [], isLoading: false });
});

describe('FriendProfileScreen', () => {
  it('shows "Add Friend" and sends a request when there is no relationship yet', async () => {
    mockUseFriendRelationships.mockReturnValue({
      data: { friendIds: new Set(), outgoingByAddressee: new Map(), incomingByRequester: new Map() },
    });

    const { getByText } = await render(<FriendProfileScreen />);
    await waitFor(() => expect(getByText('Alex B.')).toBeTruthy());

    await fireEvent.press(getByText('Add Friend'));
    expect(mockSendMutate).toHaveBeenCalledWith('user-2');
  });

  it('shows an Accept/Decline pair for an incoming request', async () => {
    mockUseFriendRelationships.mockReturnValue({
      data: {
        friendIds: new Set(),
        outgoingByAddressee: new Map(),
        incomingByRequester: new Map([['user-2', 'req-1']]),
      },
    });

    const { getByText } = await render(<FriendProfileScreen />);
    await waitFor(() => expect(getByText('Accept')).toBeTruthy());

    await fireEvent.press(getByText('Accept'));
    expect(mockAcceptMutate).toHaveBeenCalledWith('req-1');

    await fireEvent.press(getByText('Decline'));
    expect(mockDeclineMutate).toHaveBeenCalledWith('req-1');
  });

  it('shows "Friends" once accepted', async () => {
    mockUseFriendRelationships.mockReturnValue({
      data: { friendIds: new Set(['user-2']), outgoingByAddressee: new Map(), incomingByRequester: new Map() },
    });

    const { getByText } = await render(<FriendProfileScreen />);
    await waitFor(() => expect(getByText('Friends')).toBeTruthy());
  });

  it('blocks the profile via the overflow menu after confirming', async () => {
    mockUseFriendRelationships.mockReturnValue({
      data: { friendIds: new Set(), outgoingByAddressee: new Map(), incomingByRequester: new Map() },
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const blockButton = buttons?.find(b => b.text === 'Block');
      blockButton?.onPress?.();
    });

    const { getByLabelText, getByText } = await render(<FriendProfileScreen />);
    await waitFor(() => expect(getByText('Alex B.')).toBeTruthy());

    await fireEvent.press(getByLabelText('Profile options'));
    await fireEvent.press(getByText('Block Alex B.'));

    expect(alertSpy).toHaveBeenCalled();
    expect(mockBlockMutate).toHaveBeenCalledWith('user-2');
    alertSpy.mockRestore();
  });

  it('shows a plain unavailable state instead of the profile when the target is blocked', async () => {
    mockUseFriendRelationships.mockReturnValue({
      data: { friendIds: new Set(), outgoingByAddressee: new Map(), incomingByRequester: new Map() },
    });
    mockUseIsBlocked.mockReturnValue({ data: true, isLoading: false });

    const { getByText, queryByText } = await render(<FriendProfileScreen />);
    await waitFor(() => expect(getByText('This profile is unavailable.')).toBeTruthy());
    expect(queryByText('Alex B.')).toBeNull();
  });

  it('shows a Posts section from useUserPosts with no visibility badges', async () => {
    mockUseFriendRelationships.mockReturnValue({
      data: { friendIds: new Set(['user-2']), outgoingByAddressee: new Map(), incomingByRequester: new Map() },
    });
    mockUseUserPosts.mockReturnValue({
      data: [
        {
          id: 'post-1',
          user_id: 'user-2',
          post_type: 'progress_photo',
          visibility: 'friends',
          caption: null,
          photo_path: 'user-2/friends/a.jpg',
          before_photo_path: null,
          after_photo_path: null,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      isLoading: false,
    });

    const { getByText, queryByText } = await render(<FriendProfileScreen />);
    await waitFor(() => expect(getByText('POSTS')).toBeTruthy());
    expect(queryByText('🔒 Private')).toBeNull();
    expect(queryByText('👥 Friends')).toBeNull();
  });
});
