import { Component, Suspense, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { MathUtils, PCFSoftShadowMap } from 'three';
import { RoomAudio } from './audio';
import { RoomScene } from './RoomScene';
import { FrameBudget } from './FrameBudget';
import { barLight } from './barLight';
import { ChapterRail } from './ChapterRail';
import { loaded } from './loadProgress';
import type { RailApi } from './ChapterRail';
import {
  CHAPTERS,
  HOLDS,
  HOLD_PLAY,
  mailBeats,
  officeBeats,
  deskBeats,
  gradBeats,
  arenaBeats,
  mismBeats,
  flyBeats,
  bridgeBeats,
  endBeats,
  rewindBeats,
  schoolBeats,
  split,
  SWITCH,
  YEARS,
} from './story';
import './room.css';

/** A job card's figures, before its points (2026-11-22, the user's pick of
 *  three mock-ups: what a reader takes in at a glance). */
function Figures({ items }: { items: [string, string][] }) {
  return (
    <ul className="room-figures">
      {items.map(([n, label]) => (
        <li key={label}>
          <strong>{n}</strong>
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}

/** A job card's link to the company (where "Next: …" was: the story goes
 *  on by itself). */
function Visit({ href, name }: { href: string; name: string }) {
  return (
    <a className="room-visit" href={href} target="_blank" rel="noreferrer">
      <span>Visit</span>
      {name}
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h13" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    </a>
  );
}

/** The links' arrow out (they open in a new tab). */
function OutArrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 16 16 8" />
      <path d="M9.5 8H16v6.5" />
    </svg>
  );
}

class RoomBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="room-error">The 3D room could not load in this browser.</p>
    ) : (
      this.props.children
    );
  }
}

/** The loading screen's percentage: the models in (to 75 %: their bytes, then
 *  read; loadProgress.ts), then the warm-up (the rest: RoomScene draws every
 *  place once behind it, so nothing compiles or uploads mid-story). Shown
 *  eased toward that, a frame at a time and never back; 100 only once ready.
 *  (After the last byte there are still about 3 s: building the scene, its
 *  first frame, the warm-up. On a fast connection that is most of the wait.) */
const LOAD_SHARE = 75;

/** Dust in the loading screen's air: a fixed scatter, then CSS alone (it
 *  keeps drifting while the page is too busy to update anything else). */
const MOTES = Array.from({ length: 14 }, (_, i) => {
  const r = (k: number) => {
    const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    left: `${(r(1) * 100).toFixed(1)}%`,
    top: `${(r(2) * 100).toFixed(1)}%`,
    '--s': `${(1.2 + r(3) * 2.2).toFixed(1)}px`,
    '--d': `${(9 + r(4) * 9).toFixed(1)}s`,
    '--w': `${(-r(5) * 18).toFixed(1)}s`,
    '--o': (0.25 + r(6) * 0.5).toFixed(2),
    '--x': `${Math.round(r(7) * 60 - 30)}px`,
  } as CSSProperties;
});

/**
 * The loading screen (2026-11-25, the user's pick of three mock-ups,
 * art/portfolio-room/loader-options: A, the focus pull). The room's opening
 * view, blurred (a thumbnail of it, scripts/build-loader-poster.mjs), comes
 * into focus as it loads: a sharper copy fades in over it with the
 * percentage. In the middle, "Setting up the room" in the top bar's small
 * caps, a hairline that fills, and the number. Once ready it fades off the
 * live scene, which settles from a touch larger (.room-scene).
 */
function Loader({
  ready,
  warmUp,
}: {
  ready: boolean;
  warmUp: RefObject<number>;
}) {
  const num = useRef<HTMLSpanElement>(null),
    fill = useRef<HTMLElement>(null),
    focus = useRef<HTMLDivElement>(null),
    shown = useRef(0);
  useEffect(() => {
    const write = (n: number) => {
      if (num.current) num.current.textContent = `${n}%`;
      fill.current?.style.setProperty('transform', `scaleX(${n / 100})`);
      focus.current?.style.setProperty(
        'opacity',
        (0.9 * (n / 100) ** 1.4).toFixed(3)
      );
    };
    if (ready) return write(100);
    let raf = 0,
      last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000),
        target = Math.min(
          99,
          LOAD_SHARE * loaded() + (100 - LOAD_SHARE) * warmUp.current
        );
      last = now;
      shown.current +=
        Math.max(0, target - shown.current) * (1 - Math.exp(-6 * dt));
      write(Math.floor(shown.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, warmUp]);
  return (
    <div className="room-loader" data-done={ready}>
      <div className="room-loader-blur" />
      <div ref={focus} className="room-loader-focus" />
      <div className="room-loader-veil" />
      <div className="room-loader-dust">
        {MOTES.map((style, i) => (
          <i key={i} style={style} />
        ))}
      </div>
      <div className="room-loader-status">
        <p>Setting up the room</p>
        <div>
          <span className="room-loader-track">
            <i ref={fill} />
          </span>
          <span ref={num} className="room-loader-num">
            0%
          </span>
        </div>
      </div>
    </div>
  );
}

/** Caption windows over the 0..1 story progress: [fade in, fade out]. */
/** Bridge's marketplace search over the valley (natural language). */
const SEARCH = 'profitable businesses in Utah County under $1.5M';
const captions = [
  { id: 'intro', from: -1, to: 0.14 },
  { id: 'welcome', from: 0.72, to: 2 },
] as const;

// The hold ring's circumference (r 20 in a 46 px box).
const HOLD_RING = 2 * Math.PI * 20;

// The story playing by itself (the chapter rail's Play): how fast the scroll
// moves on (dvh a second), and slower while a card or caption is up to read;
// it eases between them (per second), and waits on each hold (HOLD_PLAY).
const PLAY_FAST = 80,
  PLAY_READ = 24,
  PLAY_EASE = 2.5;

const fade = (p: number, from: number, to: number) =>
  Math.min(1, Math.max(0, Math.min((p - from) / 0.06, (to - p) / 0.06)));

// The year counter turns from cream (over the night room) to ink (on the
// dial's cream) as the screen washes over.
const CREAM = [244, 234, 214],
  INK = [42, 37, 33];
const mix = (t: number) =>
  `rgb(${CREAM.map((c, i) => Math.round(c + (INK[i] - c) * t)).join(',')})`;

/**
 * How /portfolio shows on a phone held upright, while the user compares two
 * ways (2026-11-25; without ?fit, as before):
 * - ?fit=1: the desktop page itself, 1440x900 in a frame, shrunk to the
 *   screen (FitDesktop.tsx, loaded instead of this page: App.tsx). This page
 *   is what the frame shows.
 * - ?fit=2: the scene as on a desktop, in a 16:10 band under the top bar,
 *   and the words below it at a phone's size, so nothing covers the scene
 *   (room.css, [data-fit='2']).
 */
export default function RoomPortfolio() {
  const [band] = useState(
    () => new URLSearchParams(location.search).get('fit') === '2'
  );
  return <RoomPage band={band} />;
}

/** ?fit=1's frame: the desktop page's size (FitDesktop.tsx). */
const DESKTOP = { w: 1440, h: 900 };

/** The canvas's starting pixel ratio: in ?fit=1's frame, no sharper than
 *  the frame is shown (shrunk to the screen). */
function startDpr() {
  try {
    if (window.parent !== window)
      return Math.min(
        1.75,
        Math.max(
          1,
          Math.min(
            window.parent.innerWidth / DESKTOP.w,
            window.parent.innerHeight / DESKTOP.h
          ) * devicePixelRatio
        )
      );
  } catch {
    // (Framed elsewhere: as usual.)
  }
  return 1.75;
}

function RoomPage({ band }: { band: boolean }) {
  const scroll = useRef<HTMLDivElement>(null),
    page = useRef(0), // eased scroll over the whole page
    progress = useRef(0), // the room story, 0..1
    rewind = useRef(0), // the rewind into chapter 1, 0..1
    school = useRef(0), // chapter 1, the lecture hall, 0..1
    mail = useRef(0), // the mail into chapter 2, 0..1
    office = useRef(0), // chapter 2, the interview at Neighbor, 0..1
    desk = useRef(0), // hired: the way to his desk, 0..1
    grad = useRef(0), // the admission mail into chapter 3, 0..1
    arena = useRef(0), // chapter 3, the commencement (out of the flow), 0..1
    mism = useRef(0), // chapter 3, the MISM's classroom, 0..1
    fly = useRef(0), // the way to Bridge, over Utah Valley, 0..1
    bridge = useRef(0), // chapter 4, Bridge's office, 0..1
    end = useRef(0), // the ending, back in his room, 0..1
    pointer = useRef({ x: 0, y: 0 }),
    caption = useRef<Record<string, HTMLElement | null>>({}),
    hint = useRef<HTMLDivElement>(null),
    hold = useRef<HTMLDivElement>(null),
    holdArc = useRef<SVGCircleElement>(null),
    // The scroll's brakes (story.ts HOLDS), each: where (page), fill 0..1
    // (input), shown (eased, for the ring), released once full, and when it
    // bit (ms).
    brake = useRef(
      HOLDS.map((page) => ({
        page,
        fill: 0,
        shown: 0,
        released: false,
        at: 0,
      }))
    ),
    year = useRef<HTMLDivElement>(null),
    yearStrip = useRef<HTMLDivElement>(null),
    flash = useRef<HTMLDivElement>(null),
    flashWhite = useRef<HTMLDivElement>(null),
    // Bridge's marketplace search, over the valley's listings.
    search = useRef<HTMLDivElement>(null),
    searchText = useRef<HTMLSpanElement>(null),
    searchCount = useRef<HTMLDivElement>(null),
    sky = useRef<HTMLDivElement>(null),
    // The top bar's two ends (the name, the links).
    barEnds = useRef<{ left: HTMLElement | null; right: HTMLElement | null }>({
      left: null,
      right: null,
    }),
    // The chapter rail (ChapterRail.tsx), the shade it opens over, and the
    // dip to dark a jump cuts through.
    rail = useRef<RailApi>(null),
    railShade = useRef<HTMLDivElement>(null),
    dip = useRef<HTMLDivElement>(null),
    // Set by a jump: the next frame lands where the scroll is, uneased.
    snap = useRef(false),
    // A jump under way: where to (page), and its timer.
    jump = useRef({ to: -1, timer: 0 }),
    // The story playing by itself: on, where the scroll is (px, unrounded),
    // how fast (dvh a second), and whether it played to the end.
    auto = useRef({ on: false, top: 0, speed: 0, ended: false });
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const audio = useRef<RoomAudio | null>(null),
    soundButton = useRef<HTMLButtonElement>(null);
  const [sound, setSound] = useState(false);
  // The canvas's highest pixel ratio, lowered by FrameBudget a step at a time
  // if frames keep missing their budget.
  const [maxDpr, setMaxDpr] = useState(startDpr);
  // Every place in and drawn once (RoomScene's warm-up): the loader lifts.
  const [ready, setReady] = useState(false);
  // 0..1 through that warm-up, for the loader's percentage.
  const warmUp = useRef(0);

  // Sound starts on the first click, tap or key press anywhere (browsers
  // require a gesture; scrolling does not count) unless the viewer turned it
  // off before. It pauses while the tab is hidden.
  useEffect(() => {
    const a = new RoomAudio();
    audio.current = a;
    a.onChange = setSound;
    const gesture = (e: Event) => {
      if (!soundButton.current?.contains(e.target as Node)) a.start();
    };
    const kinds = ['pointerdown', 'keydown', 'touchend'] as const;
    for (const k of kinds) window.addEventListener(k, gesture, true);
    const visibility = () =>
      a.setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', visibility);
    return () => {
      for (const k of kinds) window.removeEventListener(k, gesture, true);
      document.removeEventListener('visibilitychange', visibility);
      a.dispose();
      audio.current = null;
    };
  }, []);
  const toggleSound = () => {
    const a = audio.current;
    if (a) a.setEnabled(!a.playing);
  };

  // Native scroll; the scene follows an eased copy of it.
  useEffect(() => {
    let frame = 0,
      last = performance.now(),
      lastRoll = 0,
      lastFlip = 0,
      lastFlipOn = 0,
      lastLeaf = 0,
      lastFlipDesk = 0,
      lastLeafDesk = 0,
      lastFlipGrad = 0,
      lastLeafGrad = 0,
      lastFlipFly = 0,
      lastFlipEnd = 0,
      // Whether each end of the top bar is on a light scene (ink-dark), as
      // it stands (a remount keeps the classes); and the chapter rail.
      inkLeft = !!barEnds.current.left?.classList.contains('is-ink'),
      inkRight = !!barEnds.current.right?.classList.contains('is-ink'),
      inkRail = false,
      // How much there was to read last frame (the captions' and cards'
      // opacity, at most): the story playing by itself slows for it.
      reading = 0;
    // Playing by itself: the scroll moves on, slower while there is a card
    // to read, and waits on each hold, its ring filling, before going on.
    const play = (e: HTMLDivElement, dt: number) => {
      const a = auto.current,
        span = Math.max(1, e.scrollHeight - e.clientHeight);
      if (Math.abs(e.scrollTop - a.top) > 2) a.top = e.scrollTop;
      const stops = brake.current,
        k = stops.findIndex((s) => !s.released && s.page * span > a.top - 1),
        b = stops[k];
      if (b && a.top >= b.page * span - 1) {
        a.speed = 0;
        b.fill = Math.min(1, b.fill + dt / HOLD_PLAY[k]);
        if (b.fill >= 1) b.released = true;
        return;
      }
      const want = MathUtils.lerp(
        PLAY_FAST,
        PLAY_READ,
        MathUtils.smoothstep(reading, 0.2, 0.9)
      );
      a.speed += (want - a.speed) * (1 - Math.exp(-dt * PLAY_EASE));
      let top = a.top + ((a.speed * e.clientHeight) / 100) * dt;
      if (b) top = Math.min(top, b.page * span);
      if (top >= span - 1) {
        top = span;
        a.on = false;
        a.ended = true;
        rail.current?.setState('ended');
      }
      a.top = top;
      e.scrollTop = top;
    };
    const tick = (now: number) => {
      const e = scroll.current;
      if (e) {
        const dt = Math.min(0.05, (now - last) / 1000);
        if (auto.current.on) play(e, dt);
        const target =
            e.scrollTop / Math.max(1, e.scrollHeight - e.clientHeight),
          // A jump lands with no easing, and with no page turns or whoosh
          // for the ground it skipped.
          snapped = snap.current;
        snap.current = false;
        if (snapped) audio.current?.jumped();
        const sfx = snapped ? null : audio.current;
        page.current =
          reduced || snapped
            ? target
            : page.current + (target - page.current) * (1 - Math.exp(-dt * 4));
        if (auto.current.ended && target < 0.995) {
          auto.current.ended = false;
          rail.current?.setState('idle');
        }
        let read = 0;
        const parts = split(page.current),
          rb = rewindBeats(parts.rewind),
          sb = schoolBeats(parts.school),
          mb = mailBeats(parts.mail),
          ob = officeBeats(parts.office),
          db = deskBeats(parts.desk),
          gb = gradBeats(parts.grad),
          ab = arenaBeats(parts.arena),
          ib = mismBeats(parts.mism),
          fb = flyBeats(parts.fly),
          bb = bridgeBeats(parts.bridge),
          eb = endBeats(parts.end),
          // Chapter 3's opening: the arena's or the classroom's (one is
          // out of the flow; its beats stay at 0).
          reveal3 = Math.max(ab.reveal, ib.reveal);
        progress.current = parts.room;
        rewind.current = parts.rewind;
        school.current = parts.school;
        mail.current = parts.mail;
        office.current = parts.office;
        desk.current = parts.desk;
        grad.current = parts.grad;
        arena.current = parts.arena;
        mism.current = parts.mism;
        fly.current = parts.fly;
        bridge.current = parts.bridge;
        end.current = parts.end;
        const show = (el: HTMLElement | null | undefined, o: number) => {
          if (!el) return;
          read = Math.max(read, o);
          el.style.opacity = String(o);
          el.style.transform = `translateY(${(1 - o) * 24}px)`;
          el.toggleAttribute('inert', o < 0.5);
        };
        for (const c of captions) {
          const o = fade(parts.room, c.from, c.to);
          show(
            caption.current[c.id],
            c.id === 'welcome' ? o * (1 - rb.leave) : o
          );
        }
        // Rewind: the year rolls back with the clock, the dial's cream washes
        // over, and chapter 1's title comes up under the year. Into chapter
        // 2 it rolls on again, 2019 to 2022, as the mail's white washes over.
        if (year.current && yearStrip.current) {
          const y = year.current,
            last = YEARS.length - 1,
            // Hired, on the way to his desk: 2022 rolls on to 2024 over
            // the east windows as a day passes outside.
            // Into chapter 3: 2024 rolls on to 2025 on the admission's
            // white, as into chapter 2.
            // Into chapter 4: 2024 rolls on to 2025 on his window's white.
            // The ending: 2025 rolls on to now on the white over Bridge.
            em = parts.end > 0,
            fm = !em && parts.fly > 0,
            gm = !em && !fm && parts.grad > 0,
            desk = !em && !fm && !gm && parts.desk > 0,
            on = em || fm || gm || (!desk && parts.mail > 0),
            // Mechanical counter: each year rests, then flips quickly to the next.
            steps = em
              ? eb.roll
              : fm
                ? fb.roll
                : gm
                  ? gb.roll
                  : desk
                    ? db.roll * 2
                    : on
                      ? mb.roll * 3
                      : rb.spin * last,
            whole = Math.floor(steps),
            stepped = whole + MathUtils.smoothstep(steps - whole, 0.55, 1),
            roll = em
              ? YEARS.indexOf(2025) - stepped
              : fm || gm
                ? YEARS.indexOf(2024) - stepped
                : desk
                  ? YEARS.indexOf(2022) - stepped
                  : on
                    ? last - stepped
                    : stepped,
            wash = em
              ? eb.flash
              : fm
                ? fb.flash
                : gm
                  ? gb.flash
                  : desk
                    ? 0
                    : on
                      ? mb.flash
                      : rb.flash,
            card = em
              ? 0
              : fm
                ? fb.card
                : gm
                  ? gb.card
                  : desk
                    ? 0
                    : on
                      ? mb.card
                      : rb.card;
          y.style.opacity = String(
            em
              ? eb.counter * (1 - eb.reveal)
              : fm
                ? fb.counter * (1 - bb.reveal)
                : gm
                  ? gb.counter * (1 - reveal3)
                  : desk
                    ? db.counter
                    : on
                      ? mb.counter * (1 - ob.reveal)
                      : rb.counter * (1 - sb.reveal)
          );
          y.style.color = mix(on ? 1 : wash);
          y.style.textShadow = on
            ? 'none'
            : `0 0 40px rgba(12, 16, 28, ${0.45 * (1 - wash)})`;
          // Beside the clock while it spins (below it on tall screens);
          // centred over the card; over the windows on the way to his desk.
          const tall = innerWidth < innerHeight,
            off = 1 - wash;
          y.style.transform =
            em || fm || gm
              ? `translate(-50%, calc(-50% - ${card * 9}vh))`
              : desk
                ? `translate(-50%, calc(-50% - ${tall ? 30 : 26}vh))`
                : tall
                  ? `translate(-50%, calc(-50% + ${off * 24 - card * 9}vh))`
                  : `translate(calc(-50% + ${off * 17}vw), calc(-50% - ${card * 9}vh))`;
          yearStrip.current.style.transform = `translateY(${-roll}em)`;
          // A page turn each time a year starts to flip over (forward only).
          const flip = Math.floor(steps + 0.45);
          if (em) {
            if (flip > lastFlipEnd && eb.counter > 0.5)
              sfx?.flipPage(true, eb.counter);
            lastFlipEnd = flip;
          } else if (fm) {
            if (flip > lastFlipFly && fb.counter > 0.5)
              sfx?.flipPage(true, fb.counter);
            lastFlipFly = flip;
          } else if (gm) {
            if (flip > lastFlipGrad && gb.counter > 0.5)
              sfx?.flipPage(true, gb.counter);
            lastFlipGrad = flip;
            const leaf = Math.floor(steps * 4);
            if (leaf > lastLeafGrad && leaf < 3 && gb.counter > 0.5)
              sfx?.flipPage(false, gb.counter, true);
            lastLeafGrad = leaf;
          } else if (desk) {
            if (flip > lastFlipDesk && db.counter > 0.5)
              sfx?.flipPage(flip >= 2, db.counter);
            lastFlipDesk = flip;
            // Lighter pages riffle by between the years, as through a
            // calendar, the year's own turn the firmer one.
            const leaf = Math.floor(steps * 4);
            if (
              leaf > lastLeafDesk &&
              leaf % 4 !== 2 &&
              leaf < 7 &&
              db.counter > 0.5
            )
              sfx?.flipPage(false, db.counter, true);
            lastLeafDesk = leaf;
          } else if (on) {
            if (flip > lastFlipOn && mb.counter > 0.5)
              sfx?.flipPage(flip >= 3, mb.counter);
            lastFlipOn = flip;
            // Between the years, lighter pages riffle by (a quarter year
            // each, as through a calendar), the year's own turn the firmer
            // one among them, 2022's heavy turn always last: about a dozen in all.
            const leaf = Math.floor(steps * 4);
            if (
              leaf > lastLeaf &&
              leaf % 4 !== 2 &&
              leaf < 11 &&
              mb.counter > 0.5
            )
              sfx?.flipPage(false, mb.counter, true);
            lastLeaf = leaf;
          } else {
            if (flip > lastFlip && rb.counter > 0.5)
              sfx?.flipPage(flip >= last);
            lastFlip = flip;
          }
          // Blur the digits a little while they flip.
          const speed = Math.abs(roll - lastRoll) / Math.max(dt, 1e-3);
          lastRoll = roll;
          yearStrip.current.style.filter = reduced
            ? ''
            : `blur(${Math.min(4, speed * 0.6).toFixed(2)}px)`;
        }
        sky.current?.style.setProperty(
          'opacity',
          parts.rewind >= SWITCH ? '1' : '0'
        );
        // The cream lifts off the lecture hall's clock, taking the card with it.
        const cream = rb.flash * (1 - sb.reveal);
        if (flash.current) flash.current.style.opacity = String(cream);
        show(caption.current.chapter, rb.card * (1 - sb.reveal));
        show(caption.current.school, fade(parts.school, 0.32, 0.66));
        // The mail's white lifts off the meeting room's whiteboard.
        const white = Math.max(
          mb.flash * (1 - ob.reveal),
          gb.flash * (1 - reveal3),
          // Up through the classroom's ceiling, and at his window (it
          // lifts off Bridge's office).
          fb.punch,
          fb.flash * (1 - bb.reveal),
          // The ending: over Bridge's office, lifting off his room.
          eb.flash * (1 - eb.reveal)
        );
        if (flashWhite.current)
          flashWhite.current.style.opacity = String(white);
        // The top bar's text: cream on the dark and busy scenes, ink-dark
        // where it is light behind it (how light, from the table sampled
        // off the story itself: barLight.ts), each end on its own, with a
        // little hysteresis so it does not flicker on the edge.
        {
          // (In ?fit=2's band the scene is framed as on a wide screen, and
          // the top bar is over the dark above it, light only under a wash.)
          const tall = innerWidth < innerHeight,
            light = barLight(page.current, tall && !band),
            wash = Math.max(cream, white),
            behind =
              band && tall
                ? { left: wash, right: wash, rail: light.rail }
                : light,
            ink = (was: boolean, l: number) => (was ? l > 0.14 : l > 0.2),
            l = ink(inkLeft, behind.left),
            r = ink(inkRight, behind.right);
          if (l !== inkLeft)
            barEnds.current.left?.classList.toggle('is-ink', l);
          if (r !== inkRight)
            barEnds.current.right?.classList.toggle('is-ink', r);
          inkLeft = l;
          inkRight = r;
          // (The rail turns ink only where it is plainly light: on mixed
          // ground, half dark, the cream with its shadow holds up better.)
          inkRail = inkRail ? behind.rail > 0.22 : behind.rail > 0.3;
        }
        // The chapter rail: the chapter the story is in, and the line filled
        // to there (a dot each, evenly spaced), as the scene shows it.
        {
          const p = page.current,
            n = CHAPTERS.length;
          let i = n - 1;
          while (i > 0 && p < CHAPTERS[i].from) i--;
          const t =
            i < n - 1
              ? MathUtils.clamp(
                  (p - CHAPTERS[i].from) /
                    (CHAPTERS[i + 1].from - CHAPTERS[i].from),
                  0,
                  1
                )
              : 0;
          rail.current?.paint(i, Math.min(1, (i + t) / (n - 1)), inkRail);
        }
        show(caption.current.chapter2, mb.card * (1 - ob.reveal));
        show(caption.current.interview, fade(parts.office, 0.19, 0.42));
        // The interview ends on the offer; then, at his desk, Neighbor's card.
        show(
          caption.current.offer,
          fade(parts.office, 0.9, 2) * (1 - db.leave)
        );
        show(caption.current.neighbor, db.card * (1 - gb.leave));
        // Chapter 3: its title on the admission's white, and its closing card.
        show(caption.current.chapter3, gb.card * (1 - reveal3));
        show(
          caption.current.masters,
          Math.max(ab.card, ib.card) * (1 - fb.leave)
        );
        // Chapter 4: its title on his window's white, lifting off Bridge's
        // office; and his Bridge card.
        show(caption.current.chapter4, fb.card * (1 - bb.reveal));
        show(caption.current.bridge, bb.card * (1 - eb.leave));
        // The ending: his last card, in his room.
        show(caption.current.end, eb.card);
        // Over the valley, the marketplace's search: the query typed, then
        // what it finds.
        if (search.current && searchText.current && searchCount.current) {
          search.current.style.opacity = String(fb.ui);
          search.current.style.transform = `translate(-50%, ${(1 - fb.ui) * -16}px)`;
          const typed = Math.round(
            MathUtils.clamp((parts.fly - 0.47) / 0.08, 0, 1) * SEARCH.length
          );
          if (searchText.current.textContent?.length !== typed)
            searchText.current.textContent = SEARCH.slice(0, typed);
          searchCount.current.style.opacity = String(
            MathUtils.smoothstep(parts.fly, 0.56, 0.6)
          );
        }
        // Into either chapter, the sound goes muffled as the camera falls
        // in and reopens on the card; a whoosh pulls it in.
        audio.current?.setMuffle(
          Math.max(rb.muffle, mb.muffle, gb.muffle, fb.muffle)
        );
        audio.current?.setRiser(parts.rewind);
        // (The same whoosh pulls each mail's white into the next chapter.)
        // (And up through the classroom's ceiling: its window, 0.84..1,
        // over the punch.)
        audio.current?.setMailRiser(
          parts.fly > 0
            ? 0.84 + ((parts.fly - 0.11) / 0.08) * 0.16
            : parts.grad > 0
              ? parts.grad
              : parts.mail
        );
        audio.current?.setMusicOut(rb.musicOut);
        // Chapter 1's song comes up with its card, as the muffle reopens, and
        // fades away into the mail, as the room's song did into the clock.
        // Back at BYU (chapter 3) the same song comes up again with that
        // chapter's card, from its intro: the school's theme (2026-11-19).
        audio.current?.setSchoolMusic(
          Math.max(rb.card * (1 - mb.musicOut), gb.card * (1 - fb.musicOut))
        );
        // Chapter 2's song comes up with its card; muffled while he thinks,
        // opening as he writes; its big hit as he finishes the solution.
        audio.current?.setOfficeMusic(
          mb.card * (1 - gb.musicOut),
          parts.fly > 0 ? 1 : ob.write
        );
        // Chapter 4's own song (it had brought chapter 2's back) comes up as
        // the flight comes out of the white over BYU, and plays on over the
        // valley and through Bridge's office.
        audio.current?.setBridgeMusic(fb.music * (1 - eb.flash));
        // The ending's own (a Christmas song): chapter 4's fades into the
        // white over Bridge; this comes up as it lifts off his room.
        audio.current?.setEndMusic(eb.reveal);
        // The wall clock comes up as he turns to it, runs back with the
        // hands, and goes dull and away into the dial.
        audio.current?.setClock(rb.look * (1 - rb.flash), rb.dive, rb.spin);
        hint.current?.style.setProperty(
          'opacity',
          String(Math.max(0, 1 - target * 12))
        );
        // The holds: the ring comes up as the scroll brakes on one, fills
        // while the viewer keeps scrolling, and goes once full or passed.
        let ring = 0,
          shown = 0;
        for (const b of brake.current) {
          b.shown += (b.fill - b.shown) * (1 - Math.exp(-dt * 12));
          const p = page.current,
            o =
              MathUtils.smoothstep(p, b.page - 0.035, b.page) *
              (1 - MathUtils.smoothstep(p, b.page + 0.002, b.page + 0.012)) *
              (1 - MathUtils.smoothstep(b.shown, 0.92, 1));
          if (o > ring) {
            ring = o;
            shown = b.shown;
          }
        }
        if (hold.current && holdArc.current) {
          hold.current.style.opacity = String(ring);
          holdArc.current.style.strokeDashoffset = String(
            HOLD_RING * (1 - shown)
          );
        }
        reading = read;
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, band]);

  // The brakes (story.ts HOLDS: the welcome, chapter 1's card). Scrolling
  // down onto one stops dead there, however fast: the scroll is held on it,
  // and the input that carried it there is swallowed until it pauses (a
  // flick's or a trackpad's momentum dies on it). Fresh scrolling (wheel,
  // touch, keys) then fills the ring, at most a step's worth per event; once
  // it is full the scroll is let go. Fresh is a pause in the input, or, on a
  // trackpad whose momentum never pauses (a new swipe made while the last
  // still coasts), its deltas rising again (2026-10-14: before, a trackpad
  // had to click to stop the momentum before the ring would fill). Scrolling back up empties it, and going
  // well back above re-arms it. A big jump (scrollbar, restored position)
  // passes straight through.
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const stops = brake.current,
      PX = 700, // scroll travel (px) to fill the ring
      STEP = 120, // at most this much (px) counts per event
      PAUSE = 180, // ms without input that ends the swallowing
      HOLD_MIN = 450; // ms always swallowed after it bites
    type Stop = (typeof stops)[number];
    const lock = (b: Stop) => b.page * (el.scrollHeight - el.clientHeight);
    let lastTop = el.scrollTop,
      touchY = 0,
      // When the viewer last scrolled (by wheel, touch or keys): the event's
      // own time, so a busy frame (the hall's first render) that delivers a
      // flick's queued events late doesn't read as a pause in it.
      input = 0,
      gap = Infinity, // ms since the input before this one
      lastDy = 0, // the wheel delta before this one (momentum decays)
      swallow = false; // eating the input that ran into a brake
    // Already past a brake (a restored position): it starts released.
    const settle = () => {
      for (const b of stops)
        if (el.scrollTop > lock(b) + 2) {
          b.released = true;
          b.fill = 1;
        }
    };
    settle();
    // The next brake ahead (or the one being held), if any.
    const ahead = () =>
      stops.find((b) => !b.released && el.scrollTop < lock(b) + 2);
    const holding = () => {
      const b = ahead();
      return b && el.scrollTop >= lock(b) - 1 ? b : undefined;
    };
    const bite = (b: Stop, now: number) => {
      b.at = now;
      swallow = true;
    };
    const feed = (b: Stop, dy: number, rising = false) => {
      if (swallow) {
        const since = input - b.at;
        if (since < HOLD_MIN || (gap < PAUSE && !rising && since < 2500))
          return;
        swallow = false;
      }
      b.fill = MathUtils.clamp(
        b.fill + Math.max(-STEP, Math.min(STEP, dy)) / PX,
        0,
        1
      );
      if (b.fill >= 1) b.released = true;
    };
    const touch = (e: Event) => {
      const now = e.timeStamp || performance.now();
      gap = now - input;
      input = now;
    };
    const onScroll = () => {
      const top = el.scrollTop;
      for (const b of stops)
        if (b.released && top < lock(b) - el.clientHeight * 0.5) {
          b.released = false;
          b.fill = 0;
        }
      // The first armed brake the scroll has run past.
      const b = stops.find((s) => !s.released && top > lock(s) + 1);
      if (b) {
        const at = lock(b);
        // A big jump with no scrolling input (scrollbar, restored position).
        if (
          top - lastTop > el.clientHeight * 3 &&
          performance.now() - input > 250
        ) {
          for (const s of stops)
            if (top > lock(s) + 1) {
              s.released = true;
              s.fill = 1;
            }
        } else {
          if (lastTop < at - 1) bite(b, input || performance.now());
          el.scrollTop = at;
        }
      }
      lastTop = el.scrollTop;
    };
    const onWheel = (e: WheelEvent) => {
      touch(e);
      const dy =
        e.deltaY *
        (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1);
      // A new swipe within a trackpad's coasting: momentum only decays.
      const rising = dy > 2 && dy > lastDy * 1.3 + 1;
      lastDy = Math.max(0, dy);
      const b = ahead();
      if (!b) return;
      // A wheel step that would carry past a brake stops exactly on it.
      const at = lock(b);
      if (dy > 0 && el.scrollTop < at - 1) {
        if (el.scrollTop + dy >= at - 1) {
          e.preventDefault();
          bite(b, input);
          el.scrollTop = at;
        }
        return;
      }
      if (el.scrollTop < at - 1) return;
      // Down fills the ring; up empties it first, then scrolls back. (A
      // zero delta, which can open a trackpad's gesture, is held too: the
      // browser lets a gesture be held only if its first event is.)
      if (dy >= 0 || b.fill > 0) {
        e.preventDefault();
        if (dy !== 0) feed(b, dy > 0 ? dy : dy * 2, rising);
      }
    };
    const onTouchStart = (e: TouchEvent) => {
      touch(e);
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      touch(e);
      const y = e.touches[0].clientY,
        dy = touchY - y,
        b = holding();
      touchY = y;
      if (b && (dy > 0 || b.fill > 0)) {
        e.preventDefault();
        feed(b, dy > 0 ? dy * 1.6 : dy * 3);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      // (Keys on the chapter rail's buttons are theirs.)
      if ((e.target as Element | null)?.closest?.('.room-rail')) return;
      touch(e);
      const b = holding();
      if (!b) return;
      if (['ArrowDown', 'PageDown', ' ', 'End'].includes(e.key)) {
        e.preventDefault();
        feed(b, STEP);
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('keydown', onKey);
    };
  }, []);

  // The story playing by itself pauses as soon as the viewer scrolls (the
  // wheel, a touch or click on the story, the scroll keys): it is theirs
  // again. (The chapter rail's own buttons and the top bar's don't count.)
  useEffect(() => {
    const el = scroll.current,
      j = jump.current;
    if (!el) return;
    const KEYS = [
      'ArrowDown',
      'ArrowUp',
      'PageDown',
      'PageUp',
      ' ',
      'Home',
      'End',
    ];
    const stop = () => {
      const a = auto.current;
      if (!a.on) return;
      a.on = false;
      rail.current?.setState('idle');
    };
    const ours = (e: Event) =>
      !!(e.target as Element | null)?.closest?.('.room-rail, .room-header');
    const down = (e: Event) => {
      if (!ours(e)) stop();
    };
    const key = (e: KeyboardEvent) => {
      if (KEYS.includes(e.key) && !ours(e)) stop();
    };
    window.addEventListener('wheel', stop, { passive: true });
    el.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('wheel', stop);
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
      clearTimeout(j.timer);
    };
  }, []);

  // A jump to a chapter (the rail): a quick dip to dark; under it the scroll
  // is set straight there (the brakes before it let go, those after armed
  // again) and the scene lands with no easing; then the dip lifts. Another
  // pick while it dips lands on that one instead.
  const goTo = (chapter: number, then?: () => void) => {
    const j = jump.current,
      first = j.to < 0;
    j.to = CHAPTERS[chapter].go;
    if (!first) return;
    dip.current?.classList.add('is-on');
    j.timer = window.setTimeout(() => {
      const el = scroll.current;
      if (el) {
        const span = el.scrollHeight - el.clientHeight,
          top = Math.round(j.to * span);
        for (const b of brake.current) {
          const past = b.page * span < top - 1;
          b.released = past;
          b.fill = b.shown = past ? 1 : 0;
        }
        el.scrollTop = top;
        const a = auto.current;
        a.top = top;
        a.speed = 0;
        a.ended = false;
        rail.current?.setState(a.on ? 'playing' : 'idle');
        snap.current = true;
      }
      j.to = -1;
      j.timer = window.setTimeout(() => {
        dip.current?.classList.remove('is-on');
        then?.();
      }, 180);
    }, 260);
  };
  // Play, or pause; at the end, from the start again.
  const togglePlay = () => {
    const a = auto.current,
      el = scroll.current;
    if (!el) return;
    if (a.on) {
      a.on = false;
      rail.current?.setState('idle');
      return;
    }
    const start = () => {
      a.on = true;
      a.ended = false;
      a.top = el.scrollTop;
      a.speed = 0;
      rail.current?.setState('playing');
    };
    if (el.scrollTop >= el.scrollHeight - el.clientHeight - 2) goTo(0, start);
    else start();
  };

  // Pointer position for the camera's gentle parallax (mouse and pen only).
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      pointer.current.x = (e.clientX / innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);

  useEffect(() => {
    const title = document.title;
    document.title = 'Jongwoo Lim — Welcome';
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => {
      document.title = title;
      media.removeEventListener('change', change);
    };
  }, []);

  const bind = (id: string) => (el: HTMLElement | null) => {
    caption.current[id] = el;
  };

  return (
    <main className="room" data-ready={ready} data-fit={band ? 2 : undefined}>
      {/* Behind the canvas: a morning sky replaces the night page in school. */}
      <div ref={sky} className="room-sky" aria-hidden="true" />
      <div className="room-stage" aria-hidden="true">
        <div className="room-scene" data-ready={ready}>
          <RoomBoundary>
            <Canvas
              shadows={{ type: PCFSoftShadowMap }}
              dpr={[1, maxDpr]}
              camera={{
                position: [5.4, 4.5, 6.4],
                fov: 36,
                near: 0.1,
                far: 900,
              }}
              gl={{ stencil: true }}
              onCreated={({ gl }) => {
                gl.toneMappingExposure = 1.05;
              }}
            >
              <Suspense fallback={null}>
                <RoomScene
                  progress={progress}
                  rewind={rewind}
                  school={school}
                  mail={mail}
                  office={office}
                  desk={desk}
                  grad={grad}
                  arena={arena}
                  mism={mism}
                  fly={fly}
                  bridge={bridge}
                  end={end}
                  pointer={pointer}
                  reduced={reduced}
                  audio={audio}
                  onReady={() => setReady(true)}
                  warmUp={warmUp}
                />
                <FrameBudget active={ready} onLower={setMaxDpr} />
              </Suspense>
            </Canvas>
          </RoomBoundary>
        </div>
        <Loader ready={ready} warmUp={warmUp} />
      </div>

      {/* One line of small caps, no boxes (2026-11-22, the user's pick of
          three): his name and role at the left, the links at the right. */}
      <header className="room-header">
        <p
          className="room-brand"
          ref={(el) => {
            barEnds.current.left = el;
          }}
        >
          <span className="room-brand-name">Jongwoo Lim</span>
          <span className="room-brand-rule" aria-hidden="true" />
          <span className="room-brand-role">Software Engineer</span>
        </p>
        <nav
          aria-label="Profile"
          ref={(el) => {
            barEnds.current.right = el;
          }}
        >
          <button
            ref={soundButton}
            type="button"
            className="room-link room-sound"
            aria-pressed={sound}
            onClick={toggleSound}
          >
            <span className="room-sound-bars" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="room-sound-label">
              Sound{' '}
              <span className="room-sound-state">{sound ? 'On' : 'Off'}</span>
            </span>
          </button>
          <a
            className="room-link"
            href="/portfolio/jongwoo-lim-resume-revised.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Résumé
            <OutArrow />
          </a>
          <a
            className="room-link"
            href="https://www.linkedin.com/in/jwlim94"
            target="_blank"
            rel="noreferrer"
          >
            LinkedIn
            <OutArrow />
          </a>
        </nav>
      </header>

      <div
        ref={scroll}
        className="room-scroll"
        tabIndex={0}
        aria-label="Scroll to meet Jongwoo"
      >
        <div className="room-pin">
          <ChapterRail
            ref={rail}
            shadeRef={railShade}
            ready={ready}
            onGo={(i) => goTo(i)}
            onPlay={togglePlay}
          />
          {/* (In the pinned layer with the rail, a layer of its own: over
              the scene and the cards, under the rail.) */}
          <div ref={railShade} className="room-rail-shade" aria-hidden="true" />
          <div ref={dip} className="room-dip" aria-hidden="true" />
          <section ref={bind('intro')} className="room-caption room-intro">
            <p className="room-kicker">
              <i />A software engineer’s story
            </p>
            <h1>
              Every story
              <br />
              starts in a room.
            </h1>
          </section>
          <section ref={bind('welcome')} className="room-caption room-welcome">
            <h2>Welcome!</h2>
            <p>
              I’m <strong>Jongwoo</strong>, a full-stack software engineer.
              <br />
              Let me show you how I got here.
            </p>
          </section>
          <div ref={flash} className="room-flash" aria-hidden="true" />
          <div
            ref={flashWhite}
            className="room-flash room-flash-white"
            aria-hidden="true"
          />
          <div ref={search} className="room-search" aria-hidden="true">
            <div className="room-search-bar">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="M15.5 15.5 21 21" />
              </svg>
              <span ref={searchText} />
              <i />
              <span className="room-search-filters">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
                  <circle cx="16" cy="7" r="2" />
                  <circle cx="10" cy="17" r="2" />
                </svg>
                Filters
              </span>
              <span className="room-search-go">Search →</span>
            </div>
            <div ref={searchCount} className="room-search-count">
              9,500+ businesses for sale · 1,400+ industries
            </div>
          </div>
          <div ref={year} className="room-year" aria-hidden="true">
            <div ref={yearStrip} className="room-year-strip">
              {YEARS.map((y) => (
                <span key={y}>{y}</span>
              ))}
            </div>
          </div>
          <section ref={bind('chapter')} className="room-caption room-chapter">
            <p className="room-kicker">
              CHAPTER 1<span className="room-sr"> · 2019</span>
            </p>
            <h2>School</h2>
            <p>
              Provo, Utah · B.S. in Computer Science, Brigham Young University
            </p>
          </section>
          <section ref={bind('school')} className="room-caption room-school">
            <p className="room-kicker">
              <i />
              <b>2019</b> · Provo, Utah
            </p>
            <h2>It started with CS 142.</h2>
            <p>
              Day one of a B.S. in Computer Science at Brigham Young University,
              and my first “Hello, World!”
            </p>
          </section>
          <section ref={bind('chapter2')} className="room-caption room-chapter">
            <p className="room-kicker">
              CHAPTER 2<span className="room-sr"> · 2022</span>
            </p>
            <h2>Neighbor</h2>
            <p>Lehi, Utah · Full-Stack Engineer</p>
          </section>
          <section
            ref={bind('interview')}
            className="room-caption room-school room-up"
          >
            <p className="room-kicker">
              <i />
              <b>2022</b> · Lehi, Utah
            </p>
            <h2>The first onsite interview.</h2>
            <p>
              Two engineers, one whiteboard, and a queen on a chessboard: in how
              few moves can she reach a given square?
            </p>
          </section>
          <section
            ref={bind('offer')}
            className="room-caption room-school room-up"
          >
            <p className="room-kicker">
              <i />
              <b>Neighbor</b> · May 2022
            </p>
            <h2>Got the offer.</h2>
            <p>Full-stack engineer, on the Renter team.</p>
          </section>
          <section
            ref={bind('neighbor')}
            className="room-caption room-school room-neighbor"
          >
            <p className="room-kicker">
              <i />
              <b>Neighbor</b> · May 2022 – Jan 2024
            </p>
            <h2>Full-stack engineer at Neighbor.</h2>
            {/* Told in words, no figures (2026-11-24, the user's call). */}
            <p className="room-card-lead">
              On the Renter team, working on what renters see: search, the map,
              and the listings they reserve.
            </p>
            <ul>
              <li>
                Built an automated system that finds listings left inactive with
                no host engagement and takes them off the marketplace, so
                renters run into far fewer unresponsive or outdated listings.
              </li>
              <li>
                Reworked search and the map so renters can browse and compare
                nearby listings more easily, with results tied more closely to
                the map.
              </li>
              <li>
                Built listing boosts that give enterprise hosts higher placement
                in search, opening a way for the platform to serve its largest
                host.
              </li>
              <li>
                Finished my B.S. in Computer Science along the way (Dec 2022).
              </li>
            </ul>
            <Visit href="https://www.neighbor.com" name="Neighbor" />
          </section>
          <section ref={bind('chapter3')} className="room-caption room-chapter">
            <p className="room-kicker">
              CHAPTER 3<span className="room-sr"> · 2024</span>
            </p>
            <h2>Back to BYU</h2>
            <p>Provo, Utah · Master of Information Systems Management</p>
          </section>
          <section
            ref={bind('masters')}
            className="room-caption room-school room-neighbor room-up"
          >
            <p className="room-kicker">
              <i />
              <b>BYU</b> · Marriott School of Business · Sep 2024 – Sep 2025
            </p>
            <h2>Master of Information Systems Management.</h2>
            <ul>
              <li>An accelerated master’s: start to finish in one year.</li>
              <li>
                A security focus: how breaches happen, and the controls that
                stop them.
              </li>
              <li>
                Business alongside it: what a fix costs, against the risk it
                takes away.
              </li>
            </ul>
          </section>
          <section ref={bind('chapter4')} className="room-caption room-chapter">
            <p className="room-kicker">
              CHAPTER 4<span className="room-sr"> · 2025</span>
            </p>
            <h2>Bridge</h2>
            <p>Lehi, Utah · Full-Stack Engineer</p>
          </section>
          <section
            ref={bind('bridge')}
            className="room-caption room-school room-neighbor room-up"
          >
            <p className="room-kicker">
              <i />
              <b>Bridge</b> · May 2025 – Present
            </p>
            <h2>Full-stack engineer at Bridge.</h2>
            <Figures
              items={[
                ['~70%', 'faster extraction'],
                ['9,500+', 'listings'],
                ['1,400+', 'industries'],
              ]}
            />
            <ul>
              <li>
                Built the AI document extraction behind its business valuations:
                tax returns and P&amp;Ls into structured financials, valuation
                models and PDF reports. In-house, it cut extraction time by
                about 70%.
              </li>
              <li>
                Designed and built the marketplace: natural-language search, a
                map view, filters and saved listings. 9,500+ listings across
                1,400+ industries.
              </li>
              <li>
                Led the GCP infrastructure and security that passed a credit
                union’s vendor risk review: US-only data, isolated extraction
                workers, audited deletion, all in Terraform.
              </li>
            </ul>
            <Visit href="https://bridge.financial" name="Bridge" />
          </section>
          {/* The ending, in his room now, at Christmas (2026-11-22, the
              user's words): open to new opportunities. */}
          <section ref={bind('end')} className="room-caption room-school">
            <p className="room-kicker">
              <i />
              <b>Now</b> · Home for the holidays
            </p>
            <h2>Open to new opportunities.</h2>
            <p>
              I’m a software engineer looking for what’s next. If you know of an
              open role, or a team I might be a good fit for, I’d love to hear
              about it.
            </p>
            <p className="room-card-note">
              Thanks for scrolling, and happy holidays.
            </p>
          </section>
        </div>
        <div className="room-track" />
      </div>

      <p className="room-credit">
        Character & backpack: Meshy AI (CC BY 4.0), character rigged and
        animated with Mixamo · Furniture &amp; Christmas: Kenney, Poly Haven
        (CC0) · Photos: James Thompson, Ryoo Geon Uk, WS Chae on Unsplash ·
        Music: Alex Morgan, AtlasAudio, ZephiraMusic (Pixabay) · Typing: stu556,
        Page turn: Flem0527, Whoosh: skyernaklea (Freesound, CC0) · Clock tick:
        mab (Freesound, CC BY 3.0)
      </p>

      <div ref={hint} className="room-hint" aria-hidden="true">
        Scroll <span>↓</span>
      </div>
      <div ref={hold} className="room-hold" aria-hidden="true">
        <svg viewBox="0 0 46 46">
          <circle className="track" cx="23" cy="23" r="20" />
          <circle
            ref={holdArc}
            className="arc"
            cx="23"
            cy="23"
            r="20"
            strokeDasharray={HOLD_RING}
            strokeDashoffset={HOLD_RING}
          />
        </svg>
        <span>↓</span>
      </div>
    </main>
  );
}
