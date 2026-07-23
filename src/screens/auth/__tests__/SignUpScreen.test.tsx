import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SignUpScreen } from '../SignUpScreen';

type GetByPlaceholderText = Awaited<ReturnType<typeof render>>['getByPlaceholderText'];

const mockNavigate = jest.fn();
const mockSignUp = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => ({ canGoBack: () => false }) };
});

jest.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ loading: false, signUp: mockSignUp }),
}));

const navigation = { navigate: mockNavigate } as never;

beforeEach(() => {
  jest.clearAllMocks();
});

async function fillForm(getByPlaceholderText: GetByPlaceholderText, {
  email = 'new@example.com',
  password = 'password1',
  confirmPassword = 'password1',
}: { email?: string; password?: string; confirmPassword?: string } = {}) {
  await fireEvent.changeText(getByPlaceholderText('you@example.com'), email);
  await fireEvent.changeText(getByPlaceholderText('At least 6 characters'), password);
  await fireEvent.changeText(getByPlaceholderText('••••••••'), confirmPassword);
}

describe('SignUpScreen', () => {
  it('rejects a too-short password without calling signUp', async () => {
    const { getByText, getByPlaceholderText } = await render(<SignUpScreen navigation={navigation} route={{} as never} />);
    await fillForm(getByPlaceholderText, { password: 'abc', confirmPassword: 'abc' });

    await fireEvent.press(getByText('Create Account'));

    expect(getByText('Password must be at least 6 characters.')).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords without calling signUp', async () => {
    const { getByText, getByPlaceholderText } = await render(<SignUpScreen navigation={navigation} route={{} as never} />);
    await fillForm(getByPlaceholderText, { password: 'password1', confirmPassword: 'password2' });

    await fireEvent.press(getByText('Create Account'));

    expect(getByText('Passwords do not match.')).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('does not show an email-confirmation screen when signUp returns an active session', async () => {
    mockSignUp.mockResolvedValue({ error: null, hasSession: true });
    const { getByText, queryByText, getByPlaceholderText } = await render(
      <SignUpScreen navigation={navigation} route={{} as never} />,
    );
    await fillForm(getByPlaceholderText);

    await fireEvent.press(getByText('Create Account'));

    await waitFor(() => expect(mockSignUp).toHaveBeenCalledWith('new@example.com', 'password1'));
    expect(queryByText(/check your email/i)).toBeNull();
    expect(queryByText('Back to Sign In')).toBeNull();
    // Still on the sign-up form — AuthProvider (outside this screen) is what
    // actually swaps the navigator over once the session lands.
    expect(getByText('Create your account')).toBeTruthy();
  });

  it('surfaces a diagnostic message instead of a confirmation screen when no session comes back', async () => {
    mockSignUp.mockResolvedValue({ error: null, hasSession: false });
    const { getByText, queryByText, getByPlaceholderText } = await render(
      <SignUpScreen navigation={navigation} route={{} as never} />,
    );
    await fillForm(getByPlaceholderText);

    await fireEvent.press(getByText('Create Account'));

    await waitFor(() => expect(getByText(/email confirmation needs to be disabled/i)).toBeTruthy());
    expect(queryByText(/check your email/i)).toBeNull();
  });

  it('shows the error returned by signUp', async () => {
    mockSignUp.mockResolvedValue({ error: 'Email already registered', hasSession: false });
    const { getByText, getByPlaceholderText } = await render(<SignUpScreen navigation={navigation} route={{} as never} />);
    await fillForm(getByPlaceholderText);

    await fireEvent.press(getByText('Create Account'));

    await waitFor(() => expect(getByText('Email already registered')).toBeTruthy());
  });
});
