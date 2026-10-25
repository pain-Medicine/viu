/// <reference types="node" />
// The web build's provider proxy must only ever forward to the provider's
// own hosts, and only listen on this machine.
import assert from 'node:assert/strict';
import type { AddressInfo, Server } from 'node:net';
import { after, before, describe, it } from 'node:test';

import { isAllowed, startProxy } from '../scripts/provider-proxy.mjs';

describe('isAllowed', () => {
  it('allows the AllAnime api and mp4upload hosts, any port', () => {
    assert.ok(isAllowed('https://api.mkissa.net/api'));
    assert.ok(isAllowed('https://api.mkissa.net/client-crypto/v1/bootstrap?buildId=181&k=k7'));
    assert.ok(isAllowed('https://www.mp4upload.com/embed-abc.html'));
    assert.ok(isAllowed('https://a2.mp4upload.com:183/d/xyz/video.mp4'));
  });
  it('rejects everything else', () => {
    assert.ok(!isAllowed('https://example.com/'));
    assert.ok(!isAllowed('https://mp4upload.com.evil.example/'));
    assert.ok(!isAllowed('https://evilmp4upload.com/'));
    assert.ok(!isAllowed('http://api.mkissa.net/api'));
    assert.ok(!isAllowed('https://user:pass@api.mkissa.net/api'));
    assert.ok(!isAllowed('http://127.0.0.1:8080/'));
    assert.ok(!isAllowed('not a url'));
  });
});

describe('startProxy', () => {
  let server: Server;
  let base: string;
  before(async () => {
    server = await startProxy(0);
    const { address, port } = server.address() as AddressInfo;
    assert.equal(address, '127.0.0.1');
    base = `http://127.0.0.1:${port}/`;
  });
  after(() => server.close());

  it('answers CORS preflights', async () => {
    const res = await fetch(base, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  });
  it('refuses targets outside the allowlist without contacting them', async () => {
    const res = await fetch(`${base}?url=${encodeURIComponent('https://example.com/')}`);
    assert.equal(res.status, 403);
    assert.equal((await fetch(base)).status, 403);
  });
});
