import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

type AuthState = { session: Session | null; loading: boolean; error: string | null };
type AuthContextValue = AuthState & {
  configured: boolean;
  retry: () => void;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setState({ session: null, loading: false, error: null });
      return;
    }
    let active = true;
    let revision = 0;
    setState({ session: null, loading: true, error: null });
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      // Bootstrap verifies persisted credentials before showing a protected screen.
      if (!active || event === 'INITIAL_SESSION') return;
      revision++;
      setState({ session, loading: false, error: null });
    });
    const initialRevision = revision;
    void (async () => {
      try {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (data.session) {
          const result = await client.auth.getUser();
          if (result.error || result.data.user?.id !== data.session.user.id) {
            throw new Error('Session verification failed.');
          }
        }
        if (active && revision === initialRevision) {
          setState({ session: data.session, loading: false, error: null });
        }
      } catch {
        if (active && revision === initialRevision) {
          setState({ session: null, loading: false, error: 'We couldn’t restore your session. Check your connection and try again, or sign out on this device.' });
        }
      }
    })();

    // The SDK handles browser visibility itself; native apps use AppState.
    const refresh = (status: string) => {
      if (status === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    };
    if (Platform.OS !== 'web') refresh(AppState.currentState);
    const listener = Platform.OS !== 'web' ? AppState.addEventListener('change', refresh) : null;
    return () => {
      active = false;
      subscription.unsubscribe();
      listener?.remove();
      if (Platform.OS !== 'web') void client.auth.stopAutoRefresh();
    };
  }, [attempt]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    setState({ session: null, loading: false, error: null });
  }, []);

  return <AuthContext.Provider value={{ ...state, configured: Boolean(supabase), retry, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
