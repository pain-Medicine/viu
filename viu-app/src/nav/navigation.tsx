// A tiny stack navigator. TV apps only ever move forward and back, so this
// avoids pulling in a router that isn't on Expo's TV support list.
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

import type { TranslationType } from '../providers/types';

export type Route =
  | { name: 'home' }
  | { name: 'browse' }
  | { name: 'schedule' }
  | { name: 'mylist' }
  | { name: 'search' }
  | { name: 'settings' }
  | { name: 'signin' }
  | { name: 'vpnimport' }
  | { name: 'details'; mediaId: number }
  | { name: 'player'; mediaId: number; episode: string; translation: TranslationType };

interface NavContextValue {
  stack: Route[];
  push: (route: Route) => void;
  replace: (route: Route) => void;
  back: () => boolean;
  // Top-level sections reset the stack instead of growing it.
  goTo: (route: Route) => void;
  // Back was pressed once at Home; a second press soon after leaves the app.
  exitArmed: boolean;
}

const EXIT_WINDOW_MS = 2500;

const NavContext = createContext<NavContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [stack, setStackState] = useState<Route[]>([{ name: 'home' }]);
  // Mirrors the state so back() can answer synchronously for BackHandler.
  const stackRef = useRef(stack);
  const setStack = useCallback((next: Route[]) => {
    stackRef.current = next;
    setStackState(next);
  }, []);

  const push = useCallback((route: Route) => setStack([...stackRef.current, route]), [setStack]);
  const replace = useCallback((route: Route) => setStack([...stackRef.current.slice(0, -1), route]), [setStack]);
  const goTo = useCallback((route: Route) => setStack([route]), [setStack]);

  // One Back too many at Home shouldn't throw the viewer out of the app, so
  // the first one only says how to leave.
  const [exitArmed, setExitArmed] = useState(false);
  const exitArmedRef = useRef(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const armExit = useCallback((on: boolean) => {
    exitArmedRef.current = on;
    setExitArmed(on);
    clearTimeout(exitTimer.current);
    if (on) exitTimer.current = setTimeout(() => armExit(false), EXIT_WINDOW_MS);
  }, []);

  const back = useCallback(() => {
    const s = stackRef.current;
    if (s.length > 1) {
      setStack(s.slice(0, -1));
      return true;
    }
    if (s[0].name !== 'home') {
      setStack([{ name: 'home' }]);
      return true;
    }
    // A browser tab has nothing to leave to.
    if (Platform.OS === 'web') return false;
    if (exitArmedRef.current) {
      armExit(false);
      return false;
    }
    armExit(true);
    return true;
  }, [setStack, armExit]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const onKey = (e: KeyboardEvent) => {
        const typing = (e.target as HTMLElement | null)?.tagName === 'INPUT';
        if (e.key === 'Escape' || (e.key === 'Backspace' && !typing)) {
          e.preventDefault();
          back();
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    // Returning false at the root lets Android close the app.
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  const value = useMemo(() => ({ stack, push, replace, back, goTo, exitArmed }), [stack, push, replace, back, goTo, exitArmed]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

// False for screens kept mounted under the top one. Screens with global key
// listeners check it so they don't react while hidden.
export const ScreenActiveContext = createContext(true);
export const useScreenActive = () => useContext(ScreenActiveContext);

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used inside NavigationProvider');
  return ctx;
}
