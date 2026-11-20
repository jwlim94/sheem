import { Component, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { experiences } from '../experience';
import { sectors, setCourse } from './mission';
import type { Pilot } from './mission';
import { ExpeditionScene } from './ExpeditionScene';
import './expedition.css';
const storageKey = 'jongwoo-expedition-v1';
function restore(): number[] {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (i: unknown) =>
                typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < 5
            )
          ),
        ]
      : [];
  } catch {
    return [];
  }
}
class FlightBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="exp-fallback">
        Flight visuals unavailable. Open the flight log to explore every
        experience.
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function ExpeditionPortfolio() {
  const [found, setFound] = useState<number[]>(restore),
    [active, setActive] = useState<number | null>(null),
    [near, setNear] = useState<number | null>(null),
    [destination, setDestination] = useState<number | null>(null),
    [log, setLog] = useState(false),
    [started, setStarted] = useState(false),
    [reduced, setReduced] = useState(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  const pilot = useRef<Pilot>({
    x: 0,
    y: -3,
    targetX: 0,
    targetY: -3,
    destination: null,
    near: null,
    keys: new Set(),
    paused: false,
  });
  const miniShip = useRef<HTMLSpanElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLElement | null>(null);
  const modal = active !== null || log;
  const course = (i: number) => {
    setCourse(pilot.current, i);
    setDestination(i);
    setStarted(true);
    setLog(false);
    setActive(null);
  };
  const open = (i: number, discover: boolean) => {
    trigger.current = document.activeElement as HTMLElement;
    setActive(i);
    setLog(false);
    if (discover) setFound((old) => (old.includes(i) ? old : [...old, i]));
  };
  const close = () => {
    setActive(null);
    setLog(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(found));
    } catch {
      /* Progress remains available for this visit. */
    }
  }, [found]);
  useEffect(() => {
    pilot.current.paused = modal;
    pilot.current.keys.clear();
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  useEffect(() => {
    dialog.current?.scrollTo(0, 0);
  }, [active, log]);
  useEffect(() => {
    const old = document.title;
    document.title = 'Jongwoo Lim — The career expedition';
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    const clear = () => pilot.current.keys.clear();
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      document.title = old;
      media.removeEventListener('change', change);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (pilot.current.paused || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (
        [
          'w',
          'a',
          's',
          'd',
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
        ].includes(k)
      ) {
        e.preventDefault();
        pilot.current.keys.add(k);
        setStarted(true);
        setDestination(null);
      }
      if (k === 'e' && pilot.current.near !== null && !e.repeat) {
        trigger.current = document.activeElement as HTMLElement;
        const i = pilot.current.near;
        setActive(i);
        setFound((old) => (old.includes(i) ? old : [...old, i]));
      }
    };
    const up = (e: KeyboardEvent) => {
      pilot.current.keys.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
  const entry = active === null ? null : experiences[active];
  return (
    <main className={`expedition ${started ? 'has-launched' : ''}`}>
      <div className="exp-space">
        <FlightBoundary>
          <Canvas
            camera={{ position: [0, 0, 58], fov: 45, near: 0.1, far: 350 }}
            dpr={[1, 1.5]}
            fallback={
              <div className="exp-fallback">
                Open the flight log to explore every experience.
              </div>
            }
          >
            <ExpeditionScene
              pilot={pilot}
              onNear={setNear}
              onFree={() => {
                setStarted(true);
                setDestination(null);
              }}
              onCourse={course}
              found={found}
              reduced={reduced}
              marker={miniShip}
            />
          </Canvas>
        </FlightBoundary>
      </div>
      <div className="exp-atmosphere" />
      <header className="exp-header">
        <a className="exp-brand" href="/portfolio/3">
          <span className="exp-logo">✳</span>
          <span>
            JONGWOO LIM<small>FULL-STACK ENGINEER</small>
          </span>
        </a>
        <nav aria-label="Portfolio">
          <button
            onClick={() => {
              trigger.current = document.activeElement as HTMLElement;
              setLog(true);
            }}
          >
            Flight log <span>↗</span>
          </button>
          <a
            href="/portfolio/jongwoo-lim-resume.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Résumé <span>↗</span>
          </a>
        </nav>
      </header>
      <section className="exp-mission">
        <p className="exp-kicker">
          <i /> PERSONAL EXPLORATION / 003
        </p>
        <h1>
          {started ? (
            'Follow your curiosity.'
          ) : (
            <>
              A career.
              <br />
              <em>A small universe.</em>
            </>
          )}
        </h1>
        <p>
          {started
            ? 'Every signal has a story. Choose your next destination.'
            : 'Pilot a little ship through the things I’ve built. Five destinations. A few discoveries. One ongoing journey.'}
        </p>
        {!started && (
          <button className="exp-primary" onClick={() => course(0)}>
            Begin expedition <span>↗</span>
          </button>
        )}
      </section>
      <aside className="exp-objective" aria-label="Exploration progress">
        <div>
          <span>MISSION PROGRESS</span>
          <strong>
            {String(found.length).padStart(2, '0')}
            <small> / 05</small>
          </strong>
        </div>
        <div className="exp-progress">
          {sectors.map((s, i) => (
            <i key={s.name} className={found.includes(i) ? 'is-done' : ''} />
          ))}
        </div>
        <p aria-live="polite">
          {found.length === 5
            ? 'All logs recovered. Thanks for exploring.'
            : `${5 - found.length} career logs waiting to be discovered.`}
        </p>
        {found.length === 5 && (
          <a href="mailto:limjongwoo1994@gmail.com">Start our next chapter ↗</a>
        )}
      </aside>
      <div className="exp-radar" aria-label="Navigation map">
        <span className="exp-radar-label">SECTOR MAP</span>
        <div className="exp-radar-field">
          {sectors.map((s, i) => (
            <button
              key={i}
              style={{
                left: `${((s.x + 29) / 58) * 100}%`,
                top: `${((17 - s.y) / 34) * 100}%`,
              }}
              className={found.includes(i) ? 'is-done' : ''}
              onClick={() => course(i)}
              aria-label={`Set course to ${experiences[i].company}`}
            >
              {i + 1}
            </button>
          ))}
          <span ref={miniShip} className="exp-radar-ship" />
        </div>
        <small>SELECT A SIGNAL TO AUTOPILOT</small>
      </div>
      <div className="exp-docking" aria-live="polite">
        {near !== null ? (
          <>
            <span>WITHIN SCANNING RANGE</span>
            <button className="exp-primary" onClick={() => open(near, true)}>
              <kbd>E</kbd> {found.includes(near) ? 'Reopen' : 'Scan'}{' '}
              {experiences[near].company.replace(' Digital Media', '')}{' '}
              <span>↗</span>
            </button>
          </>
        ) : destination !== null ? (
          <>
            <span>AUTOPILOT ENGAGED</span>
            <strong>
              En route to{' '}
              {experiences[destination].company.replace(' Digital Media', '')}{' '}
              <i>···</i>
            </strong>
          </>
        ) : (
          <>
            <span>EXPLORER 01 · FREE FLIGHT</span>
            <strong>Click the stars to chart your own course.</strong>
          </>
        )}
      </div>
      <footer className="exp-footer">
        <span>
          <kbd>W A S D</kbd> / arrows to fly <i>·</i> Click a planet to navigate{' '}
          <i>·</i> <kbd>E</kbd> to scan
        </span>
        <button
          onClick={() => {
            trigger.current = document.activeElement as HTMLElement;
            setLog(true);
          }}
        >
          Prefer reading? Open all experiences →
        </button>
      </footer>
      <dialog
        ref={dialog}
        className="exp-dialog"
        aria-label="Career flight log"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        }}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === dialog.current) {
            const r = dialog.current.getBoundingClientRect();
            if (
              e.clientX < r.left ||
              e.clientX > r.right ||
              e.clientY < r.top ||
              e.clientY > r.bottom
            )
              close();
          }
        }}
      >
        <div className="exp-dialog-top">
          <span>
            {log
              ? 'EXPLORER’S FLIGHT LOG'
              : `TRANSMISSION 0${active! + 1} / ${found.includes(active!) ? 'RECOVERED' : 'PREVIEW'}`}
          </span>
          <button onClick={close} aria-label="Close flight log">
            ✕
          </button>
        </div>
        {log ? (
          <>
            <p className="exp-kicker">THE WORK BEHIND THE JOURNEY</p>
            <h2>
              Five places.
              <br />
              <em>One curious engineer.</em>
            </h2>
            <p className="exp-log-intro">
              I’m Jongwoo Lim. I build across web, mobile, and cloud
              infrastructure. Explore a chapter here, or plot a course and
              recover it with your ship.
            </p>
            <div className="exp-log-list">
              {experiences.map((e, i) => (
                <div key={e.company}>
                  <span className={found.includes(i) ? 'collected' : ''}>
                    {found.includes(i) ? '✓' : `0${i + 1}`}
                  </span>
                  <button onClick={() => open(i, false)}>
                    <strong>{e.company}</strong>
                    <small>
                      {e.role} {e.period && `· ${e.period}`}
                    </small>
                  </button>
                  <button
                    aria-label={`Navigate to ${e.company}`}
                    onClick={() => course(i)}
                  >
                    ↗
                  </button>
                </div>
              ))}
            </div>
            <div className="exp-contact">
              <a
                href="/portfolio/jongwoo-lim-resume.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Full résumé ↗
              </a>
              <a
                href="https://www.linkedin.com/in/jwlim94"
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn ↗
              </a>
              <a href="mailto:limjongwoo1994@gmail.com">Say hello ↗</a>
            </div>
          </>
        ) : (
          entry && (
            <div key={active} className="exp-transmission">
              <p className="exp-kicker">{sectors[active!].name} / EXPERIENCE</p>
              <h2>{entry.company}</h2>
              <p className="exp-role">{entry.role}</p>
              <p className="exp-dates">
                {entry.period && `${entry.period} · `}
                {entry.location}
              </p>
              <h3>{entry.theme}</h3>
              <div className="exp-highlights">
                {entry.highlights.map((h) => (
                  <span key={h}>{h}</span>
                ))}
              </div>
              {entry.contributions.map((p, i) => (
                <p className="exp-contribution" key={p}>
                  <small>0{i + 1}</small>
                  {p}
                </p>
              ))}
              <div className="exp-next">
                <button
                  onClick={() => {
                    setActive(null);
                    setLog(true);
                  }}
                >
                  All experiences
                </button>
                <button
                  className="exp-primary"
                  onClick={() => course((active! + 1) % 5)}
                >
                  Fly to next signal ↗
                </button>
              </div>
            </div>
          )
        )}
      </dialog>
    </main>
  );
}
