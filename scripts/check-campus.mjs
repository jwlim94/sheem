// Checks the buildings of the valley flight (src/portfolio/room/valley.ts:
// BYU's campus; lehi.ts: round Bridge's office): no two boxes of a building
// have faces in one plane where both could show (they fight in the depth
// buffer and flicker, the user's report 2026-11-20), and no two buildings
// overlap. Run: node --experimental-strip-types scripts/check-campus.mjs
import { register } from 'node:module';

// The app's imports leave off '.ts' (Vite's way); Node's need it.
register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function resolve(s, c, next) {
        try { return await next(s, c); }
        catch (e) { if (s.startsWith('.') && !s.endsWith('.ts')) return next(s + '.ts', c); throw e; }
      }`
    )
);
const { campusBoxes, CAMPUS_BUILDINGS } =
  await import('../src/portfolio/room/valley.ts');
const { lehiBoxes, LEHI_BUILDINGS } =
  await import('../src/portfolio/room/lehi.ts');

const EPS = 0.03; // closer than this (units, 1.5 m) counts as the same plane
const span = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
let bad = 0;
for (const [label, boxes, buildings] of [
  ['campus', campusBoxes(), CAMPUS_BUILDINGS],
  ['lehi', lehiBoxes(), LEHI_BUILDINGS],
]) {
  // Within a building: in its own frame (its parts share its turn).
  const ext = (b) => ({
    x0: b.lx - b.w / 2,
    x1: b.lx + b.w / 2,
    z0: b.lz - b.d / 2,
    z1: b.lz + b.d / 2,
    y0: b.y,
    y1: b.y + b.h,
  });
  // Between buildings: round each box's corners in the valley's frame.
  const bound = (b) => {
    const c = Math.abs(Math.cos(b.rot)),
      s = Math.abs(Math.sin(b.rot)),
      ex = (c * b.w + s * b.d) / 2,
      ez = (s * b.w + c * b.d) / 2;
    return { x0: b.x - ex, x1: b.x + ex, z0: b.z - ez, z1: b.z + ez };
  };
  const name = (b) =>
    `${buildings[b.building].name} ${b.part ? 'part' : 'plant'}@${b.lx.toFixed(2)},${b.lz.toFixed(2)}`;
  let n = 0;
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      if (a.building !== b.building) {
        const A = bound(a),
          B = bound(b);
        if (
          span(A.x0, A.x1, B.x0, B.x1) > 0 &&
          span(A.z0, A.z1, B.z0, B.z1) > 0
        ) {
          console.log(`${label} overlap: ${name(a)} / ${name(b)}`);
          n++;
        }
        continue;
      }
      const A = ext(a),
        B = ext(b),
        ox = span(A.x0, A.x1, B.x0, B.x1),
        oz = span(A.z0, A.z1, B.z0, B.z1),
        oy = span(A.y0, A.y1, B.y0, B.y1);
      // Tops in one plane over a shared area.
      if (ox > 1e-6 && oz > 1e-6 && Math.abs(A.y1 - B.y1) < EPS) {
        console.log(`${label} tops: ${name(a)} / ${name(b)}`);
        n++;
      }
      // Walls facing the same way in one plane, over a shared stretch.
      for (const [k, along] of [
        ['x0', oz],
        ['x1', oz],
        ['z0', ox],
        ['z1', ox],
      ])
        if (along > 1e-6 && oy > 1e-6 && Math.abs(A[k] - B[k]) < EPS) {
          console.log(`${label} wall ${k}: ${name(a)} / ${name(b)}`);
          n++;
        }
    }
  console.log(
    `${label}: ${boxes.length} boxes (${boxes.filter((b) => b.part).length} parts, ${boxes.filter((b) => !b.part).length} plant), ${n} problem(s)`
  );
  bad += n;
}
process.exit(bad ? 1 : 0);
