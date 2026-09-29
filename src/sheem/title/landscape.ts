import { createNoise2D } from 'simplex-noise';
import * as THREE from 'three';

export function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
const noise = createNoise2D(seededRandom(34));
export function riverX(z: number) {
  return 20 + Math.sin(z * 0.024) * 15 + Math.sin(z * 0.055) * 5;
}
// Shared world-space coverage: dense grass islands blend into short clearings.
// Keep this deterministic so future movement/rustle logic can query the same areas.
export function grassDensity(x: number, z: number) {
  const warpX = x + noise(x * 0.022, z * 0.022) * 12;
  const warpZ = z + noise(x * 0.022 + 90, z * 0.022) * 12;
  const patches = noise(warpX * 0.035 + 80, warpZ * 0.035 - 40);
  const detail = noise(x * 0.16, z * 0.16) * 0.28;
  return THREE.MathUtils.smoothstep(patches + detail, -0.7, 0.65);
}
export function groundHeight(x: number, z: number) {
  const rolling =
    4 + noise(x * 0.009, z * 0.009) * 9 + noise(x * 0.026, z * 0.026) * 1.8;
  const bank = THREE.MathUtils.smoothstep(Math.abs(x - riverX(z)), 4.5, 23);
  return -0.7 + Math.max(1.4, rolling + 3) * bank;
}
// Match the rendered four-meter terrain triangles, not just the underlying noise.
// Small blades otherwise disappear below slopes and reveal artificial contour bands.
export function surfaceHeight(x: number, z: number) {
  const x0 = Math.floor((x + 360) / 4) * 4 - 360;
  const z0 = Math.floor((z + 570) / 4) * 4 - 570;
  const u = (x - x0) / 4,
    v = (z - z0) / 4;
  const a = groundHeight(x0, z0),
    b = groundHeight(x0 + 4, z0);
  const c = groundHeight(x0, z0 + 4),
    d = groundHeight(x0 + 4, z0 + 4);
  return u + v <= 1
    ? a + u * (b - a) + v * (c - a)
    : d + (1 - u) * (c - d) + (1 - v) * (b - d);
}
const groundDark = new THREE.Color('#5e7436');
const groundLight = new THREE.Color('#a6ae57');
const groundSand = new THREE.Color('#9caa79');
export function groundColorAt(x: number, z: number, target: THREE.Color) {
  target
    .copy(groundDark)
    .lerp(groundLight, (noise(x * 0.033, z * 0.033) + 1) * 0.4);
  if (Math.abs(x - riverX(z)) < 8) target.lerp(groundSand, 0.65);
  return target;
}
export function grassDirection(x: number, z: number) {
  return 0.6 + noise(x * 0.04, z * 0.04) * 0.8;
}
export function terrainGeometry() {
  const geo = new THREE.PlaneGeometry(720, 720, 180, 180);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -210);
  const p = geo.attributes.position;
  const colors = [];
  const color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i);
    const h = groundHeight(x, z);
    p.setY(i, h);
    groundColorAt(x, z, color);
    colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
export function riverGeometry() {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= 220; i++) {
    const z = 120 - i * 3;
    const x = riverX(z);
    positions.push(x - 4.8, 0, z, x + 4.8, 0, z);
    uvs.push(0, i / 8, 1, i / 8);
    if (i < 220) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
export function mountainGeometry(depth: number, seed: number) {
  const random = seededRandom(seed);
  const positions: number[] = [],
    indices: number[] = [],
    colors: number[] = [];
  const peakColor = new THREE.Color(
    ['#a4babb', '#8eaaa5', '#77988c'][(seed - 13) / 12]
  );
  const baseColor = new THREE.Color('#c5d0b7');
  const color = new THREE.Color();
  for (let i = 0; i <= 160; i++) {
    const x = -650 + i * 8.25;
    const peak =
      24 +
      Math.sin(i * 0.14 + seed) * 19 +
      Math.sin(i * 0.3) * 8 +
      random() * 3;
    positions.push(x, -10, depth, x, peak, depth - 15);
    color.copy(baseColor);
    colors.push(color.r, color.g, color.b);
    color.copy(peakColor).multiplyScalar(0.96 + random() * 0.08);
    colors.push(color.r, color.g, color.b);
    if (i < 160) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
