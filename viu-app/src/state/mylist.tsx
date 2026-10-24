import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { deleteListEntry, ListEntry, listEntry, saveListEntry } from '../api/anilist';
import { useAsync } from '../lib/useAsync';
import { useAccount } from './account';

const STORAGE_KEY = 'viu.mylist.v1';

// Titles saved on this device. Used while signed out; once signed in,
// My List is the AniList list instead.
interface LocalListValue {
  ids: number[];
  has: (mediaId: number) => boolean;
  toggle: (mediaId: number) => void;
}

const LocalListContext = createContext<LocalListValue | null>(null);

export function LocalListProvider({ children }: { children: ReactNode }) {
  // Newest first.
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setIds(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  const toggle = useCallback((mediaId: number) => {
    setIds((prev) => {
      const next = prev.includes(mediaId) ? prev.filter((id) => id !== mediaId) : [mediaId, ...prev];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ ids, has: (id: number) => ids.includes(id), toggle }), [ids, toggle]);
  return <LocalListContext.Provider value={value}>{children}</LocalListContext.Provider>;
}

export function useLocalList(): LocalListValue {
  const ctx = useContext(LocalListContext);
  if (!ctx) throw new Error('useLocalList must be used inside LocalListProvider');
  return ctx;
}

// One title's place in My List, wherever My List currently lives.
export function useListMembership(mediaId: number) {
  const { account, revision, changed } = useAccount();
  const local = useLocalList();
  const remote = useAsync<ListEntry | null>(account ? `entry:${mediaId}:${account.user.id}:${revision}` : null, () =>
    listEntry(account!.token, mediaId),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const entry = account ? remote.data ?? null : null;
  const inList = account ? !!entry : local.has(mediaId);
  // Removing an AniList entry would also erase its progress and score, so
  // only plain "Planning" entries can be taken off from here.
  const canToggle = !account || !entry || entry.status === 'PLANNING';

  const toggle = async () => {
    if (!account) return local.toggle(mediaId);
    if (busy || remote.loading || !canToggle) return;
    setBusy(true);
    setError(null);
    try {
      if (entry) await deleteListEntry(account.token, entry.id);
      else await saveListEntry(account.token, { mediaId, status: 'PLANNING' });
      changed();
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  };

  return { entry, inList, canToggle, loading: !!account && (remote.loading || busy), error, toggle };
}

// Marks an episode as seen on AniList: raises the entry's progress to it,
// and completes the show on its last episode. Never lowers progress, so
// rewatching an early episode leaves the list alone.
export function useProgressSync() {
  const { account, changed } = useAccount();
  return useCallback(
    async (media: { id: number; episodes: number | null }, episode: string) => {
      const n = Number(episode);
      // Some provider entries keep counting across seasons, so a number past
      // AniList's total isn't this show's episode.
      if (!account || !Number.isInteger(n) || n < 1 || (media.episodes && n > media.episodes)) return;
      const current = await listEntry(account.token, media.id);
      if (current && current.progress >= n && current.status !== 'PLANNING') return;
      const done = n === media.episodes;
      // A rewatch stays a rewatch until it's done.
      const status = done ? 'COMPLETED' : current?.status === 'REPEATING' ? 'REPEATING' : 'CURRENT';
      await saveListEntry(account.token, { mediaId: media.id, progress: n, status });
      changed();
    },
    [account, changed],
  );
}
