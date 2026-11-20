/**
 * Layout of chapter 1's auditorium (CS 142's real room, from the user's
 * memory): a wide, fan-shaped hall. Local to SCHOOL_ORIGIN, three.js axes:
 * +X toward the front wall, +Z to the right of a seated student.
 *
 * - Ten raked rows in three sections: the centre (9 seats) runs straight;
 *   the left and right sections (6 each) are turned ANGLE toward the stage
 *   about their front inner corners, so the aisles between are wide at the
 *   back (by the doors) and narrow toward the front.
 * - The side walls follow the side sections, so the hall widens to the back.
 * - In front: a wide flat floor, then a raised stage along the front wall
 *   with steps at both ends, three long whiteboards above it.
 * - At the back: a walkway at the top row's height, a door at each end (open,
 *   a bright corridor beyond) and the projection booth in the middle.
 *
 * art/portfolio-school/build_school.py builds the shell from the same numbers.
 */
export const PITCH = 1.5; // row spacing
export const RISE = 0.34; // tier step
export const ROWS = 10;
export const ANGLE = 0.24; // side sections' turn toward the stage (rad, ~14°)
export const FRONT_X = 9.8; // front wall face
export const BACK_X = -18.7; // back wall face
export const ROW0_FRONT = 0.75; // front edge of the first row
export const STAGE = { x0: 5.6, h: 0.55 }; // stage front edge (4.2 m deep), height
export const WALL_H = 9.4; // above the front floor
const SEAT_W = 0.98; // sized for the 1.38× hero
const CENTRE_Z = 4.5; // centre section half width
export const AISLE = 1.5; // aisle width at the front
const SIDE_SEATS = 6;
const CENTRE_SEATS = 9;
export const SIDE_W = SIDE_SEATS * SEAT_W + 0.3; // side section width

export const rowX = (row: number) => -PITCH * row;
const centreZ = (k: number) => SEAT_W * (k - (CENTRE_SEATS - 1) / 2);
export const rowY = (row: number) => RISE * row;

/** The side section's frame: pivot (front inner corner), depth and across. */
export function sideFrame(side: -1 | 1) {
  const c = Math.cos(ANGLE),
    s = Math.sin(ANGLE);
  return {
    pivot: [ROW0_FRONT, 0, side * (CENTRE_Z + AISLE)] as [
      number,
      number,
      number,
    ],
    back: [-c, 0, side * s] as [number, number, number], // toward the back
    out: [s, 0, side * c] as [number, number, number], // toward the side wall
    yaw: side * ANGLE, // a seat's turn, so it faces the stage
  };
}

export type Seat = {
  row: number;
  section: -1 | 0 | 1;
  x: number;
  y: number;
  z: number;
  yaw: number; // about Y; 0 faces +X
};

/** Every seat in the hall. */
export function seats(): Seat[] {
  const out: Seat[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let k = 0; k < CENTRE_SEATS; k++)
      out.push({
        row,
        section: 0,
        x: rowX(row),
        y: rowY(row),
        z: centreZ(k),
        yaw: 0,
      });
    for (const side of [-1, 1] as const) {
      const f = sideFrame(side),
        a = PITCH / 2 + PITCH * row; // seat centre behind the front edge
      for (let k = 0; k < SIDE_SEATS; k++) {
        const b = 0.15 + SEAT_W / 2 + SEAT_W * k;
        out.push({
          row,
          section: side,
          x: f.pivot[0] + f.back[0] * a + f.out[0] * b,
          y: rowY(row),
          z: f.pivot[2] + f.back[2] * a + f.out[2] * b,
          yaw: f.yaw,
        });
      }
    }
  }
  return out;
}

// His seat: centre section, row 3, next to the right aisle.
export const HERO_ROW = 3;
export const HERO_Z = centreZ(CENTRE_SEATS - 1);
// The Typing clip was made on the room's tall desk chair (seated, its feet hang
// 0.23 m up), so here he sits 0.17 m lower, on a lower cushion, and 0.15 m
// back toward the backrest: his slippers reach the floor and his back meets
// the seat (build_school.py HERO_BACK / HERO_DROP).
export const SCHOOL_SEAT: [number, number, number] = [
  rowX(HERO_ROW) - 0.15,
  rowY(HERO_ROW) - 0.17,
  HERO_Z,
];
// His laptop: a 16-inch one for his 1.38x scale (0.525 x 0.36 m; a 14-inch
// read small), its keys under his fingertips as measured on the v2 character
// over the hall's typing loop (scene units from SCHOOL_SEAT: tips 0.81-0.84 m
// ahead, wrists 0.54-0.59; across, the left hand at -0.31, the right at
// +0.08; the left types 7 cm lower than the right). The desk top sits 0.89 m
// above SCHOOL_SEAT's y, between the two hands' heights (build_school.py
// DESK_TOP matches). The lid leans 14° back from its hinge.
export const LAPTOP = { w: 0.525, d: 0.36, lidH: 0.36, base: 0.02 };
export const SCHOOL_DESK_Y = SCHOOL_SEAT[1] + 0.89;
export const SCHOOL_HINGE_X = SCHOOL_SEAT[0] + 0.9;
export const SCHOOL_LAPTOP_Z = HERO_Z - 0.09;
const LID_TILT = (14 * Math.PI) / 180;
/** The lid's centre. */
export const SCHOOL_LID: [number, number, number] = [
  SCHOOL_HINGE_X + Math.sin(LID_TILT) * (LAPTOP.lidH / 2),
  SCHOOL_DESK_Y + LAPTOP.base + Math.cos(LID_TILT) * (LAPTOP.lidH / 2),
  SCHOOL_LAPTOP_Z,
];

/** The left side wall's face, front and back ends (x, z): the side section's
 *  outer edge plus a 0.9 m walk, from the front wall to the back wall. */
export function wallLine(): [[number, number], [number, number]] {
  const f = sideFrame(-1),
    c = Math.cos(ANGLE),
    fx = f.pivot[0] + f.out[0] * (SIDE_W + 0.9),
    fz = f.pivot[2] + f.out[2] * (SIDE_W + 0.9),
    tf = -(FRONT_X - fx) / c,
    tb = (fx - BACK_X) / c;
  return [
    [fx + f.back[0] * tf, fz + f.back[2] * tf],
    [fx + f.back[0] * tb, fz + f.back[2] * tb],
  ];
}
export const HALF_W = -wallLine()[1][1] + 0.3; // half width at the back

// The front: three long whiteboards over the stage, a pull-down projection
// screen over the middle one, the sign above, the clock past the right-hand board.
// Margins at both ends, so the clock hangs clear of the board and the wall's edge.
export const BOARDS: [number, number][] = [
  [-9.0, -3.15],
  [-2.95, 2.95],
  [3.15, 9.0],
];
export const BOARD_Y: [number, number] = [1.75, 5.35];
// Projected on the pull-down screen hanging in front of the middle board.
// Filling the screen's fabric edge to edge (5.6 × 4.05 m, bottom at 1.45 m).
export const SLIDE = { x: FRONT_X - 0.18, y: 3.5, z: 0, w: 5.5, h: 3.95 };
export const SIGN = { x: FRONT_X - 0.03, y: 5.95, z: 0, w: 1.6, h: 0.41 };
export const SCHOOL_CLOCK: [number, number, number] = [
  FRONT_X - 0.015,
  4.2,
  10.0,
];
// The instructor's lectern stands on the floor below the stage, by the left
// stage steps toward the side wall, the professor's laptop on it.
export const LECTERN: [number, number, number] = [STAGE.x0 - 1.6, 0, -10.4];
// The professor stands behind it (stage side, where his laptop's screen
// faces), his hands on the laptop, facing the class.
export const PROFESSOR: [number, number, number] = [
  LECTERN[0] + 0.57,
  0,
  LECTERN[2] + 0.12,
];

// The back: a walkway at the top row's height, deep enough to stand on; a door
// at the top of each aisle (where the centre and side sections part), and the
// projection booth in the middle against the back wall.
export const BACK_WALK_X = -14.6; // the walkway runs from here to the back wall
export const DOOR_Z = 7.0; // door centres at ±DOOR_Z in the back wall
export const BOOTH = {
  x0: BACK_X,
  x1: BACK_X + 2.0,
  z0: -2.6,
  z1: 2.6,
  floor: rowY(ROWS - 1),
};
export const LENS: [number, number, number] = [
  BOOTH.x1 + 0.1,
  BOOTH.floor + 2.1,
  0,
];
