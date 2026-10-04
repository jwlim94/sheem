import type { Point3 } from './windField';

export type GrassRustleContact = { position: Point3; strength: number };
/** Contact depth and resolved travel speed, independent of blade count and wind. */
export function grassRustleStrength(depth: number, speed: number) {
  const motion = Math.max(0, Math.min(1, (speed - 0.08) / 2.92));
  return Math.max(0, Math.min(1, depth)) * Math.sqrt(motion);
}

/** Recorded kyles CC0 foliage excerpts (see public/sounds/foliage/CREDITS.md).
 * Shares the experience's context/listener/master; never owns their lifecycle. */
export function createGrassRustle(context: AudioContext, output: AudioNode) {
  let seed = 8191;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const controller = new AbortController();
  let buffers: AudioBuffer[] = [];
  const ready = Promise.all(
    Array.from({ length: 6 }, async (_, i) => {
      const response = await fetch(`/sounds/foliage/kyles-brush-${i + 1}.wav`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Grass audio unavailable');
      return context.decodeAudioData(await response.arrayBuffer());
    })
  ).then((loaded) => {
    if (!disposed) buffers = loaded;
  });
  const voices = new Set<{
    source: AudioBufferSourceNode;
    gain: GainNode;
    panner: PannerNode;
  }>();
  let enabled = false,
    disposed = false,
    nextTime = 0,
    cursor = 0,
    lastVariant = -1;
  function clear() {
    for (const voice of voices) {
      voice.source.onended = null;
      voice.source.stop();
      voice.source.disconnect();
      voice.gain.disconnect();
      voice.panner.disconnect();
    }
    voices.clear();
  }
  return {
    ready,
    setAudible(value: boolean) {
      enabled = value;
      if (!value) clear();
    },
    update(contacts: readonly GrassRustleContact[]) {
      const now = context.currentTime;
      if (
        disposed ||
        !enabled ||
        buffers.length === 0 ||
        context.state !== 'running' ||
        now < nextTime ||
        voices.size >= 3
      )
        return;
      // Rotate between occupied regions; do not replay a backlog after a pause.
      let contact: GrassRustleContact | undefined;
      for (let i = 0; i < contacts.length; i++) {
        const candidate = contacts[cursor++ % contacts.length];
        if (candidate.strength > 0.015) {
          contact = candidate;
          break;
        }
      }
      if (!contact) return;
      nextTime = now + 0.26 + random() * 0.1;
      const variant =
        (lastVariant + 1 + Math.floor(random() * (buffers.length - 1))) %
        buffers.length;
      lastVariant = variant;
      const source = context.createBufferSource(),
        gain = context.createGain(),
        panner = context.createPanner();
      source.buffer = buffers[variant];
      source.playbackRate.value = 0.97 + random() * 0.06;
      // +12 dB relative to the initial recording mix; wind has its own quieter bus.
      gain.gain.value = 4 * (0.08 + 0.32 * contact.strength);
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 0.7;
      panner.rolloffFactor = 1;
      panner.maxDistance = 12;
      panner.positionX.value = contact.position.x;
      panner.positionY.value = contact.position.y;
      panner.positionZ.value = contact.position.z;
      source.connect(gain).connect(panner).connect(output);
      const voice = { source, gain, panner };
      voices.add(voice);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        panner.disconnect();
        voices.delete(voice);
      };
      source.start();
    },
    dispose() {
      disposed = true;
      controller.abort();
      buffers = [];
      enabled = false;
      clear();
    },
  };
}
