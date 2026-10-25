#!/usr/bin/env node
// Local helper that lets the web build stream. Browsers won't let a page set
// Origin or Referer, and AllAnime's key endpoint (behind Cloudflare) only
// answers when they say mkissa.to, while mp4upload's pages send no CORS
// headers at all. This forwards just those requests from 127.0.0.1 with the
// headers they need. The Android TV app doesn't use it.
//
//   node scripts/provider-proxy.mjs [port]     (default 8787)
//
// `npm run web` and `npm run serve:web` start it for you. The app sends the
// target in a `url` query parameter and the headers to set as `x-forward-*`.
// Video requests come from the browser's player, which can't set headers, so
// they carry the Referer in a `referer` query parameter instead.
import http from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';

export const DEFAULT_PORT = 8787;

// Only the provider's hosts, so this can't be used to reach anything else.
// fast4speed.rsvp serves the Yt-mp4 source, which wants AllAnime's Referer.
const ALLOWED_HOSTS = ['api.mkissa.net', 'allanime.day', 'mp4upload.com', 'fast4speed.rsvp'];

export function isAllowed(target) {
  let url;
  try {
    url = new URL(target);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, HEAD, OPTIONS',
  'access-control-expose-headers': 'content-length, content-range, accept-ranges',
};

const PASS_BACK = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// On some networks the first TLS connection to the API in a while fails and
// the next one works, so a failed connection is tried again before giving up.
// Only connection errors are retried; an HTTP error status is passed back.
async function fetchWithRetry(url, init, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      if (attempt >= tries) throw err;
      await sleep(250 * attempt);
    }
  }
}

// Redirects are followed by hand so each hop is checked against the allowlist.
async function forward(target, init) {
  let url = target;
  for (let hop = 0; hop < 5; hop++) {
    const response = await fetchWithRetry(url, { ...init, redirect: 'manual' });
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) return response;
    url = new URL(location, url).href;
    if (!isAllowed(url)) throw new Error(`redirect to a host that isn't allowed: ${url}`);
    if (response.status === 303) init = { ...init, method: 'GET', body: undefined };
  }
  throw new Error('too many redirects');
}

async function handle(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }
  const query = new URL(req.url ?? '/', 'http://localhost').searchParams;
  const target = query.get('url');
  if (!target || !isAllowed(target)) {
    res.writeHead(403, { ...CORS, 'content-type': 'text/plain' });
    return res.end('This proxy only forwards to the AllAnime and mp4upload hosts.');
  }

  const headers = { 'user-agent': USER_AGENT };
  for (const [name, value] of Object.entries(req.headers)) {
    if (name.startsWith('x-forward-') && typeof value === 'string') headers[name.slice('x-forward-'.length)] = value;
  }
  const referer = query.get('referer');
  if (referer) headers.referer = referer;
  if (req.headers.range) headers.range = req.headers.range;
  // Uncompressed, so content-length and byte ranges stay correct.
  headers['accept-encoding'] = 'identity';

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }

  let upstream;
  try {
    upstream = await forward(target, { method: req.method, headers, body });
  } catch (err) {
    console.error(`proxy: ${target}: ${err.cause?.message ?? err.message}`);
    res.writeHead(502, { ...CORS, 'content-type': 'text/plain' });
    return res.end(`Couldn't reach ${new URL(target).host}.`);
  }

  const out = { ...CORS };
  for (const name of PASS_BACK) {
    const value = upstream.headers.get(name);
    if (value) out[name] = value;
  }
  res.writeHead(upstream.status, out);
  if (!upstream.body || req.method === 'HEAD') return res.end();
  const stream = Readable.fromWeb(upstream.body);
  // The player drops connections when it seeks; that's not an error.
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

export function startProxy(port = DEFAULT_PORT) {
  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error(`proxy: ${err.message}`);
      if (!res.headersSent) res.writeHead(500, CORS);
      res.end();
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    // Loopback only: nothing else on the network can use it.
    server.listen(port, '127.0.0.1', () => {
      console.log(`Provider proxy on http://127.0.0.1:${port}/`);
      resolve(server);
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  startProxy(Number(process.argv[2]) || DEFAULT_PORT).catch((err) => {
    console.error(
      err.code === 'EADDRINUSE' ? `Port ${err.port} is in use. Is the proxy already running?` : err.message,
    );
    process.exit(1);
  });
}
