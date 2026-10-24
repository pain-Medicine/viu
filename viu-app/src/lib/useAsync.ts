import { useEffect, useState } from 'react';

// Results stay cached for the session, so stepping back to a screen doesn't
// refetch or flash a loading state.
const cache = new Map<string, unknown>();

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
}

export function useAsync<T>(key: string | null, load: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>(() => ({
    data: key ? (cache.get(key) as T | undefined) : undefined,
    error: undefined,
    loading: !!key && !cache.has(key),
  }));

  useEffect(() => {
    if (!key) {
      setState({ data: undefined, error: undefined, loading: false });
      return;
    }
    if (cache.has(key)) {
      setState({ data: cache.get(key) as T, error: undefined, loading: false });
      return;
    }
    let live = true;
    setState((s) => ({ data: s.data, error: undefined, loading: true }));
    load().then(
      (data) => {
        cache.set(key, data);
        if (live) setState({ data, error: undefined, loading: false });
      },
      (error: Error) => live && setState({ data: undefined, error, loading: false }),
    );
    return () => {
      live = false;
    };
    // The key identifies the request; `load` is recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
