// Watch progress rules, kept free of React and storage so they can be tested in Node.

// An episode counts as watched once this much of it has played, which
// covers stopping during the credits.
const WATCHED_AT = 0.9;

export interface EpisodeProgress {
  position: number;
  duration: number;
}

export interface HistoryEntry {
  mediaId: number;
  // The episode played most recently, and where it stopped.
  episode: string;
  position: number;
  duration: number;
  updatedAt: number;
  // Every episode played so far. Entries saved before this existed don't
  // have it, so they fall back to "earlier episodes count as watched".
  episodes?: Record<string, EpisodeProgress>;
}

export const progressOf = (e?: EpisodeProgress) => (e && e.duration > 0 ? Math.min(1, e.position / e.duration) : 0);

export const isWatched = (e?: EpisodeProgress) => progressOf(e) >= WATCHED_AT;

// Progress of one episode of a show. `order` and `resumeOrder` are the
// episode's and the last-played episode's positions in the episode list,
// used only for entries saved before per-episode history.
export function episodeProgress(entry: HistoryEntry | undefined, episode: string, order: number, resumeOrder: number): EpisodeProgress | undefined {
  if (!entry) return undefined;
  if (entry.episodes) return entry.episodes[episode];
  if (entry.episode === episode) return entry;
  if (resumeOrder >= 0 && order < resumeOrder) return { position: 1, duration: 1 };
  return undefined;
}

// The episode to start from: the last one played, or the one after it when
// that was finished. `episodes` is the show's episode list when known;
// otherwise the next whole number is assumed, capped at `total`.
export function upNext(entry: HistoryEntry, episodes?: string[], total?: number | null): { episode: string; resume: boolean } {
  if (!isWatched(entry)) return { episode: entry.episode, resume: true };
  if (episodes?.length) {
    const i = episodes.indexOf(entry.episode);
    if (i >= 0 && i < episodes.length - 1) return { episode: episodes[i + 1], resume: false };
    return { episode: entry.episode, resume: true };
  }
  const n = Math.floor(parseFloat(entry.episode)) + 1;
  if (Number.isFinite(n) && (!total || n <= total)) return { episode: String(n), resume: false };
  return { episode: entry.episode, resume: true };
}
