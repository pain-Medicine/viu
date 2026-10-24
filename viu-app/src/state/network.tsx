import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ViuNetwork } from '../../modules/viu-network';

const STORAGE_KEY = 'viu.network.v1';
// Where a dead tunnel sends traffic: nothing listens there, so requests fail
// instead of quietly going out without the VPN.
const BLOCKED = 'http://127.0.0.1:9';

export type NetworkMode = 'direct' | 'proxy' | 'vpn';

export interface NetworkSettings {
  mode: NetworkMode;
  proxy: string;
  // The WireGuard .conf text. It holds the VPN's private key and stays in the
  // app's private storage.
  wgConfig: string | null;
}

export type NetworkStatus =
  | { state: 'direct' }
  | { state: 'proxy'; proxy: string }
  | { state: 'vpn'; proxy: string }
  | { state: 'error'; message: string };

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

async function apply(settings: NetworkSettings): Promise<NetworkStatus> {
  const native = ViuNetwork;
  if (!native) return { state: 'direct' };
  try {
    native.stopTunnel();
    if (settings.mode === 'proxy' && settings.proxy) {
      native.setProxy(settings.proxy);
      return { state: 'proxy', proxy: settings.proxy };
    }
    if (settings.mode === 'vpn') {
      if (!settings.wgConfig) throw new Error('No WireGuard config imported yet.');
      return { state: 'vpn', proxy: await native.startTunnel(settings.wgConfig) };
    }
    native.setProxy(null);
    return { state: 'direct' };
  } catch (e) {
    native.setProxy(BLOCKED);
    return { state: 'error', message: (e as Error).message };
  }
}

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
