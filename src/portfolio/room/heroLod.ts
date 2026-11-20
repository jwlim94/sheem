import { BufferAttribute, FileLoader, Loader } from 'three';
import type { BufferGeometry, Mesh, Object3D } from 'three';
import { MeshoptDecoder } from 'meshoptimizer/meshopt_decoder.module.js';

/** His parts' simplified index buffers (scripts/build-hero-lod.mjs), by the
 *  part's name: the level drawn, then the one for the shadow passes. Each
 *  with what it was built for, to check against the model loaded. */
export type HeroLod = Map<
  string,
  { vertices: number; triangles: number; hash: number; levels: Uint32Array[] }
> | null;

/** FNV-1a over an index buffer's values: must match build-hero-lod.mjs. */
function hashIndex(index: ArrayLike<number>) {
  let h = 0x811c9dc5;
  for (let i = 0; i < index.length; i++) {
    h ^= index[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function parse(buffer: ArrayBuffer): HeroLod {
  const u32 = new Uint32Array(buffer),
    words = (bytes: number) => Math.ceil(bytes / 4);
  if (u32[0] !== 0x444f4c48 || u32[1] !== 1)
    throw new Error('not a version 1 hero LOD file');
  const parts: NonNullable<HeroLod> = new Map();
  let at = 3;
  for (let p = 0; p < u32[2]; p++) {
    const nameBytes = u32[at++];
    const name = new TextDecoder().decode(
      new Uint8Array(buffer, at * 4, nameBytes)
    );
    at += words(nameBytes);
    const vertices = u32[at++],
      triangles = u32[at++],
      hash = u32[at++],
      count = u32[at++],
      levels: Uint32Array[] = [];
    for (let l = 0; l < count; l++) {
      const indices = u32[at++],
        bytes = u32[at++],
        level = new Uint32Array(indices);
      MeshoptDecoder.decodeIndexBuffer(
        new Uint8Array(level.buffer),
        indices,
        4,
        new Uint8Array(buffer, at * 4, bytes)
      );
      at += words(bytes);
      levels.push(level);
    }
    parts.set(name, { vertices, triangles, hash, levels });
  }
  return parts;
}

/** Loads a hero LOD file (for useLoader, so it loads with the models and is
 *  cached with them). Never fails: without it (missing, unreadable) he is
 *  drawn at full resolution, as before. */
export class HeroLodLoader extends Loader<HeroLod> {
  load(
    url: string,
    onLoad: (data: HeroLod) => void,
    onProgress?: (event: ProgressEvent) => void
  ) {
    const without = (why: unknown) => {
      console.warn('[room] his simplified mesh is unavailable:', why);
      onLoad(null);
    };
    const file = new FileLoader(this.manager);
    file.setResponseType('arraybuffer');
    file.load(
      url,
      (data) =>
        MeshoptDecoder.ready
          .then(() => onLoad(parse(data as ArrayBuffer)))
          .catch(without),
      onProgress,
      without
    );
  }
}

/**
 * Puts the simplified levels on his parts, once per geometry (the GLTF is
 * cached, so a remount finds them on): the first as the index, which every
 * pass draws, and the second swapped in around each shadow pass (three
 * binds a vertex array per geometry and program, and the shadow passes
 * draw with their own programs, so the swap re-binds nothing per frame).
 * A part whose mesh is not the one the file was built from keeps its own.
 */
export function applyHeroLod(root: Object3D, lod: HeroLod) {
  if (!lod) return;
  // In development, ?hero=full keeps him at full resolution (to compare).
  if (
    import.meta.env.DEV &&
    new URLSearchParams(location.search).get('hero') === 'full'
  )
    return;
  root.traverse((o) => {
    const part = lod.get(o.name),
      mesh = o as Mesh;
    if (!part || !mesh.isMesh) return;
    const g = mesh.geometry;
    if (g.userData.heroLod) return;
    const index = g.index;
    if (
      !index ||
      g.attributes.position.count !== part.vertices ||
      index.count !== part.triangles * 3 ||
      hashIndex(index.array) !== part.hash
    ) {
      console.warn(
        `[room] ${o.name}'s simplified mesh was built for another model (node scripts/build-hero-lod.mjs): kept at full resolution`
      );
      return;
    }
    const [drawn, shadow] = part.levels.map((l) => new BufferAttribute(l, 1));
    g.setIndex(drawn);
    g.userData.heroLod = true;
    if (!shadow) return;
    const swap =
      (to: BufferAttribute) =>
      (...args: unknown[]) =>
        (args[4] as BufferGeometry).setIndex(to);
    mesh.onBeforeShadow = swap(shadow);
    mesh.onAfterShadow = swap(drawn);
  });
}
