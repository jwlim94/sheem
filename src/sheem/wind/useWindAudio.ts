import { useCallback, useEffect, useRef, useState } from 'react';
import type { Quaternion } from 'three';
import { createWindAudio } from './createWindAudio';
import type { WindSample, Point3 } from './windField';

export function useWindAudio(active: boolean) {
  const audio = useRef<ReturnType<typeof createWindAudio> | null>(null);
  const desired = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState(false);
  const toggle = useCallback(async () => {
    if (!active) return;
    desired.current = !desired.current;
    setEnabled(desired.current);
    setError(false);
    if (!desired.current) {
      audio.current?.setAudible(false);
      return;
    }
    let current = audio.current;
    try {
      current = audio.current ?? createWindAudio();
      audio.current = current;
      await current.context.resume();
      if (audio.current !== current) return;
      if (current.context.state !== 'running')
        throw new Error('Audio suspended');
      current.setAudible(desired.current && !document.hidden);
    } catch {
      if (audio.current !== current) return;
      current?.setAudible(false);
      desired.current = false;
      setEnabled(false);
      setError(true);
    }
  }, [active]);
  const update = useCallback(
    (
      wind: WindSample,
      velocity: Readonly<Point3>,
      position: Point3,
      orientation: Quaternion
    ) => {
      audio.current?.update(wind, velocity, position, orientation);
    },
    []
  );
  useEffect(() => {
    const visibility = () =>
      audio.current?.setAudible(desired.current && !document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      audio.current?.dispose();
      audio.current = null;
      desired.current = false;
      setEnabled(false);
    };
  }, [active]);
  return { enabled, error, toggle, update };
}
