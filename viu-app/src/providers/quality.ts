import type { StreamLink } from './types';

// The preferred quality plays first and the rest keep their order, like the
// terminal's _filter_by_quality (cli/interactive/menu/media/servers.py),
// which takes the link of that quality, else the first.
export function preferQuality(links: StreamLink[], quality: string): StreamLink[] {
  const i = links.findIndex((l) => l.quality === quality);
  return i <= 0 ? links : [links[i], ...links.slice(0, i), ...links.slice(i + 1)];
}
