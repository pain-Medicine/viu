import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

// How the viewer is driving the app right now. Focus rings are for remotes
// and keyboards; a tap or a click shouldn't leave one behind.
export type InputMode = 'keys' | 'pointer';

let mode: InputMode = Platform.isTV ? 'keys' : 'pointer';
const listeners = new Set<() => void>();

function set(next: InputMode) {
  if (next === mode) return;
  mode = next;
  listeners.forEach((l) => l());
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    (e) => {
      if (!e.metaKey && !e.ctrlKey && !e.altKey) set('keys');
    },
    true,
  );
  window.addEventListener('pointerdown', () => set('pointer'), true);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// A phone or tablet with a hardware keyboard or remote moves focus with it;
// Focusable reports that here, so its ring shows.
export const noteKeyFocus = () => set('keys');

export function useInputMode(): InputMode {
  return useSyncExternalStore(
    subscribe,
    () => mode,
    () => mode,
  );
}
