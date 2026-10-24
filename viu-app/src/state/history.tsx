import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { EpisodeProgress, HistoryEntry } from './progress';

export * from './progress';

const STORAGE_KEY = 'viu.history.v1';

interface HistoryContextValue {
  entries: HistoryEntry[];
  get: (mediaId: number) => HistoryEntry | undefined;
  record: (entry: { mediaId: number; episode: string; position: number; duration: number }) => void;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [byId, setById] = useState<Record<number, HistoryEntry>>({});

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setById(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  const record = useCallback((entry: { mediaId: number; episode: string; position: number; duration: number }) => {
    setById((prev) => {
      const old = prev[entry.mediaId];
      const episodes = { ...legacyEpisodes(old), [entry.episode]: { position: entry.position, duration: entry.duration } };
      const next = { ...prev, [entry.mediaId]: { ...entry, episodes, updatedAt: Date.now() } };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => {
    const entries = Object.values(byId).sort((a, b) => b.updatedAt - a.updatedAt);
    return { entries, get: (id: number) => byId[id], record };
  }, [byId, record]);

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

// An entry from before per-episode history only knows its last episode.
function legacyEpisodes(e?: HistoryEntry): Record<string, EpisodeProgress> {
  if (!e) return {};
  return e.episodes ?? { [e.episode]: { position: e.position, duration: e.duration } };
}

export function useHistory(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistory must be used inside HistoryProvider');
  return ctx;
}
