import {
  BufferAttribute,
  BufferGeometry,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

/**
 * Translucent figures (the hall's classmates, the interviewers): each one
 * smooth sculpted surface, metaballs chained along the limbs and torso,
 * polygonised once by MarchingCubes into a static geometry.
 */
export const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

// Each figure is one smooth surface: metaballs chained along the limbs and
// torso, polygonised once by MarchingCubes into a static geometry, so there
// are no seams or joints between parts, only a soft, sculpted silhouette.
export type Ball = [number, number, number, number]; // x, y, z, radius (metres)
const BOX_MIN = v(-0.62, -0.06, -0.62),
  BOX_SPAN = 1.92,
  RES = 72,
  SUB = 60; // field falloff: lower blends limbs more, higher keeps them crisp

/** Balls along a segment, radius easing from ra to rb. */
export function chain(a: Vector3, b: Vector3, ra: number, rb = ra): Ball[] {
  const n = Math.max(2, Math.ceil(a.distanceTo(b) / (0.45 * Math.min(ra, rb))));
  const out: Ball[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      p = a.clone().lerp(b, t);
    out.push([p.x, p.y, p.z, ra + (rb - ra) * t]);
  }
  return out;
}

/** The field's box: a seated figure's by default; a standing one (2.3 m at
 *  his scale) needs a taller box, at the same cell size. */
export type Box = { min: Vector3; span: number; res: number };
const SEATED_BOX: Box = { min: BOX_MIN, span: BOX_SPAN, res: RES };
export const STANDING_BOX: Box = {
  min: v(-0.62, -0.06, -0.62),
  span: 2.4,
  res: 90,
};

export function sculpt(balls: Ball[], box: Box = SEATED_BOX): BufferGeometry {
  const { min: BOX_MIN, span: BOX_SPAN, res } = box,
    scratch = new MeshBasicMaterial(),
    mc = new MarchingCubes(res, scratch, false, false, 90000);
  mc.isolation = 80;
  mc.reset();
  for (const [x, y, z, r] of balls) {
    const rn = r / BOX_SPAN;
    mc.addBall(
      (x - BOX_MIN.x) / BOX_SPAN,
      (y - BOX_MIN.y) / BOX_SPAN,
      (z - BOX_MIN.z) / BOX_SPAN,
      rn * rn * (mc.isolation + SUB),
      SUB
    );
  }
  mc.update();
  const n = mc.count,
    pos = mc.positionArray.slice(0, n * 3),
    nor = mc.normalArray.slice(0, n * 3);
  // Back from the field's -1..1 cube to metres.
  for (let i = 0; i < n * 3; i += 3) {
    pos[i] = BOX_MIN.x + ((pos[i] + 1) / 2) * BOX_SPAN;
    pos[i + 1] = BOX_MIN.y + ((pos[i + 1] + 1) / 2) * BOX_SPAN;
    pos[i + 2] = BOX_MIN.z + ((pos[i + 2] + 1) / 2) * BOX_SPAN;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  mc.geometry.dispose();
  scratch.dispose();
  return g;
}

// Seated on a 0.37 m cushion, facing +X (the stage), at the hero's scale.
export const HIP = 0.52,
  NECK = 1.27,
  HEAD: [number, number, number] = [-0.1, 1.46, 0];

/** Head, neck, shoulders, torso, hips and legs for a seated figure. */
export function seatedBody(lean: number, drop: number): Ball[] {
  const top = -0.17 - lean,
    hx = HEAD[0] - lean + 0.05 * drop,
    hy = HEAD[1] - 0.05 * drop;
  return [
    // Hips and a tapered, slightly broad torso (two chains side by side).
    [-0.1, HIP, -0.08, 0.15],
    [-0.1, HIP, 0.08, 0.15],
    ...chain(v(-0.11, HIP + 0.1, -0.075), v(top, 1.0, -0.085), 0.145, 0.16),
    ...chain(v(-0.11, HIP + 0.1, 0.075), v(top, 1.0, 0.085), 0.145, 0.16),
    ...chain(v(top, 1.07, -0.2), v(top, 1.07, 0.2), 0.1), // shoulders
    ...chain(v(top + 0.03, 1.12, 0), v(hx - 0.03, NECK, 0), 0.065), // neck
    // Head: skull, jaw, and a hair mass over the crown (not behind).
    [hx, hy, 0, 0.165],
    [hx + 0.05, hy - 0.08, 0, 0.11],
    [hx - 0.015, hy + 0.05, 0, 0.15],
    // Legs: thighs on the cushion, knees, shins down, feet.
    ...[-1, 1].flatMap((s) => [
      ...chain(
        v(-0.06, HIP - 0.02, 0.12 * s),
        v(0.36, HIP, 0.13 * s),
        0.1,
        0.085
      ),
      ...chain(
        v(0.38, HIP - 0.02, 0.13 * s),
        v(0.43, 0.11, 0.14 * s),
        0.075,
        0.06
      ),
      ...chain(v(0.42, 0.05, 0.14 * s), v(0.53, 0.05, 0.14 * s), 0.055),
    ]),
  ];
}
