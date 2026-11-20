/**
 * Chapter 3's classroom: a case-discussion room in BYU's business school,
 * where he took the MISM's security courses (after the user's photo,
 * 2026-10-15): four tiers of curved maple desks in a horseshoe round the
 * front floor, grey shell chairs on chrome sleds, two projection screens and
 * a whiteboard on the front wall, a maple lectern, beige walls with grey and
 * tan acoustic panels, a striped grey carpet.
 *
 * Local to MISM_ORIGIN (story.ts), three.js axes, at the hero's 1.38x scale:
 * +X toward the front wall, +Z to a seated student's right. The horseshoe
 * centres on the origin, on the front floor; row k's seats stand on a circle
 * of radius RS[k] round it, each facing it.
 *
 * art/portfolio-mism/build_class.py builds the room from the same numbers.
 */
export const S = 1.38;
export const TIERS = 4;
export const PITCH = 1.7; // between rows (radius)
export const RISE = 0.4; // tier step
export const R0 = 4.2; // the first row's seats
export const SPAN = 1.15; // the desks' half angle (rad, ~66°)
export const SEAT_W = 1.0; // along the arc
export const FRONT_X = 4.9; // the front wall's face
export const BACK_X = -11.0; // the back wall's face
export const HALF_W = 10.6; // the side walls (±z)
export const CEIL = 4.9; // above the front floor

export const RS = Array.from({ length: TIERS }, (_, k) => R0 + PITCH * k);
export const tierY = (k: number) => RISE * k;
// The desks (as the lecture hall's, for the same typing pose): the top 0.72
// above a tier's floor; its student edge 0.36 inside the seat circle, 0.75
// deep, a modesty panel down its front edge.
export const DESK_TOP = 0.72;
export const DESK_IN = 0.36;
export const DESK_D = 0.75;
export const SEAT_TOP = 0.37; // the chairs' seat, as the hall's

export type Seat = {
  row: number;
  k: number;
  x: number;
  y: number;
  z: number;
  yaw: number; // about Y; 0 faces +X
};

/** Every seat: along each row's arc, evenly over ±SPAN. */
export function seats(): Seat[] {
  const out: Seat[] = [];
  for (let row = 0; row < TIERS; row++) {
    const r = RS[row],
      n = Math.floor((2 * SPAN * r) / SEAT_W);
    for (let k = 0; k < n; k++) {
      const a = -SPAN + ((k + 0.5) * 2 * SPAN) / n;
      out.push({
        row,
        k,
        x: -r * Math.cos(a),
        y: tierY(row),
        z: r * Math.sin(a),
        yaw: a,
      });
    }
  }
  return out;
}

// His seat: the third row, left of the middle (seen from the front, the
// establishing shot's side), the eighth of its seventeen.
export const HERO_ROW = 2;
export const HERO_K = 7;
const heroSeat = seats().find((s) => s.row === HERO_ROW && s.k === HERO_K)!;
export const HERO_YAW = heroSeat.yaw;
/** His facing (toward the front floor) and his right, flat. */
export const HERO_FWD: [number, number, number] = [
  Math.cos(HERO_YAW),
  0,
  -Math.sin(HERO_YAW),
];
export const HERO_RIGHT: [number, number, number] = [
  Math.sin(HERO_YAW),
  0,
  Math.cos(HERO_YAW),
];
const along = (
  p: [number, number, number],
  f: number,
  r: number,
  y = 0
): [number, number, number] => [
  p[0] + HERO_FWD[0] * f + HERO_RIGHT[0] * r,
  p[1] + y,
  p[2] + HERO_FWD[2] * f + HERO_RIGHT[2] * r,
];
const seatAt: [number, number, number] = [heroSeat.x, heroSeat.y, heroSeat.z];
// As in the lecture hall: he sits 0.15 m back from the seat's centre and
// 0.17 m low (the Typing clip's feet hang), the desk 0.89 above that, the
// laptop's hinge 0.9 ahead of him, 0.09 to his left.
export const MISM_SEAT = along(seatAt, -0.15, 0, -0.17);
export const MISM_LAPTOP = { w: 0.525, d: 0.36, lidH: 0.36, base: 0.02 };
export const MISM_DESK_Y = MISM_SEAT[1] + 0.89;
export const MISM_HINGE = along(MISM_SEAT, 0.9, -0.09);
const LID_TILT = (14 * Math.PI) / 180;
/** The lid's centre (it leans 14° back from the hinge, away from him). */
export const MISM_LID: [number, number, number] = [
  MISM_HINGE[0] + HERO_FWD[0] * Math.sin(LID_TILT) * (MISM_LAPTOP.lidH / 2),
  MISM_DESK_Y + MISM_LAPTOP.base + Math.cos(LID_TILT) * (MISM_LAPTOP.lidH / 2),
  MISM_HINGE[2] + HERO_FWD[2] * Math.sin(LID_TILT) * (MISM_LAPTOP.lidH / 2),
];
/** The keyboard deck's centre (half its depth back from the hinge). */
export const MISM_KEYS = along(
  [MISM_HINGE[0], MISM_DESK_Y + MISM_LAPTOP.base, MISM_HINGE[2]],
  -MISM_LAPTOP.d / 2,
  0
);
export const LID_ANGLE = LID_TILT;

// The front wall: two screens either side of a whiteboard, the slides
// projected on them live (their fabric's face, 6 cm off the wall).
export const SCREENS = [
  { z: -3.75, y: 2.55, w: 4.0, h: 2.5 },
  { z: 3.75, y: 2.55, w: 4.0, h: 2.5 },
];
export const SCREEN_X = FRONT_X - 0.07;
/** The whiteboard between them (build_class.py): its frame's top, and its
 *  centre along the wall. */
export const WHITEBOARD = { top: 1.85 + 0.78, z: 0 };
// The professor stands in the horseshoe's middle, asking the room; the
// lectern by the right-hand screen.
export const PROFESSOR: [number, number, number] = [1.7, 0, 0.6];
export const LECTERN: [number, number, number] = [FRONT_X - 1.5, 0, 1.9];
