import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LessEqualDepth,
  MathUtils,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { HERO_ROW, HERO_Z, PROFESSOR, seats } from './hall';
import {
  chain,
  HEAD,
  HIP,
  NECK,
  sculpt,
  seatedBody,
  STANDING_BOX,
  v,
} from './figures';
import type { Ball } from './figures';
import { occupants } from './occupants';

/**
 * The rest of CS 142: translucent silhouettes of classmates, memories around
 * the one clear figure. They appear one by one as the scroll goes on and settle
 * into their seats until the hall is nearly full. The professor is there
 * first, at the lectern, his hands on his laptop.
 *
 * Four seated poses (typing on a laptop, leaning back, chin on hand, arms
 * crossed), each one smooth sculpted surface (metaballs polygonised by
 * MarchingCubes) with human proportions, instanced. A soft fresnel ghost shader draws only the
 * outer surface (depth pre-pass), breathes, now and then turns a head, and
 * fades with distance. Some typists' laptops glow on their laps.
 *
 * Seats come from hall.ts; his seat, his neighbours and the seats right
 * behind him stay free for the over-the-shoulder shot. Local to the school.
 */
const near = (r: number, z: number) =>
  Math.abs(r - HERO_ROW) <= 1 && Math.abs(z - HERO_Z) < 1.2;

/** Deterministic pseudo-random in [0, 1). */
function rand(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Arms per pose, shoulder to elbow to hand; `reach`: how much further
 *  ahead a typist's hands are (on a laptop on a desk, not the lap). */
function seatedArms(pose: number, lean: number, reach = 0): Ball[] {
  const sx = -0.17 - lean,
    out: Ball[] = [];
  for (const s of [-1, 1]) {
    const sh = v(sx, 1.05, 0.25 * s);
    let elbow: Vector3, hand: Vector3;
    if (pose === 0) {
      elbow = v(sx + 0.06 + reach / 2, 0.78 + reach / 4, 0.26 * s); // typing
      hand = v(0.3 + reach, 0.74 + reach / 4, 0.11 * s);
    } else if (pose === 1) {
      elbow = v(sx + 0.02, 0.74, 0.32 * s); // leaning back, arms on the rests
      hand = v(0.28, 0.69, 0.33 * s);
    } else if (pose === 2) {
      elbow = s > 0 ? v(sx + 0.24, 0.88, 0.18) : v(sx + 0.08, 0.76, -0.26);
      hand = s > 0 ? v(-0.0, 1.3, 0.06) : v(0.22, 0.66, 0.02); // chin on hand
    } else {
      elbow = v(sx + 0.12, 0.86, 0.27 * s); // arms crossed
      hand = v(0.05, 0.93, -0.15 * s);
    }
    out.push(
      ...chain(sh, elbow, 0.068, 0.058),
      ...chain(elbow, hand, 0.056, 0.05),
      [hand.x, hand.y, hand.z, 0.055]
    );
  }
  return out;
}

const POSES = [
  { lean: 0, headDrop: 1 }, // typing, looking down
  { lean: 0.06, headDrop: 0 }, // leaning back
  { lean: -0.05, headDrop: 0.3 }, // chin on hand
  { lean: 0.03, headDrop: 0 }, // arms crossed
];

function seatedFigure(pose: number, reach = 0) {
  const p = POSES[pose];
  return sculpt([
    ...seatedBody(p.lean, p.headDrop),
    ...seatedArms(pose, p.lean, reach),
  ]);
}

/** The professor at the lectern: leaning in a little over his laptop, head
 *  down to its screen, both hands on its keyboard (0.42 m ahead, at the
 *  lectern top's height). Faces +X; turned to face the class. */
function lecternFigure(): BufferGeometry {
  const balls: Ball[] = [
    [0, 1.12, -0.09, 0.16],
    [0, 1.12, 0.09, 0.16],
    ...chain(v(0, 1.2, -0.08), v(0.05, 1.62, -0.09), 0.15, 0.165),
    ...chain(v(0, 1.2, 0.08), v(0.05, 1.62, 0.09), 0.15, 0.165),
    ...chain(v(0.05, 1.7, -0.21), v(0.05, 1.7, 0.21), 0.1),
    ...chain(v(0.06, 1.75, 0), v(0.1, 1.9, 0), 0.065),
    [0.12, 2.06, 0, 0.165],
    [0.17, 1.98, 0, 0.11],
    [0.105, 2.11, 0, 0.15],
    ...[-1, 1].flatMap((s) => [
      ...chain(v(0, 1.08, 0.11 * s), v(0.02, 0.55, 0.12 * s), 0.1, 0.075),
      ...chain(v(0.02, 0.55, 0.12 * s), v(0.0, 0.1, 0.13 * s), 0.07, 0.055),
      ...chain(v(0.0, 0.05, 0.13 * s), v(0.12, 0.05, 0.13 * s), 0.055),
      ...chain(v(0.05, 1.67, 0.26 * s), v(0.12, 1.32, 0.3 * s), 0.066, 0.058),
      ...chain(v(0.12, 1.32, 0.3 * s), v(0.42, 1.21, 0.15 * s), 0.055, 0.05),
      [0.42, 1.21, 0.15 * s, 0.055] as Ball,
    ]),
  ];
  return sculpt(balls, STANDING_BOX);
}

const vertex = /* glsl */ `
attribute float aAppear, aPhase;
attribute vec2 aHead; // neck height, head's turning centre (x)
uniform float uTime;
// Typists at desks: their hands tap, in bursts (0 or 1).
uniform float uType;
// The professor's gesture (0..1): his left arm turned about its shoulder
// (uPivot) round uAxis by up to uAngle, his head toward it.
uniform float uPoint, uAngle;
uniform vec3 uPivot, uAxis;
varying vec3 vN, vV;
varying float vA, vFade;
vec3 turn(vec3 v, vec3 k, float a) {
  return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1.0 - cos(a));
}
void main() {
  vA = aAppear;
  vec3 p = position;
  vec3 n = normal;
  // Breathing: the upper body rises a hair.
  float above = smoothstep(${(HIP + 0.1).toFixed(2)}, ${(HIP + 0.4).toFixed(2)}, p.y);
  p.y += above * 0.008 * sin(uTime * 1.3 + aPhase * 6.283);
  if (uType > 0.0) {
    // The forearms and hands (ahead of the body, below the chest), each
    // hand on its own beat, a few words at a time.
    float hands = smoothstep(0.1, 0.28, p.x) * (1.0 - smoothstep(0.92, 1.05, p.y));
    float burst = smoothstep(0.15, 0.55, sin(uTime * 0.8 + aPhase * 23.0));
    p.y += uType * hands * burst * 0.007 * sin(uTime * 17.0 + aPhase * 50.0 + sign(p.z) * 1.9);
  }
  if (uPoint > 0.0) {
    // His left arm (beyond the shoulder, -z), the upper arm bending in.
    float arm = smoothstep(0.3, 0.42, -p.z) * smoothstep(1.0, 1.2, p.y);
    float b = uAngle * uPoint * arm;
    p = uPivot + turn(p - uPivot, uAxis, b);
    n = turn(n, uAxis, b);
  }
  // Now and then the head turns a little, then back (the professor's, to
  // his left as he gestures).
  float look = smoothstep(0.82, 0.98, sin(uTime * 0.11 + aPhase * 40.0)) * (aPhase > 0.5 ? 1.0 : -1.0);
  float a = (0.45 * look * (1.0 - uPoint) - 0.5 * uPoint) * smoothstep(aHead.x - 0.04, aHead.x + 0.06, p.y);
  vec2 c = vec2(aHead.y, 0.0);
  mat2 r = mat2(cos(a), sin(a), -sin(a), cos(a));
  p.xz = c + r * (p.xz - c);
  n.xz = r * n.xz;
  p.y += (1.0 - aAppear) * 0.35; // settles into the seat as it appears
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix * instanceMatrix) * n);
  vV = normalize(cameraPosition - wp.xyz);
  float d = distance(cameraPosition, wp.xyz);
  // Gone right in front of the lens; softer and fainter far away.
  vFade = smoothstep(0.9, 2.4, d) * mix(1.0, 0.45, smoothstep(9.0, 26.0, d));
  gl_Position = projectionMatrix * viewMatrix * wp;
  if (aAppear < 0.01) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
}`;

const fragment = /* glsl */ `
uniform vec3 uColor, uRim;
uniform float uBody, uEdge;
varying vec3 vN, vV;
varying float vA, vFade;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  gl_FragColor = vec4(mix(uColor, uRim, f), vA * vFade * (uBody + uEdge * f));
}`;

const glowVertex = /* glsl */ `
attribute float aAppear;
varying vec2 vUv;
varying float vA;
void main() {
  vUv = uv;
  vA = aAppear;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
  if (aAppear < 0.01) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
}`;
const glowFragment = /* glsl */ `
varying vec2 vUv;
varying float vA;
void main() {
  vec2 d = abs(vUv - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.75, 1.0, max(d.x, d.y))) * (0.75 + 0.25 * vUv.y);
  gl_FragColor = vec4(vec3(0.62, 0.72, 1.0) * a * vA * 0.55, 1.0);
}`;

type Crowd = {
  meshes: InstancedMesh[];
  appear: InstancedBufferAttribute;
  at: number[]; // when each one appears (chapter progress)
  /** Its own uniforms (typing, gesture). */
  own?: ReturnType<typeof motion>;
};

/** A room's uniforms, shared by its silhouettes' materials: its tint, and
 *  the time that drives breathing and glances. (One set for every room
 *  until 2026-11-20: once every place was in from the start, the last room
 *  to tick set the others' tint, the hall's slate as the classroom's.) */
type Look = {
  uTime: { value: number };
  uColor: { value: Color };
  uRim: { value: Color };
  uBody: { value: number };
  uEdge: { value: number };
};
function look(tint: Room['tint']): Look {
  return {
    uTime: { value: 0 },
    uColor: { value: new Color(tint.color) },
    uRim: { value: new Color(tint.rim) },
    uBody: { value: tint.body },
    uEdge: { value: tint.edge },
  };
}
/** A crowd's own: whether it types, and the professor's gesture. */
function motion(type = 0) {
  return {
    uType: { value: type },
    uPoint: { value: 0 },
    uAngle: { value: 0 },
    uPivot: { value: new Vector3() },
    uAxis: { value: new Vector3(0, 1, 0) },
  };
}

/**
 * Depth pass, then colour with an equal-depth test, over the same instances:
 * only each silhouette's outer surface shows (limbs don't show through).
 */
function crowd(
  shared: Look,
  geometry: BufferGeometry,
  places: Matrix4[],
  at: number[],
  head: [number, number] = [NECK, HEAD[0]],
  own = motion()
): Crowd {
  const uniforms = { ...shared, ...own };
  const n = places.length,
    appear = new InstancedBufferAttribute(new Float32Array(n), 1),
    phase = new InstancedBufferAttribute(
      new Float32Array(n).map((_, i) => rand(i * 7.31 + at[i] * 13)),
      1
    );
  appear.setUsage(DynamicDrawUsage);
  geometry.setAttribute('aAppear', appear);
  geometry.setAttribute('aPhase', phase);
  geometry.setAttribute(
    'aHead',
    new InstancedBufferAttribute(
      new Float32Array(n * 2).map((_, i) => head[i % 2]),
      2
    )
  );
  const depth = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }',
    uniforms,
    transparent: true,
    colorWrite: false,
  });
  const colour = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthFunc: LessEqualDepth,
  });
  const meshes = [depth, colour].map((material, pass) => {
    const mesh = new InstancedMesh(geometry, material, n);
    places.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.frustumCulled = false;
    mesh.renderOrder = 3 + pass;
    return mesh;
  });
  return { meshes, appear, at, own };
}

/** The professor standing in the room, asking it: weight on one leg, his
 *  left hand open toward the screens, the right at his side. Faces +X. */
function standingFigure(): BufferGeometry {
  const balls: Ball[] = [
    [0, 1.12, -0.09, 0.16],
    [0, 1.12, 0.09, 0.16],
    ...chain(v(0, 1.2, -0.08), v(0.0, 1.62, -0.09), 0.15, 0.165),
    ...chain(v(0, 1.2, 0.08), v(0.0, 1.62, 0.09), 0.15, 0.165),
    ...chain(v(0.0, 1.7, -0.21), v(0.0, 1.7, 0.21), 0.1),
    ...chain(v(0.01, 1.75, 0), v(0.03, 1.9, 0), 0.065),
    [0.05, 2.06, 0, 0.165],
    [0.1, 2.0, 0, 0.11],
    [0.035, 2.11, 0, 0.15],
    ...[-1, 1].flatMap((s) => [
      ...chain(
        v(0, 1.08, 0.11 * s),
        v(0.0, 0.55, 0.12 * s + (s < 0 ? -0.02 : 0)),
        0.1,
        0.075
      ),
      ...chain(v(0.0, 0.55, 0.12 * s), v(0.0, 0.1, 0.13 * s), 0.07, 0.055),
      ...chain(v(0.0, 0.05, 0.13 * s), v(0.12, 0.05, 0.13 * s), 0.055),
    ]),
    // His right arm down; his left out toward the screens, palm open.
    ...chain(v(0.0, 1.67, 0.26), v(0.02, 1.32, 0.3), 0.066, 0.058),
    ...chain(v(0.02, 1.32, 0.3), v(0.04, 1.0, 0.3), 0.055, 0.05),
    [0.04, 0.98, 0.3, 0.055] as Ball,
    ...chain(v(0.0, 1.67, -0.26), v(0.12, 1.4, -0.42), 0.066, 0.058),
    ...chain(v(0.12, 1.4, -0.42), v(0.36, 1.46, -0.56), 0.055, 0.05),
    [0.4, 1.47, -0.58, 0.058] as Ball,
  ];
  return sculpt(balls, STANDING_BOX);
}

/** Laptop screens glowing on some typists' laps (additive, cool); `at`: the
 *  screen's place in the sitter's frame (on the lap, or on a desk). */
function glows(
  places: Matrix4[],
  at: number[],
  where: [number, number] = [0.42, 0.86]
): Crowd {
  const g = new PlaneGeometry(0.3, 0.2);
  // Facing the sitter, tilted back like an open lid.
  g.rotateY(-Math.PI / 2);
  g.rotateZ(0.25);
  g.translate(where[0], where[1], 0);
  const appear = new InstancedBufferAttribute(
    new Float32Array(places.length),
    1
  );
  appear.setUsage(DynamicDrawUsage);
  g.setAttribute('aAppear', appear);
  const mesh = new InstancedMesh(
    g,
    new ShaderMaterial({
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    }),
    places.length
  );
  places.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return { meshes: [mesh], appear, at };
}

/** A room of them: its seats (each facing +X turned by yaw), those to keep
 *  free, the professor's place, pose and turn, when they arrive (the
 *  chapter's progress), and where their laptops' glow sits. Chapter 1's
 *  hall by default. */
export type Room = {
  seats: { row: number; x: number; y: number; z: number; yaw: number }[];
  free: (seat: { row: number; x: number; z: number }) => boolean;
  professor: {
    at: [number, number, number];
    yaw: number;
    pose: 'lectern' | 'standing';
  };
  arrive: [number, number];
  /** Where their laptops' glow sits (none where the laptops are real). */
  glow?: [number, number];
  /** Their tint: body and rim colours, body and rim opacity. */
  tint: { color: string; rim: string; body: number; edge: number };
  /** A room with desks: the typists' hands reach this much further, onto
   *  the laptops on them (DeskThings), and tap. */
  reach?: number;
  /** The standing professor's gesture (0..1) at the chapter's progress:
   *  his left arm out toward the screens, his head with it. */
  gesture?: (progress: number) => number;
};
const HALL: Room = {
  seats: seats(),
  free: (seat) =>
    (seat as { section?: number }).section === 0 && near(seat.row, seat.z),
  professor: { at: PROFESSOR, yaw: Math.PI, pose: 'lectern' },
  arrive: [0.14, 0.46],
  glow: [0.42, 0.86],
  // Pale and faint in the dim hall.
  tint: { color: '#8f9bb8', rim: '#e6ecff', body: 0.05, edge: 0.34 },
};

/** The professor's gesture: his left arm, from where it is held (the hand
 *  forward and low) to out at his side, a little up and back, toward the
 *  screens behind his left. About his shoulder; the axis and angle that
 *  turn the one direction to the other. */
const SHOULDER = v(0, 1.66, -0.27),
  ARM_FROM = v(0.4, 1.47, -0.58).sub(SHOULDER).normalize(),
  ARM_TO = v(0.05, 0.25, -0.97).normalize(),
  ARM_AXIS = ARM_FROM.clone().cross(ARM_TO).normalize(),
  ARM_ANGLE = Math.acos(ARM_FROM.dot(ARM_TO));

function build(room: Room, shared: Look) {
  const byPose = POSES.map(() => ({
      places: [] as Matrix4[],
      at: [] as number[],
    })),
    lit = { places: [] as Matrix4[], at: [] as number[] };
  for (const { pose, m, t, n } of occupants(room)) {
    byPose[pose].places.push(m);
    byPose[pose].at.push(t);
    if (room.glow && pose === 0 && rand(n * 2.9) < 0.6) {
      lit.places.push(m);
      lit.at.push(t + 0.03);
    }
  }
  const professor = motion();
  if (room.gesture) {
    professor.uPivot.value.copy(SHOULDER);
    professor.uAxis.value.copy(ARM_AXIS);
    professor.uAngle.value = ARM_ANGLE;
  }
  return [
    ...byPose.map((p, i) =>
      crowd(
        shared,
        seatedFigure(i, i === 0 ? (room.reach ?? 0) : 0),
        p.places,
        p.at,
        undefined,
        motion(i === 0 && room.reach ? 1 : 0)
      )
    ),
    ...(room.glow ? [glows(lit.places, lit.at, room.glow)] : []),
    // The professor, there before anyone (from the chapter's first frame),
    // at the lectern or standing in the room; only his head turns (now and
    // then, to the room), and his arm where the room says (gesture).
    crowd(
      shared,
      room.professor.pose === 'lectern' ? lecternFigure() : standingFigure(),
      [
        new Matrix4().compose(
          v(...room.professor.at),
          new Quaternion().setFromAxisAngle(v(0, 1, 0), room.professor.yaw),
          v(1, 1, 1)
        ),
      ],
      [-0.05], // already standing there when the chapter opens
      room.professor.pose === 'lectern' ? [1.86, 0.11] : [1.86, 0.04],
      professor
    ),
  ];
}

/** Per frame: each figure's appear value from the chapter's progress. */
function tick(c: Crowd, s: number) {
  const arr = c.appear.array as Float32Array;
  let changed = false;
  for (let i = 0; i < c.at.length; i++) {
    const a = MathUtils.smoothstep(s, c.at[i], c.at[i] + 0.05);
    if (Math.abs(arr[i] - a) > 1e-3) {
      arr[i] = a;
      changed = true;
    }
  }
  if (changed) c.appear.needsUpdate = true;
  for (const m of c.meshes) m.visible = s > 0;
}

/** The professor's gesture, for the crowd that has one. */
function gesture(c: Crowd, value: number) {
  if (c.own && c.own.uAngle.value > 0) c.own.uPoint.value = value;
}

export function Classmates({
  school,
  reduced,
  room = HALL,
}: {
  /** The chapter's progress (they arrive as it goes). */
  school: RefObject<number>;
  reduced: boolean;
  room?: Room;
}) {
  const group = useRef<Group>(null),
    live = useRef<{ list: Crowd[]; shared: Look } | null>(null);
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    const shared = look(room.tint),
      list = build(room, shared);
    for (const c of list) g.add(...c.meshes);
    live.current = { list, shared };
    return () => {
      for (const c of list) {
        g.remove(...c.meshes);
        c.meshes[0].geometry.dispose();
        for (const m of c.meshes) {
          (m.material as ShaderMaterial).dispose();
          m.dispose();
        }
      }
      live.current = null;
    };
  }, [room]);
  useFrame((_, dt) => {
    const now = live.current;
    if (!now) return;
    if (!reduced) now.shared.uTime.value += Math.min(dt, 0.05);
    const s = school.current ?? 0;
    for (const c of now.list) {
      tick(c, s);
      if (room.gesture) gesture(c, room.gesture(s));
    }
  });
  return <group ref={group} />;
}
