// A browser's <video> plays HLS only where the browser does (Safari, some
// Chrome builds); elsewhere hls.js feeds it through Media Source Extensions.
import Hls from 'hls.js';

const isHls = (url: string) => /\.m3u8(\?|$)/i.test(url);

export function needsHlsJs(url: string): boolean {
  if (!isHls(url) || typeof document === 'undefined') return false;
  const native = document.createElement('video').canPlayType('application/vnd.apple.mpegurl');
  return !native && Hls.isSupported();
}

// Plays `url` in `video` and returns the cleanup. `onFatal` gets errors
// hls.js can't recover from, so the player can move on to another server.
export function attachHls(video: HTMLVideoElement, url: string, onFatal: (message: string) => void): () => void {
  const hls = new Hls();
  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (data.fatal) onFatal(`The stream didn’t load (${data.details}).`);
  });
  hls.loadSource(url);
  hls.attachMedia(video);
  return () => hls.destroy();
}
