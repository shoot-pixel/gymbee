import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
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
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }) };
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

const mockSendChatMessage = jest.fn();
jest.mock('../../../services/api/edgeFunctions', () => {
  const actual = jest.requireActual('../../../services/api/edgeFunctions');
  return { ...actual, sendChatMessage: (...args: unknown[]) => mockSendChatMessage(...args) };
});

const mockUseProfile = jest.fn();
jest.mock('../../../services/api/queries/profiles', () => ({
  useProfile: (...args: unknown[]) => mockUseProfile(...args),
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

// Timestamped "now" (not a fixed past date) so the "used this month" count
// this exercises stays correct regardless of when the suite actually runs.
const NOW_ISO = new Date().toISOString();

const MESSAGES = [
  { id: 'm1', role: 'user' as const, content: 'How much should I squat this week?', created_at: NOW_ISO },
  { id: 'm2', role: 'assistant' as const, content: 'Based on your recent sessions, aim for 3x5 at RPE 8.', created_at: NOW_ISO },
];

beforeEach(() => {
  jest.clearAllMocks();
  useChatUiStore.setState({ streamingBuffer: '', hasUnread: false });
  mockUseConversation.mockReturnValue({ data: { id: 'conv-1' } });
  mockUseMessages.mockReturnValue({ data: MESSAGES, isLoading: false });
  mockClearChatMutateAsync.mockResolvedValue(undefined);
  mockUseProfile.mockReturnValue({ data: { is_premium: true } });
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

  describe('free-tier message cap', () => {
    beforeEach(() => {
      mockUseProfile.mockReturnValue({ data: { is_premium: false } });
    });

    it('shows how many of the free messages have been used this month', async () => {
      const { getByText } = await renderChatScreen();
      // MESSAGES has one 'user' row timestamped "now".
      await waitFor(() => expect(getByText('1 of 3 free messages used this month')).toBeTruthy());
    });

    it('does not show the free-tier caption for a Premium account', async () => {
      mockUseProfile.mockReturnValue({ data: { is_premium: true } });
      const { queryByText } = await renderChatScreen();
      await waitFor(() => expect(queryByText(/free messages used/)).toBeNull());
    });

    it('redirects to the paywall when the server reports the free limit reached', async () => {
      const { EdgeFunctionError } = jest.requireActual('../../../services/api/edgeFunctions');
      mockSendChatMessage.mockRejectedValue(
        new EdgeFunctionError("You've used your 3 free AI Coach messages this month.", 'free_limit_reached'),
      );

      const { getByPlaceholderText, getByText } = await renderChatScreen();
      await waitFor(() => expect(getByText('How much should I squat this week?')).toBeTruthy());

      // fireEvent.changeText doesn't reliably reach this multiline
      // TextField in this RN/RNTL combo — invoking onChangeText directly
      // (still act()-wrapped) is the pattern that actually works here.
      await act(() => {
        getByPlaceholderText('Ask your coach...').props.onChangeText('One more question');
      });
      await fireEvent.press(getByText('Send'));

      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Paywall', { trigger: 'ai_chat' }));
      // The draft isn't lost — it's handed back to the input rather than
      // discarded, since the failure wasn't the athlete's fault.
      expect(getByPlaceholderText('Ask your coach...').props.value).toBe('One more question');
    });

    it('skips the network call and goes straight to the paywall once already at the cap', async () => {
      mockUseMessages.mockReturnValue({
        data: [
          { id: 'm1', role: 'user', content: 'q1', created_at: NOW_ISO },
          { id: 'm2', role: 'user', content: 'q2', created_at: NOW_ISO },
          { id: 'm3', role: 'user', content: 'q3', created_at: NOW_ISO },
        ],
        isLoading: false,
      });

      const { getByPlaceholderText, getByText } = await renderChatScreen();
      await waitFor(() => expect(getByText("You've used all your free messages this month — upgrade for unlimited AI Coach")).toBeTruthy());

      await act(() => {
        getByPlaceholderText('Upgrade to keep chatting…').props.onChangeText('One more');
      });
      await fireEvent.press(getByText('Upgrade'));

      expect(mockNavigate).toHaveBeenCalledWith('Paywall', { trigger: 'ai_chat' });
      expect(mockSendChatMessage).not.toHaveBeenCalled();
    });
  });
});
