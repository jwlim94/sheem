import { Component, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { experiences } from '../experience';
import { UniverseScene } from './UniverseScene';
import './universe.css';

class SpaceBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="space-fallback" aria-label="A distant star field" />
    ) : (
      this.props.children
    );
  }
}
export default function UniversePortfolio() {
  const [selected, setSelected] = useState<number | null>(null);
  const [about, setAbout] = useState(false);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const input = useRef({ x: 0, y: 0, zoom: 0 });
  const panel = useRef<HTMLElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const select = (index: number) => {
    lastTrigger.current = document.activeElement as HTMLElement;
    setAbout(false);
    setSelected(index);
  };
  const close = () => {
    setSelected(null);
    setAbout(false);
    lastTrigger.current?.focus();
  };
  useEffect(() => {
    const previous = document.title;
    document.title = 'Jongwoo Lim — A universe of work';
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => {
      document.title = previous;
      media.removeEventListener('change', change);
    };
  }, []);
  useEffect(() => {
    if (selected !== null || about) {
      panel.current?.scrollTo(0, 0);
      panel.current?.focus({ preventScroll: true });
    }
  }, [selected, about]);
  const experience = selected === null ? null : experiences[selected];
  return (
    <main
      className={`universe ${ready ? 'is-ready' : ''} ${experience || about ? 'has-panel' : ''}`}
      onPointerMove={(event) => {
        input.current.x = (event.clientX / window.innerWidth - 0.5) * 2;
        input.current.y = (0.5 - event.clientY / window.innerHeight) * 2;
      }}
      onPointerLeave={() => {
        input.current.x = 0;
        input.current.y = 0;
      }}
      onWheel={(event) => {
        if (selected === null && !about)
          input.current.zoom = Math.max(
            -1.5,
            Math.min(1.5, input.current.zoom + event.deltaY * 0.001)
          );
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
        if (
          selected !== null &&
          (event.key === 'ArrowRight' || event.key === 'ArrowLeft')
        ) {
          event.preventDefault();
          setSelected((selected + (event.key === 'ArrowRight' ? 1 : 4)) % 5);
        }
      }}
    >
      <div className="universe-canvas" aria-hidden="false">
        <SpaceBoundary>
          <Canvas
            camera={{ position: [0, 0, 43], fov: 48, near: 0.1, far: 400 }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: false }}
          >
            <color attach="background" args={['#030611']} />
            <UniverseScene
              selected={selected}
              onSelect={select}
              input={input}
              reduced={reduced}
              onReady={() => setReady(true)}
            />
          </Canvas>
        </SpaceBoundary>
      </div>
      <div className="universe-vignette" />
      <header className="universe-header">
        <button
          className="universe-brand"
          onClick={close}
          aria-label="Jongwoo Lim, return to the universe"
        >
          <span className="brand-star">✳</span>
          <span>
            JONGWOO LIM<small>ENGINEER · EXPLORER · BUILDER</small>
          </span>
        </button>
        <nav aria-label="Profile">
          <a
            href="/portfolio/jongwoo-lim-resume.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Résumé <span>↗</span>
          </a>
          <button
            onClick={() => {
              lastTrigger.current = document.activeElement as HTMLElement;
              setSelected(null);
              setAbout(true);
            }}
          >
            Let’s connect <span>↗</span>
          </button>
        </nav>
      </header>
      {!experience && !about && (
        <section className="universe-intro">
          <p className="universe-eyebrow">
            <span /> A UNIVERSE OF WORK
          </p>
          <h1>
            Built on Earth.
            <br />
            <em>Looking beyond.</em>
          </h1>
          <p className="universe-description">
            I’m Jongwoo, a full-stack engineer.
            <br />
            Turning ambitious ideas into things people use.
            <br />
            This is a small constellation of my journey.
          </p>
          <button className="explore-work" onClick={() => select(0)}>
            Explore my experience <span>↗</span>
          </button>
          <div className="intro-coordinate">
            40° 23′ N &nbsp; / &nbsp; UTAH, EARTH
          </div>
        </section>
      )}
      {(experience || about) && (
        <section
          ref={panel}
          tabIndex={-1}
          className="universe-panel"
          aria-label={
            experience ? `${experience.company} experience` : 'About Jongwoo'
          }
        >
          <button className="universe-back" onClick={close}>
            ← Back to the universe <span>ESC</span>
          </button>
          <div key={about ? 'about' : selected} className="panel-content">
            {experience ? (
              <>
                <p className="universe-eyebrow">
                  CHAPTER 0{selected! + 1} <span className="eyebrow-rule" />{' '}
                  PROFESSIONAL EXPERIENCE
                </p>
                <h2>{experience.company}</h2>
                <p className="experience-role">{experience.role}</p>
                <p className="experience-meta">
                  {experience.period && (
                    <>
                      {experience.period}
                      <span> / </span>
                    </>
                  )}
                  {experience.location}
                </p>
                <h3>{experience.theme}</h3>
                <div className="experience-highlights">
                  {experience.highlights.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
                <div className="experience-contributions">
                  {experience.contributions.map((item, index) => (
                    <p key={item}>
                      <span>0{index + 1}</span>
                      {item}
                    </p>
                  ))}
                </div>
                <div className="chapter-controls">
                  <button onClick={() => setSelected((selected! + 4) % 5)}>
                    ← Previous chapter
                  </button>
                  <button onClick={() => setSelected((selected! + 1) % 5)}>
                    Next chapter →
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="universe-eyebrow">THE PERSON BEHIND THE WORK</p>
                <h2>Jongwoo Lim.</h2>
                <h3>
                  Curiosity is the starting point.
                  <br />
                  Building is how I follow it.
                </h3>
                <p className="about-copy">
                  I’m a full-stack software engineer who builds across web,
                  mobile, and cloud infrastructure. My work spans financial
                  tools, marketplaces, field research, and digital media.
                </p>
                <p className="about-copy">
                  I care about the details that make a product feel considered,
                  and the systems that make it work reliably.
                </p>
                <div className="contact-links">
                  <a href="mailto:limjongwoo1994@gmail.com">
                    Say hello <span>↗</span>
                    <small>limjongwoo1994@gmail.com</small>
                  </a>
                  <a
                    href="https://www.linkedin.com/in/jwlim94"
                    target="_blank"
                    rel="noreferrer"
                  >
                    LinkedIn <span>↗</span>
                  </a>
                  <a
                    href="/portfolio/jongwoo-lim-resume.pdf"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Read my résumé <span>↗</span>
                  </a>
                </div>
              </>
            )}
          </div>
        </section>
      )}
      <aside className="universe-side-note" aria-hidden="true">
        <span>AN ONGOING EXPLORATION</span>
        <i />
        <small>EST. 2021</small>
      </aside>
      <footer className="universe-footer">
        <div className="universe-footer-caption">
          <span>SELECT A CHAPTER</span>
          <span className="flight-hint">
            MOVE TO DRIFT &nbsp;·&nbsp; SCROLL TO TRAVEL
          </span>
          <span>01 — 05</span>
        </div>
        <nav className="experience-nav" aria-label="Experiences">
          {experiences.map((item, index) => (
            <button
              key={item.company}
              className={selected === index ? 'is-selected' : ''}
              onClick={() => select(index)}
              aria-pressed={selected === index}
            >
              <small>0{index + 1}</small>
              <span>{item.company.replace(' Digital Media', '')}</span>
              <i>↗</i>
            </button>
          ))}
        </nav>
      </footer>
    </main>
  );
}
