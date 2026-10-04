import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({
  entryPoints: ['src/sheem/wind/windGrassAudio.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { createWindGrassAudio, windGrassLevel } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);
assert.equal(windGrassLevel(0), 0);
assert.equal(windGrassLevel(0.15), 0);
assert(windGrassLevel(2) < windGrassLevel(4));
assert(windGrassLevel(4) < windGrassLevel(6));
assert.equal(windGrassLevel(99), 0.8);
const nodes = [];
const param = () => ({
  value: 0,
  setTargetAtTime(v) {
    this.target = v;
  },
});
const node = () => {
  const n = {
    connect() {
      return this;
    },
    disconnect() {
      this.disconnected = true;
    },
  };
  nodes.push(n);
  return n;
};
const ctx = {
  currentTime: 0,
  createGain: () => ({ ...node(), gain: param() }),
  createPanner: () => ({
    ...node(),
    positionX: param(),
    positionY: param(),
    positionZ: param(),
  }),
  createBufferSource: () => ({
    ...node(),
    start() {
      this.started = true;
    },
    stop() {
      this.stopped = true;
    },
  }),
  decodeAudioData: async () => ({ duration: 10.5 }),
};
let gain, panner, source;
const g = ctx.createGain,
  p = ctx.createPanner,
  s = ctx.createBufferSource;
ctx.createGain = () => (gain = g());
ctx.createPanner = () => (panner = p());
ctx.createBufferSource = () => (source = s());
const original = globalThis.fetch;
globalThis.fetch = async () => ({
  ok: true,
  arrayBuffer: async () => new ArrayBuffer(1),
});
const audio = createWindGrassAudio(ctx, node());
await audio.ready;
assert(source.loop && source.started);
assert.equal(gain.gain.value, 0);
audio.update({ x: 0, y: 0.3, z: 3 }, 4);
assert.equal(gain.gain.target, 0);
audio.setAudible(true);
assert.equal(gain.gain.target, windGrassLevel(4));
assert.equal(panner.positionZ.value, 3);
assert.equal(panner.panningModel, 'HRTF');
assert.equal(panner.maxDistance, 12);
audio.update({ x: 0, y: 0.3, z: 3 }, 0);
assert.equal(gain.gain.target, 0);
audio.update({ x: 0, y: 0.3, z: 3 }, 6);
audio.setAudible(false);
assert.equal(gain.gain.target, 0);
audio.dispose();
audio.dispose();
assert(
  source.stopped &&
    source.disconnected &&
    gain.disconnected &&
    panner.disconnected
);
globalThis.fetch = async () => ({ ok: false });
const failed = createWindGrassAudio(ctx, node());
await assert.rejects(failed.ready);
failed.dispose();
let resolve, signal;
globalThis.fetch = (_, o) => {
  signal = o.signal;
  return new Promise((r) => (resolve = r));
};
const late = createWindGrassAudio(ctx, node());
const before = source;
late.dispose();
assert(signal.aborted);
resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
await late.ready;
assert.equal(source, before);
globalThis.fetch = original;
console.log(
  'Wind grass: calm/gust levels, position, fade targets, mute, disposal, failure and late loading passed.'
);
