import { MathUtils } from 'three';
import { BRIDGE } from './daySky';

/**
 * The page's scroll, in eight parts: the room story (400dvh), the rewind
 * into chapter 1 (280dvh), the school (360dvh), the mail into chapter 2
 * (240dvh), the interview at Neighbor (520dvh), hired, the way out of the
 * meeting room to his desk (380dvh), his leaving Neighbor into chapter 3
 * (460dvh), the master's: a security case in a business-school classroom
 * (520dvh), the way to Bridge, up out of the classroom and over Utah
 * Valley from Provo to Lehi (560dvh), and Bridge's office (520dvh). (The
 * commencement in the Marriott Center, built first, is kept
 * out of the flow: ARENA_IN_FLOW; its part has no length.) See .room-track
 * in room.css.
 */
/** Whether chapter 3 is the commencement (the arena) or the classroom. */
export const ARENA_IN_FLOW = false;
const SEG = {
  room: 400,
  rewind: 280,
  school: 360,
  mail: 240,
  office: 520,
  desk: 380,
  grad: 460,
  mism: ARENA_IN_FLOW ? 0 : 520,
  arena: ARENA_IN_FLOW ? 440 : 0,
  fly: 560,
  bridge: 520,
};
const TOTAL = Object.values(SEG).reduce((a, b) => a + b, 0);
const OFFICE_START = SEG.room + SEG.rewind + SEG.school + SEG.mail;
const DESK_START = OFFICE_START + SEG.office;
const GRAD_START = DESK_START + SEG.desk;
const MISM_START = GRAD_START + SEG.grad;
const ARENA_START = MISM_START + SEG.mism;
const FLY_START = ARENA_START + SEG.arena;
const BRIDGE_START = FLY_START + SEG.fly;

/** Where the room story ends (page 0..1): the welcome. */
export const ROOM_END = SEG.room / TOTAL;
/** Chapter 1's progress where the camera has arrived in front of him and the
 *  chapter's card is up (the school is told there). */
export const SCHOOL_HOLD = 0.52;
/** Chapter 2's progress where the offer's card is up: the problem solved,
 *  he got the job. (The interview's own card passes without a stop: the
 *  interview holds once, at its end.) */
export const OFFICE_END_HOLD = 0.93;
/** Where the scroll brakes (page 0..1, in order): the welcome, chapter 1's
 *  card, and chapter 2's closing card. RoomPortfolio holds each until its
 *  ring is filled. */
/** Desk progress where Neighbor's card is up (held). */
export const DESK_HOLD = 0.86;
/** Chapter 3's progress where the closing card is up (held). */
export const ARENA_HOLD = 0.93;
/** Chapter 3's progress (the classroom) where its closing card is up (held). */
export const MISM_HOLD = 0.94;
/** Chapter 4's progress (Bridge's office) where his Bridge card is up (held). */
export const BRIDGE_HOLD = 0.93;
export const HOLDS = [
  ROOM_END,
  (SEG.room + SEG.rewind + SCHOOL_HOLD * SEG.school) / TOTAL,
  (OFFICE_START + OFFICE_END_HOLD * SEG.office) / TOTAL,
  (DESK_START + DESK_HOLD * SEG.desk) / TOTAL,
  ARENA_IN_FLOW
    ? (ARENA_START + ARENA_HOLD * SEG.arena) / TOTAL
    : (MISM_START + MISM_HOLD * SEG.mism) / TOTAL,
  (BRIDGE_START + BRIDGE_HOLD * SEG.bridge) / TOTAL,
];

export const split = (page: number) => {
  const d = page * TOTAL;
  return {
    room: MathUtils.clamp(d / SEG.room, 0, 1),
    rewind: MathUtils.clamp((d - SEG.room) / SEG.rewind, 0, 1),
    school: MathUtils.clamp((d - SEG.room - SEG.rewind) / SEG.school, 0, 1),
    mail: MathUtils.clamp(
      (d - SEG.room - SEG.rewind - SEG.school) / SEG.mail,
      0,
      1
    ),
    office: MathUtils.clamp((d - OFFICE_START) / SEG.office, 0, 1),
    desk: MathUtils.clamp((d - DESK_START) / SEG.desk, 0, 1),
    grad: MathUtils.clamp((d - GRAD_START) / SEG.grad, 0, 1),
    mism: SEG.mism ? MathUtils.clamp((d - MISM_START) / SEG.mism, 0, 1) : 0,
    arena: SEG.arena ? MathUtils.clamp((d - ARENA_START) / SEG.arena, 0, 1) : 0,
    fly: MathUtils.clamp((d - FLY_START) / SEG.fly, 0, 1),
    bridge: MathUtils.clamp((d - BRIDGE_START) / SEG.bridge, 0, 1),
  };
};

/** Rewind progress where the scenes swap, while the cream covers the screen. */
export const SWITCH = 0.9;

const ease = (a: number, b: number, p: number) => MathUtils.smoothstep(p, a, b);
const smoother = (a: number, b: number, p: number) =>
  MathUtils.smootherstep(p, a, b);

/**
 * Beats of the rewind (0..1), shared by the camera, clock, year counter,
 * captions and audio so they stay in step:
 * - the welcome fades and he turns to look at the wall clock;
 * - the camera glides to the clock while its hands spin backward and the year
 *   rolls back from this year to 2019 (both settle together);
 * - the camera dives into the dial, which washes the screen cream;
 * - the next chapter's title card comes up on the cream.
 */
export function rewindBeats(r: number) {
  return {
    leave: ease(0, 0.1, r), // welcome out, wave → idle
    look: ease(0.02, 0.3, r), // he turns toward the clock
    approach: smoother(0.05, 0.55, r), // camera glides to the clock
    spin: smoother(0.25, 0.62, r), // hands rewind; year now → 2019
    counter: ease(0.22, 0.3, r), // year counter shows
    dive: ease(0.55, 0.88, r), // into the dial
    flash: ease(0.82, 0.9, r), // dial cream fills the screen
    card: ease(0.89, 0.97, r), // chapter title
    // Sound goes muffled while time runs back, then opens on the new chapter.
    muffle: ease(0.12, 0.5, r) * (1 - ease(0.86, 0.99, r)),
    // The room's song fades away into the dive; chapter 1 brings its own.
    musicOut: ease(0.3, 0.86, r),
  };
}

// The wall clock on the left wall (three.js axes), 1.5 cm off the wall, above
// and in front of the floor lamp so its light falls on the dial.
export const CLOCK_POSITION: [number, number, number] = [-3.085, 3.05, -1.25];

/**
 * Beats of the school (0..1): the cream lifts off the lecture hall's clock, the
 * camera pulls back over the rows to show the hall, then moves in over his
 * shoulder to the laptop.
 */
export function schoolBeats(s: number) {
  return {
    reveal: ease(0.02, 0.12, s), // cream lifts; the title card goes
    pull: smoother(0.03, 0.5, s), // back from the clock across the hall
    push: smoother(0.56, 0.94, s), // over his shoulder to the laptop
  };
}

// The lecture hall sits far off to the side of the room (never in the room's
// views; the room is hidden while in school). Positions inside it are local.
export const SCHOOL_ORIGIN: [number, number, number] = [60, 0, 0];

// The auditorium's dimmed house light from above (local to SCHOOL_ORIGIN):
// position and aim of the shadow-casting key light.
export const SUN_FROM: [number, number, number] = [-4, 16, 2];
export const SUN_TO: [number, number, number] = [-5.9, 0, 0];

/** The year counter: from now (the wall clock shows the viewer's real time,
 *  so the counter starts from their real year, never before 2026) back to
 *  2019, his first year at BYU. */
const NOW_YEAR = Math.max(2026, new Date().getFullYear());
export const YEARS = Array.from(
  { length: NOW_YEAR - 2018 },
  (_, i) => NOW_YEAR - i
);

/**
 * Beats of the mail into chapter 2 (0..1): over the laptop's last screen a
 * mail notification slides in and opens (the invitation to the onsite
 * interview); the camera comes square to the screen and in close on the
 * message, and its white fades over everything; then a year counter rolls on
 * from 2019 to 2022 and the chapter's card comes up on the white.
 */
export function mailBeats(m: number) {
  return {
    notify: ease(0.03, 0.14, m), // the banner slides in
    open: ease(0.2, 0.34, m), // the mail opens over the editor
    square: smoother(0.06, 0.38, m), // the camera comes square to the screen
    dive: smoother(0.3, 0.55, m), // in close on the message
    flash: ease(0.44, 0.62, m), // the mail fades away into white
    counter: ease(0.47, 0.6, m), // ...as 2019 comes up over it
    roll: smoother(0.58, 0.72, m), // 2019 → 2022, a page turn each
    card: ease(0.71, 0.78, m), // chapter 2's title; then, after a breath,
    // the whoosh (audio.ts MAIL_RISE_*) pulls it into the meeting room as
    // the mail ends and the white lifts.
    // The sound goes muffled as the camera closes in, and reopens as it
    // arrives.
    muffle: ease(0.32, 0.56, m) * (1 - ease(0.9, 1, m)),
    // Chapter 1's song fades away into the mail, gone by the white.
    musicOut: ease(0.25, 0.62, m),
  };
}

/** Mail progress where the scenes swap, while the white covers the screen. */
export const MAIL_SWITCH = 0.66;

/**
 * Beats of the interview (0..1): the white lifts off the whiteboard, seen
 * straight on, and the camera moves straight in on the problem; he thinks it through at the board (the queen's lines are
 * drawn), turns and talks it over with them, then writes the pseudo-code
 * (the camera beside the board), finishes and turns back to them.
 */
export function officeBeats(o: number) {
  return {
    reveal: ease(0.02, 0.1, o), // white lifts; the title card goes
    pull: smoother(0.02, 0.34, o), // straight in on the problem, from the front
    think: ease(0.08, 0.16, o) * (1 - ease(0.36, 0.42, o)), // at the board
    reach: smoother(0.12, 0.33, o), // the queen's lines and the path drawn
    talk: ease(0.38, 0.44, o) * (1 - ease(0.52, 0.57, o)), // turned to them
    across: smoother(0.35, 0.45, o), // the camera, behind him, onto them
    side: smoother(0.52, 0.62, o), // the camera moves beside the board
    write: smoother(0.62, 0.86, o), // the pseudo-code written out
    done: ease(0.86, 0.92, o), // he steps back and turns to them
  };
}

/**
 * Beats of the way to his desk (0..1), hired: the offer's card goes; the
 * camera leaves the meeting room through its glass door and flies out over
 * the corridor to the east windows, and looking out glides along them while
 * a day passes outside (daySky.ts); it turns to him, at his desk, typing,
 * the marketplace on his monitor; and Neighbor's card comes up.
 */
export function deskBeats(d: number) {
  return {
    leave: ease(0, 0.06, d), // the offer's card goes
    fly: ease(0.04, 0.68, d), // on its way (RoomScene's DESK_KEYS_AT time it)
    // A day passing outside, evenly, while the camera looks out of the
    // east windows (sunset as it arrives, sunrise as it leaves).
    day: MathUtils.clamp((d - 0.2) / 0.42, 0, 1),
    light: ease(0.12, 0.42, d), // the meeting room's light hands over to his desk's
    // The year counter over the windows: 2022 rolls on to 2024 as the day
    // passes, a calendar's pages turning.
    counter: ease(0.2, 0.26, d) * (1 - ease(0.6, 0.66, d)),
    roll: smoother(0.27, 0.58, d),
    card: ease(0.74, 0.82, d), // Neighbor's card
  };
}

/** Desk progress where he is moved to his desk: the camera is out of the
 *  meeting room's door by then, the room behind it. */
export const DESK_SWITCH = 0.28;

/**
 * Beats of leaving Neighbor (grad progress 0..1), one continuous camera move
 * hiding a cut: Neighbor's card goes and his hands stop on the keys; the
 * camera comes round to the aisle at his right; his hands settle on his knees
 * (SitToStand's first frame) as his chair rolls back, and as he starts to
 * stand the camera pans away right, to the windows, and lingers on the view
 * while the day outside goes on (from the morning through the afternoon and
 * the sunset into the night: `day`, daySky.ts past 1); then on round to look
 * down the aisle. While it looks out (`cut`), he has his backpack on; as it
 * comes round he walks (Walking, scrubbed by the ground covered) from behind
 * the camera, into the shot and off down the aisle, the camera following. The
 * white comes up, 2024 on it, then chapter 3's card. (His filmed motion,
 * taking the bag and slinging it on, looked staged with the bag following
 * his hands; then a hard cut stopped the scene dead: 2026-10-15, the user's
 * call for a pan.)
 */
export function gradBeats(g: number) {
  return {
    leave: ease(0, 0.03, g), // Neighbor's card goes
    stop: ease(0.01, 0.05, g), // his hands still on the keys
    toA: ease(0.02, 0.12, g), // the camera to shot A
    seat: ease(0.06, 0.14, g), // typing → seated, hands on knees
    chair: 0.55 * ease(0.06, 0.18, g) + 0.1 * ease(0.22, 0.34, g), // m
    rise: MathUtils.clamp((g - 0.16) / 0.2, 0, 1), // SitToStand
    panA: smoother(0.22, 0.34, g), // the camera turns away to the view
    dwell: smoother(0.34, 0.56, g), // on the view, drifting
    panB: smoother(0.54, 0.67, g), // round to look down the aisle
    cut: g >= 0.45, // (looking out) his bag on
    out: MathUtils.clamp((g - 0.56) / 0.36, 0, 1), // along the aisle
    // The day outside goes on, into the night (daySky.ts: 1 the morning,
    // then 1 + BRIDGE the afternoon, + 0.46 the night, the moon up).
    day: 1 + BRIDGE * smoother(0.04, 0.3, g) + 0.46 * smoother(0.3, 0.58, g),
    counter: ease(0.86, 0.9, g), // 2024
    roll: 0,
    flash: ease(0.86, 0.94, g),
    card: ease(0.94, 0.99, g), // chapter 3's title
    muffle: ease(0.84, 0.94, g) * (1 - ease(0.98, 1, g)),
    musicOut: ease(0.7, 0.92, g), // chapter 2's song fades away
  };
}

/** Grad progress where the scenes swap, while the white covers the screen. */
export const GRAD_SWITCH = 0.97;

/**
 * Beats of the commencement (0..1): the white lifts off the Marriott
 * Center's center-hung screen, showing the ceremony; the camera pulls back
 * from it over the bowl, thousands of graduates in navy on the floor; it
 * comes down to the floor, to the line of graduates waiting in the roped
 * aisle by the stage, him among them; his name comes up on the screens and
 * he walks across the stage, takes his diploma, turns to us with it.
 */
export function arenaBeats(a: number) {
  return {
    reveal: ease(0.02, 0.1, a), // white lifts; the title card goes
    pull: smoother(0.02, 0.32, a), // back from the screen, over the bowl
    down: smoother(0.3, 0.46, a), // down to the floor, to the line
    name: ease(0.46, 0.5, a), // his name on the screens
    walk: smoother(0.5, 0.72, a), // up and across the stage
    diploma: ease(0.66, 0.72, a), // the diploma, handed to him
    turn: smoother(0.74, 0.84, a), // he turns to us with it
    card: ease(0.86, 0.92, a), // chapter 3's closing card
  };
}

/** Where the arena is (far from every other set; hidden elsewhere). */
export const ARENA_ORIGIN: [number, number, number] = [0, 0, 600];

/**
 * Beats of chapter 3 (0..1), a security case in the MISM's classroom: the
 * white lifts off the room, seen from high in its back corner (as in the
 * user's photo), the case on the screens, the professor asking the room, the
 * class there (their silhouettes, as chapter 1's); the camera glides down
 * over the tiers to him, over his shoulder: he works the case on his laptop
 * (typed by the scroll), his notes; then back behind him, the screens over
 * his head, as the class's answers go up on the right screen, the controls
 * one by one (MFA on the stolen VPN password, step 2, boxed: the cheapest
 * place to break the chain, as his notes have it); his master's card. (His
 * hand going up with the answer, Mixamo's Hand Raising, was cut on
 * 2026-11-19 at the user's request, and the chapter shortened by its 100dvh:
 * the master's is told briefly. The beats before it keep their scroll
 * distances.)
 */
export function mismBeats(m: number) {
  return {
    reveal: ease(0.02, 0.12, m), // the white lifts; the title card goes
    est: smoother(0.0, 0.36, m), // the establishing glide
    toHim: smoother(0.34, 0.52, m), // down over the tiers to him
    // His notes are typed on a clock from the start (RoomScene); from here
    // they are no longer started over, and are complete by this beat's end.
    notes: MathUtils.clamp((m - 0.45) / 0.24, 0, 1),
    question: ease(0.22, 0.29, m), // the case's question on the right screen
    toScreens: smoother(0.66, 0.8, m), // back behind him, the screens over
    answer: ease(0.74, 0.87, m), // the controls go up, one by one
    card: ease(0.88, 0.93, m), // his master's card
  };
}

/** Where the classroom is (far from every other set; hidden elsewhere). */
export const MISM_ORIGIN: [number, number, number] = [0, 0, 900];
/**
 * Beats of the way to Bridge (fly progress 0..1), into chapter 4: his
 * master's card goes; in the classroom the camera rises over him to the
 * ceiling, looking down, and punches up through it (a white like a cloud's);
 * it comes out high over BYU, looking straight down onto the campus and the
 * "Y" on its mountain, and climbs, turning north up Utah Valley; over the
 * lake in the sunset, along I-15, the towns' lights coming on, it flies to
 * Lehi; on the way the listings of Bridge's marketplace pop up over the
 * towns as pins, its search bar over them; it comes down over Lehi's
 * offices to Bridge's, to his lit window; the white, 2025, chapter 4's card.
 * (valley.ts, ValleyScene.tsx; 2026-11-20, the user's pick of three.)
 */
export function flyBeats(f: number) {
  return {
    leave: ease(0, 0.03, f), // his master's card goes
    rise: smoother(0.01, 0.19, f), // up over him to the ceiling
    punch: ease(0.12, 0.185, f) * (1 - ease(0.2, 0.27, f)), // through it
    path: smoother(0.19, 0.93, f), // the flight, along its path
    campus: ease(0.2, 0.25, f) * (1 - ease(0.3, 0.36, f)), // "BYU" over it
    tilt: smoother(0.21, 0.4, f), // from straight down to ahead, north
    labels: ease(0.3, 0.38, f) * (1 - ease(0.8, 0.86, f)), // the towns
    dusk: ease(0.3, 0.85, f), // the valley's lights come on
    pins: MathUtils.clamp((f - 0.44) / 0.28, 0, 1), // the clusters pop up
    // Over Lehi, its cluster opens into its listings' cards.
    split: MathUtils.clamp((f - 0.71) / 0.09, 0, 1),
    ui: ease(0.44, 0.49, f) * (1 - ease(0.76, 0.81, f)), // its search bar
    window: smoother(0.76, 0.9, f), // the aim onto his window
    flash: ease(0.905, 0.955, f), // the white at his window
    counter: ease(0.92, 0.95, f), // 2024, rolling on to 2025
    roll: smoother(0.93, 0.96, f),
    card: ease(0.95, 0.99, f), // chapter 4's title
    muffle: ease(0.88, 0.95, f) * (1 - ease(0.98, 1, f)),
    // Chapter 3's song fades away up through the classroom's ceiling, under
    // the whoosh; chapter 4's comes up as the white lifts off BYU, and plays
    // on over the valley, into his window and through Bridge's office (the
    // user's call, 2026-11-22: it had come in only with the card at his
    // window).
    musicOut: ease(0.04, 0.19, f),
    music: ease(0.19, 0.27, f),
  };
}

/** Fly progress where the scenes swap, while the white covers the screen. */
export const FLY_SWITCH = 0.19;

/** Where the valley is (far from every other set; hidden elsewhere). */
export const VALLEY_ORIGIN: [number, number, number] = [0, 0, 3000];

/** Fly progress where Bridge's office takes over, while the white at his
 *  window covers the screen. */
export const BRIDGE_SWITCH = 0.97;

/**
 * Beats of chapter 4 (0..1), Bridge's office (bridge.ts, after the user's
 * floor plan, 2026-11-22): the white lifts (2025 and the card go) off the
 * office seen through its west glass from the corridor, the whiteboard on
 * its far wall, as through his window from outside; the camera comes in
 * through the open door and across the room to the whiteboard (Bridge, what
 * it is for, his valuation pipeline, the marketplace); it turns round to
 * him at his desk against the south wall, over his right shoulder: his
 * monitor (the marketplace), his laptop on its stand (the pipeline's code);
 * up to the room's north-west, high, over him and the CEO at their desks;
 * his Bridge card (held).
 */
export function bridgeBeats(b: number) {
  return {
    reveal: ease(0.02, 0.1, b), // the white lifts; 2025 and the card go
    enter: smoother(0.0, 0.36, b), // in through the door, to the whiteboard
    toHim: smoother(0.46, 0.62, b), // round to him, over his shoulder
    wide: smoother(0.76, 0.88, b), // up over him and the CEO
    card: ease(0.86, 0.92, b), // his Bridge card
  };
}
