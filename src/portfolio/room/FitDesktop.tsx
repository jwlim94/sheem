import { useEffect, useState } from 'react';

/** The desktop page's size, which ?fit=1 shrinks to the screen (also in
 *  RoomPortfolio's startDpr). */
const DESKTOP = { w: 1440, h: 900 };
const fitScale = () =>
  Math.min(innerWidth / DESKTOP.w, innerHeight / DESKTOP.h);

/**
 * /portfolio?fit=1 (to compare phone layouts, 2026-11-25): the desktop page
 * itself, /portfolio?embed in a 1440x900 frame, shrunk to the screen, dark
 * around it. A module of its own, loaded instead of RoomPortfolio (App.tsx):
 * that one's scene modules ask for every model as they load, so this page
 * had loaded them all a second time, beside the frame's, and an iPhone's
 * tab ran out of memory.
 */
export default function FitDesktop() {
  const [scale, setScale] = useState(fitScale);
  useEffect(() => {
    const resize = () => setScale(fitScale());
    addEventListener('resize', resize);
    return () => removeEventListener('resize', resize);
  }, []);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#0c101c',
      }}
    >
      <iframe
        src="/portfolio?embed"
        title="Jongwoo Lim, Software Engineer"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: DESKTOP.w,
          height: DESKTOP.h,
          border: 0,
          transformOrigin: 'center',
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      />
    </div>
  );
}
