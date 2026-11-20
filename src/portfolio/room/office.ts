/**
 * Chapter 2's room: the small meeting room at Neighbor's Lehi office where he
 * had his first onsite interview (2022), after the user's memory: white walls,
 * a glass front with a glass door onto the office, a glass far wall onto the
 * corn fields by Thanksgiving Point and the mountains beyond, a whiteboard,
 * and a plain white folding table with the two engineers behind it.
 *
 * Local to OFFICE_ORIGIN, three.js axes, at the hero's 1.38x scale (like the
 * hall): x runs from the TV wall (-x) to the whiteboard (+x), z from the
 * window (-z) to the glass front and its door (+z). (Mirrored 2026-10-12 at
 * the user's request, so the camera on the window's side sees the board,
 * him and the engineers' faces together.) Mirrored by
 * art/portfolio-office/build_office.py.
 */

/** Far from the room (origin) and the hall (x 60); hidden elsewhere. */
export const OFFICE_ORIGIN: [number, number, number] = [-120, 0, 0];

/** The room's inner faces: x ±HX, z ±HZ, floor 0 to the ceiling H. */
export const ROOM = { hx: 4.2, hz: 3.5, h: 3.6 };

/** The whiteboard on the east wall: its writing surface (x, facing -x: nx
 *  points into the room), bottom and top (y), its two ends (z0, z1), and
 *  which is on the left and right as you face it (facing +x, the window's
 *  end is on the left). The chessboard fills the left half, the code the
 *  right. */
export const BOARD = {
  x: ROOM.hx - 0.045,
  nx: -1,
  y0: 1.15,
  y1: 2.75,
  z0: -1.6,
  z1: 1.6,
  left: -1.6,
  right: 1.6,
};

/** The folding table (6 ft, white): centre, depth along x, length along z,
 *  and the top's height. */
export const TABLE = { x: -0.4, z: 0, d: 1.05, l: 2.5, h: 1.0 };

/** Furniture and props are sized for the hero's 1.38x scale (the chairs,
 *  table and what is on it 1.3x a real one's). */
export const PROP = 1.3;

/** Seat heights and where the chairs stand (yaw: 0 faces +x). The two
 *  engineers sit behind the table, on its far side from the whiteboard,
 *  apart, watching him across it; his chair is on the table's board side,
 *  facing them, pushed back where he left it to go up to the board. */
export const SEAT_H = 0.56;
export const CHAIRS = [
  { x: -1.5, z: -0.25, yaw: -0.1 }, // engineer, at the laptop
  { x: -1.5, z: 0.9, yaw: 0.06 }, // engineer, by the résumé
  { x: 0.75, z: 0.25, yaw: Math.PI - 0.45 }, // his, empty
];

/** Where he stands at the board (feet), in front of the code half (he faces
 *  it, +x). */
export const AT_BOARD = { x: ROOM.hx - 0.78, z: 0.62 };

/** The ground outside, about eight floors down (the room is high up: the
 *  view looks down over the fields), and the sun (high, early
 *  afternoon, from the window's side and the west: it rakes in through the
 *  window and lights the mountains' faces from the side). */
export const GROUND_Y = -33;
export const OFFICE_SUN_FROM: [number, number, number] = [-13, 15, -7];
export const OFFICE_SUN_TO: [number, number, number] = [0, 0, 0];

/** His desk, hired: a place at the Renter team's single row by the east
 *  windows, facing them (+x), the fourth from its far end, a desk leg at
 *  its right for his backpack (the user's sketch, 2026-10-15; build_office.py's `MY_PLACE` and DESK_HERO). He sits
 *  as in the lecture hall's typing loop: the desk top 0.89 above his origin,
 *  the keys' middle 0.82 ahead and 0.1 to his left. Its monitor (a live
 *  screen, RenterDesk.tsx) stands at the row's back, toward the windows. */
export const DESK = {
  top: 1.0, // the desk top's surface (0.98 buried the keyboard)
  hero: [32.78, 0.09, 10.09] as [number, number, number],
  keys: [33.6, 0.99, 9.99] as [number, number, number],
  monitor: [33.95, 1.38, 9.99] as [number, number, number],
};
