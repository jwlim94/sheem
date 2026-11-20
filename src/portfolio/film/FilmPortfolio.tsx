import { Component, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { FilmScene } from './FilmScene';
import { story } from './story';
import './film.css';
class FilmBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="film-fallback" />
    ) : (
      this.props.children
    );
  }
}
export default function FilmPortfolio() {
  const scroll = useRef<HTMLDivElement>(null),
    progress = useRef(0),
    pointer = useRef({ x: 0, y: 0 }),
    bar = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLElement | null>(null);
  const [chapter, setChapter] = useState(0),
    [detail, setDetail] = useState<number | null>(null),
    [reduced, setReduced] = useState(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  const update = () => {
    const e = scroll.current;
    if (!e) return;
    progress.current = Math.min(6, e.scrollTop / (e.clientHeight * 1.5));
    bar.current?.style.setProperty(
      'transform',
      `scaleX(${e.scrollTop / Math.max(1, e.scrollHeight - e.clientHeight)})`
    );
    setChapter(Math.min(6, Math.floor(progress.current + 0.18)));
  };
  const jump = (i: number) =>
    scroll.current?.scrollTo({
      top: i * scroll.current.clientHeight * 1.5,
      behavior: reduced ? 'instant' : 'smooth',
    });
  const close = () => {
    setDetail(null);
    trigger.current?.focus();
  };
  useEffect(() => {
    const title = document.title;
    document.title = 'Jongwoo Lim — A life, in the making';
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    const resize = () => {
      const e = scroll.current;
      if (e) {
        progress.current = Math.min(6, e.scrollTop / (e.clientHeight * 1.5));
      }
    };
    window.addEventListener('resize', resize);
    return () => {
      document.title = title;
      media.removeEventListener('change', change);
      window.removeEventListener('resize', resize);
    };
  }, []);
  useEffect(() => {
    if (detail !== null) dialog.current?.showModal();
    else dialog.current?.close();
  }, [detail]);
  const experience = detail === null ? null : story[detail].experience;
  return (
    <main
      className="career-film"
      onPointerMove={(e) => {
        pointer.current = {
          x: (e.clientX / innerWidth - 0.5) * 2,
          y: (0.5 - e.clientY / innerHeight) * 2,
        };
      }}
      onPointerLeave={() => {
        pointer.current = { x: 0, y: 0 };
      }}
    >
      <div className="film-stage" aria-hidden="true">
        <FilmBoundary>
          <Canvas
            camera={{ position: [0, 0, 22], fov: 43, near: 0.1, far: 400 }}
            dpr={[1, 1.5]}
            fallback={<div className="film-fallback" />}
          >
            <FilmScene
              progress={progress}
              pointer={pointer}
              reduced={reduced}
            />
          </Canvas>
        </FilmBoundary>
      </div>
      <div className="film-shade" />
      <header className="film-header">
        <button
          className="film-brand"
          onClick={() => jump(0)}
          aria-label="Back to the prologue"
        >
          jl
          <span>
            JONGWOO LIM
            <br />
            <small>ENGINEER & BUILDER</small>
          </span>
        </button>
        <nav aria-label="Profile">
          <a
            href="/portfolio/jongwoo-lim-resume.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Résumé ↗
          </a>
          <button onClick={() => jump(6)}>
            Let’s talk <span>↗</span>
          </button>
        </nav>
      </header>
      <div
        ref={scroll}
        className="film-scroll"
        onScroll={update}
        tabIndex={0}
        aria-label="Scroll through Jongwoo’s career"
      >
        {story.map((s, i) => (
          <section
            key={s.name}
            className={`film-section film-section-${i}`}
            aria-labelledby={`film-title-${i}`}
            style={{ '--chapter-color': s.color } as CSSProperties}
          >
            <div className="film-frame">
              <div className="film-copy">
                <p className="film-eyebrow">
                  <span>
                    {i === 0
                      ? 'PRELUDE'
                      : i === 6
                        ? 'EPILOGUE'
                        : `CHAPTER 0${i}`}
                  </span>
                  <i />
                  {s.year}
                </p>
                <h1 id={`film-title-${i}`}>
                  {s.title.split('\n').map((line, n) => (
                    <span key={line} className={n === 1 ? 'film-italic' : ''}>
                      {line}
                    </span>
                  ))}
                </h1>
                <p className="film-role">{s.line}</p>
                <p className="film-description">{s.text}</p>
                {s.experience ? (
                  <>
                    <div className="film-outcomes">
                      {s.experience.highlights.slice(0, 2).map((h) => (
                        <span key={h}>{h}</span>
                      ))}
                    </div>
                    <button
                      className="film-read"
                      onClick={() => {
                        trigger.current = document.activeElement as HTMLElement;
                        setDetail(i);
                      }}
                    >
                      Behind this chapter <span>↗</span>
                    </button>
                  </>
                ) : i === 0 ? (
                  <button className="film-read" onClick={() => jump(1)}>
                    Scroll to begin <span>↓</span>
                  </button>
                ) : (
                  <div className="film-contact">
                    <a href="mailto:limjongwoo1994@gmail.com">
                      Start a conversation ↗
                    </a>
                    <a
                      href="https://www.linkedin.com/in/jwlim94"
                      target="_blank"
                      rel="noreferrer"
                    >
                      LinkedIn ↗
                    </a>
                  </div>
                )}
              </div>
              <div className="film-scene-caption" aria-hidden="true">
                <span>FIG. 0{i + 1}</span>
                <i />
                <span>
                  {
                    [
                      'THE THREAD OF CURIOSITY',
                      'A SIGNAL THAT LIVES ON',
                      'SPACES BECOME CONNECTIONS',
                      'AN IDEA TAKES SHAPE',
                      'LAYERS OF DISCOVERY',
                      'FROM COMPLEXITY TO CLARITY',
                      'AN OPEN HORIZON',
                    ][i]
                  }
                </span>
              </div>
            </div>
          </section>
        ))}
      </div>
      <aside className="film-index">
        <span>A LIFE IN CHAPTERS</span>
        <nav aria-label="Career chapters">
          {story.map((s, i) => (
            <button
              key={s.name}
              onClick={() => jump(i)}
              aria-label={`Go to ${s.name}`}
              aria-current={chapter === i ? 'step' : undefined}
            >
              <span>{String(i).padStart(2, '0')}</span>
              <i />
              <strong>{s.name}</strong>
            </button>
          ))}
        </nav>
      </aside>
      <footer className="film-footer">
        <span>
          SCROLL TO UNFOLD <i>↓</i>
        </span>
        <span>
          {String(chapter).padStart(2, '0')} <b>/</b> 06
        </span>
        <span>AN ONGOING STORY</span>
        <div ref={bar} className="film-progress" />
      </footer>
      <dialog
        ref={dialog}
        className="film-dialog"
        aria-label="Career chapter details"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        }}
      >
        <div className="film-dialog-top">
          <span>BEHIND THE CHAPTER</span>
          <button onClick={close} aria-label="Close chapter details">
            ✕
          </button>
        </div>
        {experience && (
          <>
            <h2>{experience.company}</h2>
            <p className="film-role">{experience.role}</p>
            <p className="film-description">
              {experience.period && `${experience.period} · `}
              {experience.location}
            </p>
            <div className="film-outcomes">
              {experience.highlights.map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
            {experience.contributions.map((p, i) => (
              <p className="film-contribution" key={p}>
                <small>0{i + 1}</small>
                {p}
              </p>
            ))}
            <button className="film-read" onClick={close}>
              Return to the story <span>↗</span>
            </button>
          </>
        )}
      </dialog>
    </main>
  );
}
