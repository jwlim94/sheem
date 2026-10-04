// node --experimental-strip-types scripts/check-foliage-contact.mjs
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute, Mesh, Vector3 } from 'three';
import { createFoliageContact } from '../src/sheem/wind/foliageContact.ts';
for (const fps of [30, 60, 120]) {
  const rest = [
    0.3, 0.95, 0, 1.8, 0.95, -0.65, 1.8, 0.95, 0.65, 0.3, 2, 0, 1.8, 2, -0.65,
    1.8, 2, 0.65,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(rest, 3));
  const mesh = new Mesh(geometry);
  const solve = createFoliageContact(mesh, 0, 0);
  const body = {
    position: { x: 1.7, y: 0, z: 0.55 },
    velocity: { x: 2, y: 0, z: 0 },
    radius: 0.34,
    height: 1.45,
    active: true,
  };
  for (let i = 0; i < fps; i++) solve.update([body], 1 / fps);
  const p = geometry.attributes.position;
  assert(
    new Vector3()
      .fromBufferAttribute(p, 0)
      .distanceTo(new Vector3(0.3, 0.95, 0)) < 1e-6,
    'attachment fixed'
  );
  assert(
    new Vector3()
      .fromBufferAttribute(p, 1)
      .distanceTo(new Vector3(1.8, 0.95, -0.65)) < 1e-6,
    'untouched end of SAME branch stays fixed'
  );
  const tip = new Vector3()
    .fromBufferAttribute(p, 2)
    .distanceTo(new Vector3(1.8, 0.95, 0.65));
  assert(tip > 0.005 && tip < 0.25, 'gentle tip bend');
  for (let i = 9; i < rest.length; i++)
    assert(Math.abs(p.array[i] - rest[i]) < 1e-6, 'other branch unchanged');
  for (let i = 0; i < fps * 6; i++) solve.update([], 1 / fps);
  for (let i = 0; i < rest.length; i++)
    assert(Math.abs(p.array[i] - rest[i]) < 1e-5, 'recovery');
  geometry.dispose();
  mesh.material.dispose();
}
console.log(
  'Local grass-like leaf response: fixed attachment, gentle tip bend, unchanged neighbours and recovery pass at 30/60/120 fps'
);

// Mid-frond touches must not disappear under a squared whole-branch weight.
{
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [0.3, 0.95, 0, 2, 0.95, -0.4, 2, 0.95, 0.4, 0.9, 0.95, 0],
      3
    )
  );
  geometry.setIndex([0, 1, 3, 1, 2, 3, 2, 0, 3]);
  const mesh = new Mesh(geometry),
    solve = createFoliageContact(mesh, 0, 0);
  const body = {
    position: { x: 1, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: -1.8 },
    radius: 0.34,
    height: 1.45,
    active: true,
  };
  for (let i = 0; i < 60; i++) solve.update([body], 1 / 60);
  const p = geometry.attributes.position;
  const movement = new Vector3()
    .fromBufferAttribute(p, 3)
    .distanceTo(new Vector3(0.9, 0.95, 0));
  assert(
    movement > 0.08 && movement < 0.26,
    'mid-frond touch is visibly local'
  );
  assert(
    new Vector3()
      .fromBufferAttribute(p, 1)
      .distanceTo(new Vector3(2, 0.95, -0.4)) < 1e-6,
    'far tip stays still'
  );
  geometry.dispose();
  mesh.material.dispose();
  console.log(
    'Mid-frond contact remains visible without moving the distant tip'
  );
}
