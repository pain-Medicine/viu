/// <reference types="node" />
// The app's riskiest pure logic: what Resume plays, sign-in parsing and the
// AllAnime key handling. Run with `npm test`.
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import { gcm } from '@noble/ciphers/aes.js';

import { airedEpisodes, type Media, tokenFrom } from '../src/api/anilist';
import { base64ToBytes, bytesToBase64, bytesToUtf8 } from '../src/lib/base64';
import { CLIENT_EPOCH_MS } from '../src/providers/allanime/constants';
import { AllAnimeKeys } from '../src/providers/allanime/keys';
import { AllAnimeProvider } from '../src/providers/allanime/provider';
import { episodeProgress, type HistoryEntry, upNext } from '../src/state/progress';

const entry = (episode: string, position: number, duration = 100, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
  mediaId: 1,
  episode,
  position,
  duration,
  updatedAt: 0,
  ...extra,
});

describe('upNext', () => {
  const eps = ['1', '2', '3'];
  it('resumes a half-watched episode', () => {
    assert.deepEqual(upNext(entry('2', 40), eps), { episode: '2', resume: true });
  });
  it('moves on after a watched episode', () => {
    assert.deepEqual(upNext(entry('2', 95), eps), { episode: '3', resume: false });
  });
  it('stays on the last episode of the show', () => {
    assert.deepEqual(upNext(entry('3', 95), eps), { episode: '3', resume: true });
  });
  it('guesses the next number without a list, capped at the total', () => {
    assert.deepEqual(upNext(entry('11', 95), undefined, 12), { episode: '12', resume: false });
    assert.deepEqual(upNext(entry('12', 95), undefined, 12), { episode: '12', resume: true });
  });
});

describe('episodeProgress', () => {
  it('counts earlier episodes as watched for entries saved before per-episode history', () => {
    assert.deepEqual(episodeProgress(entry('3', 10), '1', 0, 2), { position: 1, duration: 1 });
    assert.equal(episodeProgress(entry('3', 10), '4', 3, 2), undefined);
  });
  it('uses per-episode history when there is one', () => {
    const e = entry('3', 10, 100, { episodes: { '3': { position: 10, duration: 100 } } });
    assert.equal(episodeProgress(e, '1', 0, 2), undefined);
  });
});

describe('tokenFrom', () => {
  it('takes the token out of the address AniList ends on', () => {
    assert.equal(tokenFrom(' https://anilist.co/api/v2/oauth/pin#access_token=abc.def&token_type=Bearer '), 'abc.def');
  });
  it('accepts a bare token', () => {
    assert.equal(tokenFrom('  abc.def\n'), 'abc.def');
  });
});

describe('airedEpisodes', () => {
  const media = (episodes: number | null, next: number | null) =>
    ({ episodes, nextAiringEpisode: next ? { episode: next, airingAt: 0 } : null }) as Media;
  it('uses the total when known, otherwise what has aired', () => {
    assert.equal(airedEpisodes(media(12, null)), 12);
    assert.equal(airedEpisodes(media(null, 8)), 7);
    assert.equal(airedEpisodes(media(null, null)), 0);
  });
});

describe('AllAnime crypto', () => {
  const key = new Uint8Array(32).map((_, i) => i);

  it('base64 round-trips and decodes UTF-8', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253]);
    assert.deepEqual(base64ToBytes(bytesToBase64(bytes)), bytes);
    assert.equal(bytesToUtf8(new TextEncoder().encode('Shingeki · 進撃 🎬')), 'Shingeki · 進撃 🎬');
  });

  it('decrypts a tobeparsed payload sealed the way the api does', () => {
    const iv = new Uint8Array(12).fill(7);
    const sealed = gcm(key, iv).encrypt(new TextEncoder().encode(JSON.stringify({ episode: { notes: 'Pilot' } })));
    const blob = bytesToBase64(new Uint8Array([1, ...iv, ...sealed]));
    assert.deepEqual(new AllAnimeKeys(key, 1).decryptTobeparsed(blob), { episode: { notes: 'Pilot' } });
  });

  it('builds an aaReq the key can open', () => {
    const data = base64ToBytes(new AllAnimeKeys(key, 42).makeAaReq('hash'));
    const payload = JSON.parse(bytesToUtf8(gcm(key, data.slice(1, 13)).decrypt(data.slice(13))));
    assert.equal(payload.epoch, 42);
    assert.equal(payload.qh, 'hash');
  });
});

describe('AllAnimeProvider keys', () => {
  afterEach(() => mock.restoreAll());

  it('fetches new keys once the week changes', async () => {
    let bootstraps = 0;
    const fetchFn = (async (url: string) => {
      if (url.includes('bootstrap')) {
        bootstraps++;
        return new Response(JSON.stringify({ epoch: bootstraps, partB: bytesToBase64(new Uint8Array(32)) }));
      }
      return new Response(JSON.stringify({ data: { episode: { sourceUrls: [] } } }));
    }) as typeof fetch;
    const provider = new AllAnimeProvider(fetchFn);
    const week = 2900;
    mock.method(Date, 'now', () => week * CLIENT_EPOCH_MS + 1000);
    await provider.episodeStreams('id', '1', 'sub');
    await provider.episodeStreams('id', '2', 'sub');
    assert.equal(bootstraps, 1);
    mock.method(Date, 'now', () => (week + 1) * CLIENT_EPOCH_MS + 1000);
    await provider.episodeStreams('id', '3', 'sub');
    assert.equal(bootstraps, 2);
  });
});
