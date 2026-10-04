import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({
  entryPoints: ['src/sheem/wind/grassContact.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { stepGrassContact } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);
const body = (speed = 0) => ({
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: speed },
  radius: 0.34,
  height: 0.85,
  active: true,
});
const empty = () => ({ x: 0, z: 0, intensity: 0 });
const length = (s) => Math.hypot(s.x, s.z);
function settle(x, b, fps = 60, y = 0) {
  const s = empty();
  for (let i = 0; i < fps; i++)
    stepGrassContact({ x, y, z: 0 }, 0.6, b, 1 / fps, s);
  return s;
}
assert.equal(length(settle(2, [body()])), 0);
assert.equal(length(settle(0.1, [body()], 60, 1)), 0);
assert.equal(length(settle(0.1, [{ ...body(), active: false }])), 0);
const slow = settle(0.12, [body(1)]),
  fast = settle(0.12, [body(3)]);
assert(slow.x > 0 && slow.z > 0);
assert(settle(-0.12, [body(1)]).x < 0);
assert(length(fast) > length(slow));
assert(length(settle(0.08, [body()])) > length(settle(0.3, [body()])));
assert(
  length(settle(0.1, [body()])) > 0.1,
  'stationary contact stays displaced'
);
for (const fps of [30, 60, 120]) {
  const s = settle(0.12, [body(3)], fps);
  assert(Math.abs(length(s) - length(fast)) < 1e-8);
  const initial = length(s);
  for (let i = 0; i < fps * 2; i++) {
    const before = length(s);
    stepGrassContact({ x: 0.12, y: 0, z: 0 }, 0.6, [], 1 / fps, s);
    assert(length(s) <= before);
  }
  assert(length(s) < initial * 0.01, 'smooth recovery within two seconds');
}
assert(length(settle(0.05, [body(3), body(3), body(3)])) <= 0.6 * 0.85);
const fromWind = empty();
stepGrassContact(
  { x: 0.5, y: 0, z: 0 },
  0.6,
  [body()],
  0.05,
  fromWind,
  -0.2,
  0
);
assert(fromWind.intensity > 0, 'wind-bent blades can enter contact');
console.log(
  'Grass contact checks passed: locality, direction, speed/depth, height, recovery, frame rates, multiple bodies, wind.'
);
