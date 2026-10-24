import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { TranslationType } from '../providers/types';
import { DEFAULT_THEME, themes } from '../theme/themes';
import type { Theme, ThemeId } from '../theme/types';

const STORAGE_KEY = 'viu.settings.v1';

export interface Settings {
  themeId: ThemeId;
  translation: TranslationType;
  // Jump past intros, recaps and credits without asking.
  autoSkip: boolean;
}

const DEFAULTS: Settings = { themeId: DEFAULT_THEME, translation: 'sub', autoSkip: false };

interface SettingsContextValue {
  settings: Settings;
  theme: Theme;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<Settings>;
        setSettings({
          ...DEFAULTS,
          ...saved,
          themeId: saved.themeId && saved.themeId in themes ? saved.themeId : DEFAULTS.themeId,
        });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ settings, theme: themes[settings.themeId], ready, update }),
    [settings, ready, update],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}

export const useTheme = (): Theme => useSettings().theme;
