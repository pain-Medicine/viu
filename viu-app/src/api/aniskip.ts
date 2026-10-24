// AniSkip community skip times (https://api.aniskip.com). Keyed by
// MyAnimeList id and episode number; it allows CORS, so web works too.
const ENDPOINT = 'https://api.aniskip.com/v2/skip-times';

export interface SkipInterval {
  kind: 'intro' | 'credits' | 'recap';
  start: number;
  end: number;
}

const KINDS: Record<string, SkipInterval['kind']> = {
  op: 'intro',
  'mixed-op': 'intro',
  ed: 'credits',
  'mixed-ed': 'credits',
  recap: 'recap',
};

export async function skipTimes(malId: number, episode: string): Promise<SkipInterval[]> {
  const n = Number(episode);
  // AniSkip only knows whole-numbered episodes.
  if (!Number.isInteger(n) || n < 1) return [];
  const types = Object.keys(KINDS)
    .map((t) => `types[]=${t}`)
    .join('&');
  const response = await fetch(`${ENDPOINT}/${malId}/${n}?${types}&episodeLength=0`);
  // 404 means nobody has submitted times for this episode yet.
  if (!response.ok) return [];
  const json = (await response.json()) as {
    found: boolean;
    results?: { skipType: string; interval: { startTime: number; endTime: number } }[];
  };
  if (!json.found) return [];
  return (json.results ?? [])
    .filter((r) => KINDS[r.skipType])
    .map((r) => ({ kind: KINDS[r.skipType], start: r.interval.startTime, end: r.interval.endTime }))
    .sort((a, b) => a.start - b.start);
}
