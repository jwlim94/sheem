import type { Point3 } from './windField';

type TreeEmitter = {
  gain: GainNode;
  panner: PannerNode;
  source: AudioBufferSourceNode | null;
  target: number;
};

export function treeRustleLevel(speed: number) {
  const t = Math.max(0, Math.min(1, (speed - 0.2) / 7.8));
  return 0.7 * Math.pow(t, 1.25);
}

/** One shared recording, independent mono canopy emitters, same rabbit-ear listener. */
export function createTreeRustleAudio(
  context: AudioContext,
  output: AudioNode
) {
  const abort = new AbortController();
  const emitters = new Map<string, TreeEmitter>();
  let buffer: AudioBuffer | null = null,
    disposed = false,
    audible = false;
  const apply = (emitter: TreeEmitter) =>
    emitter.gain.gain.setTargetAtTime(
      audible ? emitter.target : 0,
      context.currentTime,
      audible ? 0.4 : 0.05
    );
  const start = (emitter: TreeEmitter, offset: number) => {
    if (!buffer || emitter.source) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(emitter.gain);
    source.start(0, offset % buffer.duration);
    emitter.source = source;
  };
  const ready = (async () => {
    const response = await fetch('/sounds/foliage/tree-wind-loop.wav', {
      signal: abort.signal,
    });
    if (!response.ok) throw new Error('Tree rustle audio unavailable');
    const decoded = await context.decodeAudioData(await response.arrayBuffer());
    if (disposed) return;
    buffer = decoded;
    let i = 0;
    for (const emitter of emitters.values()) start(emitter, i++ * 7.3);
  })();
  return {
    ready,
    setAudible(value: boolean) {
      if (disposed) return;
      audible = value;
      emitters.forEach(apply);
    },
    update(id: string, position: Readonly<Point3>, speed: number) {
      if (disposed) return;
      let emitter = emitters.get(id);
      if (!emitter) {
        const gain = context.createGain(),
          panner = context.createPanner();
        gain.gain.value = 0;
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'linear';
        panner.refDistance = 2;
        panner.maxDistance = 14;
        panner.rolloffFactor = 1;
        gain.connect(panner).connect(output);
        emitter = { gain, panner, source: null, target: 0 };
        emitters.set(id, emitter);
        start(emitter, (emitters.size - 1) * 7.3);
      }
      emitter.panner.positionX.value = position.x;
      emitter.panner.positionY.value = position.y;
      emitter.panner.positionZ.value = position.z;
      emitter.target = treeRustleLevel(speed);
      apply(emitter);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      for (const e of emitters.values()) {
        e.source?.stop();
        e.source?.disconnect();
        e.gain.disconnect();
        e.panner.disconnect();
      }
      emitters.clear();
      buffer = null;
    },
  };
}
