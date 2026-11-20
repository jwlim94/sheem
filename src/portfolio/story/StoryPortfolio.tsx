import { Component, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { skills } from '../experience';
import { StoryScene } from './StoryScene';
import { chapters, LAST, SPAN } from './story';
import './story.css';

class StoryBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

export default function StoryPortfolio() {
  const scroll = useRef<HTMLDivElement>(null),
    rail = useRef<HTMLDivElement>(null),
    progress = useRef(0),
    pointer = useRef({ x: 0, y: 0, active: false }),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLElement | null>(null);
  const [chapter, setChapter] = useState(0),
    [detail, setDetail] = useState<number | null>(null),
    [reduced, setReduced] = useState(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches
    );

  // Scroll is native; this loop only eases the value the scene follows.
  useEffect(() => {
    let frame = 0,
      last = performance.now();
    const tick = (now: number) => {
      const e = scroll.current;
      if (e) {
        const target = Math.min(LAST, e.scrollTop / (e.clientHeight * SPAN)),
          dt = Math.min(0.05, (now - last) / 1000);
        progress.current = reduced
          ? target
          : progress.current +
            (target - progress.current) * (1 - Math.exp(-dt * 5));
        rail.current?.style.setProperty(
          'transform',
          `scaleX(${progress.current / LAST})`
        );
        const active = Math.min(LAST, Math.floor(target + 0.25));
        setChapter((c) => (c === active ? c : active));
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  useEffect(() => {
    const title = document.title;
    document.title = 'Jongwoo Lim — Software Engineer';
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => {
      document.title = title;
      media.removeEventListener('change', change);
    };
  }, []);

  useEffect(() => {
    if (detail !== null) dialog.current?.showModal();
    else dialog.current?.close();
  }, [detail]);

  const jump = (i: number) =>
    scroll.current?.scrollTo({
      top: i * scroll.current.clientHeight * SPAN,
      behavior: reduced ? 'instant' : 'smooth',
    });
  const open = (i: number) => {
    trigger.current = document.activeElement as HTMLElement;
    setDetail(i);
  };
  const close = () => {
    setDetail(null);
    trigger.current?.focus();
  };
  const current = detail === null ? null : chapters[detail].detail;

  return (
    <main
      className="story"
      style={{ '--accent': chapters[chapter].color } as CSSProperties}
      onPointerMove={(e) => {
        pointer.current = {
          x: (e.clientX / innerWidth) * 2 - 1,
          y: 1 - (e.clientY / innerHeight) * 2,
          active: e.pointerType === 'mouse',
        };
      }}
      onPointerLeave={() => {
        pointer.current.active = false;
      }}
    >
      <div className="story-stage" aria-hidden="true">
        <StoryBoundary>
          <Canvas
            camera={{ position: [0, 0, 16], fov: 35, near: 0.1, far: 100 }}
            dpr={[1, 1.75]}
            gl={{ antialias: false }}
          >
            <StoryScene
              progress={progress}
              pointer={pointer}
              reduced={reduced}
            />
          </Canvas>
        </StoryBoundary>
      </div>

      <header className="story-header">
        <button
          className="story-brand"
          onClick={() => jump(0)}
          aria-label="Back to the beginning"
        >
          <b>JL</b>
          <span>
            Jongwoo Lim
            <small>Software Engineer</small>
          </span>
        </button>
        <nav aria-label="Profile">
          <a
            href="/portfolio/jongwoo-lim-resume.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Résumé
          </a>
          <a
            href="https://www.linkedin.com/in/jwlim94"
            target="_blank"
            rel="noreferrer"
          >
            LinkedIn
          </a>
          <button className="story-pill" onClick={() => jump(LAST)}>
            Contact
          </button>
        </nav>
      </header>

      <div
        ref={scroll}
        className="story-scroll"
        tabIndex={0}
        aria-label="Jongwoo’s story, from computer science to today"
      >
        {/* Copy stays pinned inside the scroller so wheel and touch over
            text still scroll; the spacer track below sets the scroll length. */}
        <div className="story-pin">
          {chapters.map((c, i) => (
            <section
              key={c.name}
              className={`story-section story-${c.track}`}
              data-active={chapter === i}
              inert={chapter !== i}
              aria-labelledby={`story-title-${i}`}
            >
              <div className="story-sticky">
                <div className="story-copy">
                  <p className="story-eyebrow">
                    <span>{pad(i)}</span>
                    <i />
                    {c.eyebrow}
                  </p>
                  <p className="story-commit">{c.commit}</p>
                  <h1 id={`story-title-${i}`}>
                    {c.title.map((line, n) => (
                      <span className="story-line" key={line}>
                        <span style={{ transitionDelay: `${n * 90}ms` }}>
                          {line}
                        </span>
                      </span>
                    ))}
                  </h1>
                  <p className="story-text">{c.text}</p>
                  {c.detail?.kind === 'work' && (
                    <ul className="story-tags" aria-label="Outcomes">
                      {c.detail.item.highlights.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  )}
                  {c.detail?.kind === 'education' && (
                    <ul className="story-tags" aria-label="Degree">
                      <li>{c.detail.item.degree}</li>
                      {c.detail.item.honors.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  )}
                  {c.detail ? (
                    <button className="story-cta" onClick={() => open(i)}>
                      {c.detail.kind === 'work'
                        ? 'Read the full story'
                        : 'About the degree'}
                      <span>→</span>
                    </button>
                  ) : i === 0 ? (
                    <button className="story-cta" onClick={() => jump(1)}>
                      Scroll to compile <span>↓</span>
                    </button>
                  ) : (
                    <>
                      <ul className="story-tags" aria-label="Skills">
                        {skills.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                      <div className="story-contact">
                        <a
                          className="story-cta"
                          href="mailto:limjongwoo1994@gmail.com"
                        >
                          limjongwoo1994@gmail.com <span>↗</span>
                        </a>
                        <a
                          className="story-link"
                          href="https://www.linkedin.com/in/jwlim94"
                          target="_blank"
                          rel="noreferrer"
                        >
                          LinkedIn ↗
                        </a>
                        <a
                          className="story-link"
                          href="/portfolio/jongwoo-lim-resume.pdf"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Résumé (PDF) ↗
                        </a>
                      </div>
                    </>
                  )}
                </div>
                <p className="story-figure" aria-hidden="true">
                  <span>FIG. {pad(i + 1)}</span>
                  <i />
                  {c.figure}
                </p>
              </div>
            </section>
          ))}
        </div>
        <div className="story-track" aria-hidden="true">
          {chapters.map((c) => (
            <div key={c.name} className="story-spacer" />
          ))}
        </div>
      </div>

      <nav className="story-index" aria-label="Chapters">
        {chapters.map((c, i) => (
          <button
            key={c.name}
            onClick={() => jump(i)}
            aria-label={`Go to ${c.name}`}
            aria-current={chapter === i ? 'step' : undefined}
            className={`story-${c.track}`}
          >
            <strong>{c.name}</strong>
            <i />
          </button>
        ))}
      </nav>

      <footer className="story-footer" aria-hidden="true">
        <div className="story-legend">
          <span className="story-education">Education</span>
          <span className="story-work">Work</span>
        </div>
        <div className="story-rail">
          <div ref={rail} className="story-rail-fill" />
          {chapters.map((c, i) => (
            <span
              key={c.name}
              className={`story-tick story-${c.track}`}
              data-on={i <= chapter}
              style={{ left: `${(i / LAST) * 100}%` }}
            >
              <em>{c.year}</em>
            </span>
          ))}
        </div>
        <div className="story-count">
          {pad(chapter)} <b>/</b> {pad(LAST)}
        </div>
      </footer>

      <dialog
        ref={dialog}
        className="story-dialog"
        aria-labelledby="story-dialog-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <div className="story-dialog-top">
          <span>
            {current?.kind === 'education' ? 'EDUCATION' : 'EXPERIENCE'}
          </span>
          <button onClick={close} aria-label="Close details">
            ✕
          </button>
        </div>
        {current?.kind === 'work' && (
          <>
            <h2 id="story-dialog-title">{current.item.company}</h2>
            <p className="story-meta">
              {current.item.role}
              <br />
              {current.item.period && `${current.item.period} · `}
              {current.item.location}
            </p>
            <ul className="story-tags">
              {current.item.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            {current.item.contributions.map((p, n) => (
              <p className="story-contribution" key={p}>
                <small>{pad(n + 1)}</small>
                {p}
              </p>
            ))}
          </>
        )}
        {current?.kind === 'education' && (
          <>
            <h2 id="story-dialog-title">{current.item.degree}</h2>
            <p className="story-meta">
              {current.item.school}
              {current.item.detail && (
                <>
                  <br />
                  {current.item.detail}
                </>
              )}
              <br />
              {current.item.period} · {current.item.location}
            </p>
            {current.item.honors.length > 0 && (
              <ul className="story-tags">
                {current.item.honors.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
          </>
        )}
        <button className="story-cta" onClick={close}>
          Back to the story <span>↩</span>
        </button>
      </dialog>
    </main>
  );
}
