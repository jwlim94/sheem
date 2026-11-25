import { useEffect, useRef, useState } from 'react';
import './phoneVideo.css';

const RESUME = '/portfolio/jongwoo-lim-resume-revised.pdf',
  LINKEDIN = 'https://www.linkedin.com/in/jwlim94';

/**
 * /portfolio on a phone or tablet (2026-11-25, the user's call): the story
 * as a video of the desktop page, not the 3D scene. An iPhone ran out of
 * memory loading the scene, and once that was worked around, drew it
 * slowly and blurred.
 *
 * The video (public/portfolio/story.mp4: scripts/record-story-video.mjs) is
 * the desktop page as it plays itself, 1440x900, with its sound (music and
 * all, recorded with the sound on). It is fitted whole to the screen, held
 * upright or on its side: as wide as the screen with room above and below,
 * or as tall with room at the sides, never cut off (object-fit: contain).
 * It starts on its own, muted (a phone plays nothing aloud by itself), and
 * loops; the Sound button turns the sound on, and a tap on the video pauses
 * it and plays it again. Held upright, his name sits above it, and the
 * links and a line on the page itself below.
 *
 * App.tsx loads this instead of RoomPortfolio on any touch screen, tablets
 * too (their Safari has the same limits), so none of the scene is loaded.
 */
export default function PhoneVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false),
    [sound, setSound] = useState(false);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const sync = () => setPaused(v.paused);
    v.addEventListener('play', sync);
    v.addEventListener('pause', sync);
    // (Low Power Mode does not let it start on its own: then a tap does.)
    v.play().catch(sync);
    return () => {
      v.removeEventListener('play', sync);
      v.removeEventListener('pause', sync);
    };
  }, []);
  // (In the tap itself, so the phone lets it be heard.)
  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    setSound(!v.muted);
    if (!v.muted && v.paused) void v.play();
  };
  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };
  return (
    <main className="phone-story">
      <header className="phone-story-top">
        <b>Jongwoo Lim</b>
        <span>Software Engineer</span>
      </header>
      <button
        type="button"
        className="phone-story-sound"
        aria-pressed={sound}
        onClick={toggleSound}
      >
        <span className="phone-story-bars" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        Sound <em>{sound ? 'On' : 'Off'}</em>
      </button>
      <button
        type="button"
        className="phone-story-frame"
        onClick={toggle}
        aria-label={paused ? 'Play the story' : 'Pause the story'}
      >
        <video
          ref={video}
          src="/portfolio/story.mp4"
          poster="/portfolio/story-poster.jpg"
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          aria-label="Jongwoo Lim's story, from his first CS class to Bridge, in 3D"
        />
        <span className="phone-story-play" data-on={paused} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M7 4.5v15l12.5-7.5z" />
          </svg>
        </span>
      </button>
      <footer className="phone-story-foot">
        <nav aria-label="Profile">
          <a href={RESUME} target="_blank" rel="noreferrer">
            Résumé <i aria-hidden="true">↗</i>
          </a>
          <a href={LINKEDIN} target="_blank" rel="noreferrer">
            LinkedIn <i aria-hidden="true">↗</i>
          </a>
        </nav>
        <p>
          Made to be scrolled through on a computer: open sheem.ai/portfolio
          there to walk through it yourself.
        </p>
      </footer>
    </main>
  );
}
