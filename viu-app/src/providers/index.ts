import { Platform } from 'react-native';

import { airedEpisodes, type Media } from '../api/anilist';
import { AllAnimeProvider } from './allanime/provider';
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

// A browser's <video> can't send headers, so on web the video goes through the
// proxy too, with the Referer it needs passed as a query parameter.
export function playableUrl(url: string, headers: Record<string, string>): string {
  if (Platform.OS !== 'web' || !PROXY) return url;
  const referer = headers.Referer ?? headers.referer;
  return `${PROXY}?url=${encodeURIComponent(url)}${referer ? `&referer=${encodeURIComponent(referer)}` : ''}`;
}

export const provider: AnimeProvider = new AllAnimeProvider(
  Platform.OS === 'web' ? webProxyFetch : (...args) => fetch(...args),
);

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Finds the provider's entry for an AniList show: exact title matches first,
// then the closest episode count among titles that contain ours.
export async function matchProviderShow(
  media: Media,
  translation: TranslationType,
): Promise<ProviderSearchResult | null> {
  const titles = [media.title.romaji, media.title.english, ...media.synonyms].filter((t): t is string => !!t);
  const wanted = new Set(titles.map(normalize));
  // Airing shows have no total yet, so compare with what has aired.
  const target = airedEpisodes(media);
  for (const q of [media.title.romaji, media.title.english].filter((t): t is string => !!t)) {
    const results = await provider.search(q, translation);
    if (!results.length) continue;
    const exact = results.find((r) => wanted.has(normalize(r.title)));
    if (exact) return exact;
    const base = normalize(q);
    const close = results
      .filter((r) => normalize(r.title).includes(base))
      .sort(
        (a, b) =>
          Math.abs((a.episodes[translation] || 0) - target) - Math.abs((b.episodes[translation] || 0) - target),
      );
    if (close.length) return close[0];
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
