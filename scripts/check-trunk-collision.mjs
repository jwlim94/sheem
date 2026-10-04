// node --experimental-strip-types scripts/check-trunk-collision.mjs
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { moveAroundTrunks, CHARACTER_BODY_RADIUS } from '../src/sheem/characters/trunkCollision.ts';
const trunks = [{ x: 0, z: 0, radius: 0.22 }];
const clearance = CHARACTER_BODY_RADIUS + trunks[0].radius;
for (const fps of [20, 30, 60, 120]) {
  for (const speed of [1.8, 3]) {
    const p = new Vector3(0, 0, 2);
    for (let i = 0; i < fps * 3; i++) {
      moveAroundTrunks(p, 0, -speed / fps, trunks);
      assert(Math.hypot(p.x, p.z) >= clearance - 1e-8);
    }
    assert(Math.abs(p.z - clearance) < 1e-8);
    moveAroundTrunks(p, 0, speed / fps, trunks);
    assert(p.z > clearance, 'can leave contact');
    p.set(0.3, 0, 2);
    for (let i = 0; i < fps * 4; i++) {
      moveAroundTrunks(p, 0, -speed / fps, trunks);
      assert(Math.hypot(p.x, p.z) >= clearance - 1e-8);
    }
    assert(p.z < -clearance, 'off-center approach slides past');
  }
}
const p = new Vector3(0, 0, 2);
moveAroundTrunks(p, 0, -5, trunks);
assert(p.z >= clearance - 1e-8, 'large displacement cannot tunnel');
p.set(0, 0, 0);
moveAroundTrunks(p, 0, 0, trunks);
assert(Number.isFinite(p.x) && p.length() >= clearance);
console.log('Trunk contact: walk/run, 20–120 fps, slide, release, tunneling and overlap recovery pass');
