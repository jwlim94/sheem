import type { Loader } from 'three';
import sizes from 'virtual:model-sizes';

/**
 * How much of what the loader waits on has come in, for its percentage: the
 * bytes of every model so far over all of theirs (their sizes from the build,
 * vite.config.ts's model-sizes: the server sends them compressed, with no
 * length to read). A file's bytes count for 90 % of it, its being read
 * (parsed, its geometry decoded) the rest. It had counted files done over
 * files asked for: the small ones came in first, so it ran to 99 % in a
 * second and sat there, and went back to 0 when more were asked for.
 */

/** Each file loaded through a tracked loader, by URL: bytes in, and read. */
const files = new Map<string, { bytes: number; read: boolean }>();
const tracked = new WeakSet<object>();

/**
 * Pass to each preload (useGLTF.preload's extendLoader, useLoader.preload's
 * extensions): from then on the loader's files are counted, from when each
 * is asked for, as its bytes come in. (A loader is shared by all its
 * preloads; it is wrapped once.)
 */
export function trackLoads(loader: Loader) {
  if (tracked.has(loader)) return;
  tracked.add(loader);
  const load = loader.load.bind(loader);
  loader.load = (url, onLoad, onProgress, onError) => {
    const file = files.get(url) ?? { bytes: 0, read: false };
    files.set(url, file);
    load(
      url,
      (data) => {
        file.read = true;
        onLoad(data);
      },
      (e) => {
        file.bytes = Math.max(file.bytes, e.loaded);
        onProgress?.(e);
      },
      onError
    );
  };
}

/** 0..1: of every file asked for (with a known size). */
export function loaded() {
  let have = 0,
    all = 0;
  for (const [url, { bytes, read }] of files) {
    const size = sizes[url];
    if (!size) continue;
    all += size;
    have += read ? size : 0.9 * Math.min(bytes, size);
  }
  return all ? have / all : 0;
}
