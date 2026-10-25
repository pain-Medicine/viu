import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { ProviderId, TranslationType } from '../providers/types';
import { setWatchedAt } from './progress';
import { DEFAULT_THEME, themes } from '../theme/themes';
import type { Theme, ThemeId } from '../theme/types';

const STORAGE_KEY = 'viu.settings.v1';

export type Tracking = 'off' | 'prompt' | 'auto';

// The playback options follow the terminal's StreamConfig
// (viu_media/core/config/model.py) and its defaults.
export interface Settings {
  themeId: ThemeId;
  // general.provider: where streams come from.
  provider: ProviderId;
  translation: TranslationType;
  // Jump past intros, recaps and credits without asking.
  autoSkip: boolean;
  // stream.quality: the link of this quality plays first.
  quality: '1080' | '720' | '480' | '360';
  // stream.server: 'TOP' takes the first server that works.
  server: string;
  // stream.auto_next: count down into the next episode at the end.
  autoNext: boolean;
  // stream.episode_complete_at: percent played that counts as watched.
  episodeCompleteAt: number;
  // stream.default_media_list_tracking: update AniList progress when an
  // episode is watched, ask first, or never.
  tracking: Tracking;
  // stream.force_forward_tracking: never move AniList progress backwards.
  forceForwardTracking: boolean;
  // stream.continue_from_watch_history: resume where an episode stopped.
  continueFromHistory: boolean;
}

const DEFAULTS: Settings = {
  themeId: DEFAULT_THEME,
  // AllAnime: the only one with English subtitles and dubs.
  provider: 'allanime',
  translation: 'sub',
  autoSkip: false,
  quality: '1080',
  server: 'TOP',
  autoNext: false,
  episodeCompleteAt: 80,
  // The terminal's config says 'prompt', but its watch history service
  // updates AniList without asking; this matches what it does.
  tracking: 'auto',
  forceForwardTracking: true,
  continueFromHistory: true,
};

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

  useEffect(() => setWatchedAt(settings.episodeCompleteAt), [settings.episodeCompleteAt]);

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
