import { createWindGrassAudio } from './windGrassAudio';
import { createGrassRustle } from './grassRustle';
import { Vector3, Quaternion } from 'three';
import { relativeWind, windExposure } from './windField';
import { windAudioStrength } from './windAudioLevel';
import type { WindSample, Point3 } from './windField';

/** Owned per experience. Procedural sound is a tuning source, not recorded wind. */
export function createWindAudio() {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);
  // Keep wind behind nearby contact sounds without changing its spatial response.
  const windBus = context.createGain();
  windBus.gain.value = 0.63;
  windBus.connect(master);
  const rustle = createGrassRustle(context, master);
  const grassWind = createWindGrassAudio(context, master);
  const nodes: AudioNode[] = [master, windBus];
  const sources: AudioBufferSourceNode[] = [];
  function noise(seed: number, channels: number) {
    const buffer = context.createBuffer(
      channels,
      context.sampleRate * 12,
      context.sampleRate
    );
    for (let c = 0; c < channels; c++) {
      const a = buffer.getChannelData(c);
      let brown = 0;
      for (let i = 0; i < a.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        brown = (brown + ((seed / 4294967296) * 2 - 1) * 0.025) / 1.025;
        a[i] = brown * 4;
      }
      const fade = context.sampleRate;
      for (let i = 0; i < fade; i++) {
        const t = i / fade;
        a[a.length - fade + i] =
          a[a.length - fade + i] * Math.cos((t * Math.PI) / 2) +
          a[i] * Math.sin((t * Math.PI) / 2);
      }
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 1;
    sources.push(source);
    nodes.push(source);
    return source;
  }
  const bed = noise(112, 2),
    local = noise(4817, 1);
  const bedFilter = context.createBiquadFilter();
  bedFilter.type = 'lowpass';
  bedFilter.frequency.value = 650;
  const airFilter = context.createBiquadFilter();
  airFilter.type = 'lowpass';
  airFilter.Q.value = 0.3;
  const high = context.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 80;
  const bedGain = context.createGain(),
    airGain = context.createGain();
  bedGain.gain.value = airGain.gain.value = 0;
  const panner = context.createPanner();
  panner.panningModel = 'HRTF';
  panner.rolloffFactor = 0;
  bed.connect(bedFilter).connect(bedGain).connect(windBus);
  local
    .connect(high)
    .connect(airFilter)
    .connect(airGain)
    .connect(panner)
    .connect(windBus);
  nodes.push(bedFilter, airFilter, high, bedGain, airGain, panner);
  sources.forEach((s) => s.start());
  const forward = new Vector3(),
    right = new Vector3(),
    up = new Vector3();
  const apparent: WindSample = { velocity: { x: 0, y: 0, z: 0 }, speed: 0 };
  let disposed = false;
  function smooth(param: AudioParam, value: number) {
    param.setTargetAtTime(value, context.currentTime, 0.1);
  }
  return {
    context,
    ready: Promise.all([rustle.ready, grassWind.ready]),
    patchWind: grassWind.update,
    contact: rustle.update,
    setAudible(value: boolean) {
      rustle.setAudible(value);
      grassWind.setAudible(value);
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(value ? 0.22 : 0, now + 0.2);
    },
    update(
      ambient: WindSample,
      listenerVelocity: Readonly<Point3>,
      position: Point3,
      orientation: Quaternion
    ) {
      if (disposed) return;
      forward.set(0, 0, 1).applyQuaternion(orientation);
      right.set(-1, 0, 0).applyQuaternion(orientation);
      up.set(0, 1, 0).applyQuaternion(orientation);
      relativeWind(ambient, listenerVelocity, apparent);
      const e = windExposure(apparent, forward, right),
        listener = context.listener;
      const strength = windAudioStrength(
        ambient.speed,
        apparent.speed,
        Math.hypot(listenerVelocity.x, listenerVelocity.y, listenerVelocity.z)
      );
      smooth(bedGain.gain, 0.45 * Math.min(1, ambient.speed / 12));
      // Keep direct airflow behind nearby foliage contact (another ~4 dB reduction).
      smooth(airGain.gain, 1.26 * strength * (0.8 + 0.2 * e.front));
      smooth(airFilter.frequency, 1100 + 1800 * strength + 650 * e.front);
      for (const [key, p] of [
        ['x', listener.positionX],
        ['y', listener.positionY],
        ['z', listener.positionZ],
      ] as const)
        smooth(p, position[key]);
      smooth(listener.forwardX, forward.x);
      smooth(listener.forwardY, forward.y);
      smooth(listener.forwardZ, forward.z);
      smooth(listener.upX, up.x);
      smooth(listener.upY, up.y);
      smooth(listener.upZ, up.z);
      const divisor = apparent.speed || 1;
      smooth(
        panner.positionX,
        position.x - (3 * apparent.velocity.x) / divisor
      );
      smooth(
        panner.positionY,
        position.y - (3 * apparent.velocity.y) / divisor
      );
      smooth(
        panner.positionZ,
        position.z - (3 * apparent.velocity.z) / divisor
      );
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      rustle.dispose();
      grassWind.dispose();
      sources.forEach((s) => s.stop());
      nodes.forEach((n) => n.disconnect());
      void context.close();
    },
  };
}
