import { useCallback, useEffect, useRef, useState } from 'react';
import { seededRandom } from './landscape';

// A quiet, synthesized wind bed for the title preview. No downloaded sound assets.
// This is intentionally not the future spatial/environmental audio engine.
function createWind() {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);
  const source = context.createBufferSource();
  const buffer = context.createBuffer(
    2,
    context.sampleRate * 8,
    context.sampleRate
  );
  const random = seededRandom(112);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let brown = 0;
    for (let i = 0; i < data.length; i++) {
      brown = (brown + (random() * 2 - 1) * 0.025) / 1.025;
      data[i] = brown * 4;
    }
    // Crossfade the loop boundary into the beginning; avoid an abrupt seam.
    const fade = context.sampleRate / 2;
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      const end = data.length - fade + i;
      data[end] = data[end] * (1 - t) + data[i] * t;
    }
  }
  source.buffer = buffer;
  source.loop = true;
  source.loopStart = 0.5;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 750;
  filter.Q.value = 0.3;
  const breath = context.createOscillator();
  breath.frequency.value = 0.085;
  const modulation = context.createGain();
  modulation.gain.value = 220;
  breath.connect(modulation);
  modulation.connect(filter.frequency);
  source.connect(filter);
  filter.connect(master);
  source.start();
  breath.start();
  return {
    context,
    master,
    dispose() {
      source.stop();
      breath.stop();
      source.disconnect();
      breath.disconnect();
      modulation.disconnect();
      filter.disconnect();
      master.disconnect();
      void context.close();
    },
  };
}

export function useAmbience() {
  const audio = useRef<ReturnType<typeof createWind> | null>(null);
  const enabledRef = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState(false);
  const toggle = useCallback(async () => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    setError(false);
    try {
      if (next && !audio.current) audio.current = createWind();
      const current = audio.current;
      if (!current) return;
      if (next) await current.context.resume();
      if (audio.current !== current) return;
      current.master.gain.setTargetAtTime(
        enabledRef.current && !document.hidden ? 0.16 : 0,
        current.context.currentTime,
        0.3
      );
      if (enabledRef.current && current.context.state !== 'running')
        throw new Error('Audio suspended');
    } catch {
      enabledRef.current = false;
      setEnabled(false);
      setError(true);
    }
  }, []);
  useEffect(() => {
    const visibility = () => {
      const current = audio.current;
      if (!current) return;
      current.master.gain.setTargetAtTime(
        document.hidden || !enabledRef.current ? 0 : 0.16,
        current.context.currentTime,
        0.15
      );
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      audio.current?.dispose();
      audio.current = null;
    };
  }, []);
  return { enabled, error, toggle };
}
