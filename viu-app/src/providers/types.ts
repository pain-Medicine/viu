// The terminal's MediaTranslationType: subtitled, English dub, or raw
// (Japanese audio, no subtitles).
export type TranslationType = 'sub' | 'dub' | 'raw';
export const TRANSLATIONS: TranslationType[] = ['sub', 'dub', 'raw'];

// The streaming sources the app can use; the terminal's ProviderName.
export type ProviderId = 'allanime' | 'animeunity';

export interface ProviderSearchResult {
  id: string;
  title: string;
  episodes: Record<TranslationType, number>;
}

export interface ProviderAnime {
  id: string;
  title: string;
  episodes: Record<TranslationType, string[]>;
}

export interface StreamLink {
  url: string;
  quality: string;
}

export interface StreamServer {
  name: string;
  links: StreamLink[];
  headers: Record<string, string>;
  episodeTitle: string | null;
}

export interface AnimeProvider {
  name: string;
  search(query: string, translation: TranslationType): Promise<ProviderSearchResult[]>;
  get(id: string): Promise<ProviderAnime | null>;
  // Finds the first server that works, trying `preferredServer` first when
  // given (the terminal's stream.server; anything else means "TOP").
  episodeStreams(id: string, episode: string, translation: TranslationType, preferredServer?: string): Promise<EpisodeStreams>;
}

// An episode's servers, found one at a time like the terminal's TOP server
// choice: only the first is fetched up front, the next when it's needed.
export interface EpisodeStreams {
  // Servers found so far, in the order they were found.
  servers: StreamServer[];
  // Every source the episode lists, by AllAnime's name for it.
  sources: string[];
  // Finds the next server that works and adds it to `servers`; null once
  // every source has been tried.
  more(): Promise<StreamServer | null>;
}

// Thrown when a provider can't run on this platform (for example a browser,
// where CORS and forbidden headers block the scraping calls).
export class ProviderUnavailableError extends Error {}
