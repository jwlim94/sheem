import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(
  new URL('../src/portfolio/island.ts', import.meta.url),
  'utf8'
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { constrainPosition, ISLAND_RADIUS, obstacles, SPAWN, places } =
  await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  );
assert.deepEqual(constrainPosition(...SPAWN), { x: SPAWN[0], z: SPAWN[1] });
for (let i = 0; i < 360; i++) {
  const angle = (i * Math.PI) / 180;
  const p = constrainPosition(Math.cos(angle) * 30, Math.sin(angle) * 30);
  assert.ok(
    Math.hypot(p.x, p.z) <= ISLAND_RADIUS + 1e-8,
    'Cannot leave the island'
  );
}
for (const obstacle of obstacles) {
  for (const fps of [20, 30, 60, 120]) {
    let p = { x: obstacle.x, z: obstacle.z + obstacle.radius + 1 };
    for (let frame = 0; frame < fps * 3; frame++) {
      p = constrainPosition(p.x, p.z - 3 / fps);
      assert.ok(
        Math.hypot(p.x - obstacle.x, p.z - obstacle.z) >=
          obstacle.radius + 0.34 - 1e-8,
        'Cannot walk through an obstacle'
      );
    }
    p = constrainPosition(p.x, p.z + 0.2);
    assert.ok(
      p.z > obstacle.z + obstacle.radius + 0.34,
      'Can back away after contact'
    );
  }
}
for (const place of places) {
  const p = constrainPosition(place.position[0], place.position[1] + 3);
  assert.ok(
    Math.hypot(p.x - place.position[0], p.z - place.position[1]) < 3.5,
    'Every place has a reachable interaction zone'
  );
}
console.log(
  'Portfolio island: shore bounds, obstacle blocking/release at 20–120 fps, and reachable places passed.'
);
