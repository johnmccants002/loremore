import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';

jest.mock('../src/lib/supabase', () => ({ supabase: { auth: {
  getSession: jest.fn(), getUser: jest.fn(), onAuthStateChange: jest.fn(),
  startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn(), signOut: jest.fn(),
} } }));
const auth = jest.mocked(supabase!.auth);
const session = { user: { id: 'user-1', email: 'journal@example.com' }, access_token: 'test-token' } as Session;
let listener: (event: AuthChangeEvent, value: Session | null) => void;
const unsubscribe = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  auth.onAuthStateChange.mockImplementation(callback => {
    listener = callback;
    return { data: { subscription: { id: "test-subscription", callback, unsubscribe } } } as ReturnType<typeof auth.onAuthStateChange>;
  });
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  auth.getUser.mockResolvedValue({ data: { user: session.user }, error: null });
  auth.signOut.mockResolvedValue({ error: null });
});

test('restores and verifies a persisted session, then cleans up listeners', async () => {
  auth.getSession.mockResolvedValue({ data: { session }, error: null });
  const { result, unmount } = await renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(auth.getUser).toHaveBeenCalledTimes(1);
  expect(result.current.session?.user.id).toBe('user-1');
  await unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test('does not expose a cached INITIAL_SESSION before verification completes', async () => {
  auth.getSession.mockImplementation(() => new Promise(() => {}));
  const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
  await act(() => listener('INITIAL_SESSION', session));
  expect(result.current.loading).toBe(true);
  expect(result.current.session).toBeNull();
});

test('a late bootstrap result cannot overwrite sign-out', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof auth.getSession>>) => void;
  auth.getSession.mockImplementation(() => new Promise(done => { resolve = done; }));
  const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
  await act(() => listener('SIGNED_OUT', null));
  await act(async () => { resolve({ data: { session }, error: null }); });
  expect(result.current.session).toBeNull();
  expect(result.current.loading).toBe(false);
});

test('network failure blocks access and retry restores the session', async () => {
  auth.getSession.mockResolvedValue({ data: { session }, error: null });
  auth.getUser.mockRejectedValueOnce(new Error('offline'));
  const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.error).not.toBeNull());
  expect(result.current.session).toBeNull();
  await act(() => result.current.retry());
  await waitFor(() => expect(result.current.session).toEqual(session));
});

test('sign-in and sign-out events update state; sign-out uses this device scope', async () => {
  const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
  await act(() => listener('SIGNED_IN', session));
  expect(result.current.session).toEqual(session);
  await act(async () => { await result.current.signOut(); });
  expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(result.current.session).toBeNull();
});

test('a failed sign-out preserves the current session and rejects to the caller', async () => {
  const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
  await act(() => listener('SIGNED_IN', session));
  auth.signOut.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { await expect(result.current.signOut()).rejects.toThrow('offline'); });
  expect(result.current.session).toEqual(session);
});

test('mismatched cached user fails closed', async () => {
  auth.getSession.mockResolvedValue({ data: { session }, error: null });
  auth.getUser.mockResolvedValue({ data: { user: { ...session.user, id: 'different-user' } }, error: null });
  const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.error).not.toBeNull());
  expect(result.current.session).toBeNull();
});
