#!/usr/bin/env node
// `npm run serve:web [port]`: serves the built site in dist/web (default
// http://localhost:8080) and starts the provider proxy it was built to use.
// Ctrl+C stops both.
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

import { DEFAULT_PORT, startProxy } from './provider-proxy.mjs';

const site = resolve(import.meta.dirname, '..', 'dist', 'web');
const port = Number(process.argv[2]) || 8080;

if (!existsSync(join(site, 'index.html'))) {
  console.error('No build in dist/web yet. Run `npm run build:web` first.');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

http
  .createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    let file = normalize(join(site, path));
    // Anything that isn't a file is the app itself, which handles navigation.
    if (!file.startsWith(site + sep) || !existsSync(file) || statSync(file).isDirectory()) file = join(site, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  })
  .listen(port, '127.0.0.1', () => console.log(`Viu on http://localhost:${port}/`));

startProxy(DEFAULT_PORT).catch((err) => {
  if (err.code !== 'EADDRINUSE') throw err;
  console.log(`Port ${DEFAULT_PORT} is in use, so using the provider proxy that's already running there.`);
});
