import type { Media } from '../api/anilist';
import type { EpisodeProgress } from '../state/history';

const FORMATS: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'TV short',
  MOVIE: 'Movie',
  SPECIAL: 'Special',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Music',
};

export const formatLabel = (m: Media) => (m.format ? FORMATS[m.format] ?? m.format : 'Anime');

export function metaLine(m: Media, opts: { episodes?: boolean; status?: boolean; genres?: boolean } = {}): string {
  const parts = [
    m.seasonYear?.toString(),
    formatLabel(m),
    opts.episodes && m.episodes ? `${m.episodes} episodes` : undefined,
    m.studios.nodes[0]?.name,
    opts.status ? statusLabel(m) : opts.genres === false ? undefined : m.genres.slice(0, 3).join(', '),
  ];
  return parts.filter(Boolean).join('  ·  ');
}

export function statusLabel(m: Media): string | undefined {
  switch (m.status) {
    case 'RELEASING':
      return 'Airing';
    case 'FINISHED':
      return 'Finished';
    case 'NOT_YET_RELEASED':
      return 'Upcoming';
    default:
      return undefined;
  }
}

export function minutesLeft(e: EpisodeProgress): string {
  const left = Math.max(0, Math.round((e.duration - e.position) / 60));
  return left <= 0 ? 'Finished' : `${left} min left`;
}

export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}
