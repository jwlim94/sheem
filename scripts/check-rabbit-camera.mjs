// Run with Node 22.6+: node --experimental-strip-types scripts/check-rabbit-camera.mjs
import { createRabbitCameraClearance } from '../src/sheem/characters/rabbitCamera.ts';
import { PerspectiveCamera, Vector3, Spherical } from 'three';
import assert from 'node:assert/strict';
for (const fps of [30, 60, 120]) {
  const solve = createRabbitCameraClearance(),
    camera = new PerspectiveCamera(),
    target = new Vector3(0, 0.85, 0);
  const requested = 1.43,
    radius = 7;
  let hill = true;
  const ground = (x, z) => (hill ? 1.8 * Math.exp(-(((z - 3) / 1.2) ** 2)) : 0);
  camera.position
    .copy(target)
    .add(new Vector3().setFromSpherical(new Spherical(radius, requested, 0)));
  for (let i = 0; i < fps * 2; i++) {
    solve.restore(camera, target);
    solve.update(camera, target, ground, 1 / fps);
    assert(Math.abs(camera.position.distanceTo(target) - radius) < 1e-9);
    for (let j = 1; j <= 100; j++) {
      const p = target.clone().lerp(camera.position, j / 100);
      assert(p.y - ground(p.x, p.z) > 0.18);
    }
  }
  hill = false;
  for (let i = 0; i < fps * 2; i++) {
    solve.restore(camera, target);
    solve.update(camera, target, ground, 1 / fps);
  }
  const polar = new Spherical().setFromVector3(
    camera.position.clone().sub(target)
  ).phi;
  assert(Math.abs(polar - requested) < 1e-4);
  solve.reset();
  camera.position.set(0, 3.5, 4.5);
  solve.update(camera, target, ground, 1 / fps);
  assert(camera.position.distanceTo(new Vector3(0, 3.5, 4.5)) < 1e-8);
  console.log(
    fps,
    'fps: terrain clearance, preserved zoom, return and reset passed'
  );
}
