// Port of viu_media/libs/provider/anime/animeunity (Terminal branch).
//
// AnimeUnity is an Italian site: "sub" is the Japanese audio with Italian
// subtitles and "dub" the Italian dub; there's no raw. Streams are plain mp4s
// from vixcloud, read from its player page with regexes only: nothing it
// sends is ever run.
import { HttpError, reach } from '../../lib/errors';
import { safeServer } from '../safety';
import type { AnimeProvider, EpisodeStreams, ProviderAnime, ProviderSearchResult, StreamServer, TranslationType } from '../types';

// animeunity.so, the terminal's domain, no longer resolves; animeunity.to
// redirects here.
export const ANIMEUNITY_BASE = 'https://www.animeunity.co';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const TOKEN_REGEX = /<meta[^>]*name="csrf-token"[^>]*content="([^"]*)"/;
const DOWNLOAD_URL_REGEX = /window\.downloadUrl\s*=\s*'([^']*)'/;
const QUALITY_REGEX = /\/(\d{3,4})p\./;
const AVAILABLE_VIDEO_QUALITY = [1080, 720, 480];
// constants.py REPLACEMENT_WORDS: AnimeUnity titles say "2" and "Part".
const REPLACEMENT_WORDS: [string, string][] = [
  ['Season ', ''],
  ['Cour', 'Part'],
];
// Episode lists come in pages of 120 (provider.py _get_anime).
const EPISODE_PAGE = 120;

export interface AnimeUnityRecord {
  id: number;
  title?: string | null;
  title_eng?: string | null;
  title_it?: string | null;
  dub: number;
  episodes_count?: number;
  real_episodes_count?: number;
}

// mappers.py get_titles: English, then the original, then Italian.
export const recordTitle = (r: AnimeUnityRecord) => r.title_eng || r.title || r.title_it || 'Unknown';
// mappers.py get_episodes_count
export const recordEpisodes = (r: AnimeUnityRecord) => (r.real_episodes_count ?? 0) > 0 ? r.real_episodes_count! : (r.episodes_count ?? 0);

export function toSearchResult(r: AnimeUnityRecord): ProviderSearchResult {
  const n = recordEpisodes(r);
  return { id: String(r.id), title: recordTitle(r), episodes: { sub: r.dub === 1 ? 0 : n, dub: r.dub === 1 ? n : 0, raw: 0 } };
}

// Only vixcloud pages are fetched as players.
export function isVixcloudUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'vixcloud.cc' || u.hostname.endsWith('.vixcloud.cc'));
  } catch {
    return false;
  }
}

// extractor.py extract_server_info plus mappers.py map_to_server: the player
// page's download link, and the same file at each lower quality.
export function vixcloudServer(page: string, episodeTitle: string | null): StreamServer | null {
  const link = DOWNLOAD_URL_REGEX.exec(page)?.[1];
  if (!link) return null;
  let host: string;
  try {
    const u = new URL(link);
    if (u.protocol !== 'https:') return null;
    host = u.hostname;
  } catch {
    return null;
  }
  if (!host.endsWith('.vix-content.net')) return null;
  const quality = Number(QUALITY_REGEX.exec(link)?.[1] ?? 0);
  const qualities = quality
    ? [...new Set([...AVAILABLE_VIDEO_QUALITY, quality])].filter((q) => q <= quality).sort((a, b) => b - a)
    : [0];
  return {
    name: 'vixcloud',
    links: qualities.map((q) => ({
      url: q && q !== quality ? link.replace(`/${quality}p.`, `/${q}p.`) : link,
      quality: q ? String(q) : '1080',
    })),
    headers: {},
    episodeTitle,
  };
}

// The cookies a response sets, as one Cookie header. The web proxy passes
// Set-Cookie back as x-set-cookie, since browsers hide it.
function cookiesOf(response: Response): string {
  const raw = response.headers.get('set-cookie') ?? response.headers.get('x-set-cookie') ?? '';
  const out: string[] = [];
  for (const m of raw.matchAll(/(?:^|,\s*)(animeunity_session|XSRF-TOKEN)=([^;,]+)/g)) out.push(`${m[1]}=${m[2]}`);
  return out.join('; ');
}

export class AnimeUnityProvider implements AnimeProvider {
  name = 'AnimeUnity';
  private session: Promise<{ token: string; cookie: string }> | null = null;
  private records = new Map<string, AnimeUnityRecord>();
  private episodes = new Map<string, { id: number; number: string }[]>();

  constructor(private fetchFn: typeof fetch = (...args) => fetch(...args)) {}

  private request(url: string, init: RequestInit = {}): Promise<Response> {
    return reach('AnimeUnity', () =>
      this.fetchFn(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...(init.headers as Record<string, string>) } }),
    );
  }

  private async json<T>(url: string): Promise<T> {
    const response = await this.request(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new HttpError('AnimeUnity', response.status);
    return (await response.json()) as T;
  }

  // provider.py _get_token: the page's CSRF token and the session cookie it
  // belongs to, which the search needs.
  private getSession(): Promise<{ token: string; cookie: string }> {
    this.session ??= (async () => {
      const response = await this.request(ANIMEUNITY_BASE);
      if (!response.ok) throw new HttpError('AnimeUnity', response.status);
      const token = TOKEN_REGEX.exec(await response.text())?.[1];
      if (!token) throw new Error('AnimeUnity changed its page; its search token wasn’t found.');
      return { token, cookie: cookiesOf(response) };
    })().catch((err) => {
      this.session = null;
      throw err;
    });
    return this.session;
  }

  async search(query: string, translation: TranslationType): Promise<ProviderSearchResult[]> {
    if (translation === 'raw') return [];
    let title = query;
    for (const [from, to] of REPLACEMENT_WORDS) title = title.split(from).join(to);
    const post = async () => {
      const { token, cookie } = await this.getSession();
      return this.request(`${ANIMEUNITY_BASE}/livesearch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'x-csrf-token': token,
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: `title=${encodeURIComponent(title)}`,
      });
    };
    let response = await post();
    // 419: the session expired; one fresh one.
    if (response.status === 419) {
      this.session = null;
      response = await post();
    }
    if (!response.ok) throw new HttpError('AnimeUnity', response.status);
    const records = ((await response.json()) as { records?: AnimeUnityRecord[] }).records ?? [];
    // mappers.py map_to_search_result: dubbed entries for dub, the others for sub.
    return records
      .filter((r) => (translation === 'dub') === (r.dub === 1))
      .map((r) => {
        this.records.set(String(r.id), r);
        return toSearchResult(r);
      });
  }

  async get(id: string): Promise<ProviderAnime | null> {
    const record = this.records.get(id) ?? (await this.json<AnimeUnityRecord>(`${ANIMEUNITY_BASE}/info_api/${encodeURIComponent(id)}/`));
    if (!record?.id) return null;
    this.records.set(id, record);
    const count = recordEpisodes(record);
    const list: { id: number; number: string }[] = [];
    for (let start = 1; start <= count; start += EPISODE_PAGE) {
      const end = Math.min(start + EPISODE_PAGE - 1, count);
      const page = await this.json<{ episodes?: { id: number; number: string | number }[] }>(
        `${ANIMEUNITY_BASE}/info_api/${encodeURIComponent(id)}/1?start_range=${start}&end_range=${end}`,
      );
      for (const e of page.episodes ?? []) list.push({ id: e.id, number: String(e.number) });
    }
    this.episodes.set(id, list);
    const numbers = list.map((e) => e.number);
    return {
      id,
      title: recordTitle(record),
      episodes: { sub: record.dub === 1 ? [] : numbers, dub: record.dub === 1 ? numbers : [], raw: [] },
    };
  }

  async episodeStreams(id: string, episode: string): Promise<EpisodeStreams> {
    if (!this.episodes.has(id)) await this.get(id);
    const ep = this.episodes.get(id)?.find((e) => e.number === episode);
    if (!ep) throw new Error(`AnimeUnity doesn’t list episode ${episode} of this show.`);
    const embedResponse = await this.request(`${ANIMEUNITY_BASE}/embed-url/${ep.id}`);
    if (!embedResponse.ok) throw new HttpError('AnimeUnity', embedResponse.status);
    const embed = (await embedResponse.text()).trim();
    if (!isVixcloudUrl(embed)) throw new Error('AnimeUnity pointed to a player that isn’t vixcloud, so it wasn’t opened.');
    const page = await this.request(embed, { headers: { Referer: `${ANIMEUNITY_BASE}/` } });
    if (!page.ok) throw new HttpError('vixcloud', page.status);
    const title = `${recordTitle(this.records.get(id) ?? { id: 0, dub: 0 })} - Ep ${episode}`;
    const server = safeServer(vixcloudServer(await page.text(), title));
    if (!server) throw new Error('AnimeUnity has no playable stream for this episode yet.');
    return { servers: [server], sources: ['vixcloud'], more: async () => null };
  }
}
