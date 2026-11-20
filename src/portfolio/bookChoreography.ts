import { Object3D, SkinnedMesh } from 'three';
import {
  BENCH_SEAT,
  BENCH_SEAT_TOP,
  SEATED_ROOT_HEIGHT,
  BOOK_LAP,
  ease,
} from './reading';

export const BENCH_BOOK = { x: 5.06, y: BENCH_SEAT_TOP + 0.02, z: 3.56 };
export function bookScore(progress: number) {
  return {
    reach: ease((progress - 0.04) / 0.2),
    lift: ease((progress - 0.3) / 0.18),
    carry: ease((progress - 0.48) / 0.28),
    support: ease((progress - 0.55) / 0.21),
    open: ease((progress - 0.8) / 0.2),
  };
}
/** World-space book: it remains on the bench while the rabbit walks and sits. */
export function notebookTransform(progress: number) {
  const s = bookScore(progress);
  return {
    x:
      BENCH_BOOK.x +
      (BENCH_SEAT[0] - 0.08 * (1 - s.open) - BENCH_BOOK.x) * s.carry,
    y:
      BENCH_BOOK.y +
      0.18 * s.lift * (1 - s.carry) +
      (SEATED_ROOT_HEIGHT + BOOK_LAP.height - BENCH_BOOK.y) * s.carry,
    z:
      BENCH_BOOK.z +
      (BENCH_SEAT[1] + BOOK_LAP.forward - 0.06 * (1 - s.open) - BENCH_BOOK.z) *
        s.carry,
    pitch: -Math.PI / 2 + (BOOK_LAP.pitch + Math.PI / 2) * s.carry,
    yaw: -0.18 * (1 - s.carry),
    open: s.open,
  };
}

// V65 merges its accessories into one mesh. These authored vertex tints belong
// exclusively to the pouch, front/back straps, clasp and stitches.
const bagTints = [
  [0.55, 0.29, 0.14],
  [0.63, 0.36, 0.19],
  [0.76, 0.52, 0.3],
];
export function prepareReadingRabbit(model: Object3D) {
  const owned: { mesh: SkinnedMesh; original: SkinnedMesh['geometry'] }[] = [];
  model.traverse((object) => {
    if (!(object instanceof SkinnedMesh)) return;
    const geometry = object.geometry,
      indices = geometry.index;
    const colors = geometry.getAttribute('color');
    if (!indices || !colors) return;
    const isBag = (i: number) =>
      bagTints.some(
        (c) =>
          Math.abs(colors.getX(i) - c[0]) < 0.0001 &&
          Math.abs(colors.getY(i) - c[1]) < 0.0001 &&
          Math.abs(colors.getZ(i) - c[2]) < 0.0001
      );
    const keep: number[] = [];
    for (let i = 0; i < indices.count; i += 3) {
      const a = indices.getX(i),
        b = indices.getX(i + 1),
        c = indices.getX(i + 2);
      if (!(isBag(a) && isBag(b) && isBag(c))) keep.push(a, b, c);
    }
    if (keep.length === indices.count) return;
    owned.push({ mesh: object, original: geometry });
    object.geometry = geometry.clone();
    object.geometry.setIndex(keep);
  });
  return () => {
    for (const { mesh, original } of owned) {
      mesh.geometry.dispose();
      mesh.geometry = original;
    }
  };
}
