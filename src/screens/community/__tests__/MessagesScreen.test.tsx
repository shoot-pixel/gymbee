import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MessagesScreen } from '../MessagesScreen';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => ({ navigate: mockNavigate, canGoBack: () => false }) };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

const mockUseConversations = jest.fn();
const mockUseIncomingDmRequests = jest.fn();
const mockUseOutgoingDmRequests = jest.fn();
const mockRespondMutate = jest.fn();

jest.mock('../../../services/api/queries/directMessages', () => ({
  useConversations: (...args: unknown[]) => mockUseConversations(...args),
  useIncomingDmRequests: (...args: unknown[]) => mockUseIncomingDmRequests(...args),
  useOutgoingDmRequests: (...args: unknown[]) => mockUseOutgoingDmRequests(...args),
  useRespondToConversation: jest.fn(() => ({ mutate: mockRespondMutate, isPending: false })),
}));

const CONVERSATION = {
  id: 'conv-1',
  requester_id: 'user-1',
  recipient_id: 'user-2',
  status: 'accepted' as const,
  created_at: '2026-01-01T00:00:00.000Z',
  last_message_at: '2026-01-02T00:00:00.000Z',
  otherParticipant: { id: 'user-2', display_name: 'Alex B.', avatar_url: null, handle: null, bio: null, hide_stats_from_friends: false, hide_photos_from_friends: false },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseConversations.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
  mockUseIncomingDmRequests.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
  mockUseOutgoingDmRequests.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
});

describe('MessagesScreen', () => {
  it('shows an empty state when there are no conversations', async () => {
    const { getByText } = await render(<MessagesScreen />);
    await waitFor(() => expect(getByText('No messages yet')).toBeTruthy());
  });

  it('lists conversations and navigates into one on tap', async () => {
    mockUseConversations.mockReturnValue({ data: [CONVERSATION], isLoading: false, refetch: jest.fn() });

    const { getByText } = await render(<MessagesScreen />);
    await waitFor(() => expect(getByText('Alex B.')).toBeTruthy());

    await fireEvent.press(getByText('Alex B.'));
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', { conversationId: 'conv-1' });
  });

  it('accepts an incoming request from the Requests tab', async () => {
    mockUseIncomingDmRequests.mockReturnValue({
      data: [{ ...CONVERSATION, id: 'conv-2', status: 'pending' }],
      isLoading: false,
      refetch: jest.fn(),
    });

    const { getByText } = await render(<MessagesScreen />);
    await fireEvent.press(getByText(/^Requests/));
    await waitFor(() => expect(getByText('Accept')).toBeTruthy());

    await fireEvent.press(getByText('Accept'));
    expect(mockRespondMutate).toHaveBeenCalledWith({ id: 'conv-2', userId: 'user-1', status: 'accepted' });
  });

  it('shows outgoing requests as Pending', async () => {
    mockUseOutgoingDmRequests.mockReturnValue({
      data: [{ ...CONVERSATION, id: 'conv-3', status: 'pending' }],
      isLoading: false,
      refetch: jest.fn(),
    });

    const { getByText } = await render(<MessagesScreen />);
    await fireEvent.press(getByText(/^Requests/));
    await waitFor(() => expect(getByText('Pending')).toBeTruthy());
  });
});
