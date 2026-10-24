export type TranslationType = 'sub' | 'dub';

export interface ProviderSearchResult {
  id: string;
  title: string;
  episodes: { sub: number; dub: number };
}

export interface ProviderAnime {
  id: string;
  title: string;
  episodes: { sub: string[]; dub: string[] };
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
  episodeStreams(id: string, episode: string, translation: TranslationType): Promise<StreamServer[]>;
}

// Thrown when a provider can't run on this platform (for example a browser,
// where CORS and forbidden headers block the scraping calls).
export class ProviderUnavailableError extends Error {}
