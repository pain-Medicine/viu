// Puts the chosen network mode in place. Kept free of React, storage and the
// native module so the no-leak rule can be tested in Node: whenever a mode
// can't be set up, traffic is blocked rather than sent out directly.

// Where a dead tunnel sends traffic: nothing listens there, so requests fail
// instead of quietly going out without the VPN.
export const BLOCKED = 'http://127.0.0.1:9';

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

export interface NetworkNative {
  setProxy(url: string | null): void;
  startTunnel(wgConfig: string): Promise<string>;
  stopTunnel(): void;
}

export async function applyNetwork(settings: NetworkSettings, native: NetworkNative | null): Promise<NetworkStatus> {
  if (!native) return { state: 'direct' };
  try {
    native.stopTunnel();
    if (settings.mode === 'proxy') {
      if (!settings.proxy) throw new Error('No proxy address set yet.');
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
