import assert from 'node:assert/strict';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Vector3,
} from 'three';
import { createTreeDetail } from '../../src/sheem/wind/treeDetail.ts';
import { createTreeWind } from '../../src/sheem/wind/treeWind.ts';

const geometry = new BufferGeometry();
geometry.setAttribute(
  'position',
  new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3)
);
geometry.setIndex([0, 1, 2, 0, 2, 3]);
const positions = geometry.attributes.position;
const mesh = new Mesh(geometry, new MeshStandardMaterial());
const root = new Group(),
  placement = new Group();
placement.add(root);
root.add(mesh);
const detail = createTreeDetail(
  root,
  1,
  new Uint32Array([4, 3, 3, 0, 1, 2, 0, 2, 3]).buffer
);
const camera = new PerspectiveCamera();
for (const [distance, expected] of [
  [2, 0],
  [4, 0],
  [5, 1],
  [4, 1],
  [10, 2],
  [9, 2],
  [8, 1],
  [3, 0],
]) {
  camera.position.set(0, 0.5, distance);
  detail.update(camera, 0.21);
  assert.equal(detail.level, expected);
  assert.equal(mesh.geometry.attributes.position, positions);
}
// Moving a leaf remains visible in all detail levels, not reset on return.
positions.setX(0, 0.1);
camera.position.z = 20;
detail.update(camera, 0.21);
assert.equal(mesh.geometry.attributes.position.getX(0), positions.getX(0));
detail.update(camera, 0.21, [
  {
    active: true,
    position: { x: 0, y: 0, z: 0 },
    radius: 0.34,
    height: 1.45,
    velocity: { x: 0, y: 0, z: 0 },
  },
]);
assert.equal(detail.level, 0);
assert.equal(mesh.geometry, geometry);
assert.equal(mesh.geometry.attributes.position.getX(0), positions.getX(0));
// Wind shape added after LOD construction must remain shared, too.
const wind = createTreeWind(root, 'broadleaf', 0, 0, 0, 1);
let samples = 0;
const field = {
  sample(_point, _time, out) {
    samples++;
    out.velocity = { x: 2, y: 0, z: 0 };
    out.speed = 2;
  },
};
wind.update(field, 0, 1 / 60);
const shape = geometry.attributes.treeWindShape;
camera.position.z = 20;
detail.update(camera, 0.21);
assert.equal(mesh.geometry.attributes.treeWindShape, shape);
const counts = [];
for (const interval of [0.1, 0.2, 0.5]) {
  samples = 0;
  for (let i = 0; i < 120; i++)
    wind.update(field, i / 60, 1 / 60, false, interval);
  counts.push(samples);
}
assert(counts[0] > counts[1] && counts[1] > counts[2]);
const offset = new Vector3();
wind.offset(mesh, 0, offset);
assert(Number.isFinite(offset.x));
wind.dispose();
detail.dispose();
mesh.material.dispose();
console.log(
  'Tree detail: shared contact/wind buffers, near override, hysteresis and reduced wind sampling passed.',
  counts
);
