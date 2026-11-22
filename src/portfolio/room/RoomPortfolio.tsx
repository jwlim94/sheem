import { Component, Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { MathUtils, PCFSoftShadowMap } from 'three';
import { RoomAudio } from './audio';
import { RoomScene } from './RoomScene';
import { FrameBudget } from './FrameBudget';
import { barLight } from './barLight';
import {
  HOLDS,
  mailBeats,
  officeBeats,
  deskBeats,
  gradBeats,
  arenaBeats,
  mismBeats,
  flyBeats,
  bridgeBeats,
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

function Loader({ ready }: { ready: boolean }) {
  const { progress } = useProgress();
  // Done once every place is in and has been drawn once behind it (the
  // scene's warm-up), so nothing compiles or uploads mid-story; it holds at
  // 99 % for that last step.
  return (
    <div className="room-loader" data-done={ready}>
      <span>
        Setting up the room… {ready ? 100 : Math.min(99, Math.round(progress))}%
      </span>
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

const fade = (p: number, from: number, to: number) =>
  Math.min(1, Math.max(0, Math.min((p - from) / 0.06, (to - p) / 0.06)));

// The year counter turns from cream (over the night room) to ink (on the
// dial's cream) as the screen washes over.
const CREAM = [244, 234, 214],
  INK = [42, 37, 33];
const mix = (t: number) =>
  `rgb(${CREAM.map((c, i) => Math.round(c + (INK[i] - c) * t)).join(',')})`;

export default function RoomPortfolio() {
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
    });
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const audio = useRef<RoomAudio | null>(null),
    soundButton = useRef<HTMLButtonElement>(null);
  const [sound, setSound] = useState(false);
  // The canvas's highest pixel ratio, lowered by FrameBudget a step at a time
  // if frames keep missing their budget.
  const [maxDpr, setMaxDpr] = useState(1.75);
  // Every place in and drawn once (RoomScene's warm-up): the loader lifts.
  const [ready, setReady] = useState(false);

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
      // Whether each end of the top bar is on a light scene (ink-dark), as
      // it stands (a remount keeps the classes).
      inkLeft = !!barEnds.current.left?.classList.contains('is-ink'),
      inkRight = !!barEnds.current.right?.classList.contains('is-ink');
    const tick = (now: number) => {
      const e = scroll.current;
      if (e) {
        const target =
            e.scrollTop / Math.max(1, e.scrollHeight - e.clientHeight),
          dt = Math.min(0.05, (now - last) / 1000);
        page.current = reduced
          ? target
          : page.current + (target - page.current) * (1 - Math.exp(-dt * 4));
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
        const show = (el: HTMLElement | null | undefined, o: number) => {
          if (!el) return;
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
            fm = parts.fly > 0,
            gm = !fm && parts.grad > 0,
            desk = !fm && !gm && parts.desk > 0,
            on = fm || gm || (!desk && parts.mail > 0),
            // Mechanical counter: each year rests, then flips quickly to the next.
            steps = fm
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
            roll =
              fm || gm
                ? YEARS.indexOf(2024) - stepped
                : desk
                  ? YEARS.indexOf(2022) - stepped
                  : on
                    ? last - stepped
                    : stepped,
            wash = fm
              ? fb.flash
              : gm
                ? gb.flash
                : desk
                  ? 0
                  : on
                    ? mb.flash
                    : rb.flash,
            card = fm
              ? fb.card
              : gm
                ? gb.card
                : desk
                  ? 0
                  : on
                    ? mb.card
                    : rb.card;
          y.style.opacity = String(
            fm
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
            fm || gm
              ? `translate(-50%, calc(-50% - ${card * 9}vh))`
              : desk
                ? `translate(-50%, calc(-50% - ${tall ? 30 : 26}vh))`
                : tall
                  ? `translate(-50%, calc(-50% + ${off * 24 - card * 9}vh))`
                  : `translate(calc(-50% + ${off * 17}vw), calc(-50% - ${card * 9}vh))`;
          yearStrip.current.style.transform = `translateY(${-roll}em)`;
          // A page turn each time a year starts to flip over (forward only).
          const flip = Math.floor(steps + 0.45);
          if (fm) {
            if (flip > lastFlipFly && fb.counter > 0.5)
              audio.current?.flipPage(true, fb.counter);
            lastFlipFly = flip;
          } else if (gm) {
            if (flip > lastFlipGrad && gb.counter > 0.5)
              audio.current?.flipPage(true, gb.counter);
            lastFlipGrad = flip;
            const leaf = Math.floor(steps * 4);
            if (leaf > lastLeafGrad && leaf < 3 && gb.counter > 0.5)
              audio.current?.flipPage(false, gb.counter, true);
            lastLeafGrad = leaf;
          } else if (desk) {
            if (flip > lastFlipDesk && db.counter > 0.5)
              audio.current?.flipPage(flip >= 2, db.counter);
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
              audio.current?.flipPage(false, db.counter, true);
            lastLeafDesk = leaf;
          } else if (on) {
            if (flip > lastFlipOn && mb.counter > 0.5)
              audio.current?.flipPage(flip >= 3, mb.counter);
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
              audio.current?.flipPage(false, mb.counter, true);
            lastLeaf = leaf;
          } else {
            if (flip > lastFlip && rb.counter > 0.5)
              audio.current?.flipPage(flip >= last);
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
        if (flash.current)
          flash.current.style.opacity = String(rb.flash * (1 - sb.reveal));
        show(caption.current.chapter, rb.card * (1 - sb.reveal));
        show(caption.current.school, fade(parts.school, 0.32, 0.66));
        // The mail's white lifts off the meeting room's whiteboard.
        if (flashWhite.current)
          flashWhite.current.style.opacity = String(
            Math.max(
              mb.flash * (1 - ob.reveal),
              gb.flash * (1 - reveal3),
              // Up through the classroom's ceiling, and at his window (it
              // lifts off Bridge's office).
              fb.punch,
              fb.flash * (1 - bb.reveal)
            )
          );
        // The top bar's text: cream on the dark and busy scenes, ink-dark
        // where it is light behind it (how light, from the table sampled
        // off the story itself: barLight.ts), each end on its own, with a
        // little hysteresis so it does not flicker on the edge.
        {
          const behind = barLight(page.current, innerWidth < innerHeight),
            ink = (was: boolean, l: number) => (was ? l > 0.14 : l > 0.2),
            l = ink(inkLeft, behind.left),
            r = ink(inkRight, behind.right);
          if (l !== inkLeft)
            barEnds.current.left?.classList.toggle('is-ink', l);
          if (r !== inkRight)
            barEnds.current.right?.classList.toggle('is-ink', r);
          inkLeft = l;
          inkRight = r;
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
        show(caption.current.bridge, bb.card);
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
        audio.current?.setBridgeMusic(fb.music);
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
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

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
    <main className="room">
      {/* Behind the canvas: a morning sky replaces the night page in school. */}
      <div ref={sky} className="room-sky" aria-hidden="true" />
      <div className="room-stage" aria-hidden="true">
        <RoomBoundary>
          <Canvas
            shadows={{ type: PCFSoftShadowMap }}
            dpr={[1, maxDpr]}
            camera={{ position: [5.4, 4.5, 6.4], fov: 36, near: 0.1, far: 900 }}
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
                pointer={pointer}
                reduced={reduced}
                audio={audio}
                onReady={() => setReady(true)}
              />
              <FrameBudget active={ready} onLower={setMaxDpr} />
            </Suspense>
          </Canvas>
        </RoomBoundary>
        <Loader ready={ready} />
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
            href="/portfolio/jongwoo-lim-resume.pdf"
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
            <Figures
              items={[
                ['+10%', 'reservation rate'],
                ['+3%', 'search-to-request'],
                ['+150%', 'boosted listings'],
              ]}
            />
            <ul>
              <li>
                Retired listings left inactive with no host engagement: renters
                hit fewer dead ends, and the reservation rate rose 10%.
              </li>
              <li>
                Tied search results more closely to the map: search-to-request
                up 3%.
              </li>
              <li>
                Built listing boosts for enterprise hosts: 150% more listing
                volume and reservations.
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
        </div>
        <div className="room-track" />
      </div>

      <p className="room-credit">
        Character & backpack: Meshy AI (CC BY 4.0), character rigged and
        animated with Mixamo · Furniture: Kenney, Poly Haven (CC0) · Photos:
        James Thompson, Ryoo Geon Uk, WS Chae on Unsplash · Music: Alex Morgan,
        ZephiraMusic (Pixabay) · Typing: stu556, Page turn: Flem0527, Whoosh:
        skyernaklea (Freesound, CC0) · Clock tick: mab (Freesound, CC BY 3.0)
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
