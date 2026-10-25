import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { type Media } from '../api/anilist';
import { AllAnimeProvider } from './allanime/provider';
import { AnimeUnityProvider } from './animeunity/provider';
import { findBestMatch, getUserTitles, searchQueries, setUserTitles } from './match';
import { withTimeout } from './safety';
import { AnimeProvider, ProviderAnime, ProviderId, ProviderSearchResult, ProviderUnavailableError, TranslationType } from './types';

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

// Provider requests carry no cookies or credentials of ours, and time out.
const providerFetch = withTimeout(
  Platform.OS === 'web' ? webProxyFetch : (input, init) => fetch(input, { ...init, credentials: 'omit' }),
);

// The terminal's general.provider choices that work today. AllAnime is the
// one with English subtitles and dubs; AnimeUnity's are Italian.
export const PROVIDERS: Record<ProviderId, AnimeProvider> = {
  allanime: new AllAnimeProvider(providerFetch),
  animeunity: new AnimeUnityProvider(providerFetch),
};
export const DEFAULT_PROVIDER: ProviderId = 'allanime';
export const providerFor = (id: ProviderId): AnimeProvider => PROVIDERS[id] ?? PROVIDERS[DEFAULT_PROVIDER];

// Finds the provider's entry for an AniList show the way the terminal does
// (see match.ts): the first search that finds anything, then the best scored
// result, with exact and normalizer-mapped titles winning outright.
export async function matchProviderShow(
  media: Media,
  translation: TranslationType,
  provider: ProviderId,
): Promise<ProviderSearchResult | null> {
  return findBestMatch(await searchCandidates(media, translation, provider), media, provider);
}

// The results of the first search that finds anything, as the terminal
// offers them when it doesn't pick one itself (provider_search.py).
export async function searchCandidates(media: Media, translation: TranslationType, provider: ProviderId): Promise<ProviderSearchResult[]> {
  await loadUserTitles();
  for (const q of searchQueries(media, provider)) {
    const results = await providerFor(provider).search(q, translation);
    if (results.length) return results;
  }
  return [];
}

const USER_TITLES_KEY = 'viu.normalizer.v1';
let userTitlesLoaded: Promise<void> | null = null;
function loadUserTitles(): Promise<void> {
  userTitlesLoaded ??= AsyncStorage.getItem(USER_TITLES_KEY)
    .then((raw) => {
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, string | Record<string, string>>;
      // Picks saved before there was more than one provider are AllAnime's.
      if (Object.values(saved).some((v) => typeof v === 'string')) setUserTitles(saved as Record<string, string>, 'allanime');
      else for (const [id, titles] of Object.entries(saved)) setUserTitles(titles as Record<string, string>, id as ProviderId);
    })
    .catch(() => {});
  return userTitlesLoaded;
}

// Remembers the viewer's pick of provider show for an AniList title, like
// update_user_normalizer_json: provider title -> the AniList title it was
// searched for, lowercased. The matcher then takes it outright.
export async function chooseShow(media: Media, choice: ProviderSearchResult, provider: ProviderId): Promise<void> {
  await loadUserTitles();
  const mediaTitle = media.title.english || media.title.romaji;
  if (!mediaTitle) return;
  // A new pick replaces any earlier one for the same title, or the first
  // pick saved would keep winning.
  const wanted = mediaTitle.toLowerCase();
  const next = Object.fromEntries(Object.entries(getUserTitles(provider)).filter(([, title]) => title !== wanted));
  next[choice.title] = wanted;
  setUserTitles(next, provider);
  const all = Object.fromEntries((Object.keys(PROVIDERS) as ProviderId[]).map((id) => [id, getUserTitles(id)]));
  await AsyncStorage.setItem(USER_TITLES_KEY, JSON.stringify(all)).catch(() => {});
}

// The provider's show for an AniList title, with its episode list. The
// details page and the player share it through the same cache key.
export const showKey = (provider: ProviderId, mediaId: number, translation: TranslationType) =>
  `show:${provider}:${mediaId}:${translation}`;

export async function findShow(media: Media, translation: TranslationType, provider: ProviderId): Promise<ProviderAnime | null> {
  const match = await matchProviderShow(media, translation, provider);
  return match ? providerFor(provider).get(match.id) : null;
}
