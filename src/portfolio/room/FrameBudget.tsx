import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/** A frame counts as slow past this: a missed 60 Hz vsync, or under 50 fps
 *  on a faster display. */
const SLOW_MS = 20;
/** Longer than this is a one-off (a place mounting, its first upload, the
 *  tab coming back): the window it falls in is not judged. */
const HITCH_MS = 120;
/** A window: at least this long, and this many frames. */
const WINDOW_MS = 1500,
  WINDOW_FRAMES = 60;
/** Judged too slow when this share of its frames is. */
const SLOW_SHARE = 0.25;
/** Not judged for this long after the loader lifts, and after each change
 *  (the canvas resized, the new resolution settling). */
const START_MS = 3000,
  SETTLE_MS = 1500;
/** The frame time aimed for when lowering: under 60 Hz's 16.7 ms, with room. */
const AIM_MS = 14;
/** Steps of a quarter, and the lowest it goes. */
const STEP = 0.25,
  FLOOR = 1;

/**
 * Lowers the canvas's pixel ratio while frames keep missing their budget: as
 * far as the frames' mean says it takes (their cost taken as per pixel, so
 * as the ratio squared; rounded down to a quarter, at least one), then again
 * if that was not enough. Never raises it: under vsync there is no telling
 * how much headroom there is, so it cannot flip-flop.
 *
 * Measured 2026-11-19, warm, with no frame cap, on an M1 Pro: a frame's cost
 * here is mostly per pixel. His room runs about 72 fps at a pixel ratio of
 * 1.75, 88 at 1.5 and 105 at 1.25. On a smaller GPU or a bigger display,
 * stepping down is what keeps the scroll smooth.
 *
 * The ratio goes back through the Canvas's dpr prop (onLower), not straight
 * to the store: the Canvas sets its prop again whenever the page re-renders.
 */
export function FrameBudget({
  active,
  onLower,
}: {
  /** Judging from START_MS after this turns true (the loader lifted: its
   *  warm-up frames are no measure). */
  active: boolean;
  onLower: (dpr: number) => void;
}) {
  const w = useRef({ ms: 0, frames: 0, slow: 0, settle: START_MS });
  useFrame(({ viewport }, dt) => {
    const s = w.current,
      ms = dt * 1000;
    const reset = () => {
      s.ms = s.frames = s.slow = 0;
    };
    if (!active) {
      s.settle = START_MS;
      return reset();
    }
    if (document.hidden || ms > HITCH_MS) return reset();
    if (s.settle > 0) {
      s.settle -= ms;
      return reset();
    }
    s.ms += ms;
    s.frames++;
    if (ms > SLOW_MS) s.slow++;
    if (s.ms < WINDOW_MS || s.frames < WINDOW_FRAMES) return;
    const slow = s.slow / s.frames,
      mean = s.ms / s.frames;
    reset();
    if (slow < SLOW_SHARE || viewport.dpr <= FLOOR) return;
    const aim = viewport.dpr * Math.sqrt(AIM_MS / mean),
      next = Math.max(
        FLOOR,
        Math.min(viewport.dpr - STEP, Math.floor(aim / STEP) * STEP)
      );
    s.settle = SETTLE_MS;
    if (import.meta.env.DEV)
      console.info(
        `[room] ${Math.round(slow * 100)} % of frames over ${SLOW_MS} ms (mean ${mean.toFixed(1)}): pixel ratio ${viewport.dpr} -> ${next}`
      );
    onLower(next);
  });
  return null;
}
