/**
 * Chapter 3's set: the Marriott Center at BYU, set for commencement (after
 * the user's photos, 2026-10-15). Local to ARENA_ORIGIN (story.ts), three.js
 * axes, at the hero's 1.38x scale: x runs the floor's length to the stage
 * (+x), z across it. The bowl of seats all round, the floor filled with
 * graduates in navy on folding chairs, the stage at the +x end with its
 * drape, banner, flowers, lectern and faculty; the center-hung screens over
 * the floor; the graduates' line in a roped aisle to the stage's stairs.
 */

export const S = 1.38;

/** The floor: half its length (x) and width (z), and its corners' radius
 *  (the bowl's first row runs round it). */
export const FLOOR = { hx: 30, hz: 19, r: 9 };

/** The bowl: the lower deck's rows (run and rise each), the concourse,
 *  the upper deck's. */
export const BOWL = {
  lowerRows: 22,
  lowerRun: 1.2,
  lowerRise: 0.55,
  concourse: 3.2,
  fascia: 3.0,
  upperRows: 16,
  upperRun: 1.15,
  upperRise: 0.75,
};

/** The stage at the +x end: its front edge, back, half width, height. */
export const STAGE = { x0: 21.5, x1: 28.5, hz: 11, h: 1.4 };

/** The center-hung screens: its middle, the half size of its box. */
export const JUMBO = { x: 0, y: 22, z: 0, hw: 4.6, hh: 2.7 };

/** The graduates' line: along x at this z, to the stairs at the stage's
 *  front (x 19.4 to 21.5, four steps). */
export const LINE_Z = -9;
export const STAIRS = { x0: 19.4, x1: 21.5, z: LINE_Z, w: 2.2 };

/** His way (feet), from his place in the line, up the stairs, across the
 *  stage to the presenter and past, where he turns to the audience. */
export const WALK: [number, number, number][] = [
  [17.0, 0, LINE_Z],
  [19.3, 0, LINE_Z],
  [21.5, STAGE.h, LINE_Z],
  [22.6, STAGE.h, LINE_Z + 1.1],
  [22.8, STAGE.h, -0.7],
  [22.8, STAGE.h, 2.4],
];

/** Where the presenter stands, handing him his diploma. */
export const PRESENTER: [number, number, number] = [24.0, STAGE.h, -0.4];
