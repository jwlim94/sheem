import { Box3, BufferAttribute, Matrix4, Mesh, Vector3 } from 'three';

export type TreeVariation = {
  seed: number;
  fullness: number;
  lean: number;
  crownWidth: number;
};

/** One-time coherent warp: branches and leaves follow the same shape, while the
 * trunk base stays fixed. Source assets and UVs are never edited. */
export function varyTreeGeometry(
  mesh: Mesh,
  bounds: Box3,
  variant: TreeVariation,
  leaves: boolean
) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const inverse = new Matrix4().copy(mesh.matrixWorld).invert();
  const p = new Vector3();
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    const h = (p.y - bounds.min.y) / size.y;
    const crown = Math.max(0, Math.min(1, (h - 0.2) / 0.35));
    const width =
      1 +
      crown * (variant.crownWidth - 1 + 0.08 * Math.sin(h * 9 + variant.seed));
    p.x = center.x + (p.x - center.x) * width + variant.lean * size.y * h * h;
    p.z =
      center.z +
      (p.z - center.z) * (1 + crown * (variant.crownWidth - 1) * 0.65);
    p.applyMatrix4(inverse);
    position.setXYZ(i, p.x, p.y, p.z);
  }
  // Remove complete connected leaf cards, not random triangles, to vary density.
  if (leaves && variant.fullness < 1) {
    const index = geometry.index;
    const count = index?.count ?? position.count;
    const parents = new Int32Array(position.count);
    for (let i = 0; i < parents.length; i++) parents[i] = i;
    const find = (i: number): number => {
      while (parents[i] !== i) {
        parents[i] = parents[parents[i]];
        i = parents[i];
      }
      return i;
    };
    const at = (i: number) => (index ? index.getX(i) : i);
    for (let i = 0; i < count; i += 3) {
      const a = find(at(i));
      parents[find(at(i + 1))] = a;
      parents[find(at(i + 2))] = a;
    }
    const kept: number[] = [];
    for (let i = 0; i < count; i += 3) {
      const id = find(at(i));
      const hash = Math.sin(id * 12.9898 + variant.seed * 78.233) * 43758.5453;
      if (hash - Math.floor(hash) < variant.fullness)
        kept.push(at(i), at(i + 1), at(i + 2));
    }
    geometry.setIndex(kept);
  }
  (position as BufferAttribute).needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
