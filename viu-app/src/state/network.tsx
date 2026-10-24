import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ViuNetwork } from '../../modules/viu-network';
import { applyNetwork, type NetworkSettings, type NetworkStatus } from './networkModes';

const STORAGE_KEY = 'viu.network.v1';

export type { NetworkMode, NetworkSettings, NetworkStatus } from './networkModes';

const DEFAULTS: NetworkSettings = { mode: 'direct', proxy: '', wgConfig: null };

interface NetworkContextValue {
  // false on web, where the browser decides how to connect
  supported: boolean;
  settings: NetworkSettings;
  status: NetworkStatus;
  ready: boolean;
  update: (patch: Partial<NetworkSettings>) => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

const apply = (settings: NetworkSettings) => applyNetwork(settings, ViuNetwork);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<NetworkSettings>(DEFAULTS);
  const [status, setStatus] = useState<NetworkStatus>({ state: 'direct' });
  const [ready, setReady] = useState(false);
  const current = useRef(settings);
  // Changes apply one after another, so a slow VPN start can't finish after
  // a later change and undo it.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  // The app waits for this before its first request, so nothing goes out
  // before the proxy or tunnel is in place.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => (raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<NetworkSettings>) } : DEFAULTS))
      .catch(() => DEFAULTS)
      .then(async (saved) => {
        current.current = saved;
        setSettings(saved);
        setStatus(await apply(saved));
      })
      .finally(() => setReady(true));
  }, []);

  const update = useCallback(async (patch: Partial<NetworkSettings>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    setSettings(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    const applied = queue.current.then(() => apply(next));
    queue.current = applied;
    setStatus(await applied);
  }, []);

  const value = useMemo(
    () => ({ supported: ViuNetwork != null, settings, status, ready, update }),
    [settings, status, ready, update],
  );
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error('useNetwork must be used inside NetworkProvider');
  return ctx;
}

// What sites see: Cloudflare's trace page answers with the caller's IP and country.
export async function checkExitAddress(): Promise<{ ip: string; country: string }> {
  const text = await (await fetch('https://www.cloudflare.com/cdn-cgi/trace')).text();
  const fields = Object.fromEntries(text.split('\n').map((line) => line.split('=') as [string, string]));
  return { ip: fields.ip ?? '?', country: fields.loc ?? '?' };
}

// The address the WireGuard config connects to, for display.
export function wgEndpoint(config: string | null): string | null {
  return config?.match(/^\s*Endpoint\s*=\s*(\S+)/im)?.[1] ?? null;
}
