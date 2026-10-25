// Native players handle HLS themselves; the web build has its own version of
// this file (hls.web.ts).
export const needsHlsJs = (_url: string) => false;

export function attachHls(_video: unknown, _url: string, _onFatal: (message: string) => void): () => void {
  return () => {};
}
