import { useEffect, useImperativeHandle, useRef } from 'react';
import type { FocusEvent, KeyboardEvent, PointerEvent, Ref } from 'react';
import { CHAPTERS } from './story';

/** Autoplay, as the rail's Play shows it. */
export type RailState = 'idle' | 'playing' | 'ended';

export interface RailApi {
  /** Per frame: the chapter the story is in, how far the line is filled
   *  (0..1, a dot per chapter), and whether it is light behind the rail. */
  paint(chapter: number, fill: number, ink: boolean): void;
  setState(state: RailState): void;
}

const PLAY_LABEL: Record<RailState, string> = {
  idle: 'Play the story',
  playing: 'Pause the story',
  ended: 'Play the story again',
};

/** A pointer that can't hover (a phone): a tap opens the rail first. */
const touchOnly = () => matchMedia('(hover: none)').matches;

/**
 * The chapter rail (2026-11-23, the user's pick of four mock-ups,
 * art/portfolio-room/chapter-menu-options, "A + B"): down the left, in the
 * top bar's small caps, a hairline with a dot and the year for each chapter,
 * the current one's name beside it, the line filling as the story goes; and
 * "Play the story" above it. Hovered (tapped on a phone, or reached by
 * keyboard) it opens: a shade comes in from the left, the rows spread, and
 * every chapter's name shows large beside its year.
 *
 * A chapter jumps there (onGo); Play lets the story play by itself, or
 * pauses it (onPlay). RoomPortfolio paints it each frame through `ref`,
 * outside React's renders; it sits in the scroll's pinned layer, so a wheel
 * over it still scrolls the story.
 */
export function ChapterRail({
  ref,
  shadeRef,
  ready,
  onGo,
  onPlay,
}: {
  ref: Ref<RailApi>;
  /** The shade it opens over (a layer of the page's own, under the bar). */
  shadeRef: { current: HTMLDivElement | null };
  ready: boolean;
  onGo: (chapter: number) => void;
  onPlay: () => void;
}) {
  const nav = useRef<HTMLElement>(null),
    fill = useRef<HTMLSpanElement>(null),
    play = useRef<HTMLButtonElement>(null),
    items = useRef<(HTMLLIElement | null)[]>([]),
    shown = useRef({
      chapter: -1,
      fill: -1,
      ink: false,
      state: 'idle' as RailState,
    }),
    openTimer = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      paint(chapter, f, ink) {
        const s = shown.current;
        if (chapter !== s.chapter) {
          items.current.forEach((li, i) => {
            if (!li) return;
            li.classList.toggle('is-on', i === chapter);
            li.classList.toggle('is-past', i < chapter);
            const b = li.firstElementChild;
            if (i === chapter) b?.setAttribute('aria-current', 'step');
            else b?.removeAttribute('aria-current');
          });
          s.chapter = chapter;
        }
        if (Math.abs(f - s.fill) > 1e-4) {
          fill.current?.style.setProperty('transform', `scaleY(${f})`);
          s.fill = f;
        }
        if (ink !== s.ink) {
          nav.current?.classList.toggle('is-ink', ink);
          s.ink = ink;
        }
      },
      setState(state) {
        if (state === shown.current.state) return;
        shown.current.state = state;
        if (nav.current) nav.current.dataset.state = state;
        play.current?.setAttribute('aria-label', PLAY_LABEL[state]);
      },
    }),
    []
  );

  const isOpen = () => !!nav.current?.classList.contains('is-open');
  const setOpen = (on: boolean) => {
    clearTimeout(openTimer.current);
    nav.current?.classList.toggle('is-open', on);
    shadeRef.current?.classList.toggle('is-open', on);
  };

  // A tap or click anywhere else closes it (a phone has no pointer leaving).
  useEffect(() => {
    const down = (e: globalThis.PointerEvent) => {
      if (!nav.current?.contains(e.target as Node)) {
        clearTimeout(openTimer.current);
        nav.current?.classList.remove('is-open');
        shadeRef.current?.classList.remove('is-open');
      }
    };
    window.addEventListener('pointerdown', down, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      clearTimeout(openTimer.current);
    };
  }, [shadeRef]);

  // A mouse opens it after a beat, so one passing over doesn't.
  const enter = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => setOpen(true), 110);
  };
  const leave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') setOpen(false);
  };
  const focus = (e: FocusEvent) => {
    if (e.target.matches(':focus-visible')) setOpen(true);
  };
  const blur = (e: FocusEvent) => {
    if (!nav.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen()) {
      setOpen(false);
      (document.activeElement as HTMLElement | null)?.blur();
    }
  };
  const go = (i: number) => {
    // On a phone the first tap opens it, to see the names.
    if (touchOnly() && !isOpen()) {
      setOpen(true);
      return;
    }
    onGo(i);
    if (touchOnly()) window.setTimeout(() => setOpen(false), 450);
  };

  return (
    <nav
      ref={nav}
      className="room-rail"
      aria-label="Chapters"
      data-state="idle"
      data-ready={ready}
      onPointerEnter={enter}
      onPointerLeave={leave}
      onFocus={focus}
      onBlur={blur}
      onKeyDown={key}
    >
      <button
        ref={play}
        type="button"
        className="room-rail-play"
        aria-label={PLAY_LABEL.idle}
        onClick={() => {
          onPlay();
          if (touchOnly()) setOpen(false);
        }}
      >
        <span className="room-rail-icon" aria-hidden="true">
          <svg className="room-rail-pl" viewBox="0 0 24 24">
            <path d="M7 4.5v15l12.5-7.5z" />
          </svg>
          <svg className="room-rail-pa" viewBox="0 0 24 24">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        </span>
        <span className="room-rail-label" aria-hidden="true">
          <span data-s="idle">Play the story</span>
          <span data-s="playing">Pause</span>
          <span data-s="ended">Play again</span>
        </span>
      </button>
      <div className="room-rail-list">
        <span className="room-rail-line" aria-hidden="true">
          <span ref={fill} className="room-rail-fill" />
        </span>
        <ol>
          {CHAPTERS.map((c, i) => (
            <li
              key={c.name}
              ref={(el) => {
                items.current[i] = el;
              }}
            >
              <button type="button" onClick={() => go(i)}>
                <i className="room-rail-dot" aria-hidden="true" />
                <span className="room-rail-year">{c.year}</span>
                <span className="room-rail-name">{c.name}</span>
                <span className="room-rail-title" aria-hidden="true">
                  {c.name}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
