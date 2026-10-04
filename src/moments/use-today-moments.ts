import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Moment, MomentRepository } from './repository';
import { localDayBounds } from './repository';

type State = { userId: string; day: string; moments: Moment[]; loading: boolean; error: string | null; revision: number };
export function useTodayMoments(repository: MomentRepository, userId: string) {
  const [state, setState] = useState<State>({ userId, day: localDayBounds(new Date()).start, moments: [], loading: true, error: null, revision: 0 });
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    const date = new Date();
    const day = localDayBounds(date).start;
    setState(old => ({ ...old, userId, day, moments: old.userId === userId && old.day === day ? old.moments : [], loading: true, error: null }));
    try {
      const moments = await repository.listDay(userId, date);
      if (request === generation.current) setState(old => ({ userId, day, moments, loading: false, error: null, revision: old.revision + 1 }));
    } catch {
      if (request === generation.current) setState(old => ({ ...old, loading: false, error: 'We couldn’t load today’s moments. Check your connection and try again.' }));
    }
  }, [repository, userId]);
  useFocusEffect(useCallback(() => {
    void refresh();
    const listener = AppState.addEventListener('change', status => { if (status === 'active') void refresh(); });
    let day = localDayBounds(new Date()).start;
    let refreshedAt = Date.now();
    // Renew private URLs before expiry and cross local midnight while open.
    const timer = setInterval(() => {
      const currentDay = localDayBounds(new Date()).start;
      if (day !== currentDay || Date.now() - refreshedAt > 45 * 60_000) {
        day = currentDay; refreshedAt = Date.now(); void refresh();
      }
    }, 30_000);
    return () => { generation.current++; listener.remove(); clearInterval(timer); };
  }, [refresh]));
  return { ...state, moments: state.userId === userId ? state.moments : [], refresh };
}
