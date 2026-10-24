// Base64 for the AllAnime crypto. atob/btoa exist in Hermes, browsers and Node.
export const bytesToBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

export const base64ToBytes = (b64: string): Uint8Array => Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0));

// UTF-8 decode without TextDecoder, which not every Hermes build ships.
export function bytesToUtf8(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++];
    let cp: number;
    if (b < 0x80) cp = b;
    else if (b < 0xe0) cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
    else if (b < 0xf0) cp = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    else
      cp =
        ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    out += String.fromCodePoint(cp);
  }
  return out;
}
