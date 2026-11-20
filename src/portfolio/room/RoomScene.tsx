import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RefObject } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { AnimationAction, Material } from 'three';
import { MeshStandardMaterial } from 'three';
import type { RoomAudio } from './audio';
import { Outside } from './Outside';
import { SpeakerViz } from './SpeakerViz';
import { Clock } from './Clock';
import {
  CLOCK_POSITION,
  MAIL_SWITCH,
  mailBeats,
  officeBeats,
  rewindBeats,
  SCHOOL_ORIGIN,
  schoolBeats,
  SUN_FROM,
  SUN_TO,
  SWITCH,
  deskBeats,
  DESK_SWITCH,
  gradBeats,
  GRAD_SWITCH,
  arenaBeats,
  ARENA_ORIGIN,
  ARENA_IN_FLOW,
  MISM_ORIGIN,
  mismBeats,
  flyBeats,
  FLY_SWITCH,
  VALLEY_ORIGIN,
} from './story';
import { ArenaScene } from './ArenaScene';
import { MismScene } from './MismScene';
import { ValleyScene } from './ValleyScene';
import {
  BRIDGE_AT,
  BRIDGE_BOX,
  FLOOR_H,
  height as valleyHeight,
  HIS_WINDOW,
  PATH as FLY_PATH,
  START_LOOK,
} from './valley';
import { NOTES_CPS, NOTES_HOLD, NOTES_LENGTH } from './mismSlides';
import {
  FRONT_X as MISM_FRONT,
  HERO_FWD as MISM_FWD,
  HERO_RIGHT as MISM_RIGHT,
  HERO_YAW as MISM_YAW,
  MISM_KEYS,
  MISM_LID,
  MISM_SEAT,
} from './mism';
import { WALK } from './arena';
import {
  AT_BOARD,
  BOARD,
  OFFICE_ORIGIN,
  OFFICE_SUN_FROM,
  OFFICE_SUN_TO,
  ROOM as OFFICE_ROOM,
  DESK,
} from './office';
import { OfficeScene } from './OfficeScene';
import { daylight, landTint } from './daySky';
import type { BoardTip } from './OfficeScene';
import { SchoolScene } from './SchoolScene';
import {
  FRONT_X,
  LAPTOP,
  SCHOOL_CLOCK,
  SCHOOL_DESK_Y,
  SCHOOL_HINGE_X,
  SCHOOL_LID,
  SCHOOL_SEAT,
  SLIDE,
} from './hall';
import { LightSwitch } from './LightSwitch';
import { Screen } from './Screen';
import { HeroLodLoader, applyHeroLod } from './heroLod';
import { mergeByMaterial } from './mergeByMaterial';
import type { Desk } from './Screen';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

// Area lights need their lookup tables once per app.
RectAreaLightUniformsLib.init();
import {
  AmbientLight,
  AnimationMixer,
  AnimationUtils,
  CatmullRomCurve3,
  DirectionalLight,
  Group,
  HemisphereLight,
  PointLight,
  RectAreaLight,
  LoopRepeat,
  MathUtils,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Vector3,
  Color,
  Matrix4,
} from 'three';
import type { Camera, Light, Skeleton, SkinnedMesh } from 'three';

const ROOM = '/models/portfolio-room/room.glb';
const HERO = '/models/jongwoo/jongwoo-v2.glb';
// His body simplified, for the frame and for the shadow passes
// (scripts/build-hero-lod.mjs).
const HERO_LOD = '/models/jongwoo/jongwoo-v2-lod.bin';
// His white backpack, set down and worn (build_backpack_glb.py).
const BAG = '/models/jongwoo/backpack.glb';
// The hero is Draco compressed (547k triangles in 3.4 MB); its decoder is
// served from public/draco/ (copied from three's examples), not a CDN.
const DRACO = '/draco/';

// The furniture was scaled for the old 2.4 m chibi; 1.38 brings the Mixamo
// typing hands (0.71 m) just above the keyboard on the 0.92 m desk.
const HERO_SCALE = 1.38;
// Chair centre (three.js axes); the hero sits on it facing the desk (-Z).
const SEAT = new Vector3(-0.9, 0, -1.28);
const SEAT_LIFT = 0;
// SitToStand ends with the hips 0.39 m (unscaled) forward of the root;
// Idle and Waving stand on the root, so the root steps forward as they blend in.
const RISE_FORWARD = 0.391 * HERO_SCALE;
// How far the chair rolls back (+Z) before turning, clear of the desk and drawers.
const PULL_BACK = 0.6;

const ease = (a: number, b: number, p: number) => MathUtils.smoothstep(p, a, b);

/** Which scene the camera is in. */
type Place = 'room' | 'hall' | 'office' | 'desk' | 'arena' | 'mism' | 'fly';
/** The places drawn once behind the loader (see the warm-up), his room last
 *  (where the story starts). The desk is in the office's group, under the
 *  same lights. */
const WARM_UP: Place[] = ARENA_IN_FLOW
  ? ['hall', 'office', 'room']
  : ['hall', 'office', 'mism', 'fly', 'room'];
/** How long the warm-up waits for its programs to compile, at most (ms);
 *  past it, drawing the places finishes them. */
const WARM_WAIT = 8000;

/** Story beats over the 0..1 scroll progress. */
function beats(p: number) {
  return {
    // Hands stay at keyboard height while the chair rolls back, so they leave
    // over the desk top; only then do they drop to the knees, clear of the desk.
    pull: ease(0.1, 0.2, p), // roll the chair back from the desk
    swivel: ease(0.24, 0.42, p), // then turn to face the room
    // Stop typing before the chair turns: settle into SitToStand's first
    // (seated, hands on knees) frame, then scrub it to stand.
    toRise: ease(0.17, 0.23, p), // Typing → seated pose
    rise: ease(0.42, 0.62, p), // SitToStand scrubbed by scroll
    toIdle: ease(0.6, 0.66, p), // SitToStand → HappyIdle
    wave: ease(0.66, 0.74, p), // HappyIdle → Waving
  };
}

// Camera keys: wide diorama → over the shoulder → front, eye to eye.
const KEYS = [
  { at: 0, pos: [5.4, 4.5, 6.4], look: [-0.7, 1.0, -1.2] },
  { at: 0.32, pos: [3.0, 3.0, 3.8], look: [-0.9, 1.2, -1.3] },
  { at: 0.62, pos: [1.5, 2.3, 4.1], look: [-0.6, 1.3, -0.8] },
  { at: 1, pos: [1.2, 2.0, 4.3], look: [-0.15, 1.4, -0.6] },
] as const;

// The rewind: from the final front view, the camera arcs up and across to the
// wall clock (left wall, facing +X), then dives into its dial. One curve for
// the eye, one for where it looks; both sampled by arc length so the speed
// follows the eased beats, not the spacing of the points.
const CLOCK = new Vector3(...CLOCK_POSITION);
const DIAL_X = CLOCK.x + 0.0365;
// Over his head (he is ~2.6 m tall at this scale), then level with the clock.
const REWIND_PATH = new CatmullRomCurve3(
  [
    new Vector3(...KEYS[KEYS.length - 1].pos),
    new Vector3(0.7, 3.2, 2.4),
    new Vector3(-0.9, 3.45, 0.7),
    new Vector3(-2.0, CLOCK.y + 0.02, CLOCK.z - 0.08),
    new Vector3(DIAL_X + 0.12, CLOCK.y, CLOCK.z),
  ],
  false,
  'centripetal'
);
// While the hands spin the clock sits in the left third of the frame (the
// year rolls on the right); the aim then closes onto the dial's centre.
const REWIND_LOOK = new CatmullRomCurve3(
  [
    new Vector3(...KEYS[KEYS.length - 1].look),
    new Vector3(-1.7, 2.8, -1.0),
    new Vector3(CLOCK.x, CLOCK.y, CLOCK.z - 0.55),
    new Vector3(CLOCK.x - 0.5, CLOCK.y, CLOCK.z),
    new Vector3(CLOCK.x - 1, CLOCK.y, CLOCK.z),
  ],
  false,
  'centripetal'
);
const FOV = 36;

// Chapter 1: the lecture hall (local positions from build_school.py, offset to
// SCHOOL_ORIGIN). The shot opens where the rewind ended: 0.12 m from a clock
// dial with the lens wide, now the hall's clock (facing -X). It pulls back
// over the rows to a high wide view, then comes in over his right shoulder to
// the laptop.
const SO = new Vector3(...SCHOOL_ORIGIN);
const at = (x: number, y: number, z: number) => new Vector3(x, y, z).add(SO);
const S_SEAT = at(...SCHOOL_SEAT);
const S_LID = at(...SCHOOL_LID);
// The middle of the keys (the typing sound's and glow's anchor).
const S_KEYS = at(
  SCHOOL_HINGE_X - 0.1,
  SCHOOL_DESK_Y + LAPTOP.base,
  SCHOOL_LID[2]
);
const S_DIAL_X = SCHOOL_CLOCK[0] - 0.0365;
const curve = (pts: Vector3[]) =>
  new CatmullRomCurve3(pts, false, 'centripetal');
// Out of the clock and turning round, low over the front of the hall, to meet
// him among the crowd from the stage side, the projector's beam pouring
// toward the lens; then down the right aisle and round to his right shoulder,
// over to the laptop. The hall is felt around him rather than surveyed.
const S_FACE = at(SCHOOL_SEAT[0] + 0.2, SCHOOL_SEAT[1] + 1.65, SCHOOL_SEAT[2]);
const SCHOOL_PULL = curve([
  at(S_DIAL_X - 0.12, SCHOOL_CLOCK[1], SCHOOL_CLOCK[2]),
  at(8.4, 3.9, 9.6),
  at(6.4, 3.0, 7.9),
  at(3.2, 2.5, 6.0),
  at(0.6, 2.35, 5.35),
]);
const SCHOOL_PULL_LOOK = curve([
  at(SCHOOL_CLOCK[0] + 1, SCHOOL_CLOCK[1], SCHOOL_CLOCK[2]),
  at(7.5, 3.4, 5.5),
  at(0.0, 2.2, 3.0),
  S_FACE.clone().add(new Vector3(1.2, 0.2, 0)),
  S_FACE.clone(),
]);
// It ends close over his right shoulder, the laptop's screen large in frame
// (the lens also tightens), his head a soft edge at the left: the chapter
// closes on his first program running, "Hello, Jongwoo!".
const S_END = at(
  SCHOOL_SEAT[0] - 0.5,
  SCHOOL_SEAT[1] + 2.24,
  SCHOOL_SEAT[2] + 0.78
);
const SCHOOL_PUSH = curve([
  at(0.6, 2.35, 5.35),
  at(-3.0, 2.55, 5.75),
  at(SCHOOL_SEAT[0] - 1.35, SCHOOL_SEAT[1] + 2.27, SCHOOL_SEAT[2] + 0.85),
  S_END,
]);
const SCHOOL_PUSH_LOOK = curve([
  S_FACE.clone(),
  S_FACE.clone().add(new Vector3(0.6, -0.2, 0)),
  S_LID.clone().add(new Vector3(0, 0.03, 0.06)),
  S_LID.clone().add(new Vector3(0, 0.02, 0.04)),
]);
// In the hall, the room's monitor light becomes the laptop's glow on his face
// and hair, and the room's lamp a faint fill behind him for the last shot (so
// his hair isn't a black mass); moved, not added, so no shader recompiles.
// Up and back from the screen, toward his face: right over the keys it
// blew his hands out white.
const S_GLOW = at(SCHOOL_LID[0] - 0.32, SCHOOL_LID[1] + 0.24, SCHOOL_LID[2]);
const S_BACKFILL = at(
  SCHOOL_SEAT[0] - 1.1,
  SCHOOL_SEAT[1] + 2.5,
  SCHOOL_SEAT[2] + 0.4
);
const ROOM_KEYS = new Vector3(-0.9, 0.95, -1.85);

// Into chapter 2: from the last shot, the camera rises over his right
// shoulder and comes round in front of him, square to the laptop's screen
// (the mail open on it), then pushes in until the mail's message fills the
// frame, and its white fades over everything. The screen leans back 14°: it
// faces him, tilted up (its right is +z, its up LID_UP). The push stops
// 0.42 m short: any closer, the lens's near plane cut into the tilted screen
// and showed the lid behind it, then the hall, as grey bands.
const LID_N = new Vector3(-Math.cos(0.244), Math.sin(0.244), 0),
  LID_UP = new Vector3(Math.sin(0.244), Math.cos(0.244), 0);
const MAIL_SQUARE = curve([
  S_END,
  at(SCHOOL_SEAT[0] + 0.1, SCHOOL_SEAT[1] + 2.15, SCHOOL_SEAT[2] + 0.62),
  S_LID.clone()
    .addScaledVector(LID_N, 0.6)
    .add(new Vector3(0, 0.04, 0)),
]);
// The message's body (drawMail: right of the list, below its header).
const MAIL_PAGE = S_LID.clone()
  .add(new Vector3(0, 0, 0.072))
  .addScaledVector(LID_UP, -0.012);
// A little above square, so it looks down past his hand on the keys.
const MAIL_DIVE_TO = MAIL_PAGE.clone()
  .addScaledVector(LID_N, 0.42)
  .addScaledVector(LID_UP, 0.09);

// Chapter 2: Neighbor's meeting room (office.ts, at OFFICE_ORIGIN). The shot
// opens, as the mail's white lifts, on the whiteboard straight on and moves
// straight in on the problem while he thinks. As he turns to talk it over it
// pulls back behind the engineers, onto him; it moves beside him, on
// the door's side, as he writes; and ends by the window, the board, him and
// the engineers behind the table all at once, as he turns back to them.
const OO = new Vector3(...OFFICE_ORIGIN);
const oat = (x: number, y: number, z: number) => new Vector3(x, y, z).add(OO);
// Chapter 3: the Marriott Center (arena.ts), at ARENA_ORIGIN.
const AO = new Vector3(...ARENA_ORIGIN);
const aat = (x: number, y: number, z: number) => new Vector3(x, y, z).add(AO);
// The camera: from close on the center-hung screen's face toward the floor's
// far end (the white lifts off it), back and up over the bowl, high in the
// far end's upper deck looking down the floor to the stage (as the user's
// photo); down to the floor's side aisle by the roped line; then with him.
// (From up under the roof, as if down through it out of the clouds.)
const ARENA_START = aat(-9, 33, 0),
  ARENA_START_LOOK = aat(-4.6, 22, 0),
  ARENA_HIGH = aat(-46, 25, -17),
  ARENA_HIGH_LOOK = aat(12, 1, -2),
  ARENA_DOWN = aat(10.5, 3.3, -18.5),
  ARENA_FOV = 50;
// His way across the stage (arena.ts WALK), its points and lengths.
const WALK_PTS = WALK.map((p) => aat(...p)),
  WALK_LEN = WALK_PTS.slice(1).map((p, i) => p.distanceTo(WALK_PTS[i])),
  WALK_TOTAL = WALK_LEN.reduce((a, b) => a + b, 0);
// Chapter 3 (the MISM's classroom, mism.ts, at MISM_ORIGIN). The white lifts
// off the room seen from high in its back-left corner, as in the user's
// photo, the case on the screens and the professor in the middle; the camera
// glides along there, then down over the tiers to him, over his right
// shoulder onto his laptop; then up behind him, the screens over his head.
// The way to Bridge (valley.ts, at VALLEY_ORIGIN): the camera along its path
// (centripetal Catmull-Rom, by arc length), looking straight down onto BYU
// at first, then ahead, then onto his window.
const VO = new Vector3(...VALLEY_ORIGIN),
  FLY_CURVE = new CatmullRomCurve3(
    FLY_PATH.map((p) => new Vector3(...p).add(VO)),
    false,
    'centripetal'
  ),
  FLY_CAMPUS = new Vector3(...START_LOOK).add(VO),
  FLY_WINDOW = new Vector3(...HIS_WINDOW).add(VO);

/** The near plane over the valley: a tenth of the camera's clearance (above
 *  the ground under it, less the campus's tallest; from Bridge's building),
 *  between 1 and 0.03 (at his window). (2026-11-20: at 0.03 the whole way,
 *  the depth buffer told apart only ~1.2 m at 110 units off, and surfaces
 *  a few metres apart could flicker; at 1, a few centimetres.) */
function flyNear(p: Vector3) {
  const x = p.x - VO.x,
    y = p.y - VO.y,
    z = p.z - VO.z,
    above = y - Math.max(0, valleyHeight(x, z)) - 2.5,
    bx = Math.max(0, Math.abs(x - BRIDGE_AT[0]) - BRIDGE_BOX.w / 2),
    bz = Math.max(0, Math.abs(z - BRIDGE_AT[1]) - BRIDGE_BOX.d / 2),
    by = Math.max(0, y - BRIDGE_BOX.floors * FLOOR_H);
  return MathUtils.clamp(
    Math.min(above, Math.hypot(bx, by, bz)) * 0.1,
    0.03,
    1
  );
}
const MO = new Vector3(...MISM_ORIGIN);
const mat_ = (x: number, y: number, z: number) => new Vector3(x, y, z).add(MO);
const M_SEAT = mat_(...MISM_SEAT),
  M_KEYS = mat_(...MISM_KEYS),
  M_LID = mat_(...MISM_LID),
  M_FWD = new Vector3(...MISM_FWD),
  M_RIGHT = new Vector3(...MISM_RIGHT);
const M_EST = mat_(-9.4, 4.25, -8.6),
  M_EST2 = mat_(-8.4, 3.9, -7.2),
  M_EST_LOOK = mat_(2.6, 0.7, 1.6),
  // Beside his right shoulder, looking down onto his laptop (from behind
  // his head, it filled the frame).
  M_SHOULDER = M_SEAT.clone()
    .addScaledVector(M_FWD, -0.12)
    .addScaledVector(M_RIGHT, 0.78)
    .add(new Vector3(0, 2.2, 0)),
  // Behind him, a little to his right and only a little above his head: his
  // head, shoulders and laptop low in the frame, the screens over (from
  // higher it saw only the top of his head).
  M_BEHIND = M_SEAT.clone()
    .addScaledVector(M_FWD, -2.2)
    .addScaledVector(M_RIGHT, 0.95)
    .add(new Vector3(0, 2.45, 0)),
  M_SCREENS_LOOK = mat_(MISM_FRONT, 1.75, 0),
  // Over him, just under the ceiling (CEIL 4.9), the way to Bridge going
  // up out of the room.
  M_ABOVE = M_SEAT.clone()
    .addScaledVector(M_FWD, 0.2)
    .setY(MO.y + 4.55),
  MISM_FOV = 46;
/** Where he is along his way (0..1), and which way he is going. */
function walkAt(t: number, at: Vector3, dir: Vector3) {
  let d = MathUtils.clamp(t, 0, 1) * WALK_TOTAL,
    i = 0;
  while (i < WALK_LEN.length - 1 && d > WALK_LEN[i]) d -= WALK_LEN[i++];
  const a = WALK_PTS[i],
    b = WALK_PTS[i + 1];
  at.copy(a).lerp(b, Math.min(1, d / WALK_LEN[i]));
  dir.copy(b).sub(a).setY(0).normalize();
}
// Leaving Neighbor (gradBeats), in two shots. A: he stops typing, rolls his
// chair back and stands (SitToStand, scrubbed), his hips held on the chair,
// then where he stands; his backpack by the desk beside him. Cut. B: he is
// already off down the aisle, his backpack on (the worn one, skinned to
// him), walking toward the entrance. (Taking the bag and slinging it on, by
// his filmed motion with the bag following his hands, looked staged.)
const SEAT_HIPS = oat(DESK.hero[0], 0, DESK.hero[2]),
  STAND_HIPS = oat(32.46, 0, 10.09);
// After the cut his way starts behind the camera, out of its sight: down the
// aisle between the window row and the double bench, past the camera on its
// right, curving round the bench's end toward the entrance (a smooth curve:
// on a polyline he snapped round at its corners).
const LEAVE_WAY = new CatmullRomCurve3(
    [
      oat(30.3, 0, 11.3),
      oat(30.4, 0, 16.6),
      oat(30.0, 0, 18.5),
      oat(28.7, 0, 19.4),
      oat(26.3, 0, 19.7),
    ],
    false,
    'centripetal'
  ),
  LEAVE_TOTAL = LEAVE_WAY.getLength();
// The camera: in the aisle at his right, a little behind, on him as he
// starts to get up (his bag by the desk in view); then it pans right to the
// windows, moving up to them (WIN_CAM, its heading from PAN_FROM to WIN_YAW,
// looking out level over the view), lingers there drifting (to WIN_YAW2)
// while night falls, and pans on round, back to the aisle (PAN_CAM), to look
// down it where he'll be (PAN_TO). Then it chases him
// along his own way, CHASE behind him and to his left (from PAN_CAM's 1.9 m
// off his way closing to an over-the-shoulder 0.7), turning with him; until
// that point on his way has passed PAN_CAM it holds there.
const LEAVE_CAM = oat(31.55, 2.05, 12.85),
  PAN_CAM = oat(32.3, 2.3, 12.85),
  WIN_CAM = oat(32.95, 1.95, 13.4),
  PAN_FROM = Math.atan2(32.46 - 31.55, 10.09 - 12.85),
  WIN_YAW = 1.75,
  WIN_YAW2 = 1.35,
  PAN_TO = Math.atan2(30.4 - 32.3, 18.5 - 12.85),
  CHASE = 3.2,
  // How far along his way PAN_CAM stands (m).
  PAN_AT = (() => {
    let best = 0,
      bd = Infinity;
    for (let i = 0; i <= 200; i++) {
      const d = LEAVE_WAY.getPointAt(i / 200).distanceTo(
        new Vector3(PAN_CAM.x, 0, PAN_CAM.z)
      );
      if (d < bd) [bd, best] = [d, i / 200];
    }
    return best * LEAVE_TOTAL;
  })();
/** A place along his way out, `d` metres from its start (before it, back
 *  along its first heading), and its heading and left (flat). */
function leaveAt(d: number, at: Vector3, dir: Vector3, left: Vector3) {
  const u = MathUtils.clamp(d / LEAVE_TOTAL, 0, 1);
  LEAVE_WAY.getPointAt(u, at);
  LEAVE_WAY.getTangentAt(u, dir).setY(0).normalize();
  if (d < 0) at.addScaledVector(dir, d);
  left.set(dir.z, 0, -dir.x);
}
// His backpack by the desk (backpack.glb, set down, 1.25x; front +x, width
// along z, base at 0): leaning back against the desk's leg panel at his
// right (its face toward the aisle, z 10.428), under the desk's top, its
// front pocket toward the aisle and the camera; clear of his legs. (Beside
// him on the floor it read as dropped there.)
const BAG_SCALE = 1.25,
  BAG_REST = oat(33.62, 0, 10.428 + 0.066 * 1.25 + 0.004),
  BAG_YAW = -Math.PI / 2;
const UP = new Vector3(0, 1, 0);
// One cycle of the Walking clip covers this much ground (1.55 m at the
// clip's scale, 1.38x): the clip is scrubbed by the distance he has come.
const WALK_CYCLE = 1.55 * 1.38;
const WIDE = oat(1.9, 2.45, -3.36),
  WIDE_LOOK = oat(1.45, 1.3, 0.7);
// The opening: the whiteboard straight on from the middle of the room,
// square to the chessboard (him at the right, by the code half), moving
// straight in on the problem; he slips out of frame as it closes in.
const PUSH_FROM = oat(BOARD.x - 4.4, 2.05, -0.8),
  PUSH_TO = oat(BOARD.x - 1.35, 1.95, -0.8),
  PUSH_LOOK_FROM = oat(BOARD.x, 1.97, -0.8),
  PUSH_LOOK_TO = oat(BOARD.x, 1.93, -0.8);
// As he turns to talk it over: back from the board, over the table, to
// behind the engineers: he turns from the board to face them (and the lens)
// and talks it over, their heads in the foreground (2026-10-13: it went
// round behind him onto their faces, and his turn and talking were lost).
// (From the door's side of the table, so his empty chair is clear of him.)
const TALK_CAM = oat(-3.6, 2.6, 1.6),
  TALK_LOOK = oat(AT_BOARD.x - 0.3, 1.75, 0.5);
const OFFICE_ACROSS = curve([PUSH_TO, oat(0.6, 2.2, -0.4), TALK_CAM]);
const OFFICE_ACROSS_LOOK = curve([
  PUSH_LOOK_TO,
  oat(BOARD.x - 0.2, 1.85, 0.0),
  TALK_LOOK,
]);
const OFFICE_SIDE = curve([
  TALK_CAM,
  oat(BOARD.x - 2.3, 2.25, 1.6),
  oat(BOARD.x - 2.65, 2.2, 2.95),
]);
const OFFICE_SIDE_LOOK = curve([
  TALK_LOOK,
  oat(BOARD.x - 0.4, 1.85, 0.6),
  oat(BOARD.x - 0.05, 1.98, 0.72),
]);
const OFFICE_END = curve([
  oat(BOARD.x - 2.65, 2.2, 2.95),
  oat(BOARD.x - 2.8, 2.2, 0.2),
  WIDE,
]);
const OFFICE_END_LOOK = curve([
  oat(BOARD.x - 0.05, 1.98, 0.72),
  oat(BOARD.x - 0.8, 1.75, 0.6),
  WIDE_LOOK,
]);
// His place: thinking and talking a step back from the board, writing at it.
const BOARD_YAW = Math.PI / 2; // facing the board (+x)
// Turned to the engineers (by way of the window, the shorter turn), the
// board still beside him; and done, from beside the board's right end.
const TALK_YAW = 2 * Math.PI - 1.74;
const DONE_YAW = 2 * Math.PI - 1.98;
const DONE_Z = 1.8; // beside the board's right end, by the door
// His grip on the marker (chapter 2), a fist around it: how far each index
// joint curls from straight (about its local +x; the three fingers Mixamo
// didn't rig follow the index), and the thumb wrapping over them, its tip on
// the index's middle joint (its base about +x, the rest about +z): axes and
// angles found by trying them on the rig in the browser. Scratch vectors for placing
// the marker.
const GRIP_INDEX = [1.25, 1.45, 1.0];
const GRIP_THUMB = [1.1, 1.1, 0.4];
const GRIP_INDEX_AXIS = new Vector3(1, 0, 0);
const GRIP_THUMB_AXES = [
  new Vector3(1, 0, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, 1),
];
const MK = {
  centre: new Vector3(),
  across: new Vector3(),
  along: new Vector3(),
  pinch: new Vector3(),
  dir: new Vector3(),
  p: new Vector3(),
  tip: new Vector3(),
  fix: new Vector3(),
  down: new Vector3(0, -1, 0),
  q: new Quaternion(),
  q2: new Quaternion(),
};
// Where the marker's tip is, from the middle of his fist (out of its thumb
// side), and how far the fist's middle sits from the index toward the
// little finger.
const MARKER_TIP = 0.101;
const FIST_IN = 0.035;
// Writing (Pointing's hand): how far the marker's tip reaches past his
// index fingertip, and how much the index curls in over it.
const POINT_PAST = 0.05;
const POINT_CURL = 0.25;
// Hired, on the way to his desk (office-local, by desk progress): from the
// closing shot by the window to the glass door and through it, quickly out
// over the corridor to the east windows; there, looking out, it glides
// slowly along them while a day passes outside (the sunset's colours, the
// night with the moon and the Milky Way, dawn and the sun up over the
// Wasatch); then it turns and comes down over his shoulder at his desk
// (office.ts DESK), his monitor beyond his head. (2026-10-15: it had flown
// straight to his desk looking down, the windows a thin band at the top.)
const DESK_HERO = oat(...DESK.hero);
const DESK_KEYS_AT = [0.04, 0.09, 0.13, 0.19, 0.25, 0.56, 0.62, 0.68];
const DESK_PATH = curve([
  oat(1.9, 2.45, -3.36),
  oat(1.85, 2.15, 1.6),
  oat(1.85, 2.0, 4.8),
  oat(16.0, 2.5, 14.0),
  oat(31.5, 2.35, 22.0),
  oat(34.0, 2.3, 15.5),
  oat(32.82, 2.35, 12.9),
  oat(30.97, 2.3, 11.55),
]);
const DESK_LOOK = curve([
  oat(1.45, 1.3, 0.7),
  oat(1.85, 1.7, 6.5),
  oat(6.0, 1.9, 9.5),
  oat(40.0, 3.0, 18.0),
  oat(120.0, 8.0, 18.0),
  oat(120.0, 7.0, -8.0),
  oat(35.22, 1.6, 10.5),
  oat(33.67, 1.4, 9.8),
]);
/** Where the camera is along its way (the curves' parameter), by desk
 *  progress: each leg between keys takes its own share of the scroll. */
function deskLeg(d: number) {
  const k = DESK_KEYS_AT,
    n = k.length - 1;
  if (d <= k[0]) return 0;
  for (let i = 0; i < n; i++)
    if (d <= k[i + 1]) return (i + (d - k[i]) / (k[i + 1] - k[i])) / n;
  return 1;
}
// Tall screens: further back and higher behind him.
const DESK_TALL = oat(30.12, 2.65, 12.2);
const DESK_KEYS = oat(...DESK.keys);
const WHITE = new Color(1, 1, 1);
// How far right of the keyboard's middle his right wrist is on the trackpad
// (measured over the Typing clip at his desk: 0.14 on the keys, 0.43 on the
// trackpad).
const MOUSE_RIGHT = 0.27;
// His desk's lights: the fill aims at him.
const DESK_AIM = oat(33.02, 1.15, 10.0);
// The meeting room's lens: a little wider than the other chapters' (a small
// room, the engineers close).
const OFFICE_FOV = 56;
// Where the stage wash comes from in the hall (above the back rows).
const STAGE_WASH_FROM = new Vector3(-8, 10, 4);

function cameraAt(p: number, pos: Vector3, look: Vector3, next: Vector3) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].at) i++;
  const a = KEYS[i],
    b = KEYS[i + 1],
    t = MathUtils.smoothstep(p, a.at, b.at);
  pos.fromArray(a.pos).lerp(next.fromArray(b.pos), t);
  look.fromArray(a.look).lerp(next.fromArray(b.look), t);
}

/** A light's shadow map redrawn each frame and applied, or left as it is and
 *  not applied (see the end of lights()). */
function shadowOn(light: PointLight | DirectionalLight | null, on: boolean) {
  if (!light || light.shadow.autoUpdate === on) return;
  light.shadow.autoUpdate = on;
  light.shadow.intensity = on ? 1 : 0;
}

/**
 * The backpack's cloth textures (a 1024 colour map and a 2048 normal map)
 * are built into every place's model as well as the bag's own, byte for
 * byte the same (checked 2026-11-20): the room, the hall, the office and the
 * classroom each held a copy on the GPU, about 110 MB in all. Each place's
 * copy is swapped for the bag's own (same name, same size), and let go.
 */
function shareBagTextures(root: Object3D, bag: Object3D) {
  const FABRIC = 'Backpack fabric';
  let own: MeshStandardMaterial | null = null;
  bag.traverse((o) => {
    const m = (o as Mesh).material;
    if (!own && m && !Array.isArray(m) && m.name === FABRIC)
      own = m as MeshStandardMaterial;
  });
  const shared = own as MeshStandardMaterial | null;
  if (!shared) return;
  root.traverse((o) => {
    const m = (o as Mesh).material;
    for (const mat of (Array.isArray(m) ? m : m ? [m] : []) as Material[]) {
      if (mat.name !== FABRIC || mat === shared) continue;
      const s = mat as MeshStandardMaterial;
      for (const key of ['map', 'normalMap'] as const) {
        const copy = s[key],
          to = shared[key];
        if (!copy || !to || copy === to) continue;
        const a = copy.image as { width?: number; height?: number } | null,
          b = to.image as { width?: number; height?: number } | null;
        if (a?.width !== b?.width || a?.height !== b?.height) continue;
        s[key] = to;
        copy.dispose();
      }
    }
  });
}

function shadows(root: Object3D) {
  root.traverse((o) => {
    if ((o as Mesh).isMesh) {
      // The backpack's contact-shadow decal would cast a dark square.
      o.castShadow =
        !/Window sky|Monitor glow|Floor/.test(o.name) &&
        !((o as Mesh).material as Material).name?.startsWith('Contact shadow');
      o.receiveShadow = true;
    }
  });
}

export function RoomScene({
  progress,
  rewind,
  school,
  mail,
  office,
  desk: deskProgress,
  grad,
  arena,
  mism,
  fly,
  pointer,
  reduced,
  audio,
  onReady,
}: {
  progress: RefObject<number>;
  /** 0..1 through the rewind into the next chapter (see story.ts). */
  rewind: RefObject<number>;
  /** 0..1 through chapter 1, the lecture hall. */
  school: RefObject<number>;
  /** 0..1 through the mail into chapter 2. */
  mail: RefObject<number>;
  /** 0..1 through chapter 2, the interview at Neighbor. */
  office: RefObject<number>;
  /** 0..1 through the way to his desk, hired. */
  desk: RefObject<number>;
  /** 0..1 through the admission mail into chapter 3. */
  grad: RefObject<number>;
  /** 0..1 through chapter 3, the commencement (out of the flow). */
  arena: RefObject<number>;
  /** 0..1 through chapter 3, the MISM's classroom. */
  mism: RefObject<number>;
  /** 0..1 through the way to Bridge: up out of the classroom, over Utah
   *  Valley to Lehi (into chapter 4). */
  fly: RefObject<number>;
  /** Pointer position over the page, -1..1 each way, for a gentle parallax. */
  pointer: RefObject<{ x: number; y: number }>;
  audio: RefObject<RoomAudio | null>;
  reduced: boolean;
  /** Called once every place is in and has been drawn once (the warm-up,
   *  behind the loader). */
  onReady?: () => void;
}) {
  const room = useGLTF(ROOM);
  const hero = useGLTF(HERO, DRACO);
  const heroLod = useLoader(HeroLodLoader, HERO_LOD);
  // Before any frame draws him (or uploads his full index for nothing).
  useLayoutEffect(
    () => applyHeroLod(hero.scene, heroLod),
    [hero.scene, heroLod]
  );
  // His bookcase (210 small meshes) drawn a material at a time, before any
  // frame (mergeByMaterial). Its speaker stays as built: SpeakerViz finds
  // it by name.
  useLayoutEffect(() => {
    shadows(room.scene);
    const shelf = room.scene.getObjectByName('Bookcase');
    if (shelf) mergeByMaterial(shelf, (o) => o.name.startsWith('Speaker'));
  }, [room.scene]);
  const bagGltf = useGLTF(BAG, DRACO);
  const bagObjects = useMemo(() => {
    const find = (re: RegExp) => {
      let hit: Object3D | null = null;
      bagGltf.scene.traverse((o) => {
        if (!hit && re.test(o.name)) hit = o;
      });
      if (!hit) throw new Error(`Missing ${re}`);
      return hit as Object3D;
    };
    // A copy (sharing its geometry and materials): mounted as a primitive,
    // the bag itself would be taken out of the cached GLTF's scene, and a
    // remount (back to this page, a hot reload) would no longer find it.
    const down = find(/^Backpack$/).clone();
    down.position.set(0, 0, 0);
    down.traverse((m) => {
      if ((m as Mesh).isMesh) m.castShadow = m.receiveShadow = true;
    });
    return { down };
  }, [bagGltf.scene]);
  const bagDown = useRef<Group>(null);
  const fill = useRef<DirectionalLight>(null),
    sun = useRef<DirectionalLight>(null),
    hemi = useRef<HemisphereLight>(null),
    ambient = useRef<AmbientLight>(null),
    windowGlow = useRef<RectAreaLight>(null),
    lamp = useRef<PointLight>(null),
    monitor = useRef<PointLight>(null),
    screenGlow = useRef<RectAreaLight>(null);
  const sunTarget = useMemo(() => {
    const o = new Object3D();
    o.position.copy(SO).add(new Vector3(...SUN_TO));
    return o;
  }, []);
  const stageTarget = useMemo(() => {
    const o = new Object3D();
    o.position.copy(SO).add(new Vector3(FRONT_X, 3.0, 0));
    return o;
  }, []);
  const body = useRef<Group>(null),
    chair = useRef<Object3D | null>(null);
  const mixer = useMemo(() => new AnimationMixer(hero.scene), [hero.scene]);
  const actions = useRef<
    | (Record<
        'type' | 'keys' | 'rise' | 'idle' | 'wave',
        AnimationAction
      > &
        Record<
          'think' | 'talk' | 'calm' | 'walk',
          AnimationAction | null
        >)
    | null
  >(null);
  // What the hands are doing at the desk, read by the monitor (Screen).
  const desk = useRef<Desk>({
      active: 1,
      mouse: false,
      hand: new Vector3(),
      keys: ROOM_KEYS.clone(),
    }),
    rightHand = useRef<Object3D | null>(null);
  // His interchangeable parts (build_web_glb.py: feet.py, face_parts.py):
  // socks and slippers at home, sneakers in the hall; the lids that blink,
  // decals over his painted eyes.
  const parts = useRef<Record<
    'sneakers' | 'socks' | 'slippers' | 'lidsHalf' | 'lidsShut' | 'wornBag',
    Object3D
  > | null>(null);
  const blink = useRef({ start: -1, next: 2.5 });
  // Chapter 3's notes on his laptop (MismScene draws `typed`): typed out on
  // a clock as long as he is in the classroom (t), read over, and typed
  // again; his hands and the typing sound follow them (rest: 1 while the
  // notes stand complete).
  const notes = useRef({ t: 0, typed: 0, rest: 0 });
  // His head, for its sway once he stops typing (see headSway below): the
  // pose it had before the sway, and whether the sway is on it.
  const headBone = useRef<Object3D | null>(null);
  // Bones the frame's own touches move (his head's sway and looks, his
  // writing arm), each with the pose it had before them: the mixer only
  // rewrites a bone whose value changed, so each frame they are put back
  // first (restoreBones), never added to the last frame's.
  const touched = useRef<{ bone: Object3D; q: Quaternion; on: boolean }[]>([]);
  // Chapter 2: the marker's place on the board (OfficeScene), his head for
  // the engineers' eyes (office-local), the marker in his hand, his writing
  // arm.
  const tip = useRef<BoardTip>({ on: false, at: new Vector3() }),
    headLocal = useRef(new Vector3()),
    heldMarker = useRef<Group>(null),
    arm = useRef<{
      upper: Object3D;
      fore: Object3D;
      hand: Object3D;
      /** Index 1-4 and thumb 1-3 (the other fingers follow the index). */
      index: Object3D[];
      thumb: Object3D[];
      /** Their rest (bind) rotations, open and straight: the grip curls them
       *  from there. */
      rest: Quaternion[];
      /** Mixamo's Pointing, held where he points (arm, hand, index 1-3,
       *  thumb 1-3), if downloaded: his writing hand's shape. */
      point: Quaternion[] | null;
    } | null>(null);
  const onTip = useMemo(
    () => (on: boolean, at: Vector3) => {
      const t = tip.current;
      t.on = on;
      if (on) t.at.copy(at);
    },
    []
  );
  const officeGroup = useRef<Group>(null),
    roomGroup = useRef<Group>(null),
    // The lecture hall: hidden in Neighbor's office (it stands 180 m east
    // of it, and the east windows looked straight at it).
    schoolGroup = useRef<Group>(null),
    arenaGroup = useRef<Group>(null),
    diploma = useRef<Group>(null),
    mismGroup = useRef<Group>(null),
    // Utah Valley, the way to Bridge (chapter 4's way in).
    valleyGroup = useRef<Group>(null),
    spineBone = useRef<Object3D | null>(null),
    // His hips (leaving: where they land, and the camera's aim).
    hipsBone = useRef<Object3D | null>(null);
  // Every place is in from the start, behind the loader, and drawn there
  // once (warmUp). They used to come in as the story neared them (the office
  // once the hall was under way, the classroom at his desk), and each one's
  // arrival and first frame froze the scroll for 0.3-2 s. The arena (out of
  // the flow) still comes in at his desk.
  const [arenaOn, setArenaOn] = useState(false);
  const tmp = useMemo(
    () => ({
      pos: new Vector3(),
      look: new Vector3(),
      cam: new Vector3(),
      right: new Vector3(),
      up: new Vector3(),
      sway: { x: 0, y: 0 },
      // Where he faced when the rewind began; he turns from there to the clock.
      faceFrom: null as number | null,
      school: false, // which scene the camera was in last frame
      office: false,
      // On the way to his desk: where the camera is along its path (eased;
      // -1 off it).
      flyT: -1,
      arena: false, // the camera was in the arena last frame
      mism: false, // ... in the classroom
      fly: false, // ... over the valley
      // Leaving: the camera's aim on him, and turned away (the pan).
      e: new Vector3(),
      f: new Vector3(),
      walked: 0,
      arenaYaw: Math.PI / 2,
      // Chapter 2: where he stands along the board (eased), the marker's
      // last place, scratch vectors and quaternions for the arm.
      officeZ: AT_BOARD.z,
      lastTip: new Vector3(),
      a: new Vector3(),
      b: new Vector3(),
      c: new Vector3(),
      d: new Vector3(),
      q: new Quaternion(),
      q2: new Quaternion(),
      target: new Vector3(),
      pole: new Vector3(),
    }),
    []
  );

  useEffect(() => {
    shadows(room.scene);
    shadows(hero.scene);
    const part = (name: string, decal = false) => {
      const o = hero.scene.getObjectByName(name);
      if (!o) throw new Error(`Missing part ${name}`);
      o.traverse((m) => {
        if (!(m as Mesh).isMesh) return;
        // Small skinned parts: their bind-pose bounds don't follow the pose.
        m.frustumCulled = false;
        if (!decal) return;
        // Half a millimetre off his face: drawn over it, never into it, and
        // casting no shadow onto it.
        m.castShadow = false;
        m.renderOrder = 1;
        const mat = (m as Mesh).material as MeshStandardMaterial;
        mat.transparent = true;
        mat.depthWrite = false;
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = -2;
        mat.polygonOffsetUnits = -2;
      });
      return o;
    };
    headBone.current = hero.scene.getObjectByName('mixamorigHead') ?? null;
    spineBone.current = hero.scene.getObjectByName('mixamorigSpine2') ?? null;
    hipsBone.current = hero.scene.getObjectByName('mixamorigHips') ?? null;
    const bone = (name: string) => {
      const b = hero.scene.getObjectByName(`mixamorig${name}`);
      if (!b) throw new Error(`Missing bone ${name}`);
      return b;
    };
    arm.current = {
      upper: bone('RightArm'),
      fore: bone('RightForeArm'),
      hand: bone('RightHand'),
      index: [1, 2, 3, 4].map((i) => bone(`RightHandIndex${i}`)),
      thumb: [1, 2, 3].map((i) => bone(`RightHandThumb${i}`)),
      rest: [],
      point: null,
    };
    // The fingers' rest rotations, from the skin's bind matrices.
    let skeleton: Skeleton | null = null;
    hero.scene.traverse((o) => {
      if (!skeleton && (o as SkinnedMesh).isSkinnedMesh)
        skeleton = (o as SkinnedMesh).skeleton;
    });
    const skel = skeleton as Skeleton | null;
    const bindOf = (b: Object3D) => {
      const i = skel ? skel.bones.indexOf(b as never) : -1;
      return i < 0 || !skel
        ? null
        : new Matrix4().copy(skel.boneInverses[i]).invert();
    };
    const gripBones = [...arm.current.index.slice(0, 3), ...arm.current.thumb];
    arm.current.rest = gripBones.map((b) => {
      const own = bindOf(b),
        parent = b.parent && bindOf(b.parent);
      if (!own || !parent) return b.quaternion.clone();
      const q = new Quaternion();
      parent.invert().multiply(own).decompose(new Vector3(), q, new Vector3());
      return q;
    });
    // Pointing at its fullest (frame 30 of 84), for the bones he writes
    // with: sampled once from its tracks.
    const pointing = hero.animations.find((a) => a.name === 'Pointing');
    if (pointing) {
      const at = (29 / 83) * pointing.duration;
      arm.current.point = [
        arm.current.upper,
        arm.current.fore,
        arm.current.hand,
        ...gripBones,
      ].map((b) => {
        const track = pointing.tracks.find(
          (t) => t.name === `${b.name}.quaternion`
        );
        if (!track) return b.quaternion.clone();
        // Its key at (or just after) that time.
        const k = Math.max(
            0,
            track.times.findIndex((t) => t >= at - 1e-4)
          ),
          v = track.values;
        return new Quaternion(
          v[k * 4],
          v[k * 4 + 1],
          v[k * 4 + 2],
          v[k * 4 + 3]
        ).normalize();
      });
    }
    touched.current = [
      bone('Head'),
      arm.current.upper,
      arm.current.fore,
      arm.current.hand,
      ...gripBones,
    ].map((b) => ({ bone: b, q: new Quaternion(), on: false }));
    parts.current = {
      sneakers: part('Sneakers'),
      socks: part('Socks'),
      slippers: part('Slippers'),
      lidsHalf: part('LidsHalf', true),
      lidsShut: part('LidsShut', true),
      // His backpack as he wears it, skinned to him (worn_backpack.py).
      wornBag: part(
        hero.scene.getObjectByName('Backpack_worn')
          ? 'Backpack_worn'
          : 'Backpack worn'
      ),
    };

    chair.current = room.scene.getObjectByName('Chair') ?? null;
    rightHand.current =
      hero.scene.getObjectByName('mixamorigRightHand') ?? null;
    chair.current?.position.set(SEAT.x, 0, SEAT.z);
    const clip = (name: string, loop = true) => {
      const c = hero.animations.find((a) => a.name === name);
      if (!c) throw new Error(`Missing clip ${name}`);
      const action = mixer.clipAction(c);
      if (loop) action.setLoop(LoopRepeat, Infinity);
      return action.play();
    };
    const rise = clip('SitToStand', false);
    rise.paused = true; // driven by scroll, not by time
    // On the laptop in the lecture hall there is no mouse: loop only the part
    // of the Typing clip where both hands stay on the keys (frames 72-186 at
    // 24 fps, measured; the hands are in nearly the same place at both ends).
    const typing = hero.animations.find((a) => a.name === 'Typing');
    if (!typing) throw new Error('Missing clip Typing');
    const keys = mixer
      .clipAction(AnimationUtils.subclip(typing, 'TypingKeys', 72, 186, 24))
      .setLoop(LoopRepeat, Infinity)
      .play();
    keys.setEffectiveWeight(0);
    // (Chapter 3's hand going up, Mixamo's Hand Raising over this loop split
    // at his right arm, was cut on 2026-11-19; the clip is still in the GLB.)
    // Chapter 2's thinking and talking at the board, if downloaded (else he
    // stands in his idle).
    const optional = (name: string) =>
      hero.animations.some((a) => a.name === name) ? clip(name) : null;
    actions.current = {
      keys,
      type: clip('Typing'),
      rise,
      idle: clip('HappyIdle'),
      wave: clip('Waving'),
      think: optional('Thinking'),
      // Mixamo's Breathing Idle: his stance at the board (HappyIdle bobbed).
      calm: optional('Idle'),
      // Chapter 3: across the stage (Mixamo's Walking, in place), if there.
      walk: optional('Walking'),
      // Turned to the engineers, he nods as he talks it over (Mixamo's Head
      // Nod Yes; Talking tossed its head about and read as arguing).
      talk: optional('HeadNod'),
    };
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(hero.scene);
    };
  }, [room.scene, hero.scene, hero.animations, mixer]);

  /** Evening in the room, the dim auditorium, or the bright meeting room
   *  (intensities, colours and places only, so no shader recompiles when the
   *  scenes swap under the cream or the white). */
  const day = useMemo(
    () => ({
      on: null as Place | null,
      roomTarget: null as Object3D | null,
      night: {
        sky: new Color('#4a5784'),
        ground: new Color('#2a2028'),
        amb: new Color('#8a96c8'),
      },
      // The windowless auditorium: house lights dimmed, the slide glowing.
      hall: {
        sky: new Color('#7f88a0'),
        ground: new Color('#2b2c31'),
        amb: new Color('#c9cfe0'),
      },
      // Early afternoon, all white: the sky through the window, the carpet
      // and walls bouncing it back.
      office: {
        sky: new Color('#dbe7f5'),
        ground: new Color('#cfc8bd'),
        amb: new Color('#f4f6fa'),
      },
    }),
    []
  );
  const officeSunTarget = useMemo(() => {
    const t = new Object3D();
    t.position.copy(OO).add(new Vector3(...OFFICE_SUN_TO));
    return t;
  }, []);
  const officeFillTarget = useMemo(() => {
    const t = new Object3D();
    t.position.copy(OO).add(new Vector3(BOARD.x - 0.6, 1.6, 0.3));
    return t;
  }, []);
  const arenaTarget = useMemo(() => {
    const t = new Object3D();
    t.position.copy(AO).add(new Vector3(21, 1, -3));
    return t;
  }, []);
  const mismTarget = useMemo(() => {
    const t = new Object3D();
    t.position.copy(MO).add(new Vector3(-4, 1, 0));
    return t;
  }, []);
  const deskFillTarget = useMemo(() => {
    const t = new Object3D();
    t.position.copy(DESK_AIM);
    return t;
  }, []);
  const lights = (
    place: Place,
    toIdle: number,
    push: number,
    deskLight = 0,
    dayP = 0
  ) => {
    if (place === 'fly') {
      // Over the valley the light is its own (in ValleyScene's shaders):
      // the scene's lights are out and their maps not drawn. (placeLights
      // sets them again on the way back.)
      for (const l of [
        fill,
        sun,
        hemi,
        ambient,
        windowGlow,
        lamp,
        monitor,
        screenGlow,
      ])
        if (l.current) l.current.intensity = 0;
      day.on = place;
      shadowOn(lamp.current, false);
      shadowOn(sun.current, false);
      return;
    }
    const inSchool = place === 'hall',
      atDesk = place === 'desk',
      inOffice = place === 'office' || atDesk;
    if (fill.current)
      fill.current.intensity =
        place === 'arena'
          ? 0.6
          : inOffice
            ? 0.55
            : inSchool
              ? 0.6
              : 0.35 + 0.35 * toIdle;
    if (inSchool) {
      if (monitor.current) monitor.current.intensity = 0.6 * push * push;
      if (lamp.current) lamp.current.intensity = 0.3 * push;
    }
    if (day.on !== place) {
      day.on = place;
      placeLights(place);
    }
    // On the way to his desk the meeting room's sun fades as the camera
    // leaves it, and his desk's lights come up (intensities only).
    if (inOffice) {
      const k = deskLight;
      if (sun.current) sun.current.intensity = 2.4 * (1 - k);
      if (atDesk) {
        // The east windows' daylight, following the day passing outside
        // (dim and blue at night, warm at dusk and dawn).
        if (windowGlow.current) {
          windowGlow.current.intensity = 4.5 * k * (0.1 + 0.9 * daylight(dayP));
          landTint(dayP, windowGlow.current.color).lerp(WHITE, 0.35);
        }
        if (screenGlow.current) screenGlow.current.intensity = 2.0 * k;
        if (lamp.current) lamp.current.intensity = 1.8 * k;
        if (monitor.current) monitor.current.intensity = 0.8 * k;
      }
    }
    // Each shadow map is redrawn only where it shows. Measured 2026-11-19
    // by rendering each spot with a map's shadow and without:
    // - The lamp's cube map (six passes a frame) changes 14-21 % of the
    //   pixels in his room, and at most 0.17 % anywhere else. In the hall
    //   the lamp is at zero, yet its six passes drew the classmates.
    // - The sun's map changes nothing in his room or at his desk (the sun
    //   is at zero there), and 4-53 % in the hall, the office and the
    //   classroom.
    // Where a map is not redrawn, it is also not applied (its shadow
    // intensity is 0), so a stale map never shows. Both lights keep
    // castShadow, so the light setup, and every shader program, stays the
    // same.
    shadowOn(lamp.current, place === 'room' || place === 'arena');
    shadowOn(
      sun.current,
      place !== 'room' && (sun.current?.intensity ?? 0) > 0.01
    );
  };
  /** Where the lights stand, per place (positions and colours). */
  const placeLights = (place: Place) => {
    const inSchool = place === 'hall',
      atDesk = place === 'desk',
      inOffice = place === 'office' || atDesk;
    // In the hall the room's front fill becomes a soft stage wash from above
    // the back rows, lighting the whiteboards, stage and lectern; in the
    // office a soft light from the door's side onto him and the board.
    const f = fill.current;
    if (f) {
      day.roomTarget ??= f.target;
      if (inSchool) {
        f.position.copy(SO).add(STAGE_WASH_FROM);
        f.target = stageTarget;
      } else if (atDesk) {
        f.position.copy(OO).add(new Vector3(30.62, 3.3, 12.3));
        f.target = deskFillTarget;
      } else if (inOffice) {
        f.position.copy(OO).add(new Vector3(-1.0, 3.4, 4.5));
        f.target = officeFillTarget;
      } else {
        f.position.set(4, 3, 7);
        f.target = day.roomTarget;
      }
    }
    const c = inOffice ? day.office : inSchool ? day.hall : day.night;
    if (hemi.current) {
      hemi.current.color.copy(c.sky);
      hemi.current.groundColor.copy(c.ground);
      hemi.current.intensity = inOffice ? 1.05 : inSchool ? 0.6 : 0.34;
    }
    if (ambient.current) {
      ambient.current.color.copy(c.amb);
      ambient.current.intensity = inOffice ? 0.3 : inSchool ? 0.12 : 0.07;
    }
    // The room's window glow becomes the office window's daylight, pouring
    // in across the room.
    // Dark, an area light is hidden: it costs every lit pixel its full
    // shading all the same (2026-11-20: his room ran 94 fps with both, 171
    // with neither, at a pixel ratio of 1.75). The hall has no window glow,
    // his room no screen glow; everywhere else both are lit. (The warm-up
    // compiles for both setups.)
    const wg = windowGlow.current;
    if (wg) {
      wg.visible = place !== 'hall';
      wg.intensity = inOffice ? 5.5 : inSchool ? 0 : 3.2;
      wg.color.set(inOffice ? '#eef4ff' : '#ff9a5c');
      wg.rotation.set(0, atDesk ? Math.PI / 2 : Math.PI, 0);
      if (atDesk) {
        // The east windows beside his desk, facing in across it.
        wg.position.copy(OO).add(new Vector3(37.1, 1.8, 10.0));
        wg.width = 7;
        wg.height = 2.8;
      } else if (inOffice) {
        wg.position.copy(OO).add(new Vector3(0, 1.8, -OFFICE_ROOM.hz + 0.05));
        wg.width = 2 * OFFICE_ROOM.hx - 0.4;
        wg.height = 3.3;
      } else {
        wg.position.set(-0.9, 2.55, -2.62);
        wg.width = 2.2;
        wg.height = 1.5;
      }
    }
    if (lamp.current) {
      const l = lamp.current;
      l.intensity = inOffice ? 2.2 : inSchool ? 0 : 6;
      if (atDesk) l.position.copy(OO).add(new Vector3(32.22, 3.1, 11.5));
      else if (inOffice)
        l.position.copy(OO).add(new Vector3(BOARD.x - 2.4, 3.1, 0.6));
      else if (inSchool) l.position.copy(S_BACKFILL);
      else l.position.set(-2.5, 1.95, -1.95);
      l.color.set(inOffice ? '#fff6ea' : inSchool ? '#ffe6cc' : '#ffa45c');
      l.distance = inOffice ? 9 : inSchool ? 4 : 9;
    }
    if (monitor.current) {
      const m = monitor.current;
      m.intensity = inSchool || inOffice ? 0 : 3.5;
      // At his desk: his monitor's glow on his face and hands.
      if (atDesk) m.position.copy(OO).add(new Vector3(33.57, 1.4, 9.99));
      else if (inSchool) m.position.copy(S_GLOW);
      else m.position.set(-0.9, 1.45, -1.95);
    }
    // The sun: the hall's dim house light, or the afternoon sun through the
    // office window (soft mullion shadows across the floor and table).
    const sn = sun.current;
    if (sn) {
      sn.intensity = inOffice ? 2.4 : inSchool ? 0.75 : 0;
      sn.color.set(inOffice ? '#fff1dc' : '#ffe9cc');
      if (inOffice) {
        sn.position.copy(OO).add(new Vector3(...OFFICE_SUN_FROM));
        sn.target = officeSunTarget;
      } else {
        sn.position.set(SO.x + SUN_FROM[0], SUN_FROM[1], SUN_FROM[2]);
        sn.target = sunTarget;
      }
    }
    // A soft spill from the screen over the seats; strong enough to pool a
    // glowing patch on the stage in front of it, so it stays low. In the
    // office: the ceiling's LED panels, a broad soft light from above.
    const sg = screenGlow.current;
    if (sg) {
      sg.visible = place !== 'room';
      sg.intensity = inOffice ? 2.6 : inSchool ? 2.2 : 0;
      if (atDesk) {
        sg.position
          .copy(OO)
          .add(new Vector3(33.42, OFFICE_ROOM.h - 0.05, 10.0));
        sg.rotation.set(-Math.PI / 2, 0, 0);
        sg.width = 5;
        sg.height = 3;
        sg.color.set('#fffaf2');
      } else if (inOffice) {
        sg.position.copy(OO).add(new Vector3(0, OFFICE_ROOM.h - 0.05, 0));
        sg.rotation.set(-Math.PI / 2, 0, 0);
        sg.width = 2 * OFFICE_ROOM.hx - 2;
        sg.height = 2.6;
        sg.color.set('#fffaf2');
      } else {
        sg.position.set(SO.x + SLIDE.x - 0.15, SLIDE.y, SLIDE.z);
        sg.rotation.set(0, Math.PI / 2, 0);
        sg.width = SLIDE.w;
        sg.height = SLIDE.h;
        sg.color.set('#dde5ff');
      }
    }
    if (place === 'arena') arenaLights();
    if (place === 'mism') mismLights();
  };
  /** The classroom by day: its LED panels on, bright and even (the
   *  hemisphere, the ambient, a broad rect light from the ceiling over the
   *  tiers), the key from above the front floor with soft shadows, the
   *  screens' light on the room, his laptop's on his face. */
  const mismLights = () => {
    if (hemi.current) {
      hemi.current.color.set('#f6f1e6');
      hemi.current.groundColor.set('#6d665a');
      hemi.current.intensity = 1.0;
    }
    if (ambient.current) {
      ambient.current.color.set('#efe9dc');
      ambient.current.intensity = 0.32;
    }
    const sg = screenGlow.current;
    if (sg) {
      sg.position.copy(MO).add(new Vector3(-4, 4.85, 0));
      sg.rotation.set(-Math.PI / 2, 0, 0);
      sg.width = 14;
      sg.height = 18;
      sg.color.set('#fffaf0');
      sg.intensity = 2.2;
    }
    const wg = windowGlow.current;
    if (wg) {
      // The screens' light, from the front wall over the room.
      wg.position.copy(MO).add(new Vector3(MISM_FRONT - 0.1, 2.5, 0));
      wg.rotation.set(0, -Math.PI / 2, 0);
      wg.width = 12;
      wg.height = 2.6;
      wg.color.set('#e8eeff');
      wg.intensity = 1.2;
    }
    const sn = sun.current;
    if (sn) {
      sn.position.copy(MO).add(new Vector3(2, 9, -3));
      sn.target = mismTarget;
      sn.color.set('#fff6ea');
      sn.intensity = 1.1;
    }
    const f = fill.current;
    if (f) {
      f.position.copy(MO).add(new Vector3(-10, 4, 6));
      f.target = mismTarget;
      f.intensity = 0.35;
    }
    if (lamp.current) lamp.current.intensity = 0;
    if (monitor.current) {
      const m = monitor.current;
      m.position.copy(M_LID).addScaledVector(M_FWD, -0.15);
      m.intensity = 0.5;
    }
  };
  /** The Marriott Center for commencement: the house lights on, warm and
   *  even (the hemisphere, the ambient, the roof's rect light over the
   *  floor), the stage lit brighter from the front (a broad rect light from
   *  over the floor, the key with soft shadows from above its front, the
   *  fill from the audience's side, a warm spot over the presenter). */
  const arenaLights = () => {
    if (hemi.current) {
      hemi.current.color.set('#d6deef');
      hemi.current.groundColor.set('#3a3f52');
      hemi.current.intensity = 0.55;
    }
    if (ambient.current) {
      ambient.current.color.set('#c9d0e6');
      ambient.current.intensity = 0.14;
    }
    const wg = windowGlow.current;
    if (wg) {
      wg.position.copy(AO).add(new Vector3(0, 30, 0));
      wg.rotation.set(-Math.PI / 2, 0, 0);
      wg.width = 70;
      wg.height = 50;
      wg.color.set('#fff3e0');
      wg.intensity = 1.2;
    }
    const sg = screenGlow.current;
    if (sg) {
      sg.position.copy(AO).add(new Vector3(12, 11, 0));
      sg.lookAt(tmp.d.copy(AO).add(new Vector3(24, 2, 0)));
      sg.width = 24;
      sg.height = 8;
      sg.color.set('#fff6ea');
      sg.intensity = 4.5;
    }
    const sn = sun.current;
    if (sn) {
      sn.position.copy(AO).add(new Vector3(8, 30, -10));
      sn.target = arenaTarget;
      sn.color.set('#fff1dc');
      sn.intensity = 2.0;
    }
    const f = fill.current;
    if (f) {
      f.position.copy(AO).add(new Vector3(-10, 14, 4));
      f.target = arenaTarget;
      f.intensity = 0.6;
    }
    if (lamp.current) {
      const l = lamp.current;
      l.position.copy(AO).add(new Vector3(21, 9, -1));
      l.color.set('#ffe9c8');
      l.distance = 26;
      l.intensity = 3.0;
    }
    if (monitor.current) monitor.current.intensity = 0;
  };

  /** The lecture hall's camera: pull back from its clock, then over his shoulder. */
  const schoolCamera = (
    camera: Camera,
    sb: ReturnType<typeof schoolBeats>,
    mb: ReturnType<typeof mailBeats>,
    tall: boolean,
    step: number
  ) => {
    const { pos, look } = tmp;
    SCHOOL_PULL.getPointAt(Math.min(1, Math.max(0, sb.pull)), pos);
    SCHOOL_PULL_LOOK.getPointAt(Math.min(1, Math.max(0, sb.pull)), look);
    if (sb.push > 0) {
      SCHOOL_PUSH.getPointAt(Math.min(1, Math.max(0, sb.push)), tmp.cam);
      pos.copy(tmp.cam);
      SCHOOL_PUSH_LOOK.getPointAt(Math.min(1, Math.max(0, sb.push)), tmp.cam);
      look.copy(tmp.cam);
    }
    // Into chapter 2: round in front of him, square to the screen, then in
    // close on the mail's message.
    if (mb.square > 0) {
      MAIL_SQUARE.getPointAt(Math.min(1, mb.square), pos);
      look.lerp(S_LID, mb.square);
      if (mb.dive > 0) {
        pos.lerp(MAIL_DIVE_TO, mb.dive);
        look.lerp(MAIL_PAGE, mb.dive);
      }
    }
    if (tall) {
      // Narrow screens: centre on him and stand further back in the wide view.
      look.lerp(S_SEAT, 0.5 * sb.pull * (1 - sb.push));
      pos
        .sub(look)
        .multiplyScalar(1 + 0.4 * sb.pull * (1 - sb.push))
        .add(look);
    }
    const sway = tmp.sway,
      ptr = pointer.current;
    if (!reduced && ptr) {
      const k = 1 - Math.exp(-step * 3);
      sway.x += (ptr.x - sway.x) * k;
      sway.y += (ptr.y - sway.y) * k;
      const amount = sb.pull * (1 - mb.square);
      tmp.right.setFromMatrixColumn(camera.matrixWorld, 0);
      tmp.up.setFromMatrixColumn(camera.matrixWorld, 1);
      pos
        .addScaledVector(tmp.right, sway.x * 0.14 * amount)
        .addScaledVector(tmp.up, -sway.y * 0.08 * amount);
    }
    // Snap on arrival (the cream hides the jump), then follow smoothly.
    if (reduced || !tmp.school) camera.position.copy(pos);
    else camera.position.lerp(pos, 1 - Math.exp(-step * 9));
    tmp.school = true;
    camera.lookAt(look);
    // The lens closes back from the dive's wide angle as it pulls away, and
    // tightens a little more onto the mail.
    const cam = camera as PerspectiveCamera,
      fov = reduced
        ? FOV
        : FOV +
          38 * (1 - sb.pull) ** 1.5 -
          9 * sb.push ** 2 * (1 - mb.square) -
          6 * mb.dive;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  };

  /** The meeting room's camera: back from the whiteboard to behind the
   *  engineers, beside the board as he writes, wide as he turns to them. */
  const officeCamera = (
    camera: Camera,
    ob: ReturnType<typeof officeBeats>,
    tall: boolean,
    step: number
  ) => {
    const { pos, look } = tmp,
      clamp = (t: number) => Math.min(1, Math.max(0, t));
    pos.lerpVectors(PUSH_FROM, PUSH_TO, ob.pull);
    look.lerpVectors(PUSH_LOOK_FROM, PUSH_LOOK_TO, ob.pull);
    if (ob.across > 0) {
      OFFICE_ACROSS.getPointAt(clamp(ob.across), pos);
      OFFICE_ACROSS_LOOK.getPointAt(clamp(ob.across), look);
    }
    if (ob.side > 0) {
      OFFICE_SIDE.getPointAt(clamp(ob.side), pos);
      OFFICE_SIDE_LOOK.getPointAt(clamp(ob.side), look);
    }
    if (ob.done > 0) {
      OFFICE_END.getPointAt(clamp(ob.done), pos);
      OFFICE_END_LOOK.getPointAt(clamp(ob.done), look);
    }
    if (tall) {
      // Narrow screens: aimed nearer him (the room is too small to stand
      // further back; the lens widens instead, below).
      look.lerp(
        tmp.d.copy(OO).add(new Vector3(AT_BOARD.x, 1.7, AT_BOARD.z)),
        0.3 * ob.pull
      );
    }
    const sway = tmp.sway,
      ptr = pointer.current;
    if (!reduced && ptr) {
      const k = 1 - Math.exp(-step * 3);
      sway.x += (ptr.x - sway.x) * k;
      sway.y += (ptr.y - sway.y) * k;
      tmp.right.setFromMatrixColumn(camera.matrixWorld, 0);
      tmp.up.setFromMatrixColumn(camera.matrixWorld, 1);
      pos
        .addScaledVector(tmp.right, sway.x * 0.1 * ob.pull)
        .addScaledVector(tmp.up, -sway.y * 0.06 * ob.pull);
    }
    if (reduced || !tmp.office) camera.position.copy(pos);
    else camera.position.lerp(pos, 1 - Math.exp(-step * 9));
    tmp.office = true;
    tmp.school = false;
    camera.lookAt(look);
    const cam = camera as PerspectiveCamera,
      // Wider for the room's wide shots (from the window: the board, him
      // and the engineers far apart), back to the usual for the close ones.
      wide = 1 - Math.max(ob.across, ob.side) * (1 - ob.done),
      base = (OFFICE_FOV + 4 * wide) * (tall ? 1.6 : 1),
      // The opening push also zooms in a little (dolly and zoom together).
      zoom = ob.pull * (1 - Math.max(ob.across, ob.side, ob.done)),
      // Narrower from behind the engineers, onto him as he talks.
      tele = ob.across * (1 - ob.side),
      fov = reduced ? base - 12 * tele : base - 12 * zoom - 12 * tele;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  };

  /** Still at the keys (weight w), his head turns a touch from side to side
   *  (about 2.3° each way, every 8 s) as he reads the output; nothing else
   *  moves. The mixer only rewrites a bone when its value changes, and the
   *  stopped clip's never does, so the sway is set over the remembered pose
   *  each frame (see unsway), never added to last frame's. */
  const headSway = (w: number, t: number) => {
    const head = headBone.current;
    if (!head || w <= 0) return;
    touch(0);
    head.rotateY(0.04 * Math.sin((t * Math.PI * 2) / 8) * w);
  };
  /** Remembers bone i's pose (once a frame) before the frame's touches. */
  const touch = (i: number) => {
    const t = touched.current[i];
    if (!t || t.on) return;
    t.q.copy(t.bone.quaternion);
    t.on = true;
  };
  /** Puts touched bones back to their poses (before the mixer runs). */
  const restoreBones = () => {
    for (const t of touched.current) {
      if (t.on) t.bone.quaternion.copy(t.q);
      t.on = false;
    }
  };

  /**
   * His right arm reaches the marker's place (two-bone IK, blended by w over
   * the clip's pose): the elbow bends out and down to his right; the upper
   * arm, then the forearm, turn to put the wrist on the target.
   */
  const reach = (target: Vector3, pole: Vector3, w: number) => {
    const bones = arm.current;
    if (!bones || w <= 0) return;
    const { upper, fore, hand } = bones,
      { a, b, c, d, q, q2 } = tmp;
    touch(1);
    touch(2);
    touch(3);
    upper.parent?.updateWorldMatrix(true, true);
    upper.getWorldPosition(a);
    fore.getWorldPosition(b);
    hand.getWorldPosition(c);
    const la = a.distanceTo(b),
      lb = b.distanceTo(c),
      dist = MathUtils.clamp(
        a.distanceTo(target),
        Math.abs(la - lb) + 1e-3,
        la + lb - 1e-3
      ),
      dir = d.copy(target).sub(a).normalize();
    // The elbow: in the plane of the arm and the pole, at the angle the
    // bone lengths allow.
    const cos = (la * la + dist * dist - lb * lb) / (2 * la * dist),
      sin = Math.sqrt(Math.max(0, 1 - cos * cos)),
      side = tmp.cam.copy(pole).sub(a);
    side.addScaledVector(dir, -side.dot(dir)).normalize();
    const elbow = tmp.up
      .copy(a)
      .addScaledVector(dir, la * cos)
      .addScaledVector(side, la * sin);
    // Upper arm: from its current direction to the elbow's.
    const turn = (bone: Object3D, from: Vector3, to: Vector3) => {
      bone.getWorldQuaternion(q);
      q2.setFromUnitVectors(from.normalize(), to.normalize()).multiply(q);
      // Back to the bone's parent's frame, blended over the clip's pose.
      bone.parent?.getWorldQuaternion(q);
      q.invert().multiply(q2);
      bone.quaternion.slerp(q, w);
      bone.updateWorldMatrix(false, true);
    };
    turn(upper, b.clone().sub(a), elbow.clone().sub(a));
    fore.getWorldPosition(b);
    hand.getWorldPosition(c);
    turn(fore, c.clone().sub(b), target.clone().sub(b));
  };

  /** Chapter 2: his place and turn at the board, his head's looks, his
   *  writing arm and the marker in his hand. */
  const officeHero = (
    s: Group,
    ob: ReturnType<typeof officeBeats>,
    of: number,
    step: number
  ) => {
    const t = tip.current,
      // A step to the board to write, back as he turns to them.
      stepIn = ob.side * (1 - ob.done);
    // The hand follows the marker's place a touch behind (it sweeps back to
    // each new line rather than jumping), and starts at the first line.
    if (tmp.lastTip.lengthSq() === 0)
      tmp.lastTip.copy(OO).add(new Vector3(BOARD.x, 2.21, 0.12));
    if (t.on) tmp.lastTip.lerp(t.at, reduced ? 1 : 1 - Math.exp(-step * 16));
    // Writing, his body stays just left of the marker (it moves along the
    // line); otherwise where he stood.
    // Done, he steps aside toward the door, clear of what he wrote.
    // (As he turns back to the board he already steps to where the first
    // line starts, so his arm needn't stretch out to it.)
    const want =
      t.on || (ob.side > 0.5 && ob.done < 0.01)
        ? tmp.lastTip.z - OO.z - 0.34
        : ob.done > 0.01
          ? AT_BOARD.z + (DONE_Z - AT_BOARD.z) * ob.done
          : AT_BOARD.z;
    tmp.officeZ +=
      (MathUtils.clamp(want, -0.1, DONE_Z) - tmp.officeZ) *
      (1 - Math.exp(-step * 2.2));
    if (reduced) tmp.officeZ = AT_BOARD.z;
    s.position
      .copy(OO)
      .add(
        tmp.a.set(
          AT_BOARD.x - BOARD.nx * 0.2 * stepIn + BOARD.nx * 0.12 * ob.done,
          0,
          tmp.officeZ
        )
      );
    let yaw = BOARD_YAW + (TALK_YAW - BOARD_YAW) * ob.talk;
    yaw += (DONE_YAW - yaw) * ob.done;
    s.rotation.y = yaw;
    s.updateMatrixWorld(true);
    // Thinking, he looks over at the chessboard (to his left), a touch down.
    const head = headBone.current;
    if (head && !reduced && ob.think > 0) {
      touch(0);
      head.rotateY(0.45 * ob.think);
      head.rotateX(0.1 * ob.think);
    }
    // Writing: his right hand to the marker's place, the marker 0.17 out
    // from the board; the elbow out to his right and down. Only once he has
    // turned back from the engineers to the board (the turn ends at 0.57).
    const w = ease(0.57, 0.62, of) * (1 - ease(0.86, 0.9, of)),
      target = tmp.target
        .copy(tmp.lastTip)
        .add(tmp.b.set(BOARD.nx * 0.28, -0.21, 0.05))
        .add(MK.fix),
      pole = tmp.pole
        .copy(s.position)
        .add(tmp.b.set(BOARD.nx * 0.5, 1.1, -BOARD.nx * 1.0));
    // Writing, his arm and hand take Pointing's shape (his wrist straight on
    // from his forearm, his fingers forward), and the IK then puts it on the
    // line.
    const bones0 = arm.current;
    if (!reduced && w > 0 && bones0?.point) {
      [bones0.upper, bones0.fore, bones0.hand].forEach((b, i) => {
        touch(1 + i);
        b.quaternion.slerp(bones0.point![i], w);
      });
      bones0.upper.updateWorldMatrix(true, true);
    }
    if (!reduced) reach(target, pole, w);
    // Writing, he watches the marker: his head turns and tips toward it
    // (most of the way; his eyes do the rest).
    if (head && !reduced && w > 0) {
      touch(0);
      head.getWorldPosition(tmp.a);
      const d = tmp.b.copy(tmp.lastTip).sub(tmp.a),
        ahead = Math.max(0.2, -BOARD.nx * d.x),
        right = -BOARD.nx * d.z;
      head.rotateY(
        -MathUtils.clamp(Math.atan2(right, ahead), -0.7, 0.7) * 0.75 * w
      );
      head.rotateX(
        MathUtils.clamp(Math.atan2(-d.y, ahead), -0.5, 0.6) * 0.7 * w
      );
    }
    // The blue marker. Standing, his fist closes around it, the marker
    // through it from his little finger's side out of his thumb's. Writing,
    // his hand takes Pointing's shape and the marker lies along his fingers,
    // pinched between thumb and index, pointing on past the fingertips, its
    // tip steered onto the line. (2026-10-13: it was set on the line itself,
    // ahead of his open hand; then pinched with no fingers closing round it;
    // then a fist turned at the wrist to the board, which looked twisted.)
    const m = heldMarker.current,
      bones = arm.current;
    if (m && bones && !reduced) {
      const { hand, index, thumb, rest, point } = bones,
        pw = point ? w : 0;
      index.slice(0, 3).forEach((b, i) => {
        touch(4 + i);
        b.quaternion
          .copy(rest[i])
          .multiply(MK.q.setFromAxisAngle(GRIP_INDEX_AXIS, GRIP_INDEX[i]));
        if (point)
          b.quaternion.slerp(
            MK.q2
              .copy(point[3 + i])
              .multiply(MK.q.setFromAxisAngle(GRIP_INDEX_AXIS, POINT_CURL)),
            pw
          );
      });
      thumb.forEach((b, i) => {
        touch(7 + i);
        b.quaternion
          .copy(rest[3 + i])
          .multiply(MK.q.setFromAxisAngle(GRIP_THUMB_AXES[i], GRIP_THUMB[i]));
        if (point) b.quaternion.slerp(point[6 + i], pw);
      });
      hand.updateWorldMatrix(true, true);
      // In his fist: across his knuckles (the index's curl axis), toward the
      // thumb, through the fist's middle.
      const across = MK.across
        .setFromMatrixColumn(index[0].matrixWorld, 0)
        .normalize();
      hand.getWorldPosition(MK.p);
      if (thumb[1].getWorldPosition(MK.tip).sub(MK.p).dot(across) < 0)
        across.negate();
      const centre = MK.centre.set(0, 0, 0);
      for (const b of index) centre.add(b.getWorldPosition(MK.p));
      centre.multiplyScalar(1 / index.length).addScaledVector(across, -FIST_IN);
      // Along his fingers: from the pinch, past the fingertips.
      const along = MK.along
          .copy(index[3].getWorldPosition(MK.p))
          .sub(index[0].getWorldPosition(MK.tip))
          .normalize(),
        pinch = index[1]
          .getWorldPosition(MK.pinch)
          .lerp(thumb[2].getWorldPosition(MK.p), 0.5),
        reachOut =
          index[3].getWorldPosition(MK.p).sub(pinch).dot(along) + POINT_PAST,
        pointTip = MK.tip.copy(pinch).addScaledVector(along, reachOut);
      // Blend the two holds; the marker's middle is 0.101 behind its tip.
      const dir = MK.dir.copy(across).lerp(along, pw).normalize();
      m.position
        .copy(centre)
        .lerp(MK.p.copy(pointTip).addScaledVector(along, -MARKER_TIP), pw);
      m.quaternion.setFromUnitVectors(MK.down, dir);
      // Steer the hand (next frame) until the tip is on the line: only once
      // his hand is up (rising, the hold is still changing and steering then
      // swung it high and back down).
      const tipAt = MK.p.copy(m.position).addScaledVector(dir, MARKER_TIP),
        steer = MathUtils.smoothstep(w, 0.85, 1);
      if (steer > 0) {
        MK.fix.addScaledVector(
          tipAt.sub(tmp.lastTip).negate(),
          (1 - Math.exp(-step * 8)) * steer
        );
        if (MK.fix.length() > 0.25) MK.fix.setLength(0.25);
      } else MK.fix.multiplyScalar(Math.exp(-step * 4));
    } else if (m && bones) {
      bones.hand.getWorldPosition(m.position);
    }
    // For the engineers' eyes.
    headBone.current?.getWorldPosition(headLocal.current);
    headLocal.current.sub(OO);
  };

  /** Hired: he works at his desk, typing (the hall's keys loop), facing
   *  the windows; his hands' place goes to the typing sound. */
  /** Chapter 3: his place in the line, then up the stairs and across the
   *  stage (walking, if the clip is there), the diploma, and his turn to us
   *  with it. */
  const arenaHero = (
    s: Group,
    ab: ReturnType<typeof arenaBeats>,
    step: number
  ) => {
    walkAt(ab.walk, s.position, tmp.a);
    const going = Math.atan2(tmp.a.x, tmp.a.z),
      want = ab.walk <= 0.001 ? Math.PI / 2 : going;
    let yaw = want + (-Math.PI / 2 - want) * ab.turn;
    if (reduced) yaw = want;
    // Eased, the short way round.
    let d = yaw - tmp.arenaYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    tmp.arenaYaw += d * (reduced ? 1 : 1 - Math.exp(-step * 8));
    s.rotation.y = tmp.arenaYaw;
    s.updateMatrixWorld(true);
    // His diploma, in his right hand once it's handed to him.
    const dp = diploma.current,
      hand = arm.current?.hand;
    if (dp && hand) {
      dp.visible = ab.diploma > 0.5;
      hand.getWorldPosition(dp.position);
      hand.getWorldQuaternion(dp.quaternion);
    }
    headBone.current?.getWorldPosition(headLocal.current);
  };

  /** Chapter 3's camera in the classroom: the establishing glide from its
   *  back-left corner, down over the tiers to over his shoulder, then up
   *  behind him to the screens. */
  const mismCamera = (
    camera: Camera,
    mb: ReturnType<typeof mismBeats>,
    tall: boolean,
    step: number,
    rise = 0
  ) => {
    const { pos, look } = tmp;
    pos.copy(M_EST).lerp(M_EST2, mb.est);
    look.copy(M_EST_LOOK);
    pos.lerp(M_SHOULDER, mb.toHim);
    look.lerp(M_LID, mb.toHim);
    pos.lerp(M_BEHIND, mb.toScreens);
    look.lerp(M_SCREENS_LOOK, mb.toScreens);
    // Into chapter 4: up over him to the ceiling, looking down onto him.
    pos.lerp(M_ABOVE, rise);
    look.lerp(M_KEYS, rise);
    if (reduced || !tmp.mism) camera.position.copy(pos);
    else camera.position.lerp(pos, 1 - Math.exp(-step * 8));
    tmp.mism = true;
    tmp.office = tmp.school = tmp.arena = false;
    camera.lookAt(look);
    const cam = camera as PerspectiveCamera,
      fov =
        (MISM_FOV -
          10 * mb.toHim * (1 - mb.toScreens) +
          2 * mb.toScreens +
          8 * rise) *
        (tall ? 1.5 : 1);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  };

  /** The way to Bridge: over Utah Valley along its path, from straight down
   *  onto BYU to ahead, north, and down onto his window. */
  const flyCamera = (
    camera: Camera,
    fb: ReturnType<typeof flyBeats>,
    tall: boolean,
    step: number
  ) => {
    const { pos, look } = tmp;
    FLY_CURVE.getPointAt(fb.path, pos);
    // Ahead: the ground toward Lehi, out as far as the camera is high and
    // more (so it looks down at about 30 degrees). (2026-11-20: it looked
    // along its path, and climbing out over BYU that pointed at the sky.)
    const alt = Math.max(1, pos.y - VO.y);
    tmp.e.set(FLY_WINDOW.x - pos.x, 0, FLY_WINDOW.z - pos.z);
    const far = tmp.e.length();
    tmp.e.multiplyScalar(Math.min(1, (alt * 1.7 + 20) / Math.max(far, 1e-3)));
    look.set(pos.x + tmp.e.x, VO.y, pos.z + tmp.e.z);
    look.lerpVectors(FLY_CAMPUS, look, fb.tilt);
    look.lerp(FLY_WINDOW, fb.window);
    if (reduced || !tmp.fly) camera.position.copy(pos);
    else camera.position.lerp(pos, 1 - Math.exp(-step * 6));
    tmp.fly = true;
    tmp.mism = tmp.office = tmp.school = tmp.arena = false;
    camera.lookAt(look);
    const cam = camera as PerspectiveCamera,
      fov = (54 - 12 * fb.window) * (tall ? 1.4 : 1);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  };

  /** Chapter 3's camera: off the center-hung screen, back over the bowl,
   *  down to the line, then with him across the stage, and before him as
   *  he turns to us. */
  const arenaCamera = (
    camera: Camera,
    ab: ReturnType<typeof arenaBeats>,
    hero: Vector3,
    tall: boolean,
    step: number
  ) => {
    const { pos, look } = tmp;
    pos.copy(ARENA_START).lerp(ARENA_HIGH, ab.pull);
    look.copy(ARENA_START_LOOK).lerp(ARENA_HIGH_LOOK, ab.pull);
    const head = tmp.b.copy(hero).add(tmp.c.set(0, 2.15, 0));
    pos.lerp(ARENA_DOWN, ab.down);
    look.lerp(head, ab.down);
    const track = MathUtils.smoothstep(ab.walk, 0, 0.12);
    tmp.d.copy(hero).add(tmp.c.set(-6.4, 2.6, -3.4));
    pos.lerp(tmp.d, track);
    look.lerp(head, track);
    tmp.d.copy(hero).add(tmp.c.set(-4.4, 2.2, 0.5));
    pos.lerp(tmp.d, ab.turn);
    if (reduced || !tmp.arena) camera.position.copy(pos);
    else camera.position.lerp(pos, 1 - Math.exp(-step * 8));
    tmp.arena = true;
    tmp.office = tmp.school = false;
    camera.lookAt(look);
    const cam = camera as PerspectiveCamera,
      fov = (ARENA_FOV - 8 * ab.turn) * (tall ? 1.5 : 1);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  };

  /** Hired: he works at his desk, typing (the whole Typing clip), facing
   *  the windows; his hands' place goes to the typing sound. Leaving: shot
   *  A, he gets up, his hips held on the chair as it rolls back, then where
   *  he stands; shot B (after the cut), he walks down the aisle, his hips on
   *  the path, his root turned the way he goes. */
  const deskHero = (
    s: Group,
    gb: ReturnType<typeof gradBeats>,
    leaving: boolean
  ) => {
    if (!leaving || gb.seat <= 0) {
      s.position.copy(DESK_HERO);
      s.rotation.y = Math.PI / 2;
    } else {
      const target = tmp.target;
      if (gb.cut) {
        leaveAt(gb.out * LEAVE_TOTAL, target, tmp.b, tmp.a);
        s.rotation.y = Math.atan2(tmp.b.x, tmp.b.z);
        s.position.y = 0;
      } else {
        const up = MathUtils.smoothstep(gb.rise, 0.25, 0.9);
        target.copy(SEAT_HIPS);
        target.x -= gb.chair;
        target.lerp(STAND_HIPS, up);
        s.rotation.y = Math.PI / 2;
        s.position.y = DESK_HERO.y * (1 - up);
      }
      // His hips from his root in this pose, so the root goes where they
      // land on the target.
      s.updateMatrixWorld(true);
      const hips = hipsBone.current;
      if (hips) {
        hips.getWorldPosition(tmp.a);
        s.position.x += target.x - tmp.a.x;
        s.position.z += target.z - tmp.a.z;
      }
    }
    s.updateMatrixWorld(true);
    if (rightHand.current)
      rightHand.current.getWorldPosition(desk.current.hand);
    // On the trackpad once his right hand is well to the keyboard's right.
    desk.current.mouse =
      (!leaving || gb.seat <= 0) &&
      desk.current.hand.z - DESK_KEYS.z > MOUSE_RIGHT;
    desk.current.keys.copy(DESK_KEYS);
    placeBag(gb, leaving);
  };

  /** His backpack: set down by his desk until the cut, then on his back
   *  (the worn one, skinned to him). */
  const placeBag = (gb: ReturnType<typeof gradBeats>, leaving: boolean) => {
    const on = leaving && gb.cut,
      wornBag = parts.current?.wornBag,
      bag = bagDown.current;
    if (wornBag) wornBag.visible = on;
    if (!bag) return;
    bag.visible = !on;
    bag.position.copy(BAG_REST);
    bag.quaternion.setFromAxisAngle(UP, BAG_YAW);
    bag.scale.setScalar(BAG_SCALE);
  };

  /** Hired: the camera's way from the closing shot out through the glass
   *  door and over the corridor to his desk (DESK_PATH), the lens
   *  narrowing as it settles over his shoulder. */
  const deskCamera = (
    camera: Camera,
    d: number,
    tall: boolean,
    step: number,
    leave = 0,
    hero?: Vector3
  ) => {
    // One eased place along the path for both where the camera is and where
    // it looks, so it moves the same way scrolled back as forward. (The
    // position alone was eased: scrolling back it trailed ahead of its aim,
    // which had already gone back, and the camera turned down to the floor.)
    const { pos, look } = tmp,
      to = deskLeg(d);
    if (reduced || tmp.flyT < 0) tmp.flyT = to;
    else tmp.flyT += (to - tmp.flyT) * (1 - Math.exp(-step * 7));
    const t = tmp.flyT;
    DESK_PATH.getPoint(t, pos);
    DESK_LOOK.getPoint(t, look);
    if (tall) {
      // Tall screens: further back, and aimed lower, so he sits in the
      // screen's upper half, above the card.
      const end = ease(0.9, 1, t);
      pos.lerp(DESK_TALL, end);
      look.y -= 0.75 * end;
    }
    // Leaving: on him from the aisle at his right as he gets up; a pan
    // away over the view (hiding the cut); him walking in and off down the
    // aisle, followed.
    if (leave > 0 && hero) {
      const gb = gradBeats(leave),
        hips = hipsBone.current;
      if (hips) hips.getWorldPosition(tmp.d);
      else tmp.d.copy(hero).setY(1);
      // Where it is: up to the windows as it pans; back to the aisle as it
      // comes round; then chasing him along his way, turning with him.
      const at = tmp.c.copy(LEAVE_CAM).lerp(WIN_CAM, gb.panA).lerp(PAN_CAM, gb.panB);
      const walked = gb.out * LEAVE_TOTAL,
        back = Math.max(walked - CHASE, PAN_AT),
        chase = MathUtils.smoothstep(walked - CHASE - PAN_AT, 0, 3),
        dir = tmp.a,
        left = tmp.b;
      if (gb.cut && gb.panB > 0) {
        leaveAt(back, tmp.f, dir, left);
        tmp.f
          .addScaledVector(left, 1.9 + (0.7 - 1.9) * chase)
          .setY(2.3 - 0.15 * chase + OO.y);
        at.lerp(tmp.f, gb.panB);
      }
      pos.lerp(at, gb.toA);
      // Where it looks: at him (his head in frame as he stands); turning
      // right off him to the windows, level, a little up (the sky), drifting
      // along the view; on round to down the aisle; he walks into the shot
      // past it, 2 m to its right, and once he's a few metres ahead it looks
      // with him, a little ahead along his way.
      const onHim = tmp.e.copy(tmp.d);
      onHim.y += gb.cut ? 0.3 : 0.2 + 0.25 * gb.rise;
      if (gb.cut) {
        leaveAt(walked + 2, tmp.f, dir, left);
        tmp.f.y = onHim.y - 0.15;
        onHim.lerp(tmp.f, 0.35 * chase);
      }
      const ahead = gb.cut
          ? MathUtils.smoothstep(walked - PAN_AT, 2.5, 5)
          : 0,
        yaw =
          gb.panB > 0
            ? WIN_YAW2 + (PAN_TO - WIN_YAW2) * gb.panB
            : gb.dwell > 0
              ? WIN_YAW + (WIN_YAW2 - WIN_YAW) * gb.dwell
              : PAN_FROM + (WIN_YAW - PAN_FROM) * gb.panA,
        lookUp = gb.panA * (1 - gb.panB),
        away = tmp.f
          .set(Math.sin(yaw) * 4, 0, Math.cos(yaw) * 4)
          .add(pos)
          .setY(1.55 + (pos.y - 1.55 - OO.y + 0.35) * lookUp + OO.y),
        off = MathUtils.smoothstep(gb.panA, 0, 0.25) * (1 - ahead);
      look.lerp(onHim.lerp(away, off), gb.toA);
    }
    camera.position.copy(pos);
    tmp.office = true;
    tmp.school = false;
    camera.lookAt(look);
    const cam = camera as PerspectiveCamera,
      fov =
        (OFFICE_FOV + 4 - 6 * ease(0.9, 1, t) + 2 * gradBeats(leave).toA) *
        (tall ? 1.6 : 1);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  };

  useFrame(({ camera, size, gl, clock }, dt) => {
    const clips = actions.current;
    if (!clips) return;
    restoreBones();
    const p = progress.current,
      r = rewind.current,
      sc = school.current,
      ml = mail.current ?? 0,
      of = office.current ?? 0,
      gr = grad.current ?? 0,
      ar = arena.current ?? 0,
      gb = gradBeats(gr),
      ab = arenaBeats(ar),
      mi = mism.current ?? 0,
      mib = mismBeats(mi),
      fl = fly.current ?? 0,
      flb = flyBeats(fl),
      // Over the valley once the punch through the classroom's ceiling is
      // white.
      inFly = fl >= FLY_SWITCH,
      // Chapter 3: in the classroom (or the arena, if it's in the flow)
      // once the leaving's white is over.
      inArena = ARENA_IN_FLOW && gr >= GRAD_SWITCH,
      inMism = !ARENA_IN_FLOW && gr >= GRAD_SWITCH,
      inOffice = ml >= MAIL_SWITCH && !inArena && !inMism,
      inSchool = !inOffice && !inArena && !inMism && r >= SWITCH,
      dk = deskProgress.current ?? 0,
      db = deskBeats(dk),
      // Hired: at his desk once the camera is out of the meeting room.
      atDesk = inOffice && dk >= DESK_SWITCH,
      place: Place = inFly
        ? 'fly'
        : inArena
        ? 'arena'
        : inMism
          ? 'mism'
          : atDesk
          ? 'desk'
          : inOffice
            ? 'office'
            : inSchool
              ? 'hall'
              : 'room',
      sb = schoolBeats(sc),
      mb = mailBeats(ml),
      ob = officeBeats(of),
      rb = rewindBeats(r),
      { pull, swivel, toRise, rise, toIdle, wave: waveIn } = beats(p),
      wave = waveIn * (1 - rb.leave),
      // A touch brighter on the welcome, as he faces the camera and waves.
      welcome = ease(0.72, 0.96, p) * (1 - rb.leave),
      step = Math.min(dt, 0.05),
      standing = toRise * toIdle;
    clips.type.setEffectiveWeight(1 - toRise);
    clips.keys.setEffectiveWeight(0);
    // Typing winds down as the chair starts rolling back: hands hold still
    // instead of typing on air while they leave the desk.
    clips.type.timeScale = 1 - ease(0.1, 0.13, p);
    desk.current.active = clips.type.timeScale * (1 - toRise);
    clips.rise.setEffectiveWeight(toRise * (1 - toIdle));
    clips.idle.setEffectiveWeight(standing * (1 - wave));
    clips.wave.setEffectiveWeight(standing * wave);
    clips.rise.time = rise * (clips.rise.getClip().duration - 1e-3);
    clips.think?.setEffectiveWeight(0);
    clips.calm?.setEffectiveWeight(0);
    clips.talk?.setEffectiveWeight(0);
    if (ARENA_IN_FLOW && !arenaOn && (dk > 0.3 || gr > 0 || ar > 0))
      setArenaOn(true);
    if (mismGroup.current) mismGroup.current.visible = inMism && !inFly;
    if (valleyGroup.current) valleyGroup.current.visible = inFly;
    {
      // Over the valley, a near plane by how close the camera is to anything
      // (flyNear); elsewhere the rooms'.
      const cam = camera as PerspectiveCamera,
        near = inFly ? flyNear(camera.position) : 0.1;
      if (cam.near !== near) {
        cam.near = near;
        cam.updateProjectionMatrix();
      }
    }
    if (arenaGroup.current) arenaGroup.current.visible = inArena;
    clips.walk?.setEffectiveWeight(0);
    if (roomGroup.current) roomGroup.current.visible = place === 'room';
    if (officeGroup.current) officeGroup.current.visible = inOffice;
    // The hall only in the hall. It was also shown in his room (never seen
    // there), and its speaker's light then made four point lights there and
    // three everywhere else: every material seen in both (his, the bag's)
    // compiled twice. Now every place has the same lights.
    if (schoolGroup.current) schoolGroup.current.visible = place === 'hall';
    if (inArena) {
      // Chapter 3: standing in the line (his breathing idle), walking up and
      // across the stage (Walking, if downloaded), standing with his diploma.
      clips.type.setEffectiveWeight(0);
      clips.keys.setEffectiveWeight(0);
      clips.rise.setEffectiveWeight(0);
      clips.wave.setEffectiveWeight(0);
      const walking = clips.walk
        ? MathUtils.smoothstep(ab.walk, 0.0, 0.04) *
          (1 - MathUtils.smoothstep(ab.walk, 0.94, 1))
        : 0;
      clips.walk?.setEffectiveWeight(walking);
      // Scrubbed by the ground he has covered (no sliding feet, reversible).
      if (clips.walk) {
        const dur = clips.walk.getClip().duration;
        clips.walk.timeScale = 0;
        clips.walk.time =
          (((ab.walk * WALK_TOTAL) / WALK_CYCLE) * dur) % (dur - 1e-3);
      }
      if (clips.calm) {
        clips.calm.setEffectiveWeight(1 - walking);
        clips.idle.setEffectiveWeight(0);
      } else clips.idle.setEffectiveWeight(1 - walking);
      desk.current.active = 0;
      mixer.update(reduced ? 0 : step);
    } else if (atDesk) {
      // Hired: at his desk, the whole Typing clip (as in his room): typing,
      // now and then reaching for the trackpad and back. Leaving: his hands
      // stop, settle onto his knees (SitToStand's first frame) as the chair
      // rolls back, and he stands (SitToStand, scrubbed); after the cut,
      // Walking, scrubbed by the ground covered.
      const leaving = gr > 0,
        seat = leaving ? gb.seat : 0,
        walk = leaving && gb.cut ? 1 : 0;
      clips.type.setEffectiveWeight((1 - seat) * (1 - walk));
      clips.type.timeScale = 1 - gb.stop;
      clips.keys.setEffectiveWeight(0);
      clips.rise.setEffectiveWeight(seat * (1 - walk));
      clips.rise.time = gb.rise * (clips.rise.getClip().duration - 1e-3);
      clips.wave.setEffectiveWeight(0);
      clips.idle.setEffectiveWeight(0);
      clips.calm?.setEffectiveWeight(0);
      clips.walk?.setEffectiveWeight(walk);
      if (clips.walk) {
        const dur = clips.walk.getClip().duration;
        clips.walk.timeScale = 0;
        clips.walk.time =
          (((gb.out * LEAVE_TOTAL) / WALK_CYCLE) * dur) % (dur - 1e-3);
      }
      desk.current.active = 1 - gb.stop;
      mixer.update(reduced ? 0 : step);
    } else if (inOffice) {
      // Chapter 2: standing at the whiteboard; thinking and talking if those
      // clips are there, his idle otherwise.
      clips.type.setEffectiveWeight(0);
      clips.keys.setEffectiveWeight(0);
      clips.rise.setEffectiveWeight(0);
      clips.wave.setEffectiveWeight(0);
      const think = clips.think ? ob.think : 0,
        talk = clips.talk ? ob.talk : 0;
      clips.think?.setEffectiveWeight(think);
      clips.talk?.setEffectiveWeight(talk);
      const stand = Math.max(0, 1 - think - talk);
      if (clips.calm) {
        clips.calm.setEffectiveWeight(stand);
        clips.idle.setEffectiveWeight(0);
      } else clips.idle.setEffectiveWeight(stand);
      desk.current.active = 0;
      mixer.update(reduced ? 0 : step);
    } else if (inMism) {
      // Chapter 3: seated at his desk in the classroom, working the case on
      // his laptop (the hall's keys loop). His notes are typed from the
      // moment the room shows, about 14 characters a second, read over for
      // a few seconds once complete (his hands rest on the keys, the typing
      // sound fades), and typed again, as the hall's program is. Once the
      // scroll's notes beat begins (the camera coming down to him) they are
      // no longer started over, and the scroll makes sure they are complete
      // by its end; then his hands rest, as the class's answers go up.
      // (2026-11-19: they had been typed by the scroll alone, so from the
      // back of the room his hands typed, and were heard, with nothing
      // appearing.)
      clips.type.setEffectiveWeight(0);
      clips.rise.setEffectiveWeight(0);
      clips.idle.setEffectiveWeight(0);
      clips.wave.setEffectiveWeight(0);
      clips.calm?.setEffectiveWeight(0);
      const n = notes.current,
        cycle = NOTES_LENGTH / NOTES_CPS + NOTES_HOLD;
      if (!reduced) {
        n.t += step;
        if (n.t >= cycle) n.t = mib.notes > 0 ? cycle : n.t % cycle;
      }
      n.typed = reduced
        ? NOTES_LENGTH
        : Math.max(
            Math.min(NOTES_LENGTH, n.t * NOTES_CPS),
            NOTES_LENGTH * mib.notes
          );
      const full = n.typed >= NOTES_LENGTH ? 1 : 0;
      n.rest = reduced ? 1 : n.rest + (full - n.rest) * (1 - Math.exp(-step * 5));
      desk.current.active = 1 - n.rest;
      clips.keys.setEffectiveWeight(1);
      clips.keys.timeScale = 1 - n.rest;
      mixer.update(reduced ? 0 : step);
    } else if (inSchool) {
      // Chapter 1: seated at the lecture desk, typing on the laptop (keys only).
      clips.type.setEffectiveWeight(0);
      clips.keys.setEffectiveWeight(1);
      clips.rise.setEffectiveWeight(0);
      clips.idle.setEffectiveWeight(0);
      clips.wave.setEffectiveWeight(0);
      // The program is typed out by 72 % of the push (SchoolScene), then
      // compiled and run: his hands slow to a stop on the keys and the
      // typing sound fades with them, as he reads the output. Scrolling
      // back brings both back.
      const done = MathUtils.smoothstep(sb.push, 0.68, 0.84);
      clips.keys.timeScale = 1 - done;
      desk.current.active = 1 - done;
      mixer.update(reduced ? 0 : step);
      if (!reduced) headSway(done, clock.elapsedTime);
    } else mixer.update(reduced ? 0 : step);
    gl.toneMappingExposure =
      inOffice || inArena || inMism ? 1.0 : 1.05 + 0.2 * welcome;
    lights(place, toIdle, inSchool ? sb.push : 0, db.light, gr > 0 ? gb.day : db.day);
    const part = parts.current;
    if (part) {
      // Socks and slippers at home, sneakers out (swapped inside the clock's
      // dive).
      part.sneakers.visible = place !== 'room';
      part.socks.visible = part.slippers.visible = place === 'room';
      part.wornBag.visible = false; // (placeBag shows it once it's on him)
      // A blink every 2.5-6 s (now and then a double one): the lids half
      // shut for 50 ms, shut for 80, half again for 60.
      const b = blink.current,
        now = clock.elapsedTime;
      if (now >= b.next) {
        b.start = now;
        b.next =
          now + (Math.random() < 0.15 ? 0.32 : 2.5 + Math.random() * 3.5);
      }
      const e = now - b.start;
      part.lidsHalf.visible = (e >= 0 && e < 0.05) || (e >= 0.13 && e < 0.19);
      part.lidsShut.visible = e >= 0.05 && e < 0.13;
    }

    const s = body.current,
      turn = Math.PI * (1 - swivel);
    if (heldMarker.current) heldMarker.current.visible = inOffice && !atDesk;
    if (diploma.current && !inArena) diploma.current.visible = false;
    if (!atDesk) {
      // By his desk all along (the hired flight comes down by it).
      if (inOffice) placeBag(gb, false);
      else if (bagDown.current) bagDown.current.visible = false;
    }
    if (!s) return;
    // Not seen over the valley (he is at his window's desk).
    s.visible = !inFly;
    if (inFly) {
      flyCamera(camera, flb, size.width < size.height, step);
      return;
    }
    tmp.fly = false;
    if (inMism) {
      s.position.copy(M_SEAT);
      s.rotation.y = MISM_YAW + Math.PI / 2; // facing the front floor
      if (rightHand.current) {
        rightHand.current.getWorldPosition(desk.current.hand);
        desk.current.mouse = false;
      }
      desk.current.keys.copy(M_KEYS);
      mismCamera(camera, mib, size.width < size.height, step, flb.rise);
      return;
    }
    tmp.mism = false;
    if (inArena) {
      arenaHero(s, ab, step);
      arenaCamera(camera, ab, s.position, size.width < size.height, step);
      return;
    }
    tmp.arena = false;
    if (inOffice) {
      if (atDesk) deskHero(s, gb, gr > 0);
      else officeHero(s, ob, of, step);
      if (db.fly > 0)
        deskCamera(camera, dk, size.width < size.height, step, gr, s.position);
      else {
        tmp.flyT = -1;
        officeCamera(camera, ob, size.width < size.height, step);
      }
      return;
    }
    tmp.office = false;
    if (inSchool) {
      s.position.copy(S_SEAT);
      s.rotation.y = Math.PI / 2; // facing the front of the hall (+X)
      if (rightHand.current) {
        rightHand.current.getWorldPosition(desk.current.hand);
        desk.current.mouse = false; // the keys-only loop never reaches for it
      }
      desk.current.keys.copy(S_KEYS);
      schoolCamera(camera, sb, mb, size.width < size.height, step);
      return;
    }
    desk.current.keys.copy(ROOM_KEYS);
    // Once standing, turn in place to face the camera (it sits off to the side).
    // In the rewind he turns from there almost all the way to the wall clock,
    // to look at it as time runs back.
    let face = Math.atan2(
      camera.position.x - s.position.x,
      camera.position.z - s.position.z
    );
    if (r > 0) {
      tmp.faceFrom ??= face;
      const toClock = Math.atan2(
        CLOCK.x - s.position.x,
        CLOCK.z - s.position.z
      );
      face = tmp.faceFrom + (toClock - tmp.faceFrom) * 0.9 * rb.look;
    } else tmp.faceFrom = null;
    s.rotation.y = turn + face * toIdle;
    // Facing +Z once turned; keep the hips put while root-motion clips hand over.
    const seatZ = SEAT.z + PULL_BACK * pull;
    s.position.set(
      SEAT.x,
      SEAT_LIFT * (1 - toRise),
      seatZ + RISE_FORWARD * standing
    );
    // Kenney's desk chair faces +Z at rest, the same way as the hero.
    if (chair.current) {
      chair.current.rotation.y = turn;
      chair.current.position.z = seatZ;
    }

    // Right hand on the mouse (measured: the Typing clip reaches right of
    // x -0.7 only to hold it) or on the keyboard.
    if (rightHand.current) {
      rightHand.current.getWorldPosition(desk.current.hand);
      desk.current.mouse = desk.current.hand.x > -0.7;
    }

    cameraAt(p, tmp.pos, tmp.look, tmp.cam);
    const { pos, look } = tmp;
    if (r > 0) {
      // Glide to the clock (to 62 % of the curve), then dive into the dial.
      const u = 0.62 * rb.approach + 0.38 * rb.dive ** 1.3;
      REWIND_PATH.getPointAt(Math.min(1, Math.max(0, u)), pos);
      REWIND_LOOK.getPointAt(Math.min(1, Math.max(0, u)), look);
    }
    // Portrait screens keep the character centred and pull back to fit; the
    // pull-back eases off as the camera heads for the clock.
    if (size.width < size.height) {
      look.setX(MathUtils.lerp(look.x, SEAT.x, p * (1 - rb.approach)));
      // Too narrow to hold the clock off-centre: aim at it (the year sits
      // below it instead) and stand a little further off until the dive.
      look.lerp(CLOCK, 0.85 * rb.approach * (1 - rb.dive));
      const back =
        1 + 0.45 * (1 - rb.approach) + 0.3 * rb.approach * (1 - rb.dive);
      pos.sub(look).multiplyScalar(back).add(look);
    }
    // A slight float with the pointer (none while diving or under reduced motion).
    const sway = tmp.sway,
      ptr = pointer.current;
    if (!reduced && ptr) {
      const k = 1 - Math.exp(-step * 3);
      sway.x += (ptr.x - sway.x) * k;
      sway.y += (ptr.y - sway.y) * k;
      const amount = 1 - rb.dive;
      tmp.right.setFromMatrixColumn(camera.matrixWorld, 0);
      tmp.up.setFromMatrixColumn(camera.matrixWorld, 1);
      pos
        .addScaledVector(tmp.right, sway.x * 0.14 * amount)
        .addScaledVector(tmp.up, -sway.y * 0.08 * amount);
    }
    if (reduced || tmp.school)
      camera.position.copy(pos); // snap back from school
    else camera.position.lerp(pos, 1 - Math.exp(-step * (r > 0 ? 9 : 6)));
    tmp.school = false;
    camera.lookAt(look);
    if (!reduced) {
      // A touch of roll mid-glide, and the lens widens as it falls into the dial.
      camera.rotateZ(0.06 * Math.sin(Math.PI * rb.approach) * (1 - rb.dive));
      const cam = camera as PerspectiveCamera,
        fov = FOV + 38 * rb.dive ** 1.5;
      if (Math.abs(cam.fov - fov) > 0.01) {
        cam.fov = fov;
        cam.updateProjectionMatrix();
      }
    }
  });

  // The warm-up, behind the loader. Once every place is in:
  // 1. Every material's program is sent to compile at once (gl.compile),
  //    under both light setups (one area light or two, see placeLights).
  //    The browser compiles them in parallel, and the frames go on, cheap,
  //    until all are ready (up to WARM_WAIT).
  // 2. Each place is drawn once, a frame each, after the story's own frame
  //    logic above. Everything in it is shown and unculled, with its shadow
  //    map. So every GPU pipeline is made, and every texture and buffer
  //    uploaded (and the shadow passes' own programs compiled), before the
  //    story starts.
  // (2026-11-19: each place's first frame had frozen the scroll for 0.3-2 s,
  // compiling and uploading.) Then onReady lifts the loader.
  const warm = useRef({
    step: 0,
    settled: 0,
    compiling: null as Set<{ isReady?: () => boolean }> | null,
    since: 0,
    fence: null as WebGLSync | null,
  });
  useFrame(({ gl, scene, camera }) => {
    const w = warm.current;
    if (w.step > WARM_UP.length) return;
    const groups: Partial<Record<Place, Group | null>> = {
      room: roomGroup.current,
      hall: schoolGroup.current,
      office: officeGroup.current,
      mism: ARENA_IN_FLOW ? null : mismGroup.current,
      fly: valleyGroup.current,
    };
    // Every place in (the hall's group stands from the start; its scene
    // inside comes with its model).
    if (
      Object.entries(groups).some(([k, g]) =>
        k === 'mism' && ARENA_IN_FLOW ? false : !g || !g.children.length
      )
    ) {
      w.settled = 0;
      return;
    }
    // A few frames more, for what their effects build once they are in (the
    // crowds, the city).
    if (w.settled++ < 4) return;
    if (!w.compiling) {
      // Every place has the same lights (see the hall's group above) but
      // for the area lights: his room and the hall show one, the others two
      // (placeLights). So every material is compiled under the room's
      // setup, then with both shown. (A material keeps a program per light
      // setup, so going between them later compiles nothing.)
      shareBagTextures(scene, bagGltf.scene);
      const programs = new Set<{ isReady?: () => boolean }>();
      const compile = () => {
        for (const m of gl.compile(scene, camera)) {
          const program = (
            gl.properties.get(m) as {
              currentProgram?: { isReady?: () => boolean };
            }
          ).currentProgram;
          if (program) programs.add(program);
        }
      };
      compile();
      const glows = [windowGlow.current, screenGlow.current],
        was = glows.map((g) => g?.visible);
      for (const g of glows) if (g) g.visible = true;
      compile();
      glows.forEach((g, i) => {
        if (g) g.visible = !!was[i];
      });
      w.compiling = programs;
      w.since = performance.now();
      return;
    }
    if (w.compiling.size && performance.now() - w.since < WARM_WAIT) {
      // (Without a ready check, nothing to wait for. three's own
      // compileAsync threw on a material without a program.)
      for (const program of w.compiling)
        if (!program.isReady || program.isReady()) w.compiling.delete(program);
      return;
    }
    if (w.step === WARM_UP.length) {
      // 3. The loader lifts once the GPU has done all of it: the draws above
      //    return at once, and what they set off (pipelines made, the
      //    unculled places drawn) otherwise landed in the story's first
      //    seconds as 0.2-0.6 s freezes. A fence, checked each frame (never
      //    waited on).
      const ctx = gl.getContext() as WebGL2RenderingContext;
      if (!w.fence) {
        w.fence = ctx.fenceSync(ctx.SYNC_GPU_COMMANDS_COMPLETE, 0);
        ctx.flush();
        w.since = performance.now();
        if (w.fence) return;
      }
      if (
        w.fence &&
        ctx.getSyncParameter(w.fence, ctx.SYNC_STATUS) !== ctx.SIGNALED &&
        performance.now() - w.since < WARM_WAIT
      )
        return;
      if (w.fence) ctx.deleteSync(w.fence);
      w.fence = null;
      w.step++;
      onReady?.();
      return;
    }
    const place = WARM_UP[w.step++];
    for (const [k, g] of Object.entries(groups)) if (g) g.visible = k === place;
    lights(place, 0, 0, place === 'desk' ? 1 : 0);
    // What holds a light keeps its visibility (the place groups, the bars):
    // the lights shown are the place's own, so the programs match.
    const holders = new Set<Object3D>();
    scene.traverse((o) => {
      if ((o as Light).isLight)
        for (let p = o.parent; p; p = p.parent) holders.add(p);
    });
    const shown: [Object3D, boolean, boolean][] = [];
    scene.traverse((o) => {
      if ((o as Light).isLight || holders.has(o)) return;
      shown.push([o, o.visible, o.frustumCulled]);
      o.visible = true;
      o.frustumCulled = false;
    });
    // The shadow passes draw everything with one shared depth material, its
    // side set per object; three picks its program again only when
    // something else changes, so which side's program it needs, and when,
    // went by the order things were drawn in (one compiled mid-chapter 1, a
    // 0.12 s freeze). Here it picks again for every object, so all of them
    // are compiled now.
    // (Over what an object has of its own: his parts swap in their shadow
    // level there, heroLod.ts.)
    const own = new Map<Object3D, Object3D['onBeforeShadow']>();
    for (const [o] of shown) {
      if (!(o as Mesh).isMesh) continue;
      const before = o.onBeforeShadow;
      own.set(o, before);
      o.onBeforeShadow = function (...args) {
        args[5].needsUpdate = true;
        before.apply(this, args);
      };
    }
    // The shadow maps as the place has them (lights() above): his room the
    // lamp's, the others the sun's. (Both, the hall's crowd went six times
    // into the lamp's cube for nothing: 40 M triangles in a frame.)
    gl.render(scene, camera);
    for (const [o, visible, culled] of shown) {
      o.visible = visible;
      o.frustumCulled = culled;
    }
    // Back to what each had: its own, or Object3D's (none).
    for (const [o, before] of own)
      if (before === Object3D.prototype.onBeforeShadow)
        delete (o as Partial<Object3D>).onBeforeShadow;
      else o.onBeforeShadow = before;
  });

  return (
    <>
      {/* Evening: room lights off, lamps on. The sun has set behind the
          mountains, so no direct light comes in: the window glows softly
          instead (area light), tinting the wall, sill and desk around it. */}
      {/* Low ambient so the lamps visibly light the room. */}
      <hemisphereLight ref={hemi} args={['#4a5784', '#2a2028', 0.34]} />
      <ambientLight ref={ambient} intensity={0.07} color="#8a96c8" />
      <rectAreaLight
        ref={windowGlow}
        position={[-0.9, 2.55, -2.62]}
        rotation={[0, Math.PI, 0]}
        width={2.2}
        height={1.5}
        intensity={3.2}
        color="#ff9a5c"
      />
      {/* Soft warm fill from the room side: faint while he works, rising as
          he stands so his face reads at the end (driven in useFrame). */}
      <directionalLight
        ref={fill}
        position={[4, 3, 7]}
        intensity={0.35}
        color="#ffd8b0"
      />
      {/* Floor lamp: the main light of the scene, with soft shadows. The
          normal offset and bias keep the walls free of shadow stripes.
          1024 a cube face (2026-11-19, was 2048): its map is six faces in one
          texture, so 2048 held 8192 x 4096 texels, 268 MB of GPU memory with
          its depth, a third of the page's. At 1024 his room's picture changes
          by 0.14-0.3 % of its pixels (mean 0.08/255), not to be seen. */}
      <pointLight
        ref={lamp}
        position={[-2.5, 1.95, -1.95]}
        color="#ffa45c"
        intensity={6}
        distance={9}
        decay={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.05}
        shadow-radius={6}
        shadow-camera-near={0.2}
        shadow-camera-far={10}
      />
      {/* Monitor glow on the face while typing. */}
      <pointLight
        ref={monitor}
        position={[-0.9, 1.45, -1.95]}
        color="#a8b8ff"
        intensity={3.5}
        distance={3}
        decay={2}
      />
      {/* His room: hidden while the camera is in another chapter. */}
      <group ref={roomGroup}>
        <primitive object={room.scene} />
        <Outside progress={progress} />
        <Screen desk={desk} reduced={reduced} audio={audio} />
        <Clock reduced={reduced} rewind={rewind} />
        <SpeakerViz room={room.scene} audio={audio} reduced={reduced} />
        <LightSwitch />
      </group>
      {/* The auditorium's lights: a dim house light from above (soft seat
          shadows) and the projected slide glowing back over the seats. Both
          exist from the start at zero intensity, so the scene swap never
          changes the light setup (no shader recompiles). */}
      <rectAreaLight
        ref={screenGlow}
        position={[SO.x + SLIDE.x - 0.15, SLIDE.y, SLIDE.z]}
        rotation={[0, Math.PI / 2, 0]}
        width={SLIDE.w}
        height={SLIDE.h}
        intensity={0}
        color="#dde5ff"
      />
      <primitive object={sunTarget} />
      <primitive object={stageTarget} />
      <directionalLight
        ref={sun}
        position={[SO.x + SUN_FROM[0], SUN_FROM[1], SUN_FROM[2]]}
        target={sunTarget}
        intensity={0}
        color="#ffe9cc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      <group ref={schoolGroup}>
        <Suspense fallback={null}>
          <SchoolScene
            reduced={reduced}
            school={school}
            mail={mail}
            audio={audio}
          />
        </Suspense>
      </group>
      <primitive object={officeSunTarget} />
      <primitive object={officeFillTarget} />
      <primitive object={deskFillTarget} />
      <primitive object={arenaTarget} />
      <primitive object={mismTarget} />
      {!ARENA_IN_FLOW && (
        <Suspense fallback={null}>
          <group ref={mismGroup} visible={false} position={MISM_ORIGIN}>
            <MismScene
              reduced={reduced}
              mism={mism}
              audio={audio}
              notes={notes}
            />
          </group>
        </Suspense>
      )}
      <group ref={valleyGroup} visible={false} position={VALLEY_ORIGIN}>
        <Suspense fallback={null}>
          <ValleyScene fly={fly} reduced={reduced} />
        </Suspense>
      </group>
      {arenaOn && (
        <group ref={arenaGroup} visible={false} position={ARENA_ORIGIN}>
          <ArenaScene arena={arena} />
        </group>
      )}
      <Suspense fallback={null}>
        <group ref={officeGroup} visible={false}>
          <OfficeScene
            office={office}
            desk={deskProgress}
            leave={grad}
            work={desk}
            reduced={reduced}
            onTip={onTip}
            head={headLocal}
            audio={audio}
          />
        </group>
      </Suspense>
      <group ref={body} scale={HERO_SCALE}>
        <primitive object={hero.scene} />
      </group>
      {/* His backpack: by his desk, in his hand, or on his back. */}
      <group ref={bagDown} visible={false}>
        <primitive object={bagObjects.down} />
      </group>
      {/* His diploma (chapter 3): a navy leather cover, a gold seal on its
          front, held in his right hand. */}
      <group ref={diploma} visible={false}>
        <group position={[0.02, 0.09, 0.05]} rotation={[0.2, 0, Math.PI / 2]}>
          <mesh castShadow>
            <boxGeometry args={[0.32, 0.24, 0.02]} />
            <meshStandardMaterial color="#14254f" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0, 0.0105]}>
            <circleGeometry args={[0.045, 24]} />
            <meshStandardMaterial
              color="#c9a64a"
              metalness={0.7}
              roughness={0.35}
            />
          </mesh>
        </group>
      </group>
      {/* The blue dry-erase marker in his hand (chapter 2): white barrel,
          blue cap end and band, a dark felt tip (at its -y end). */}
      <group ref={heldMarker} visible={false}>
        <mesh castShadow>
          <cylinderGeometry args={[0.016, 0.016, 0.15, 16]} />
          <meshStandardMaterial color="#efefeb" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[0.017, 0.017, 0.035, 16]} />
          <meshStandardMaterial color="#2f5fb8" roughness={0.35} />
        </mesh>
        <mesh position={[0, -0.04, 0]}>
          <cylinderGeometry args={[0.0165, 0.0165, 0.02, 16]} />
          <meshStandardMaterial color="#2f5fb8" roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.088, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.009, 0.026, 12]} />
          <meshStandardMaterial color="#1d2b4a" roughness={0.6} />
        </mesh>
      </group>
    </>
  );
}

useGLTF.preload(ROOM);
useLoader.preload(HeroLodLoader, HERO_LOD);
useGLTF.preload(HERO, DRACO);
useGLTF.preload(BAG, DRACO);
