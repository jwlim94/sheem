import { ReadingLab } from './ReadingLab';
import { Component, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { IslandScene } from './IslandScene';
import type { IslandInput } from './IslandScene';
import { places } from './island';
import type { Place } from './island';
import './portfolio.css';
import { ExperienceBook } from './ExperienceBook';
import { createReadingState } from './reading';
import type { ReadingPhase } from './reading';

class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="island-fallback" role="alert">
        <h2>The island could not be loaded.</h2>
        <p>You can still explore the spaces using the menu above.</p>
        <button onClick={() => window.location.reload()}>Try again</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
const movementKeys = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowLeft',
  'ArrowDown',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
]);

export default function Portfolio() {
  const input = useRef<IslandInput>({
    keys: new Set(),
    target: null,
    paused: false,
    reset: 0,
  });
  const reading = useRef(createReadingState());
  const [readingPhase, setReadingPhase] = useState<ReadingPhase>('idle');
  const [page, setPage] = useState(0);
  const changePage = useCallback((next: number) => {
    reading.current.page = next;
    setPage(next);
  }, []);
  const [near, setNear] = useState<Place | null>(null);
  const nearby = useRef<Place | null>(null);
  const onNear = useCallback((place: Place | null) => {
    nearby.current = place;
    setNear(place);
  }, []);
  const [selected, setSelected] = useState<Place | null>(null);
  const [ready, setReady] = useState(false);
  const [arrived, setArrived] = useState(false);
  const onArrived = useCallback(() => setArrived(true), []);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const onReady = useCallback(() => setReady(true), []);
  const open = useCallback((place: Place) => {
    lastFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    input.current.keys.clear();
    input.current.target = null;
    input.current.paused = true;
    setSelected(place);
  }, []);
  const beginReading = useCallback(
    (place: Place) => {
      if (place.id !== 'garden') {
        open(place);
        return;
      }
      if (reading.current.phase !== 'idle') return;
      input.current.keys.clear();
      input.current.target = null;
      reading.current.command = 'sit';
    },
    [open]
  );
  const readNotebook = useCallback(() => {
    if (reading.current.phase === 'seated') reading.current.command = 'read';
  }, []);
  const leaveBench = useCallback(() => {
    reading.current.command = 'leave';
  }, []);
  const onReadingPhase = useCallback(
    (phase: ReadingPhase) => {
      setReadingPhase(phase);
      if (phase === 'reading') open(places[2]);
    },
    [open]
  );
  const close = useCallback(() => {
    dialog.current?.close();
    if (reading.current.phase === 'reading') reading.current.command = 'back';
    input.current.paused = reading.current.phase !== 'idle';
    input.current.keys.clear();
    setSelected(null);
    lastFocus.current?.focus();
  }, []);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);
  useEffect(() => {
    const previous = document.title;
    document.title = 'Little Island — Portfolio';
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => {
      document.title = previous;
      media.removeEventListener('change', update);
    };
  }, []);
  useEffect(() => {
    const controls = input.current;
    const clear = () => {
      controls.keys.clear();
      controls.target = null;
    };
    const keydown = (event: KeyboardEvent) => {
      if (reading.current.phase !== 'idle' && !dialog.current?.open) {
        if (event.code === 'Escape') {
          event.preventDefault();
          leaveBench();
        }
        if (event.code === 'KeyE' && reading.current.phase === 'seated') {
          event.preventDefault();
          readNotebook();
        }
        return;
      }
      if (controls.paused || event.ctrlKey || event.metaKey || event.altKey)
        return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select, [contenteditable]')
      )
        return;
      if (movementKeys.has(event.code)) {
        event.preventDefault();
        controls.keys.add(event.code);
      }
      if (event.code === 'KeyE' && nearby.current && !event.repeat)
        beginReading(nearby.current);
    };
    const keyup = (event: KeyboardEvent) => controls.keys.delete(event.code);
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      clear();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, [beginReading, leaveBench, readNotebook]);

  return (
    <main
      className={`portfolio${arrived ? ' portfolio-exploring' : ''}${readingPhase !== 'idle' ? ' portfolio-reading' : ''}`}
      data-reading-phase={readingPhase}
      lang="en"
    >
      <div
        className="portfolio-canvas"
        aria-label="A small portfolio island to explore as a rabbit"
      >
        <SceneBoundary>
          <Canvas
            orthographic
            camera={{ position: [15, 19, 24], zoom: 30, near: 0.1, far: 500 }}
            shadows
            dpr={[1, 1.5]}
            fallback={
              <div className="island-fallback">
                This browser does not support 3D. Explore the spaces using the
                menu above.
              </div>
            }
          >
            <IslandScene
              input={input}
              onNear={onNear}
              onReady={onReady}
              onOpen={beginReading}
              reading={reading}
              onReadingPhase={onReadingPhase}
              onRead={readNotebook}
              reducedMotion={reducedMotion}
              ready={ready}
              onArrived={onArrived}
            />
          </Canvas>
        </SceneBoundary>
      </div>
      {import.meta.env.DEV &&
        new URLSearchParams(window.location.search).has('readingLab') && (
          <ReadingLab reading={reading} />
        )}
      <header className="portfolio-header">
        <a
          className="portfolio-brand"
          href="/portfolio/7"
          aria-label="Little Island home"
        >
          <span className="portfolio-mark">li.</span>
          <span>
            LITTLE ISLAND<small>A personal portfolio</small>
          </span>
        </a>
        <nav aria-label="Portfolio">
          {places.map((place) => (
            <button
              key={place.id}
              disabled={readingPhase !== 'idle'}
              onClick={() => open(place)}
            >
              {place.subtitle === 'Selected projects'
                ? 'Projects'
                : place.id === 'observatory'
                  ? 'Experiments'
                  : 'Experience'}
            </button>
          ))}
        </nav>
      </header>
      <section className="portfolio-intro">
        <p className="portfolio-eyebrow">
          <span /> A SMALL PLACE FOR BIG IDEAS
        </p>
        <h1>
          A little world.
          <br />
          <em>A lot to discover.</em>
        </h1>
        <p>Take a little walk. Discover what I make.</p>
      </section>
      <aside className="portfolio-note">
        <span>FIELD NOTES — 001</span>
        <p>
          A place for things I love making,
          <br />
          and the stories behind them.
        </p>
        <span className="portfolio-coordinate">
          A portfolio island in progress
        </span>
      </aside>
      <div className="portfolio-bottom">
        <div className="portfolio-controls">
          <span className="portfolio-status">
            <i />
            {ready ? 'Welcome to the island' : 'Preparing your visit'}
          </span>
          <p>
            <kbd>W A S D</kbd> / arrows to move <span>·</span> <kbd>Shift</kbd>{' '}
            to run <span>·</span> Click the ground to walk
          </p>
        </div>
        <button
          className="portfolio-reset"
          onClick={() => {
            input.current.keys.clear();
            input.current.reset++;
          }}
          disabled={readingPhase !== 'idle'}
          aria-label="Return to the dock"
        >
          ↺ <span>Back to dock</span>
        </button>
      </div>
      <div className="portfolio-near" aria-live="polite">
        {near && !selected && readingPhase === 'idle' && (
          <button onClick={() => beginReading(near)}>
            <kbd>E</kbd>
            <span>
              <small>{near.subtitle}</small>
              {near.title}
            </span>
            <span>↗</span>
          </button>
        )}
      </div>
      {readingPhase !== 'idle' && !selected && (
        <section className="reading-controls" aria-label="Bench reading">
          <p role="status">
            {readingPhase === 'walking'
              ? 'Finding a quiet place…'
              : readingPhase === 'seated'
                ? 'A little pause. A few chapters.'
                : ['packing', 'standing', 'releasing'].includes(readingPhase)
                  ? 'Back to the island…'
                  : readingPhase === 'returning'
                    ? 'Back to your quiet corner…'
                    : 'Make yourself comfortable…'}
          </p>
          <div>
            {readingPhase === 'seated' && (
              <button onClick={readNotebook}>
                <kbd>E</kbd> Read the notebook ↗
              </button>
            )}
            {!['packing', 'standing', 'releasing'].includes(readingPhase) && (
              <button onClick={leaveBench}>
                {readingPhase === 'walking' ? 'Cancel walk' : 'Stand up'}{' '}
                <span>Esc</span>
              </button>
            )}
          </div>
        </section>
      )}
      <div className="portfolio-touch" aria-label="Touch movement">
        {[
          ['ArrowUp', '↑', 'Move forward'],
          ['ArrowLeft', '←', 'Move left'],
          ['ArrowDown', '↓', 'Move backward'],
          ['ArrowRight', '→', 'Move right'],
        ].map(([code, label, name]) => (
          <button
            key={code}
            aria-label={name}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              input.current.target = null;
              input.current.keys.add(code);
            }}
            onPointerUp={() => input.current.keys.delete(code)}
            onPointerCancel={() => input.current.keys.delete(code)}
            onLostPointerCapture={() => input.current.keys.delete(code)}
          >
            {label}
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className={`portfolio-dialog${selected?.id === 'garden' ? ' portfolio-book-dialog' : ''}${readingPhase === 'reading' ? ' portfolio-book-arrival' : ''}`}
        aria-labelledby="portfolio-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        {selected && (
          <article>
            <button
              className="portfolio-close"
              onClick={close}
              autoFocus
              aria-label="Close"
            >
              ×
            </button>
            {selected.id === 'garden' ? (
              <ExperienceBook page={page} onPageChange={changePage} />
            ) : (
              <>
                <p className="portfolio-eyebrow">
                  {selected.number} / {selected.subtitle}
                </p>
                <h2 id="portfolio-dialog-title">{selected.title}</h2>
                <div
                  className="portfolio-card-art"
                  style={{ backgroundColor: selected.color }}
                  aria-hidden="true"
                >
                  {selected.id === 'workshop'
                    ? '⌂'
                    : selected.id === 'observatory'
                      ? '✧'
                      : '❋'}
                </div>
                <p>{selected.description}</p>
                <div className="portfolio-dialog-footer">
                  <span>Island preview · Stories coming soon</span>
                  <button onClick={close}>Keep exploring ↗</button>
                </div>
              </>
            )}
          </article>
        )}
      </dialog>
    </main>
  );
}
