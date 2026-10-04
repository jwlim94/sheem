import type { Point3 } from './windField';

/** Local map wind only: never relative airflow or character speed. */
export function windGrassLevel(speed: number) {
  const t = Math.max(0, Math.min(1, (speed - 0.15) / 7.85));
  return 0.8 * Math.pow(t, 1.2);
}

/** One reusable patch emitter, sharing the experience's ear listener and master. */
export function createWindGrassAudio(context: AudioContext, output: AudioNode) {
  const controller = new AbortController();
  const gain = context.createGain(),
    panner = context.createPanner();
  gain.gain.value = 0;
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'linear';
  panner.refDistance = 1;
  panner.maxDistance = 12;
  panner.rolloffFactor = 1;
  gain.connect(panner).connect(output);
  let disposed = false,
    audible = false,
    target = 0;
  let source: AudioBufferSourceNode | null = null;
  const apply = () => {
    if (disposed) return;
    gain.gain.setTargetAtTime(
      audible ? target : 0,
      context.currentTime,
      audible ? 0.35 : 0.05
    );
  };
  const ready = (async () => {
    const response = await fetch('/sounds/foliage/grass-wind-loop.wav', {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Wind grass audio unavailable');
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    if (disposed) return;
    source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
  })();
  return {
    ready,
    setAudible(value: boolean) {
      audible = value;
      apply();
    },
    update(position: Readonly<Point3>, speed: number) {
      if (disposed) return;
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
      target = windGrassLevel(speed);
      apply();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      source?.stop();
      source?.disconnect();
      gain.disconnect();
      panner.disconnect();
    },
  };
}
