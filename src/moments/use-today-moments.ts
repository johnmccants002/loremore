import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Moment, MomentRepository } from './repository';
import { localDayBounds } from './repository';

type State = { userId: string; day: string; moments: Moment[]; loading: boolean; error: string | null; revision: number };
export function useTodayMoments(repository: MomentRepository, userId: string) {
  const [state, setState] = useState<State>({ userId, day: localDayBounds(new Date()).start, moments: [], loading: true, error: null, revision: 0 });
  const generation = useRef(0);
  const attempted = useRef(new Set<string>());
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    const date = new Date();
    const day = localDayBounds(date).start;
    setState(old => ({ ...old, userId, day, moments: old.userId === userId && old.day === day ? old.moments : [], loading: true, error: null }));
    try {
      const moments = await repository.listDay(userId, date);
      // Recover imports saved just before the app closed or a request was lost.
      for (const moment of moments) {
        const key = `${userId}/${moment.id}`;
        if (request === generation.current && moment.kind === 'photo' && moment.analysis_status === 'not_requested' && !attempted.current.has(key)) {
          attempted.current.add(key);
          void repository.requestAnalysis(moment.id).then(() => { if (request === generation.current) void refresh(); }, () => {});
        }
      }
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
  useFocusEffect(useCallback(() => {
    if (!state.moments.some(moment => moment.analysis_status === 'pending')) return;
    const timer = setInterval(() => {
      const recent = state.moments.some(moment => moment.analysis_status === 'pending' && Date.now() - Date.parse(moment.ai_context?.started_at ?? '') < 120_000);
      if (recent && AppState.currentState === 'active') void refresh();
      else clearInterval(timer);
    }, 5000);
    return () => clearInterval(timer);
  }, [state.moments, refresh]));
  return { ...state, moments: state.userId === userId ? state.moments : [], refresh };
}
