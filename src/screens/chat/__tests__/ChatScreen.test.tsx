import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatScreen } from '../ChatScreen';
import { useChatUiStore } from '../../../store/chatUiStore';

// ChatScreen calls useQueryClient() directly (not via a mocked query-file
// hook, unlike everything else it reads through services/api/queries/chat)
// — the only spot in this test that needs a real provider in the tree.
function renderChatScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ChatScreen />
    </QueryClientProvider>,
  );
}

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => ({ goBack: mockGoBack }) };
});

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

const mockChannelStub = {
  on: jest.fn(function (this: unknown) {
    return this;
  }),
  subscribe: jest.fn(function (this: unknown) {
    return this;
  }),
};

jest.mock('../../../services/api/supabaseClient', () => ({
  supabase: {
    channel: jest.fn(() => mockChannelStub),
    removeChannel: jest.fn(),
  },
}));

jest.mock('../../../services/api/edgeFunctions', () => ({
  sendChatMessage: jest.fn(),
}));

const mockUseConversation = jest.fn();
const mockUseMessages = jest.fn();
const mockInvalidateMessages = jest.fn();
const mockClearChatMutateAsync = jest.fn();

jest.mock('../../../services/api/queries/chat', () => ({
  useConversation: (...args: unknown[]) => mockUseConversation(...args),
  useMessages: (...args: unknown[]) => mockUseMessages(...args),
  useInvalidateMessages: jest.fn(() => mockInvalidateMessages),
  useClearChat: jest.fn(() => ({ mutateAsync: mockClearChatMutateAsync, isPending: false })),
}));

const MESSAGES = [
  { id: 'm1', role: 'user' as const, content: 'How much should I squat this week?' },
  { id: 'm2', role: 'assistant' as const, content: 'Based on your recent sessions, aim for 3x5 at RPE 8.' },
];

beforeEach(() => {
  jest.clearAllMocks();
  useChatUiStore.setState({ streamingBuffer: '', hasUnread: false });
  mockUseConversation.mockReturnValue({ data: { id: 'conv-1' } });
  mockUseMessages.mockReturnValue({ data: MESSAGES, isLoading: false });
  mockClearChatMutateAsync.mockResolvedValue(undefined);
});

describe('ChatScreen', () => {
  it('renders the conversation history', async () => {
    const { getByText } = await renderChatScreen();
    await waitFor(() => expect(getByText('How much should I squat this week?')).toBeTruthy());
    expect(getByText('Based on your recent sessions, aim for 3x5 at RPE 8.')).toBeTruthy();
  });

  it('offers Clear Chat from the options menu and clears after confirming', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const confirm = buttons?.find(b => b.text === 'Clear');
      confirm?.onPress?.();
    });

    const { getByLabelText, getByText } = await renderChatScreen();
    await waitFor(() => expect(getByText('How much should I squat this week?')).toBeTruthy());

    await fireEvent.press(getByLabelText('Chat options'));
    await fireEvent.press(getByText('Clear Chat'));

    expect(alertSpy).toHaveBeenCalled();
    await waitFor(() => expect(mockClearChatMutateAsync).toHaveBeenCalled());

    alertSpy.mockRestore();
  });

  it('does not clear when the confirmation is cancelled', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByLabelText, getByText } = await renderChatScreen();
    await waitFor(() => expect(getByText('How much should I squat this week?')).toBeTruthy());

    await fireEvent.press(getByLabelText('Chat options'));
    await fireEvent.press(getByText('Clear Chat'));

    expect(mockClearChatMutateAsync).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('shows an alert if clearing the chat fails', async () => {
    mockClearChatMutateAsync.mockRejectedValue(new Error('Network error'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, _message, buttons) => {
      if (title === 'Clear this chat?') {
        const confirm = buttons?.find(b => b.text === 'Clear');
        confirm?.onPress?.();
      }
    });

    const { getByLabelText, getByText } = await renderChatScreen();
    await waitFor(() => expect(getByText('How much should I squat this week?')).toBeTruthy());

    await fireEvent.press(getByLabelText('Chat options'));
    await fireEvent.press(getByText('Clear Chat'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Could not clear chat', 'Network error'));
    alertSpy.mockRestore();
  });

  it('collapses the chat when the collapse button is pressed', async () => {
    const { getByLabelText, getByText } = await renderChatScreen();
    await waitFor(() => expect(getByText('How much should I squat this week?')).toBeTruthy());

    await fireEvent.press(getByLabelText('Collapse chat'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
