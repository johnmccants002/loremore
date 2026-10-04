import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { File } from 'expo-file-system';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { createMomentRepository } from '@/moments/repository';
import { nativeInbox } from './native-inbox';
import { syncInbox } from './sync-inbox';

const repository = supabase ? createMomentRepository(supabase) : null;
type State = { syncing: boolean; remaining: number; error: string | null; revision: number };
const initial: State = { syncing: false, remaining: 0, error: null, revision: 0 };
const Context = createContext({ ...initial, retry: () => {} });
export function SharedImportProvider({ children }: PropsWithChildren) {
  const { session, loading, error: authError } = useAuth();
  const userId = !loading && !authError ? session?.user.id ?? null : null;
  const current = useRef(userId); current.current = userId;
  const busy = useRef(false);
  const mounted = useRef(true);
  const [state, setState] = useState(initial);
  const sync = useCallback(async () => {
    if (!nativeInbox || !repository || !userId || busy.current) return;
    busy.current = true;
    const stillCurrent = () => mounted.current && current.current === userId;
    setState(old => ({ ...old, syncing: true, error: null }));
    try {
      nativeInbox.setOwner(userId);
      const saved = await syncInbox({ inbox: nativeInbox, repository, userId, stillCurrent,
        readBytes: item => new File(item.uri).arrayBuffer(),
        onProgress: remaining => { if (stillCurrent()) setState(old => ({ ...old, remaining })); },
      });
      if (stillCurrent() && saved) setState(old => ({ ...old, revision: old.revision + 1 }));
    } catch {
      if (stillCurrent()) setState(old => ({ ...old, error: 'Some shared photos haven’t synced yet. They’re safe on this device. Reconnect and retry.', revision: old.revision + 1 }));
    } finally {
      busy.current = false;
      if (stillCurrent()) setState(old => ({ ...old, syncing: false }));
    }
  }, [userId]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    setState(initial);
    if (!nativeInbox || loading) return;
    try { nativeInbox.setOwner(userId); }
    catch { setState(old => ({ ...old, error: 'Photo sharing couldn’t be enabled. Reopen LoreMore and retry.' })); return; }
    void sync();
  }, [userId, loading, sync]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', value => { if (value === 'active') void sync(); });
    // Also picks up new items if a share finishes while the main app is open.
    const timer = nativeInbox && userId ? setInterval(() => { if (AppState.currentState === 'active') void sync(); }, 30_000) : null;
    return () => { listener.remove(); if (timer) clearInterval(timer); };
  }, [sync, userId]);
  return <Context.Provider value={{ ...state, retry: () => void sync() }}>{children}</Context.Provider>;
}
export function useSharedImports() { return useContext(Context); }
