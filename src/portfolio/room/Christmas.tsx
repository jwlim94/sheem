import { useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Points,
  ShaderMaterial,
  SphereGeometry,
} from 'three';
import type { Group, Mesh } from 'three';
import { masked } from './windowMask';
import { shown } from './shown';
import { TREE_BULBS, TREE_STAR } from './xmasLights';
import { trackLoads } from './loadProgress';

const XMAS = '/models/portfolio-room/xmas.glb';
const DRACO = '/draco/';

/**
 * His room at Christmas, for the story's ending (2026-11-22, the user's call:
 * back in the room, dressed for Christmas and winter). The decorations from
 * Blender (art/portfolio-room/build_xmas.py, Kenney's Holiday Kit): the tree
 * by the left wall with its baubles and star, presents under it, stockings
 * on the bookcase, a wreath, a snowman. Live here:
 * - the tree's fairy lights (up its spiral) and a string of them across the
 *   window, warm white, each breathing on its own beat, now and then one
 *   glinting; a soft glow round each, and round the star;
 * - snow falling past the window, only seen through it (the window's
 *   stencil, Outside.tsx).
 * RoomScene shows the group only in the ending.
 */

// The window opening (build_room.py): its middle x -0.9, 2.2 wide, its top
// at y 3.3; the wall's inner face at z -2.6.
const WIN = { x0: -2.0, x1: 0.2, top: 3.3, z: -2.56 };

/** The string across the window: hung from five points just over the
 *  opening, in four swags, and down its sides a little way. */
function windowBulbs(): [number, number, number][] {
  const out: [number, number, number][] = [];
  const swags = 4,
    per = 11,
    sag = 0.14,
    y0 = WIN.top + 0.06;
  for (let s = 0; s < swags; s++)
    for (let k = 0; k < per; k++) {
      const t = k / per,
        x = WIN.x0 + ((s + t) / swags) * (WIN.x1 - WIN.x0);
      out.push([x, y0 - sag * Math.sin(Math.PI * t), WIN.z]);
    }
  for (const x of [WIN.x0 - 0.02, WIN.x1 + 0.02])
    for (let k = 0; k <= 7; k++)
      out.push([x + 0.025 * Math.sin(k * 1.7), y0 - 0.1 - k * 0.13, WIN.z]);
  return out;
}

const WARM = [
  [1.0, 0.82, 0.55],
  [1.0, 0.9, 0.72],
  [1.0, 0.74, 0.42],
];

const bulbVertex = /* glsl */ `
attribute vec3 aTint;
attribute float aPhase;
uniform float uTime;
varying vec3 vTint;
varying float vGlow;
float glow(float t, float ph) {
  // A slow breath on its own beat, and now and then a glint.
  float breath = 0.78 + 0.22 * sin(t * 1.1 + ph * 6.2832);
  float glint = pow(max(0.0, sin(t * 0.37 + ph * 41.0)), 40.0);
  return breath + 0.9 * glint;
}
void main() {
  vTint = aTint;
  vGlow = glow(uTime, aPhase);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const bulbFragment = /* glsl */ `
varying vec3 vTint;
varying float vGlow;
void main() {
  gl_FragColor = vec4(vTint * (0.9 + 0.8 * vGlow), 1.0);
}`;

// The glow round each bulb: a soft disc, added, its size in the world.
const haloVertex = /* glsl */ `
attribute vec3 aTint;
attribute float aPhase;
attribute float aSize;
uniform float uTime, uViewH;
varying vec3 vTint;
varying float vGlow;
void main() {
  vTint = aTint;
  float breath = 0.78 + 0.22 * sin(uTime * 1.1 + aPhase * 6.2832);
  float glint = pow(max(0.0, sin(uTime * 0.37 + aPhase * 41.0)), 40.0);
  vGlow = breath + 0.9 * glint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * projectionMatrix[1][1] * uViewH * 0.5 / max(0.1, -mv.z);
}`;
const haloFragment = /* glsl */ `
uniform float uStrength;
varying vec3 vTint;
varying float vGlow;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-d * d * 5.0) * (1.0 - smoothstep(0.8, 1.0, d));
  gl_FragColor = vec4(vTint * a * vGlow * uStrength, 1.0);
}`;

// Snow past the window: each flake falls at its own speed, sways, and fades
// into the night with distance.
const SNOW = { x0: -2.5, x1: 0.7, y0: 0.6, y1: 4.6, z0: -2.85, z1: -9 };
const snowVertex = /* glsl */ `
attribute vec4 aFlake; // speed, phase, size, sway
uniform float uTime, uViewH;
varying float vA;
void main() {
  vec3 p = position;
  float span = ${(SNOW.y1 - SNOW.y0).toFixed(2)};
  p.y = ${SNOW.y0.toFixed(2)} + mod(p.y - ${SNOW.y0.toFixed(2)} - uTime * aFlake.x, span);
  p.x += aFlake.w * sin(uTime * 0.55 + aFlake.y * 6.2832);
  p.z += 0.5 * aFlake.w * cos(uTime * 0.43 + aFlake.y * 4.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aFlake.z * projectionMatrix[1][1] * uViewH * 0.5 / max(0.1, -mv.z);
  float far = -p.z + ${SNOW.z0.toFixed(2)};
  vA = (1.0 - smoothstep(1.5, 6.0, far))
    * smoothstep(0.0, 0.4, p.y - ${SNOW.y0.toFixed(2)})
    * (1.0 - smoothstep(span - 0.4, span, p.y - ${SNOW.y0.toFixed(2)}));
}`;
const snowFragment = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.35, 1.0, d)) * vA * 0.85;
  gl_FragColor = vec4(0.9, 0.93, 1.0, a);
}`;

const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function Christmas({ group }: { group: RefObject<Group | null> }) {
  const decor = useGLTF(XMAS, DRACO);
  useEffect(() => {
    decor.scene.traverse((o) => {
      if ((o as Mesh).isMesh) o.castShadow = o.receiveShadow = true;
    });
  }, [decor.scene]);

  const live = useMemo(() => {
    const tree = TREE_BULBS,
      win = windowBulbs(),
      all = [...tree, ...win],
      n = all.length;
    // The bulbs themselves.
    const sphere = new SphereGeometry(0.024, 8, 6);
    const tints = new Float32Array(n * 3),
      phases = new Float32Array(n),
      sizes = new Float32Array(n + 1),
      halo = new Float32Array((n + 1) * 3),
      haloTint = new Float32Array((n + 1) * 3),
      haloPhase = new Float32Array(n + 1);
    all.forEach((p, i) => {
      const c = WARM[Math.floor(rand(i + 3) * WARM.length)];
      tints.set(c, i * 3);
      // Along the tree's string the beats roll on, so the light seems to
      // move up it; the window's are scattered.
      phases[i] = i < tree.length ? i * 0.045 + 0.3 * rand(i) : rand(i + 50);
      halo.set(p, i * 3);
      haloTint.set(c, i * 3);
      haloPhase[i] = phases[i];
      sizes[i] = i < tree.length ? 0.17 : 0.2;
    });
    // And the star's glow.
    halo.set(TREE_STAR, n * 3);
    haloTint.set([1.0, 0.8, 0.45], n * 3);
    haloPhase[n] = 0.2;
    sizes[n] = 0.85;
    sphere.setAttribute('aTint', new InstancedBufferAttribute(tints, 3));
    sphere.setAttribute('aPhase', new InstancedBufferAttribute(phases, 1));
    const uniforms = { uTime: { value: 0 }, uViewH: { value: 900 } };
    const bulbMat = new ShaderMaterial({
      vertexShader: bulbVertex,
      fragmentShader: bulbFragment,
      uniforms,
      toneMapped: false,
    });
    const bulbs = new InstancedMesh(sphere, bulbMat, n);
    const m = new Matrix4();
    all.forEach((p, i) => bulbs.setMatrixAt(i, m.makeTranslation(...p)));
    bulbs.computeBoundingSphere();

    const haloGeo = new BufferGeometry();
    haloGeo.setAttribute('position', new BufferAttribute(halo, 3));
    haloGeo.setAttribute('aTint', new BufferAttribute(haloTint, 3));
    haloGeo.setAttribute('aPhase', new BufferAttribute(haloPhase, 1));
    haloGeo.setAttribute('aSize', new BufferAttribute(sizes, 1));
    const haloMat = new ShaderMaterial({
      vertexShader: haloVertex,
      fragmentShader: haloFragment,
      uniforms: { ...uniforms, uStrength: { value: 0.55 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const halos = new Points(haloGeo, haloMat);
    halos.renderOrder = 8;

    // The snow.
    const flakes = 900,
      pos = new Float32Array(flakes * 3),
      flake = new Float32Array(flakes * 4);
    for (let i = 0; i < flakes; i++) {
      const r = (k: number) => rand(i * 7 + k);
      pos[i * 3] = SNOW.x0 + r(1) * (SNOW.x1 - SNOW.x0);
      pos[i * 3 + 1] = SNOW.y0 + r(2) * (SNOW.y1 - SNOW.y0);
      pos[i * 3 + 2] = SNOW.z0 + r(3) ** 1.6 * (SNOW.z1 - SNOW.z0);
      flake.set(
        [0.22 + 0.3 * r(4), r(5), 0.028 + 0.03 * r(6), 0.05 + 0.1 * r(7)],
        i * 4
      );
    }
    const snowGeo = new BufferGeometry();
    snowGeo.setAttribute('position', new BufferAttribute(pos, 3));
    snowGeo.setAttribute('aFlake', new BufferAttribute(flake, 4));
    const snowMat = new ShaderMaterial({
      vertexShader: snowVertex,
      fragmentShader: snowFragment,
      uniforms,
      // (The window's mask: transparent, no depth written.)
      ...masked,
    });
    const snow = new Points(snowGeo, snowMat);
    snow.frustumCulled = false;
    snow.renderOrder = 7;
    return {
      bulbs,
      halos,
      snow,
      uniforms,
      sphere,
      bulbMat,
      haloGeo,
      haloMat,
      snowGeo,
      snowMat,
    };
  }, []);
  useEffect(
    () => () => {
      for (const d of [
        live.sphere,
        live.bulbMat,
        live.haloGeo,
        live.haloMat,
        live.snowGeo,
        live.snowMat,
      ])
        d.dispose();
    },
    [live]
  );

  useFrame(({ clock, gl }) => {
    if (!shown(group.current)) return;
    live.uniforms.uTime.value = clock.elapsedTime;
    live.uniforms.uViewH.value = gl.domElement.height;
  });

  return (
    <group ref={group}>
      <primitive object={decor.scene} />
      <primitive object={live.bulbs} />
      <primitive object={live.halos} />
      <primitive object={live.snow} />
    </group>
  );
}

useGLTF.preload(XMAS, DRACO, true, trackLoads);
