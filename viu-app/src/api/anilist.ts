// Minimal AniList GraphQL client. AniList allows CORS, so this works on web too.
const ENDPOINT = 'https://graphql.anilist.co';

export interface Media {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null; userPreferred: string };
  synonyms: string[];
  description: string | null;
  coverImage: { extraLarge: string | null; large: string | null; color: string | null };
  bannerImage: string | null;
  episodes: number | null;
  duration: number | null;
  genres: string[];
  seasonYear: number | null;
  format: string | null;
  status: string | null;
  averageScore: number | null;
  studios: { nodes: { name: string }[] };
  nextAiringEpisode: { episode: number; airingAt: number } | null;
}

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native userPreferred }
  synonyms
  description(asHtml: false)
  coverImage { extraLarge large color }
  bannerImage
  episodes
  duration
  genres
  seasonYear
  format
  status
  averageScore
  studios(isMain: true) { nodes { name } }
  nextAiringEpisode { episode airingAt }
`;

async function query<T>(gql: string, variables: Record<string, unknown> = {}, token?: string): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query: gql, variables }),
  });
  const json = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (!response.ok || !json.data) {
    throw new Error(json.errors?.[0]?.message ?? `AniList request failed (${response.status})`);
  }
  return json.data;
}

const PAGE_QUERY = `query ($page: Int, $perPage: Int, $sort: [MediaSort], $search: String, $format: MediaFormat, $status: MediaStatus, $season: MediaSeason, $seasonYear: Int, $genre: String) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, isAdult: false, sort: $sort, search: $search, format: $format, status: $status, season: $season, seasonYear: $seasonYear, genre: $genre) {
      ${MEDIA_FIELDS}
    }
  }
}`;

export interface MediaFilter {
  search?: string;
  sort?: string[];
  format?: string;
  status?: string;
  season?: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
  seasonYear?: number;
  genre?: string;
  perPage?: number;
  page?: number;
}

export async function listMedia(filter: MediaFilter): Promise<Media[]> {
  const data = await query<{ Page: { media: Media[] } }>(PAGE_QUERY, {
    page: filter.page ?? 1,
    perPage: filter.perPage ?? 20,
    sort: filter.sort ?? (filter.search ? ['SEARCH_MATCH'] : ['TRENDING_DESC']),
    search: filter.search || undefined,
    format: filter.format,
    status: filter.status,
    season: filter.season,
    seasonYear: filter.seasonYear,
    genre: filter.genre,
  });
  return data.Page.media;
}

export function currentSeason(date = new Date()): { season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'; year: number } {
  const m = date.getMonth();
  const season = m < 3 ? 'WINTER' : m < 6 ? 'SPRING' : m < 9 ? 'SUMMER' : 'FALL';
  return { season, year: date.getFullYear() };
}

export const trending = () => listMedia({ sort: ['TRENDING_DESC', 'POPULARITY_DESC'] });
export const popularThisSeason = () => {
  const { season, year } = currentSeason();
  return listMedia({ sort: ['POPULARITY_DESC'], season, seasonYear: year });
};
export const allTimePopular = () => listMedia({ sort: ['POPULARITY_DESC'] });

export async function getMedia(id: number): Promise<Media> {
  const data = await query<{ Media: Media }>(`query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } }`, {
    id,
  });
  return data.Media;
}

export async function getMany(ids: number[]): Promise<Media[]> {
  if (!ids.length) return [];
  // AniList pages hold at most 50.
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  const pages = await Promise.all(
    chunks.map((chunk) =>
      query<{ Page: { media: Media[] } }>(
        `query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { ${MEDIA_FIELDS} } } }`,
        { ids: chunk },
      ),
    ),
  );
  const byId = new Map(pages.flatMap((p) => p.Page.media).map((m) => [m.id, m]));
  return ids.map((id) => byId.get(id)).filter((m): m is Media => !!m);
}

// Episodes out so far: the total once known, otherwise the ones aired.
export function airedEpisodes(media: Media): number {
  return media.episodes ?? (media.nextAiringEpisode ? media.nextAiringEpisode.episode - 1 : 0);
}

export function displayTitle(media: Media): string {
  return media.title.english || media.title.userPreferred || media.title.romaji || 'Untitled';
}

// AniList descriptions carry light HTML (<br>, <i>) even with asHtml false.
export function plainDescription(media: Media): string {
  return (media.description ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{2,}/g, '\n')
    .replace(/\(Source:[^)]*\)/i, '')
    .trim();
}

// Every genre AniList uses for anime, in its own order.
export const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror', 'Mahou Shoujo', 'Mecha', 'Music',
  'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
];

export interface Airing {
  id: number;
  episode: number;
  airingAt: number;
  media: Media;
}

// Episodes airing between two unix times (seconds), soonest first.
export async function airingBetween(from: number, to: number): Promise<Airing[]> {
  const out: Airing[] = [];
  for (let page = 1; page <= 6; page++) {
    const data = await query<{ Page: { pageInfo: { hasNextPage: boolean }; airingSchedules: Airing[] } }>(
      `query ($page: Int, $from: Int, $to: Int) {
        Page(page: $page, perPage: 50) {
          pageInfo { hasNextPage }
          airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
            id episode airingAt media { ${MEDIA_FIELDS} isAdult }
          }
        }
      }`,
      { page, from, to },
    );
    out.push(...data.Page.airingSchedules);
    if (!data.Page.pageInfo.hasNextPage) break;
  }
  // The schedule query has no isAdult filter of its own.
  return out.filter((a) => !(a.media as Media & { isAdult?: boolean }).isAdult);
}

// --- Signed-in calls. AniList tokens come from the implicit grant below and
// last a year.

export const ANILIST_CLIENT_ID = 20148;
export const ANILIST_AUTH_URL = `https://anilist.co/api/v2/oauth/authorize?client_id=${ANILIST_CLIENT_ID}&response_type=token`;

// AniList redirects to a URL with the token in its fragment, and people
// often copy the whole address bar, so accept either form.
export function tokenFrom(pasted: string): string {
  const text = pasted.trim();
  const match = /access_token=([^&\s]+)/.exec(text);
  return match ? decodeURIComponent(match[1]) : text;
}

export interface Viewer {
  id: number;
  name: string;
  avatar: string | null;
}

export async function viewer(token: string): Promise<Viewer> {
  const data = await query<{ Viewer: { id: number; name: string; avatar: { medium: string | null } | null } }>(
    'query { Viewer { id name avatar { medium } } }',
    {},
    token,
  );
  return { id: data.Viewer.id, name: data.Viewer.name, avatar: data.Viewer.avatar?.medium ?? null };
}

export type ListStatus = 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING';

export interface ListEntry {
  id: number;
  status: ListStatus;
  progress: number;
}

export interface ListGroup {
  status: ListStatus;
  entries: (ListEntry & { media: Media })[];
}

export async function listCollection(token: string, userId: number): Promise<ListGroup[]> {
  const data = await query<{
    MediaListCollection: { lists: { status: ListStatus | null; isCustomList: boolean; entries: (ListEntry & { media: Media })[] }[] };
  }>(
    `query ($userId: Int) {
      MediaListCollection(userId: $userId, type: ANIME, sort: UPDATED_TIME_DESC) {
        lists { status isCustomList entries { id status progress media { ${MEDIA_FIELDS} } } }
      }
    }`,
    { userId },
    token,
  );
  // Custom lists repeat entries that are already in a status list.
  return data.MediaListCollection.lists
    .filter((l): l is typeof l & { status: ListStatus } => !l.isCustomList && !!l.status)
    .map((l) => ({ status: l.status, entries: l.entries }));
}

export async function listEntry(token: string, mediaId: number): Promise<ListEntry | null> {
  const data = await query<{ Media: { mediaListEntry: ListEntry | null } }>(
    'query ($id: Int) { Media(id: $id) { mediaListEntry { id status progress } } }',
    { id: mediaId },
    token,
  );
  return data.Media.mediaListEntry;
}

export async function saveListEntry(
  token: string,
  entry: { mediaId: number; status?: ListStatus; progress?: number },
): Promise<ListEntry> {
  const data = await query<{ SaveMediaListEntry: ListEntry }>(
    `mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int) {
      SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress) { id status progress }
    }`,
    entry,
    token,
  );
  return data.SaveMediaListEntry;
}

export async function deleteListEntry(token: string, id: number): Promise<void> {
  await query('mutation ($id: Int) { DeleteMediaListEntry(id: $id) { deleted } }', { id }, token);
}
