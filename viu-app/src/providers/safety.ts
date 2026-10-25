// Addresses a provider hands back are checked before the app fetches or plays
// them: https only, never a local or private address, and for the servers we
// know, only their own hosts. Nothing a provider sends is ever run, rendered
// as a page or opened as a link.
import type { StreamServer } from './types';

// Where each server's videos live. A server not listed here still has to pass
// the https and public-host checks.
export const SERVER_HOSTS: Record<string, string[]> = {
  wixmp: ['wixstatic.com', 'wixmp.com'],
  'mp4-upload': ['mp4upload.com'],
  Yt: ['fast4speed.rsvp'],
  vixcloud: ['vix-content.net'],
};

const LOCAL_HOST = /^(localhost|[^.]+|.*\.(local|localhost|internal|lan|home|arpa))$/i;
const PRIVATE_IPV4 = /^(0|10|127)\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\.|^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./;

const onHost = (host: string, allowed: string[]) => allowed.some((h) => host === h || host.endsWith(`.${h}`));

export function isSafeUrl(url: string, allowedHosts?: string[]): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  // IPv6 literals, private IPv4 and single-label or local names.
  if (host.startsWith('[') || PRIVATE_IPV4.test(host) || LOCAL_HOST.test(host)) return false;
  return !allowedHosts || onHost(host, allowedHosts);
}

// The server with only the links that pass, or null when none do.
export function safeServer(server: StreamServer | null): StreamServer | null {
  if (!server) return null;
  const links = server.links.filter((l) => isSafeUrl(l.url, SERVER_HOSTS[server.name]));
  return links.length ? { ...server, links } : null;
}

// fetch that gives up after `ms`, so a provider that never answers can't
// leave a screen waiting forever. Long enough for the web proxy's own three
// 10 second connection tries.
export function withTimeout(fetchFn: typeof fetch, ms = 35000): typeof fetch {
  return (input, init) => {
    if (init?.signal) return fetchFn(input, init);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetchFn(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}
