import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SignInScreen from '../src/app/sign-in';
import { supabase } from '../src/lib/supabase';
import { useAuth } from '../src/auth/AuthProvider';

jest.mock('../src/lib/supabase', () => ({ supabase: { auth: { signInWithPassword: jest.fn(), signUp: jest.fn() } } }));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const auth = jest.mocked(supabase!.auth);
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({ configured: true } as ReturnType<typeof useAuth>);
});
async function enterCredentials() {
  await fireEvent.changeText(screen.getByLabelText('Email'), ' journal@example.com ');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'long-passphrase');
}

test('rejects invalid input without contacting Supabase', async () => {
  await render(<SignInScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
  expect(auth.signInWithPassword).not.toHaveBeenCalled();
});

test('email-confirmation signup stays signed out and clears passwords', async () => {
  auth.signUp.mockResolvedValue({ data: { session: null, user: null }, error: null });
  await render(<SignInScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
  await enterCredentials();
  await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'long-passphrase');
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  await waitFor(() => expect(screen.getByText(/Check your email for a confirmation link/)).toBeTruthy());
  expect(auth.signUp).toHaveBeenCalledWith({ email: 'journal@example.com', password: 'long-passphrase' });
  expect(screen.getByLabelText('Password').props.value).toBe('');
  expect(auth.signInWithPassword).not.toHaveBeenCalled();
});

test('failed sign-in shows a useful error and permits retry', async () => {
  auth.signInWithPassword.mockRejectedValueOnce(new Error('offline'));
  await render(<SignInScreen />);
  await enterCredentials();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(screen.getByText(/We couldn’t connect or save your session/)).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
});

test('missing configuration never offers a login or main-app bypass', async () => {
  jest.mocked(useAuth).mockReturnValue({ configured: false } as ReturnType<typeof useAuth>);
  await render(<SignInScreen />);
  expect(screen.getByText('Your journal is almost ready.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
});

test('mismatched signup passwords never send a registration request', async () => {
  await render(<SignInScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
  await enterCredentials();
  await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'different-passphrase');
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByText('Your passwords don’t match.')).toBeTruthy();
  expect(auth.signUp).not.toHaveBeenCalled();
});
