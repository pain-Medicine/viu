import { type EventSubscription, NativeModule, requireOptionalNativeModule } from 'expo';

type Events = { onConfigReceived: (event: { config: string }) => void };

declare class ViuNetworkModule extends NativeModule<Events> {
  setProxy(url: string | null): void;
  startTunnel(wgConfig: string): Promise<string>;
  stopTunnel(): void;
  startImportServer(port: number): Promise<string>;
  stopImportServer(): void;
}

// Android only. On web the browser owns networking, so this is null there and
// the network settings are hidden.
export const ViuNetwork = requireOptionalNativeModule<ViuNetworkModule>('ViuNetwork');

export function onConfigReceived(listener: (config: string) => void): EventSubscription | null {
  return ViuNetwork?.addListener('onConfigReceived', (event) => listener(event.config)) ?? null;
}
