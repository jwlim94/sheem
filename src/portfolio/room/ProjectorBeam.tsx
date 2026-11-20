import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  FrontSide,
  Group,
  Matrix3,
  Matrix4,
  Mesh,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { PerspectiveCamera } from 'three';
import { LENS as HALL_LENS, SLIDE } from './hall';
/**
 * The projector's beam across the dim auditorium: a soft volume of cool light
 * spreading from the booth's lens at the back to the slide on the whiteboards, with dust
 * motes drifting and glinting only inside it.
 *
 * The beam lives in a unit cube sheared over it (x across the slide, y up the
 * slide, z from the lens to the wall); the pyramid inside it narrows to the
 * lens. The shader marches the view ray through the box and integrates a
 * density that is zero outside the pyramid and soft at its edges, so there are
 * no hard faces. Local to the school group (see build_school.py).
 */
/** A beam: from its lens to the picture it throws on a wall facing ±X (the
 *  picture across Z, up Y), how dense its light, how many motes, and how
 *  bright they glint. By default the hall's: from the booth's projector lens
 *  to the slide on the whiteboards (hall.ts). */
export type Beam = {
  lens: [number, number, number];
  slide: { x: number; y: number; z: number; w: number; h: number };
  /** The light's density in the air (0: no shaft drawn, the motes only). */
  strength: number;
  motes: number;
  glint: number;
};
const HALL_BEAM: Beam = {
  lens: HALL_LENS,
  slide: SLIDE,
  strength: 0.22,
  motes: 700,
  glint: 1,
};
// Cool projector white.
const LIGHT = new Color('#dfe7ff');

const DENSITY = /* glsl */ `
float edge(float x, float w) { return smoothstep(0.0, w, x) * smoothstep(1.0, 1.0 - w, x); }
// p: (across the slide, up the slide, from the lens to the wall), each 0..1.
// The beam is the pyramid |p.xy - 0.5| < p.z / 2.
float density(vec3 p, float t) {
  float z = max(p.z, 1e-3);
  float cross = edge(0.5 + (p.x - 0.5) / z, 0.12) * edge(0.5 + (p.y - 0.5) / z, 0.12);
  // Bright near the lens, thinning as it spreads; it stops short of the wall.
  float along = smoothstep(0.0, 0.03, p.z) * (1.0 - smoothstep(0.86, 0.99, p.z)) * (1.15 - 0.6 * p.z);
  float drift = 0.8 + 0.2 * sin(p.x * 9.0 + p.z * 7.0 + t * 0.3) * sin(p.y * 7.0 - t * 0.2);
  return cross * along * drift;
}`;

const shaftVertex = /* glsl */ `
varying vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const shaftFragment = /* glsl */ `
uniform vec3 uCam; // camera in the shaft's unit-box space
uniform mat3 uBasis; // unit box → metres (for the path length)
uniform vec3 uColor;
uniform float uTime, uStrength;
varying vec3 vLocal;
${DENSITY}
void main() {
  vec3 rd = vLocal - uCam;
  vec3 inv = 1.0 / (rd + vec3(1e-6));
  vec3 a = (vec3(0.0) - uCam) * inv, b = (vec3(1.0) - uCam) * inv;
  vec3 lo = min(a, b), hi = max(a, b);
  float t0 = max(max(max(lo.x, lo.y), lo.z), 0.0);
  float t1 = min(min(hi.x, hi.y), hi.z);
  if (t1 <= t0) discard;
  float sum = 0.0;
  for (int i = 0; i < 14; i++) {
    vec3 p = uCam + rd * mix(t0, t1, (float(i) + 0.5) / 14.0);
    sum += density(p, uTime);
  }
  float metres = length(uBasis * rd) * (t1 - t0);
  float a2 = 1.0 - exp(-sum / 14.0 * metres * uStrength);
  gl_FragColor = vec4(uColor * a2, 1.0);
}`;

const moteVertex = /* glsl */ `
attribute vec3 aSeed;
attribute float aPhase;
uniform mat3 uBasis;
uniform vec3 uOrigin;
uniform float uTime, uScale;
varying float vGlow;
float edge(float x, float w) { return smoothstep(0.0, w, x) * smoothstep(1.0, 1.0 - w, x); }
void main() {
  // Each mote drifts on its own: a slow swirl across the beam, sinking at its
  // own pace and wandering along it; wrapped (invisible at the beam's edges),
  // then squeezed into the pyramid.
  vec3 s = aSeed;
  float sp = 0.6 + aPhase;
  s.x = fract(s.x + 0.06 * sin(uTime * 0.23 * sp + aPhase * 6.28)
                  + 0.025 * sin(uTime * 0.71 * sp + aPhase * 17.0)
                  + uTime * 0.004 * (aPhase - 0.5));
  s.y = fract(s.y - uTime * 0.012 * sp + 0.04 * sin(uTime * 0.31 * sp + aPhase * 9.0));
  s.z = fract(s.z + uTime * 0.003 * (aPhase - 0.4) + 0.02 * sin(uTime * 0.17 * sp + aPhase * 4.0));
  vec3 p = vec3(0.5 + (s.x - 0.5) * s.z, 0.5 + (s.y - 0.5) * s.z, s.z);
  // Glints as a mote turns in the light; only inside the beam.
  vGlow = edge(s.x, 0.12) * edge(s.y, 0.12) * smoothstep(0.04, 0.12, s.z) * (1.0 - smoothstep(0.75, 0.95, s.z))
        * (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (1.1 + 1.6 * aPhase) + aPhase * 40.0), 3.0));
  vec4 mv = modelViewMatrix * vec4(uBasis * p + uOrigin, 1.0);
  gl_PointSize = uScale * (0.5 + fract(aPhase * 7.31)) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const moteFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uGlint;
varying float vGlow;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(uColor * a * vGlow * 0.9 * uGlint, 1.0);
}`;

const additive = {
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  toneMapped: false,
} as const;

/** Deterministic pseudo-random in [0, 1). */
function rand(n: number) {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** The shaft and its motes, local to the place's group. */
function buildBeam(beam: Beam) {
  const MOTES = beam.motes,
    LENS = new Vector3(...beam.lens),
    SLIDE_C = new Vector3(beam.slide.x, beam.slide.y, beam.slide.z);
  const box = new BoxGeometry(1, 1, 1);
  box.translate(0.5, 0.5, 0.5);
  const across = new Vector3(0, 0, beam.slide.w),
    up = new Vector3(0, beam.slide.h, 0),
    along = SLIDE_C.clone().sub(LENS),
    origin = LENS.clone()
      .addScaledVector(across, -0.5)
      .addScaledVector(up, -0.5);
  const frame = new Matrix4().makeBasis(across, up, along).setPosition(origin);
  const basis = new Matrix3().setFromMatrix4(frame);
  const shaft = new Mesh(
    box,
    new ShaderMaterial({
      vertexShader: shaftVertex,
      fragmentShader: shaftFragment,
      uniforms: {
        uCam: { value: new Vector3() },
        uBasis: { value: basis },
        uColor: { value: LIGHT },
        uTime: { value: 0 },
        uStrength: { value: beam.strength },
      },
      side: FrontSide,
      ...additive,
    })
  );
  shaft.matrixAutoUpdate = false;
  shaft.matrix.copy(frame);
  shaft.matrixWorldNeedsUpdate = true;
  shaft.frustumCulled = false;
  shaft.renderOrder = 5;

  const seeds = new Float32Array(MOTES * 3),
    phases = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    seeds.set([rand(i), rand(i + 0.3), 0.05 + 0.9 * rand(i + 0.7)], i * 3);
    phases[i] = rand(i + 0.9);
  }
  const geo = new BufferGeometry();
  geo.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(MOTES * 3), 3)
  );
  geo.setAttribute('aSeed', new BufferAttribute(seeds, 3));
  geo.setAttribute('aPhase', new BufferAttribute(phases, 1));
  const motes = new Points(
    geo,
    new ShaderMaterial({
      vertexShader: moteVertex,
      fragmentShader: moteFragment,
      uniforms: {
        uBasis: { value: basis },
        uOrigin: { value: origin },
        uColor: { value: LIGHT },
        uTime: { value: 0 },
        uScale: { value: 30 },
        uGlint: { value: beam.glint },
      },
      ...additive,
    })
  );
  motes.frustumCulled = false;
  motes.renderOrder = 6;
  return [{ shaft, motes }];
}

/** Per-frame uniforms: the camera in the shaft's box space, time, mote size. */
function tick(
  { shaft, motes }: ReturnType<typeof buildBeam>[number],
  camera: Vector3,
  t: { inv: Matrix4; time: number },
  scale: number
) {
  const sm = shaft.material as ShaderMaterial,
    mm = motes.material as ShaderMaterial;
  t.inv.copy(shaft.matrixWorld).invert();
  sm.uniforms.uCam.value.copy(camera).applyMatrix4(t.inv);
  sm.uniforms.uTime.value = t.time;
  mm.uniforms.uTime.value = t.time;
  mm.uniforms.uScale.value = scale;
}

export function ProjectorBeam({
  reduced,
  beam = HALL_BEAM,
}: {
  reduced: boolean;
  beam?: Beam;
}) {
  // Built and owned here (added to the group imperatively), so the frame loop
  // can update their uniforms; removed and disposed on unmount.
  const group = useRef<Group>(null),
    live = useRef<ReturnType<typeof buildBeam> | null>(null),
    tmp = useRef({ inv: new Matrix4(), time: 0 });
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    const list = buildBeam(beam);
    // Without a strength, only the motes: in a lit room the beam itself
    // isn't seen, only the dust glinting in it.
    for (const { shaft, motes } of list)
      g.add(...(beam.strength > 0 ? [shaft, motes] : [motes]));
    live.current = list;
    return () => {
      for (const { shaft, motes } of list) {
        g.remove(shaft, motes);
        (shaft.material as ShaderMaterial).dispose();
        (motes.material as ShaderMaterial).dispose();
        motes.geometry.dispose();
      }
      list[0]?.shaft.geometry.dispose();
      live.current = null;
    };
  }, [beam]);

  useFrame(({ camera, size }, dt) => {
    const list = live.current;
    if (!list) return;
    const t = tmp.current;
    if (!reduced) t.time += Math.min(dt, 0.05);
    const cam = camera as PerspectiveCamera,
      // Mote size: ~1.6 cm at 1 m, in pixels.
      scale =
        (0.016 * size.height * Math.min(devicePixelRatio, 1.75)) /
        (2 * Math.tan((cam.fov * Math.PI) / 360));
    for (const item of list) tick(item, camera.position, t, scale);
  });

  return <group ref={group} />;
}
