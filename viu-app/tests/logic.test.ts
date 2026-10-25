/// <reference types="node" />
// The app's riskiest pure logic: what Resume plays, sign-in parsing, the
// AllAnime key handling and the network no-leak rule. Run with `npm test`.
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import { gcm } from '@noble/ciphers/aes.js';

import { airedEpisodes, type Media, tokenFrom } from '../src/api/anilist';
import { base64ToBytes, bytesToBase64, bytesToUtf8 } from '../src/lib/base64';
import { CLIENT_EPOCH_MS } from '../src/providers/allanime/constants';
import { AllAnimeKeys } from '../src/providers/allanime/keys';
import { AllAnimeProvider, episodeQueryError, wixmpLinks } from '../src/providers/allanime/provider';
import { findBestMatch, ratio, searchQueries, tokenSetRatio } from '../src/providers/match';
import { applyNetwork, BLOCKED, type NetworkSettings } from '../src/state/networkModes';
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
    await provider.episodeStreams('id', '1', 'sub').catch(() => {});
    await provider.episodeStreams('id', '2', 'sub').catch(() => {});
    assert.equal(bootstraps, 1);
    mock.method(Date, 'now', () => (week + 1) * CLIENT_EPOCH_MS + 1000);
    await provider.episodeStreams('id', '3', 'sub').catch(() => {});
    assert.equal(bootstraps, 2);
  });
});

describe('AllAnime streams', () => {
  it('turns a wixmp playlist into one mp4 per quality, playlist last', () => {
    const hls = 'https://repackager.wixmp.com/video.wixstatic.com/video/abc_123/,1080p,720p,/mp4/file.mp4.urlset/master.m3u8';
    assert.deepEqual(wixmpLinks(hls), [
      { url: 'https://video.wixstatic.com/video/abc_123/1080p/mp4/file.mp4', quality: '1080' },
      { url: 'https://video.wixstatic.com/video/abc_123/720p/mp4/file.mp4', quality: '720' },
      { url: hls, quality: 'auto' },
    ]);
    assert.deepEqual(wixmpLinks('https://example.com/a.mp4'), [{ url: 'https://example.com/a.mp4', quality: '1080' }]);
  });
  it('searches with the terminal\'s defaults', async () => {
    let body: { variables: { search: Record<string, unknown>; limit: number; countryOrigin?: string } } | undefined;
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ data: { shows: { edges: [] } } }));
    }) as typeof fetch;
    await new AllAnimeProvider(fetchFn).search('one piece', 'sub');
    assert.deepEqual(body?.variables.search, { allowAdult: true, allowUnknown: true, query: 'one piece' });
    assert.equal(body?.variables.limit, 20);
    assert.equal(body?.variables.countryOrigin, undefined);
  });
  it('says when the api is rate limiting or has no episode', () => {
    assert.match(episodeQueryError([{ message: 'Too many requests, please try again in 4 seconds.' }]).message, /rate limiting.*4 seconds/);
    assert.match(episodeQueryError(undefined).message, /no data for this episode/);
  });
  it('reads the Default source from allanime.day and names unsupported servers', async () => {
    const urls: string[] = [];
    const fetchFn = (async (url: string) => {
      urls.push(url);
      if (url.includes('bootstrap')) return new Response(JSON.stringify({ epoch: 1, partB: bytesToBase64(new Uint8Array(32)) }));
      if (url.includes('clock.json')) return new Response(JSON.stringify({ links: [{ link: 'https://x.example/v.mp4' }] }));
      const sourceUrls = url.includes('%22episodeString%22%3A%221%22')
        ? [{ sourceName: 'Default', sourceUrl: '/apivtwo/clock?id=ab' }, { sourceName: 'Ok', sourceUrl: 'https://ok.ru/x' }]
        : [{ sourceName: 'Ok', sourceUrl: 'https://ok.ru/x' }];
      return new Response(JSON.stringify({ data: { episode: { sourceUrls } } }));
    }) as typeof fetch;
    const provider = new AllAnimeProvider(fetchFn);
    const servers = await provider.episodeStreams('id', '1', 'sub');
    assert.ok(urls.includes('https://allanime.day/apivtwo/clock.json?id=ab'));
    assert.deepEqual(servers.map((s) => [s.name, s.links, s.headers]), [['wixmp', [{ url: 'https://x.example/v.mp4', quality: '1080' }], {}]]);
    await assert.rejects(provider.episodeStreams('id', '2', 'sub'), /servers \(Ok\)/);
  });
});

describe('findBestMatch', () => {
  const media = (romaji: string, english: string | null, episodes: number | null, next: number | null, synonyms: string[] = []) =>
    ({ title: { romaji, english, native: null, userPreferred: romaji }, synonyms, episodes, nextAiringEpisode: next ? { episode: next, airingAt: 0 } : null }) as Media;
  const result = (id: string, title: string, sub: number, dub = 0) => ({ id, title, episodes: { sub, dub } });

  it('maps One Piece to AllAnime\'s "1P" through the normalizer', () => {
    const results = [
      result('ReooPAxPMsHM4KPMY', '1P', 1181, 1150),
      result('EzPPDWAbAnwR2HSHA', 'ONE PIECE HEROINES', 1),
      result('PM4hwu3HqnvjbPHjq', 'Koisuru ONE PIECE', 5),
      result('bNxsZLcHxRPbs4eTf', 'ONE PIECE: Gyojin Tou-hen', 21, 21),
      result('zdoBnQCG5wi52KHyw', 'One Piece Film: Red', 1, 1),
    ];
    assert.equal(findBestMatch(results, media('ONE PIECE', 'ONE PIECE', null, 1181, ['OP']))?.id, 'ReooPAxPMsHM4KPMY');
    assert.deepEqual(searchQueries(media('ONE PIECE', 'ONE PIECE', null, 1181, ['OP'])), ['one piece', 'op']);
  });

  it('takes the series over its sequels, movies and OVAs', () => {
    const aot = [
      result('9nSb8m9Nufa2TD7oP', 'Shingeki no Kyojin Movie: Kanketsu-hen - The Last Attack', 1, 1),
      result('XYfeCqq4yyGS2zxFx', 'Shingeki no Kyojin Season 2', 12, 12),
      result('C9d6MjbQk3ddHAZnD', 'Shingeki no Kyojin OVA', 8, 3),
      result('wbnpCxPu3fyk9XSaZ', 'Shingeki no Kyojin', 27, 25),
    ];
    assert.equal(findBestMatch(aot, media('Shingeki no Kyojin', 'Attack on Titan', 25, null))?.id, 'wbnpCxPu3fyk9XSaZ');
    const frieren = [
      result('mini', 'Sousou no Frieren: ●● no Mahou', 10),
      result('ReHMC7TQnch3C6z8j', 'Sousou no Frieren', 28, 28),
    ];
    assert.equal(findBestMatch(frieren, media('Sousou no Frieren', 'Frieren: Beyond Journey’s End', 28, null))?.id, 'ReHMC7TQnch3C6z8j');
  });

  it('scores like the terminal\'s pure Python fuzz', () => {
    assert.equal(ratio('one piece', 'one piece film red'), 50);
    assert.equal(tokenSetRatio('piece one', 'one piece'), 100);
  });
});

describe('applyNetwork', () => {
  // Records the last proxy the app was pointed at.
  const fakeNative = (tunnel: () => Promise<string> = async () => '127.0.0.1:5000') => {
    const native = { proxy: undefined as string | null | undefined, setProxy: (url: string | null) => void (native.proxy = url), startTunnel: tunnel, stopTunnel: () => {} };
    return native;
  };
  const settings = (patch: Partial<NetworkSettings>): NetworkSettings => ({ mode: 'direct', proxy: '', wgConfig: null, ...patch });

  it('connects directly only when asked to', async () => {
    const native = fakeNative();
    assert.deepEqual(await applyNetwork(settings({}), native), { state: 'direct' });
    assert.equal(native.proxy, null);
  });

  it('routes through a set proxy or a running tunnel', async () => {
    const native = fakeNative();
    assert.equal((await applyNetwork(settings({ mode: 'proxy', proxy: 'http://10.0.0.2:8080' }), native)).state, 'proxy');
    assert.equal(native.proxy, 'http://10.0.0.2:8080');
    assert.equal((await applyNetwork(settings({ mode: 'vpn', wgConfig: '[Interface]' }), native)).state, 'vpn');
  });

  it('blocks traffic whenever a mode cannot be set up', async () => {
    const cases: [Partial<NetworkSettings>, (() => Promise<string>)?][] = [
      [{ mode: 'proxy', proxy: '' }],
      [{ mode: 'vpn', wgConfig: null }],
      [{ mode: 'vpn', wgConfig: '[Interface]' }, async () => { throw new Error('handshake failed'); }],
    ];
    for (const [patch, tunnel] of cases) {
      const native = fakeNative(tunnel);
      assert.equal((await applyNetwork(settings(patch), native)).state, 'error', JSON.stringify(patch));
      assert.equal(native.proxy, BLOCKED, JSON.stringify(patch));
    }
  });
});
