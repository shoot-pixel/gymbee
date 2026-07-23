import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { IntegrationsScreen } from '../IntegrationsScreen';

const mockSetParams = jest.fn();
const mockInvalidateQueries = jest.fn();
let mockRouteParams: { status?: 'success' | 'error'; message?: string } | undefined;

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useEffect } = require('react');
  return {
    ...actual,
    useNavigation: () => ({ canGoBack: () => true, setParams: mockSetParams }),
    useRoute: () => ({ params: mockRouteParams }),
    // The real hook needs a live NavigationContainer to know about focus
    // events — for these tests, running the callback once like a plain
    // effect is enough to cover the refetch-on-focus behavior.
    useFocusEffect: (callback: () => void) => useEffect(callback, [callback]),
  };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

const mockUseIntegrationConnections = jest.fn();
const mockRefetch = jest.fn();
const mockStartConnectMutateAsync = jest.fn();
const mockDisconnectMutate = jest.fn();

jest.mock('../../../services/api/queries/integrations', () => ({
  useIntegrationConnections: (...args: unknown[]) => mockUseIntegrationConnections(...args),
  useStartWhoopConnect: jest.fn(() => ({ mutateAsync: mockStartConnectMutateAsync, isPending: false })),
  useDisconnectIntegration: jest.fn(() => ({ mutate: mockDisconnectMutate, isPending: false })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = undefined;
  mockUseIntegrationConnections.mockReturnValue({ data: [], isLoading: false, refetch: mockRefetch });
  jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
});

describe('IntegrationsScreen', () => {
  it('shows Whoop as not connected when there is no stored connection', async () => {
    const { getByText } = await render(<IntegrationsScreen />);
    await waitFor(() => expect(getByText('Whoop')).toBeTruthy());
    expect(getByText('Not connected')).toBeTruthy();
  });

  it('does not render any client id/secret input fields', async () => {
    const { getByText, queryByPlaceholderText } = await render(<IntegrationsScreen />);
    await waitFor(() => expect(getByText('Whoop')).toBeTruthy());
    await fireEvent.press(getByText('Whoop'));

    expect(queryByPlaceholderText('Client ID')).toBeNull();
    expect(queryByPlaceholderText('Client Secret')).toBeNull();
  });

  it('starts the OAuth flow and opens the returned WHOOP authorize URL when Connect is pressed', async () => {
    mockStartConnectMutateAsync.mockResolvedValue({ url: 'https://api.prod.whoop.com/oauth/oauth2/auth?state=abc' });

    const { getByText } = await render(<IntegrationsScreen />);
    await waitFor(() => expect(getByText('Whoop')).toBeTruthy());
    await fireEvent.press(getByText('Whoop'));
    await fireEvent.press(getByText('Connect Whoop'));

    await waitFor(() => expect(mockStartConnectMutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(Linking.openURL).toHaveBeenCalledWith('https://api.prod.whoop.com/oauth/oauth2/auth?state=abc'),
    );
  });

  it('shows an alert if starting the OAuth flow fails', async () => {
    mockStartConnectMutateAsync.mockRejectedValue(new Error('Missing Authorization header'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByText } = await render(<IntegrationsScreen />);
    await waitFor(() => expect(getByText('Whoop')).toBeTruthy());
    await fireEvent.press(getByText('Whoop'));
    await fireEvent.press(getByText('Connect Whoop'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Could not start connection', 'Missing Authorization header'),
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('shows Connected status and a Disconnect action once a connection has an access token', async () => {
    mockUseIntegrationConnections.mockReturnValue({
      data: [
        {
          id: 'conn-1',
          user_id: 'user-1',
          provider: 'whoop',
          client_id: null,
          client_secret: null,
          access_token: 'whoop-access-token',
          refresh_token: 'whoop-refresh-token',
          token_expires_at: '2026-01-01T00:00:00.000Z',
          created_at: '',
          updated_at: '',
        },
      ],
      isLoading: false,
      refetch: mockRefetch,
    });

    const { getByText } = await render(<IntegrationsScreen />);
    await waitFor(() => expect(getByText('Connected')).toBeTruthy());

    await fireEvent.press(getByText('Whoop'));
    expect(getByText('Disconnect')).toBeTruthy();
  });

  it('disconnects the integration after confirming', async () => {
    mockUseIntegrationConnections.mockReturnValue({
      data: [
        {
          id: 'conn-1',
          user_id: 'user-1',
          provider: 'whoop',
          client_id: null,
          client_secret: null,
          access_token: 'whoop-access-token',
          refresh_token: 'whoop-refresh-token',
          token_expires_at: '2026-01-01T00:00:00.000Z',
          created_at: '',
          updated_at: '',
        },
      ],
      isLoading: false,
      refetch: mockRefetch,
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const disconnectButton = buttons?.find(b => b.text === 'Disconnect');
      disconnectButton?.onPress?.();
    });

    const { getByText } = await render(<IntegrationsScreen />);
    await waitFor(() => expect(getByText('Connected')).toBeTruthy());
    await fireEvent.press(getByText('Whoop'));
    await fireEvent.press(getByText('Disconnect'));

    expect(mockDisconnectMutate).toHaveBeenCalledWith({ userId: 'user-1', provider: 'whoop' });
    alertSpy.mockRestore();
  });

  describe('arriving via the soset://whoop-callback deep link', () => {
    it('shows a success alert, auto-expands the card, and clears the route params', async () => {
      mockRouteParams = { status: 'success' };
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

      const { getByText } = await render(<IntegrationsScreen />);

      await waitFor(() =>
        expect(alertSpy).toHaveBeenCalledWith('Whoop connected', 'Your Whoop account is now connected to SoSet.'),
      );
      // Auto-expanded — no tap on "Whoop" needed to reveal the card body.
      expect(getByText('Connect Whoop')).toBeTruthy();
      expect(mockSetParams).toHaveBeenCalledWith({ status: undefined, message: undefined });
      alertSpy.mockRestore();
    });

    it('shows the failure message from the deep link when the connection did not succeed', async () => {
      mockRouteParams = { status: 'error', message: 'Whoop access wasn’t granted.' };
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

      await render(<IntegrationsScreen />);

      await waitFor(() =>
        expect(alertSpy).toHaveBeenCalledWith('Connection failed', 'Whoop access wasn’t granted.'),
      );
      expect(mockSetParams).toHaveBeenCalledWith({ status: undefined, message: undefined });
      alertSpy.mockRestore();
    });

    it('does not show any alert on a normal visit with no deep-link params', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

      const { getByText } = await render(<IntegrationsScreen />);
      await waitFor(() => expect(getByText('Whoop')).toBeTruthy());

      expect(alertSpy).not.toHaveBeenCalled();
      expect(mockSetParams).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });
  });
});
