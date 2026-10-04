import { BufferAttribute, BufferGeometry, Mesh, Vector3 } from 'three';
import type { Camera, Object3D } from 'three';
import type { GrassContactBody } from './grassContact';

/** Index-only levels share the live vertex buffers, including contact and wind
 * attributes. Switching detail never replaces positions or resets a response. */
export function createTreeDetail(
  root: Object3D,
  height: number,
  data: ArrayBuffer
) {
  const words = new Uint32Array(data);
  let cursor = 0;
  const records: { mesh: Mesh; levels: BufferGeometry[] }[] = [];
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry;
    const count = words[cursor++],
      medium = words[cursor++],
      far = words[cursor++];
    if (count !== geometry.getAttribute('position').count || !geometry.index)
      throw new Error(
        'Broadleaf LOD does not match its source model; regenerate it.'
      );
    const original = geometry.index;
    // Preserve authored fullness: removed leaf cards stay absent at every level.
    const used = new Uint8Array(count);
    for (let i = 0; i < original.count; i++) used[original.getX(i)] = 1;
    const levels = [geometry];
    for (const length of [medium, far]) {
      if (cursor + length > words.length) throw new Error('Truncated tree LOD');
      const kept: number[] = [];
      for (let i = cursor; i < cursor + length; i += 3) {
        const a = words[i],
          b = words[i + 1],
          c = words[i + 2];
        if (used[a] && used[b] && used[c]) kept.push(a, b, c);
      }
      const reduced = new BufferGeometry();
      reduced.attributes = geometry.attributes;
      reduced.groups = geometry.groups;
      reduced.setIndex(new BufferAttribute(new Uint32Array(kept), 1));
      levels.push(reduced);
      cursor += length;
    }
    records.push({ mesh: object, levels });
  });
  if (cursor !== words.length) throw new Error('Unexpected tree LOD data');
  const center = new Vector3();
  let level = 0,
    timer = 1;
  root.userData.treeDetail = 0;
  return {
    get level() {
      return level;
    },
    update(
      camera: Camera,
      delta: number,
      bodies: readonly GrassContactBody[] = []
    ) {
      timer += delta;
      if (timer < 0.2) return;
      timer = 0;
      // The parent is the authored trunk location; the GLB root is normalized.
      (root.parent ?? root).getWorldPosition(center);
      const nearContact = bodies.some(
        (body) =>
          body.active &&
          Math.hypot(body.position.x - center.x, body.position.z - center.z) <
            height
      );
      center.y += height * 0.5;
      const distance = camera.position.distanceTo(center) / height;
      // Hysteresis prevents repeated switching while hovering at a boundary.
      let next = level;
      if (nearContact) next = 0;
      else if (distance < 3.6) next = 0;
      else if (distance > 9.5) next = 2;
      else if (level === 0 && distance > 4.2) next = 1;
      else if (level === 2 && distance < 8.5) next = 1;
      if (next === level) return;
      level = next;
      root.userData.treeDetail = level;
      for (const { mesh, levels } of records) {
        levels[level].boundingBox = levels[0].boundingBox;
        levels[level].boundingSphere = levels[0].boundingSphere;
        mesh.geometry = levels[level];
      }
    },
    dispose() {
      for (const { levels } of records)
        for (const geometry of levels) geometry.dispose();
    },
  };
}
