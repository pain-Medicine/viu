// Port of the terminal's provider matching: find_best_match_title in
// viu_media/cli/utils/search.py, the title normalizer in
// viu_media/core/utils/normalizer.py with its mapping data from
// viu_media/assets/normalizer.json, and the pure Python ratios in
// viu_media/core/utils/fuzzy.py. Keep them in step with the terminal.
import { airedEpisodes, type Media } from '../api/anilist';
import type { ProviderSearchResult } from './types';

// Provider titles that don't look like the AniList title at all, from the
// "allanime" section of normalizer.json: provider title -> AniList title.
export const ALLANIME_TITLES: Record<string, string> = {
  'Burichi -': 'bleach',
  '1P': 'one piece',
  'Magia Record: Mahou Shoujo Madoka☆Magica Gaiden (TV)': 'Mahou Shoujo Madoka☆Magica',
  'Dungeon ni Deai o Motomeru no wa Machigatte Iru Darouka': 'Dungeon ni Deai wo Motomeru no wa Machigatteiru Darou ka',
  'Hazurewaku no "Joutai Ijou Skill" de Saikyou ni Natta Ore ga Subete wo Juurin suru made':
    'Hazure Waku no [Joutai Ijou Skill] de Saikyou ni Natta Ore ga Subete wo Juurin Suru made',
  'Re:Zero kara Hajimeru Isekai Seikatsu Season 3': 'Re:Zero kara Hajimeru Isekai Seikatsu 3rd Season',
  'Hanka×Hanka (2011)': 'Hunter × Hunter (2011)',
};

export const providerTitleToMediaTitle = (title: string) => ALLANIME_TITLES[title] ?? title;

export function mediaTitleToProviderTitle(title: string): string {
  for (const [provider, media] of Object.entries(ALLANIME_TITLES)) if (media === title) return provider;
  return title;
}

// Strings are compared by code point, as Python does.
function levenshtein(a: string[], b: string[]): number {
  if (a.length < b.length) return levenshtein(b, a);
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  a.forEach((c1, i) => {
    const current = [i + 1];
    b.forEach((c2, j) => {
      current.push(Math.min(previous[j + 1] + 1, current[j] + 1, previous[j] + (c1 !== c2 ? 1 : 0)));
    });
    previous = current;
  });
  return previous[previous.length - 1];
}

export function ratio(s1: string, s2: string): number {
  if (!s1 && !s2) return 100;
  if (!s1 || !s2) return 0;
  const a = Array.from(s1);
  const b = Array.from(s2);
  const max = Math.max(a.length, b.length);
  return Math.trunc(((max - levenshtein(a, b)) / max) * 100);
}

export function tokenSetRatio(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const tokens = (s: string) => new Set(s.toLowerCase().trim().split(/\s+/).filter(Boolean));
  const t1 = tokens(s1);
  const t2 = tokens(s2);
  const sorted = (xs: Iterable<string>) => [...xs].sort().join(' ');
  const both = sorted([...t1].filter((t) => t2.has(t)));
  const combined1 = `${both} ${sorted([...t1].filter((t) => !t2.has(t)))}`.trim();
  const combined2 = `${both} ${sorted([...t2].filter((t) => !t1.has(t)))}`.trim();
  if (!combined1 && !combined2) return 100;
  if (!combined1 || !combined2) return 0;
  return ratio(combined1, combined2);
}

// The app's older matcher compared titles without punctuation; an exact match
// that way still counts as exact.
const bare = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Scores every result on its title (fuzzy, against every AniList title and
// synonym) plus how close its episode count is to what has aired, so spin-offs,
// movies and recaps that share the name lose to the series itself.
export function findBestMatch(results: ProviderSearchResult[], media: Media): ProviderSearchResult | null {
  if (!results.length) return null;
  const validTitles = [media.title.english, media.title.romaji, media.title.native, ...media.synonyms]
    .filter((t): t is string => !!t)
    .map((t) => t.toLowerCase());
  const validBare = new Set(validTitles.map(bare));
  const aired = airedEpisodes(media);
  const expected = aired > 0 ? aired : null;

  // Same title twice keeps the last one, like the terminal's title map.
  const byTitle = new Map<string, ProviderSearchResult>();
  for (const r of results) byTitle.set(r.title, r);

  let best: ProviderSearchResult | null = null;
  let highest = -9999;
  for (const [title, result] of byTitle) {
    const normTitle = providerTitleToMediaTitle(title).toLowerCase();
    if (validTitles.includes(normTitle) || validBare.has(bare(normTitle))) return result;

    const episodes = Math.max(result.episodes.sub, result.episodes.dub);
    let bonus = 0;
    if (expected !== null && episodes > 0) {
      const diff = Math.abs(expected - episodes);
      if (diff === 0) bonus = 100;
      else if (diff <= 2) bonus = 75;
      else if (diff <= 5) bonus = 30;
      // Far off on both counts: likely a movie or OVA with the same name.
      else if (diff > Math.max(10, expected * 0.3)) bonus = -50;
    }

    const lower = title.toLowerCase();
    let text = 0;
    for (const vt of validTitles) {
      // token_set_ratio forgives extra or reordered words; ratio penalises
      // length, so "One Piece Film: Red" doesn't score 100.
      text = Math.max(text, (tokenSetRatio(lower, vt) + ratio(lower, vt)) / 2, (tokenSetRatio(normTitle, vt) + ratio(normTitle, vt)) / 2);
    }

    if (text + bonus > highest) {
      highest = text + bonus;
      best = result;
    }
  }
  return best ?? results[0];
}

// What the terminal searches for: the English title (else romaji) under the
// name the provider uses, lowercased; then the synonyms if that finds nothing.
// The romaji title goes before the synonyms, as the app searched it before.
export function searchQueries(media: Media): string[] {
  const main = media.title.english || media.title.romaji;
  const queries = [main, media.title.romaji, ...media.synonyms].filter((t): t is string => !!t).map((t) => mediaTitleToProviderTitle(t).toLowerCase());
  return [...new Set(queries)];
}
