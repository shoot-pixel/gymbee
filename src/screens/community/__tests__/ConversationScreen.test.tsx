import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { ConversationScreen } from '../ConversationScreen';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, canGoBack: () => true }),
    useRoute: () => ({ params: { conversationId: 'conv-1' } }),
  };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));

const mockUseConversation = jest.fn();
const mockUseMessages = jest.fn();
const mockSendMessageMutateAsync = jest.fn();
const mockToggleLikeMutate = jest.fn();
const mockUseConversationRealtime = jest.fn();

jest.mock('../../../services/api/queries/directMessages', () => ({
  useConversation: (...args: unknown[]) => mockUseConversation(...args),
  useMessages: (...args: unknown[]) => mockUseMessages(...args),
  useSendMessage: jest.fn(() => ({ mutateAsync: mockSendMessageMutateAsync, isPending: false })),
  useToggleMessageLike: jest.fn(() => ({ mutate: mockToggleLikeMutate, isPending: false })),
  useConversationRealtime: (...args: unknown[]) => mockUseConversationRealtime(...args),
  useSignedDmPhotoUrls: jest.fn(() => ({ data: {} })),
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

const MESSAGE_FROM_ME = {
  id: 'msg-1',
  conversation_id: 'conv-1',
  sender_id: 'user-1',
  body: 'Hey!',
  photo_path: null,
  created_at: '2026-01-02T00:00:00.000Z',
  likeCount: 0,
  likedByMe: false,
};

const MESSAGE_FROM_THEM = {
  id: 'msg-2',
  conversation_id: 'conv-1',
  sender_id: 'user-2',
  body: 'Hi there',
  photo_path: null,
  created_at: '2026-01-02T00:01:00.000Z',
  likeCount: 1,
  likedByMe: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseConversation.mockReturnValue({ data: CONVERSATION });
  mockUseMessages.mockReturnValue({ data: [MESSAGE_FROM_ME, MESSAGE_FROM_THEM], isLoading: false });
  (launchImageLibrary as jest.Mock).mockResolvedValue({
    didCancel: false,
    assets: [{ uri: 'file://photo.jpg', type: 'image/jpeg' }],
  });
});

describe('ConversationScreen', () => {
  it('renders messages from both participants and subscribes to realtime', async () => {
    const { getByText } = await render(<ConversationScreen />);

    await waitFor(() => expect(getByText('Hey!')).toBeTruthy());
    expect(getByText('Hi there')).toBeTruthy();
    expect(getByText('Alex B.')).toBeTruthy();
    expect(mockUseConversationRealtime).toHaveBeenCalledWith('conv-1');
  });

  it('sends a text message and clears the composer', async () => {
    mockSendMessageMutateAsync.mockResolvedValue({ ...MESSAGE_FROM_ME, id: 'msg-3', body: 'New message' });

    const { getByText, getByPlaceholderText, getByLabelText } = await render(<ConversationScreen />);
    await waitFor(() => expect(getByText('Hey!')).toBeTruthy());

    const input = getByPlaceholderText('Message');
    await fireEvent.changeText(input, 'New message');
    await fireEvent.press(getByLabelText('Send'));

    expect(mockSendMessageMutateAsync).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      senderId: 'user-1',
      body: 'New message',
      photo: null,
    });
  });

  it('toggles a like on a message', async () => {
    const { getByText, getByLabelText } = await render(<ConversationScreen />);
    await waitFor(() => expect(getByText('Hi there')).toBeTruthy());

    await fireEvent.press(getByLabelText('Unlike message'));
    expect(mockToggleLikeMutate).toHaveBeenCalledWith({
      messageId: 'msg-2',
      conversationId: 'conv-1',
      userId: 'user-1',
      currentlyLiked: true,
    });
  });

  it('shows a pending-request notice when the viewer is the recipient of a pending thread', async () => {
    mockUseConversation.mockReturnValue({ data: { ...CONVERSATION, status: 'pending', recipient_id: 'user-1', requester_id: 'user-2' } });

    const { getByText } = await render(<ConversationScreen />);
    await waitFor(() => expect(getByText(/isn't in your messages yet/)).toBeTruthy());
  });
});
