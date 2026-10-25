// Port of viu_media/libs/provider/anime/allanime/provider.py.
//
// Two sources are extracted: AllAnime's own "Default" (wixmp) and mp4upload's
// "Mp4". The other embeds (Ok, Ak, Ss-Hls, Fm-Hls, Sw, ...) aren't supported yet.
import { AnimeProvider, ProviderAnime, ProviderSearchResult, StreamLink, StreamServer, TranslationType } from '../types';
import {
  ANIME_GQL,
  API_BASE_URL,
  API_GRAPHQL_ENDPOINT,
  API_GRAPHQL_HEADERS,
  CLIENT_BUILD_ID,
  CLIENT_EPOCH_MS,
  CLIENT_KEY_LANE,
  EPISODE_GQL_HASH,
  MP4_SERVER_JUICY_STREAM_REGEX,
  SEARCH_GQL,
  USER_AGENT,
  WIXMP_REPACKAGER_REGEX,
} from './constants';
import { HttpError, reach } from '../../lib/errors';
import { AllAnimeKeys } from './keys';

interface AllAnimeSource {
  sourceUrl: string;
  sourceName: string;
  priority?: number;
}

interface AllAnimeEpisode {
  episodeString?: string;
  notes?: string | null;
  sourceUrls?: AllAnimeSource[];
}

// "--" prefixed source urls are hex encoded and xored with a single byte.
function oneDigitSymmetricXor(password: number, hex: string): string {
  let out = '';
  for (let i = 0; i < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ password);
  }
  return out;
}

// wixmp hands out an HLS playlist that bundles every quality, which a browser's
// <video> mostly can't play. The same files are served as plain mp4s per
// quality, so those come first and the playlist stays as the last resort.
export function wixmpLinks(link: string): StreamLink[] {
  const match = WIXMP_REPACKAGER_REGEX.exec(link);
  if (!match) return [{ url: link, quality: '1080' }];
  const [, path, list] = match;
  const mp4s = list
    .split(',')
    .filter(Boolean)
    .map((res) => ({ url: `https://${path}/${res}/mp4/file.mp4`, quality: res.replace(/p$/, '') }));
  return [...mp4s, { url: link, quality: 'auto' }];
}

// The api answers a throttled or missing episode with `episode: null`, and
// says why in `errors`.
export function episodeQueryError(errors: { message?: string }[] | undefined): Error {
  const message = (errors ?? []).map((e) => e.message).filter(Boolean).join(' ');
  if (/too many requests/i.test(message)) {
    const wait = /try again in (\d+) seconds?/i.exec(message)?.[1];
    return new Error(`AllAnime is rate limiting requests. Try again in ${wait ? `${wait} seconds` : 'a minute'}.`);
  }
  return new Error(`AllAnime returned no data for this episode. Try again.${message ? ` (${message})` : ''}`);
}

export class AllAnimeProvider implements AnimeProvider {
  name = 'AllAnime';
  private keys: Promise<AllAnimeKeys> | null = null;
  // The api hands out new keys every week, so they're fetched again once the
  // week changes (an app left open on a TV would otherwise keep stale ones).
  private keysWeek = -1;

  constructor(private fetchFn: typeof fetch = (...args) => fetch(...args)) {}

  private getKeys(): Promise<AllAnimeKeys> {
    const week = Math.floor(Date.now() / CLIENT_EPOCH_MS);
    if (week !== this.keysWeek) {
      this.keys = null;
      this.keysWeek = week;
    }
    if (!this.keys) {
      this.keys = AllAnimeKeys.fetch(this.fetchFn).catch((err) => {
        this.keys = null;
        throw err;
      });
    }
    return this.keys;
  }

  private async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await reach('AllAnime', () =>
      this.fetchFn(API_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: API_GRAPHQL_HEADERS,
        body: JSON.stringify({ query, variables }),
      }),
    );
    if (!response.ok) throw new HttpError('AllAnime', response.status);
    const json = (await response.json()) as { data?: T; errors?: unknown };
    if (!json.data) throw new Error(`AllAnime returned no data: ${JSON.stringify(json.errors)}`);
    return json.data;
  }

  async search(query: string, translation: TranslationType): Promise<ProviderSearchResult[]> {
    const data = await this.graphql<{
      shows: { edges: { _id: string; name: string; availableEpisodes: { sub?: number; dub?: number } }[] };
    }>(SEARCH_GQL, {
      search: { allowAdult: false, allowUnknown: false, query },
      limit: 40,
      page: 1,
      translationType: translation,
      countryOrigin: 'ALL',
    });
    return data.shows.edges.map((edge) => ({
      id: edge._id,
      title: edge.name,
      episodes: { sub: edge.availableEpisodes?.sub ?? 0, dub: edge.availableEpisodes?.dub ?? 0 },
    }));
  }

  async get(id: string): Promise<ProviderAnime | null> {
    const data = await this.graphql<{
      show: { _id: string; name: string; availableEpisodesDetail: { sub?: string[]; dub?: string[] } } | null;
    }>(ANIME_GQL, { showId: id });
    if (!data.show) return null;
    const sortEps = (eps: string[] = []) => [...eps].sort((a, b) => parseFloat(a) - parseFloat(b));
    return {
      id: data.show._id,
      title: data.show.name,
      episodes: {
        sub: sortEps(data.show.availableEpisodesDetail?.sub),
        dub: sortEps(data.show.availableEpisodesDetail?.dub),
      },
    };
  }

  async episodeStreams(id: string, episode: string, translation: TranslationType): Promise<StreamServer[]> {
    const keys = await this.getKeys();
    const variables = { showId: id, translationType: translation, episodeString: episode };
    const extensions = {
      persistedQuery: { version: 1, sha256Hash: EPISODE_GQL_HASH },
      k: CLIENT_KEY_LANE,
      aaReq: keys.makeAaReq(EPISODE_GQL_HASH),
    };
    const url =
      `${API_GRAPHQL_ENDPOINT}?variables=${encodeURIComponent(JSON.stringify(variables))}` +
      `&extensions=${encodeURIComponent(JSON.stringify(extensions))}`;
    const response = await this.fetchFn(url, {
      headers: { ...API_GRAPHQL_HEADERS, 'x-build-id': CLIENT_BUILD_ID },
    });
    if (!response.ok) {
      throw new Error(`Episode query failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
    }
    const json = (await response.json()) as { data?: Record<string, unknown>; errors?: { message?: string }[] };
    let data = json.data ?? {};
    if (typeof data.tobeparsed === 'string') {
      data = keys.decryptTobeparsed<Record<string, unknown>>(data.tobeparsed);
    }
    const ep = 'episode' in data ? (data.episode as AllAnimeEpisode | null) : (data as AllAnimeEpisode);
    if (!ep) throw episodeQueryError(json.errors);
    const servers: StreamServer[] = [];
    for (const source of ep.sourceUrls ?? []) {
      try {
        const server = await this.extract(source, ep);
        if (server) servers.push(server);
      } catch {
        // One broken embed shouldn't hide the others.
      }
    }
    if (!servers.length) {
      const names = (ep.sourceUrls ?? []).map((s) => s.sourceName).join(', ');
      throw new Error(
        names
          ? `AllAnime has no playable stream for this episode yet. Its servers (${names}) aren’t supported or didn’t answer.`
          : 'AllAnime has no playable stream for this episode yet.',
      );
    }
    return servers;
  }

  private async extract(source: AllAnimeSource, episode: AllAnimeEpisode): Promise<StreamServer | null> {
    let url = source.sourceUrl;
    if (!url) return null;
    if (url.startsWith('--')) url = oneDigitSymmetricXor(56, url.slice(2));
    if (source.sourceName === 'Default') return this.extractDefault(url, episode);
    if (source.sourceName !== 'Mp4') return null;

    const response = await this.fetchFn(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) return null;
    const html = (await response.text()).replace(/ /g, '').replace(/\n/g, '');
    const match = MP4_SERVER_JUICY_STREAM_REGEX.exec(html);
    if (!match) return null;
    return {
      name: 'mp4upload',
      links: [{ url: match[1], quality: '1080' }],
      headers: { Referer: 'https://www.mp4upload.com/', 'User-Agent': USER_AGENT },
      episodeTitle: episode.notes ?? null,
    };
  }

  // AllAnime's own source, a relative "/apivtwo/clock?id=..." link whose json
  // twin lists the wixmp streams.
  private async extractDefault(url: string, episode: AllAnimeEpisode): Promise<StreamServer | null> {
    const response = await this.fetchFn(`https://${API_BASE_URL}${url.replace('clock', 'clock.json')}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { links?: { link: string }[]; Referer?: string };
    const links = (json.links ?? []).flatMap((l) => wixmpLinks(l.link));
    if (!links.length) return null;
    return {
      name: 'wixmp',
      links,
      headers: json.Referer ? { Referer: json.Referer } : {},
      episodeTitle: episode.notes ?? null,
    };
  }
}
