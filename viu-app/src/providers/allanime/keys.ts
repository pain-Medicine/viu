// Port of AllAnimeKeys from viu_media/libs/provider/anime/allanime/utils.py.
//
// The api hands out a weekly "epoch" and a 32 byte "partB" from its bootstrap
// endpoint, but only to callers presenting an HMAC token derived from the
// client mask. The AES-256-GCM key is the XOR of that mask and partB.
import { gcm } from '@noble/ciphers/aes.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

import { base64ToBytes, bytesToBase64, bytesToUtf8 } from '../../lib/base64';
import {
  API_BOOTSTRAP_ENDPOINT,
  API_GRAPHQL_REFERER,
  CLIENT_BOOT_SALT,
  CLIENT_BUILD_ID,
  CLIENT_EPOCH_MS,
  CLIENT_KEY_GROUP,
  CLIENT_KEY_LANE,
  CLIENT_MASK_HEX,
  USER_AGENT,
} from './constants';

const CLIENT_MASK = hexToBytes(CLIENT_MASK_HEX);

export function bootToken(epoch: number): string {
  const host = new URL(API_GRAPHQL_REFERER).hostname;
  const buildKey = hmac(sha256, CLIENT_MASK, utf8ToBytes(`${CLIENT_BOOT_SALT}:${CLIENT_BUILD_ID}`));
  const message = `${CLIENT_BUILD_ID}:${CLIENT_KEY_GROUP}:${host}:${epoch}:${CLIENT_KEY_LANE}`;
  return bytesToHex(hmac(sha256, buildKey, utf8ToBytes(message)));
}

export class AllAnimeKeys {
  constructor(
    readonly key: Uint8Array,
    readonly epoch: number,
  ) {}

  static async fetch(fetchFn: typeof fetch = fetch): Promise<AllAnimeKeys> {
    const epoch = Math.floor(Date.now() / CLIENT_EPOCH_MS);
    const url = `${API_BOOTSTRAP_ENDPOINT}?buildId=${CLIENT_BUILD_ID}&k=${CLIENT_KEY_LANE}`;
    const response = await fetchFn(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: `${API_GRAPHQL_REFERER}/`,
        Origin: API_GRAPHQL_REFERER,
        'x-build-id': CLIENT_BUILD_ID,
        'x-aa-boot': bootToken(epoch),
      },
    });
    if (!response.ok) {
      const text = (await response.text()).slice(0, 200);
      throw new Error(
        `AllAnime key bootstrap failed (${response.status}): ${text}. ` +
          'If it says invalid_boot_token, the CLIENT_* values in allanime/constants.ts need refreshing.',
      );
    }
    const bootstrap = (await response.json()) as { epoch: number | string; partB: string };
    const partB = base64ToBytes(bootstrap.partB);
    const key = CLIENT_MASK.map((m, i) => m ^ (partB[i] ?? 0));
    return new AllAnimeKeys(key, Number(bootstrap.epoch));
  }

  // Builds the signed "aaReq" value the api expects in the query extensions.
  makeAaReq(queryHash: string): string {
    const ts = Math.floor(Date.now() / 1000 / 300) * 300 * 1000;
    const iv = sha256(
      utf8ToBytes(`${this.epoch}:${CLIENT_BUILD_ID}:${queryHash}:${ts}:${CLIENT_KEY_LANE}`),
    ).slice(0, 12);
    const payload = JSON.stringify({
      v: 1,
      ts,
      epoch: this.epoch,
      buildId: CLIENT_BUILD_ID,
      qh: queryHash,
      k: CLIENT_KEY_LANE,
    });
    const sealed = gcm(this.key, iv).encrypt(utf8ToBytes(payload));
    const out = new Uint8Array(1 + iv.length + sealed.length);
    out[0] = 1;
    out.set(iv, 1);
    out.set(sealed, 1 + iv.length);
    return bytesToBase64(out);
  }

  // Decrypts the "tobeparsed" episode payload: 1 version byte, 12 byte IV,
  // ciphertext, 16 byte GCM tag.
  decryptTobeparsed<T = unknown>(blob: string): T {
    const data = base64ToBytes(blob);
    const plaintext = gcm(this.key, data.slice(1, 13)).decrypt(data.slice(13));
    return JSON.parse(bytesToUtf8(plaintext)) as T;
  }
}
