/**
 * Chapter 4's office: Bridge's, in Lehi (May 2025 –), after the user's floor
 * plan (2026-11-22). A square room off two corridors: glass from floor to
 * ceiling onto the corridor on its north and west sides, three big panes a
 * side (the door in the west glass, toward its south end, a cabinet
 * against it north of the door), concrete-coloured walls on its south and
 * east (the whiteboard on the east wall). Five desks, white tops on grey
 * legs, against the walls: three along the north glass (the left one kept
 * free, the developer's in the middle, the COO's on the right), two along
 * the south wall (his, and the CEO's east of it). Everyone faces their
 * wall: the north row the glass, the south row the concrete (the user's
 * correction, 2026-11-22: they had faced into the room, toward each
 * other). On the desks, laptops on stands, the developers' double
 * monitors; his, a laptop on a stand and a monitor beside it.
 *
 * Local to BRIDGE_ORIGIN, three.js axes, at the hero's 1.38x scale (as
 * office.ts): +x east (the whiteboard's wall), +z south (his desk's wall),
 * the floor at y 0, the room's middle at the origin. The plan's square is
 * 8.8 units (6.4 m; first 10, the user's call: a little smaller). Mirrored
 * by art/portfolio-bridge/build_bridge.py.
 */

/** Far from every other set (hidden elsewhere). */
export const BRIDGE_ORIGIN: [number, number, number] = [0, 0, 1300];

/** The room's inner faces: x ±hx, z ±hz, the floor to the ceiling h. */
export const ROOM = { hx: 4.4, hz: 4.4, h: 3.8 };
/** The corridors' width, past the north and west glass. */
export const CORRIDOR = 2.6;

/** A desk: its width (along the wall), depth, and the top's height. */
export const DESK = { w: 2.0, d: 1.04, top: 1.0 };
/** From the room's middle along z (each row the same, mirrored): a desk's
 *  middle (its back edge 0.08 off the wall), its sitter (his origin: the
 *  desk's front edge 0.57 ahead of him, as at Neighbor's), the chair's
 *  middle (0.12 behind). */
export const DESK_Z = ROOM.hz - 0.08 - DESK.d / 2;
const SITTER_Z = DESK_Z - DESK.d / 2 - 0.57,
  CHAIR_Z = SITTER_Z - 0.12;

/** The five places, west to east in each row: the desk's middle along x;
 *  which way its sitter faces (-1: -z, north, the north row at the glass;
 *  1: +z, south, the south row at the wall); whose. */
export const PLACES = [
  { x: -2.65, face: -1, who: 'free' },
  { x: 0, face: -1, who: 'developer' },
  { x: 2.65, face: -1, who: 'coo' },
  { x: 0.59, face: 1, who: 'him' },
  { x: 3.23, face: 1, who: 'ceo' },
] as const;
export type Place = (typeof PLACES)[number];
/** A place's chair (its sitter's middle) and desk middle along z. */
export const chairZ = (p: Place) => p.face * CHAIR_Z;
export const deskZ = (p: Place) => p.face * DESK_Z;

/** His place (the south row, west): he sits as at Neighbor's desk (the
 *  Typing clip): his origin 0.09 up, the keys' middle 0.82 ahead and 0.1
 *  to his left; facing +z, the wall (his left is +x, the CEO's side). His
 *  monitor ahead, his laptop on its stand to the right of it, turned to
 *  him. */
const HIM = PLACES[3];
export const HERO: [number, number, number] = [HIM.x, 0.09, SITTER_Z];
export const KEYS: [number, number, number] = [
  HIM.x + 0.1,
  0.99,
  SITTER_Z + 0.82,
];
export const MONITOR = {
  at: [HIM.x + 0.12, 1.4, SITTER_Z + 1.25],
  w: 0.72,
  h: 0.42,
};
export const LAPTOP = {
  at: [HIM.x - 0.72, SITTER_Z + 1.12],
  yaw: Math.PI - 0.45,
};

/** The whiteboard on the east wall: its writing surface (facing -x, into
 *  the room), bottom and top, its two ends (facing it, z0 at the left). */
export const BOARD = {
  x: ROOM.hx - 0.045,
  y0: 1.2,
  y1: 2.75,
  z0: -1.33,
  z1: 1.33,
};

/** The door in the west glass (its z span; its height), standing open
 *  into the room, hinged at its south post. */
export const DOOR = { z0: 1.0, z1: 2.3, h: 2.9 };
/** The cabinet against the west glass, north of the door. */
export const CABINET = { z0: -0.73, z1: 0.73, d: 0.62, h: 1.45 };
