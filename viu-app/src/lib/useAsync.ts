import { useCallback, useEffect, useMemo, useState } from 'react';

// Results stay cached for a while, so stepping back to a screen doesn't
// refetch or flash a loading state. They expire because stream links are
// signed for a few hours and airing shows gain episodes, and a TV app can stay
// open for days.
const MAX_AGE_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; data: unknown }>();

function cached<T>(key: string | null): { data: T } | undefined {
  if (!key) return undefined;
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at < MAX_AGE_MS) return { data: hit.data as T };
  cache.delete(key);
  return undefined;
}

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  // Asks again, skipping the cache. For "Try again" after a failure.
  retry: () => void;
}

type State<T> = Omit<AsyncState<T>, 'retry'>;

export function useAsync<T>(key: string | null, load: () => Promise<T>): AsyncState<T> {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    if (key) cache.delete(key);
    setAttempt((n) => n + 1);
  }, [key]);
  const [state, setState] = useState<State<T>>(() => {
    const hit = cached<T>(key);
    return { data: hit?.data, error: undefined, loading: !!key && !hit };
  });

  useEffect(() => {
    if (!key) {
      setState({ data: undefined, error: undefined, loading: false });
      return;
    }
    const hit = cached<T>(key);
    if (hit) {
      setState({ data: hit.data, error: undefined, loading: false });
      return;
    }
    let live = true;
    setState((s) => ({ data: s.data, error: undefined, loading: true }));
    load().then(
      (data) => {
        const now = Date.now();
        // Drops expired entries too, so keys that are never asked for again don't pile up.
        for (const [k, v] of cache) if (now - v.at >= MAX_AGE_MS) cache.delete(k);
        cache.set(key, { at: now, data });
        if (live) setState({ data, error: undefined, loading: false });
      },
      (error: Error) => live && setState({ data: undefined, error, loading: false }),
    );
    return () => {
      live = false;
    };
    // The key identifies the request; `load` is recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return useMemo(() => ({ ...state, retry }), [state, retry]);
}
