import { Platform } from 'react-native';

import { type Media } from '../api/anilist';
import { AllAnimeProvider } from './allanime/provider';
import { findBestMatch, searchQueries } from './match';
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
  for (const q of searchQueries(media)) {
    const results = await provider.search(q, translation);
    if (results.length) return findBestMatch(results, media);
  }
  return null;
}

// The provider's show for an AniList title, with its episode list. The
// details page and the player share it through the same cache key.
export const showKey = (mediaId: number, translation: TranslationType) => `show:${mediaId}:${translation}`;

export async function findShow(media: Media, translation: TranslationType): Promise<ProviderAnime | null> {
  const match = await matchProviderShow(media, translation);
  return match ? provider.get(match.id) : null;
}
