import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { type Media } from '../api/anilist';
import { AllAnimeProvider } from './allanime/provider';
import { findBestMatch, getUserTitles, searchQueries, setUserTitles } from './match';
import { AnimeProvider, ProviderAnime, ProviderSearchResult, ProviderUnavailableError, TranslationType } from './types';

export * from './types';

// Browsers block the cross-origin scraping and the Referer/Origin headers the
// provider needs. A web build can point EXPO_PUBLIC_PROVIDER_PROXY at a small
// pass-through proxy (it receives the target url in a `url` query param and
// the wanted headers as `x-forward-*`); without one, streaming is native-only.
const PROXY = process.env.EXPO_PUBLIC_PROVIDER_PROXY;

function webProxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!PROXY) {
    return Promise.reject(
      new ProviderUnavailableError('Streaming needs the Android TV app, or a provider proxy on web.'),
    );
  }
  const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, key) => {
    headers[`x-forward-${key}`] = value;
  });
  return fetch(`${PROXY}?url=${encodeURIComponent(target)}`, { ...init, headers });
}

// A browser's <video> can't send headers, so on web a video that needs a
// Referer goes through the proxy too, with the Referer passed as a query
// parameter. One that needs none (wixmp, which allows any origin) loads directly.
export function playableUrl(url: string, headers: Record<string, string>): string {
  const referer = headers.Referer ?? headers.referer;
  if (Platform.OS !== 'web' || !PROXY || !referer) return url;
  return `${PROXY}?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
}

export const provider: AnimeProvider = new AllAnimeProvider(
  Platform.OS === 'web' ? webProxyFetch : (...args) => fetch(...args),
);

// Finds the provider's entry for an AniList show the way the terminal does
// (see match.ts): the first search that finds anything, then the best scored
// result, with exact and normalizer-mapped titles winning outright.
export async function matchProviderShow(
  media: Media,
  translation: TranslationType,
): Promise<ProviderSearchResult | null> {
  return findBestMatch(await searchCandidates(media, translation), media);
}

// The results of the first search that finds anything, as the terminal
// offers them when it doesn't pick one itself (provider_search.py).
export async function searchCandidates(media: Media, translation: TranslationType): Promise<ProviderSearchResult[]> {
  await loadUserTitles();
  for (const q of searchQueries(media)) {
    const results = await provider.search(q, translation);
    if (results.length) return results;
  }
  return [];
}

const USER_TITLES_KEY = 'viu.normalizer.v1';
let userTitlesLoaded: Promise<void> | null = null;
function loadUserTitles(): Promise<void> {
  userTitlesLoaded ??= AsyncStorage.getItem(USER_TITLES_KEY)
    .then((raw) => {
      if (raw) setUserTitles(JSON.parse(raw) as Record<string, string>);
    })
    .catch(() => {});
  return userTitlesLoaded;
}

// Remembers the viewer's pick of provider show for an AniList title, like
// update_user_normalizer_json: provider title -> the AniList title it was
// searched for, lowercased. The matcher then takes it outright.
export async function chooseShow(media: Media, choice: ProviderSearchResult): Promise<void> {
  await loadUserTitles();
  const mediaTitle = media.title.english || media.title.romaji;
  if (!mediaTitle) return;
  const next = { ...getUserTitles(), [choice.title]: mediaTitle.toLowerCase() };
  setUserTitles(next);
  await AsyncStorage.setItem(USER_TITLES_KEY, JSON.stringify(next)).catch(() => {});
}

// The provider's show for an AniList title, with its episode list. The
// details page and the player share it through the same cache key.
export const showKey = (mediaId: number, translation: TranslationType) => `show:${mediaId}:${translation}`;

export async function findShow(media: Media, translation: TranslationType): Promise<ProviderAnime | null> {
  const match = await matchProviderShow(media, translation);
  return match ? provider.get(match.id) : null;
}
