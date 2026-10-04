import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({
  entryPoints: ['src/sheem/wind/grassRustle.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { grassRustleStrength: strength, createGrassRustle } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);
assert.equal(strength(1, 0), 0);
assert.equal(strength(0, 3), 0);
assert(strength(0.8, 3) > strength(0.8, 1.8));
assert(strength(0.8, 1.8) > strength(0.2, 1.8));
const sources = [],
  panners = [],
  buffers = [];
const node = () => ({
  connect() {
    return this;
  },
  disconnect() {
    this.disconnected = true;
  },
});
const ctx = {
  currentTime: 0,
  state: 'running',
  sampleRate: 8000,
  async decodeAudioData(bytes) {
    const view = new DataView(bytes);
    const n = (bytes.byteLength - 44) / 2;
    const data = Float32Array.from(
      { length: n },
      (_, i) => view.getInt16(44 + i * 2, true) / 32768
    );
    const b = { getChannelData: () => data };
    buffers.push(b);
    return b;
  },
  createBufferSource() {
    const s = {
      ...node(),
      playbackRate: { value: 0 },
      start() {
        this.started = true;
      },
      stop() {
        this.stopped = true;
      },
    };
    sources.push(s);
    return s;
  },
  createGain() {
    return { ...node(), gain: { value: 0 } };
  },
  createPanner() {
    const p = {
      ...node(),
      positionX: { value: 0 },
      positionY: { value: 0 },
      positionZ: { value: 0 },
    };
    panners.push(p);
    return p;
  },
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const file = readFileSync(`public${url}`);
  return {
    ok: true,
    arrayBuffer: async () =>
      file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
  };
};
const r = createGrassRustle(ctx, node()),
  contacts = [{ position: { x: -1, y: 0.2, z: 3 }, strength: 0.6 }];
r.update(contacts);
assert.equal(sources.length, 0);
r.setAudible(true);
await r.ready;
r.update(contacts);
assert.equal(sources.length, 1);
r.update(contacts);
assert.equal(sources.length, 1, 'Rate limited');
assert.equal(panners[0].positionX.value, -1);
assert.equal(panners[0].panningModel, 'HRTF');
for (let i = 0; i < 10; i++) {
  ctx.currentTime += 0.2;
  r.update(contacts);
}
assert.equal(sources.length, 3, 'Bounded overlapping voices');
for (let i = 1; i < 3; i++)
  assert.notEqual(sources[i].buffer, sources[i - 1].buffer);
r.setAudible(false);
assert(sources.every((s) => s.stopped && s.disconnected));
r.setAudible(true);
ctx.currentTime += 1;
r.update([{ ...contacts[0], strength: 0 }]);
assert.equal(sources.length, 3);
ctx.state = 'suspended';
r.update(contacts);
assert.equal(sources.length, 3);
ctx.state = 'running';
r.update(contacts);
assert.equal(sources.length, 4);
sources.at(-1).onended();
assert(sources.at(-1).disconnected);
r.dispose();
r.update(contacts);
assert.equal(sources.length, 4);
for (const b of buffers) {
  const a = b.getChannelData(0);
  assert(a[0] === 0);
  assert(Math.abs(a.at(-1)) < 0.00001);
  assert(a.every((v) => Number.isFinite(v) && Math.abs(v) < 1));
}
globalThis.fetch = async () => ({ ok: false });
const failed = createGrassRustle(ctx, node());
await assert.rejects(failed.ready, /unavailable/);
failed.dispose();
const pending = [];
const wav = readFileSync('public/sounds/foliage/kyles-brush-1.wav');
globalThis.fetch = (url, options) =>
  new Promise((resolve) => pending.push({ resolve, signal: options.signal }));
const abandoned = createGrassRustle(ctx, node());
abandoned.dispose();
assert(pending.every((p) => p.signal.aborted));
for (const p of pending)
  p.resolve({
    ok: true,
    arrayBuffer: async () =>
      wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength),
  });
await abandoned.ready;
const before = sources.length;
abandoned.setAudible(true);
abandoned.update(contacts);
assert.equal(
  sources.length,
  before,
  'Late decode cannot revive a disposed layer'
);
globalThis.fetch = originalFetch;
console.log(
  'Rustle: contact/speed, HRTF positions, voice/rate limits, variation, mute, suspension, disposal and buffer headroom passed.'
);
