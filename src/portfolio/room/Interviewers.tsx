import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { shown } from './shown';
import {
  Group,
  LessEqualDepth,
  MathUtils,
  Mesh,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { BufferGeometry } from 'three';
import { chain, HEAD, NECK, sculpt, seatedBody, v } from './figures';
import type { Ball, Box } from './figures';
import { CHAIRS, SEAT_H } from './office';

/**
 * The two engineers who interviewed him (chapter 2): translucent figures like
 * the hall's classmates (memories around the one clear figure), seated
 * behind the folding table, on its far side from the whiteboard, watching
 * him across it. One works at his laptop on the table; the other sits back
 * with arms crossed. Both keep their eyes on
 * him: their heads follow him (a little late), and now and then nod as he
 * explains. Lit for the bright room: a cool slate tint with a white rim.
 * Local to the office.
 */
const LIFT = SEAT_H - 0.37; // the classmates sit on a 0.37 m cushion
// Their field reaches lower, for the longer shins.
const BOX: Box = { min: v(-0.62, -0.06 - LIFT, -0.62), span: 2.1, res: 84 };

/** Shins long enough for the office chairs' taller seats: from the knees
 *  down to the floor (LIFT below the classmates'), and the feet. */
function shins(): Ball[] {
  return [-1, 1].flatMap((s) => [
    ...chain(
      v(0.43, 0.11, 0.14 * s),
      v(0.47, 0.05 - LIFT, 0.14 * s),
      0.065,
      0.058
    ),
    ...chain(
      v(0.46, 0.04 - LIFT, 0.14 * s),
      v(0.58, 0.04 - LIFT, 0.14 * s),
      0.055
    ),
  ]);
}
/** One engineer: at his laptop on the table, leaning in, his hands on its
 *  keys (the table top, less LIFT). */
function laptopFigure(): BufferGeometry {
  const lean = -0.05,
    sx = -0.17 - lean,
    arms: Ball[] = [];
  for (const s of [-1, 1]) {
    const sh = v(sx, 1.05, 0.25 * s),
      elbow = v(0.3, 0.84, 0.3 * s),
      hand = v(0.8, 0.86, 0.12 * s);
    arms.push(
      ...chain(sh, elbow, 0.068, 0.058),
      ...chain(elbow, hand, 0.056, 0.05),
      [hand.x, hand.y, hand.z, 0.055]
    );
  }
  return sculpt([...seatedBody(lean, 0.1), ...shins(), ...arms], BOX);
}

/** The other: sitting back, arms crossed. */
function crossedFigure(): BufferGeometry {
  const lean = 0.05,
    sx = -0.17 - lean,
    arms: Ball[] = [];
  for (const s of [-1, 1]) {
    const sh = v(sx, 1.05, 0.25 * s),
      elbow = v(sx + 0.12, 0.86, 0.27 * s),
      hand = v(0.05, 0.93, -0.15 * s);
    arms.push(
      ...chain(sh, elbow, 0.068, 0.058),
      ...chain(elbow, hand, 0.056, 0.05),
      [hand.x, hand.y, hand.z, 0.055]
    );
  }
  return sculpt([...seatedBody(lean, 0), ...shins(), ...arms], BOX);
}

const vertex = /* glsl */ `
uniform float uTime, uYaw, uNod, uPhase, uHeadX;
varying vec3 vN, vV;
varying float vFade;
void main() {
  vec3 p = position;
  vec3 n = normal;
  // Breathing: the upper body rises a hair.
  float above = smoothstep(0.62, 0.92, p.y);
  p.y += above * 0.007 * sin(uTime * 1.25 + uPhase * 6.283);
  // The head turns toward him and nods (about the neck).
  float head = smoothstep(${(NECK - 0.04).toFixed(2)}, ${(NECK + 0.06).toFixed(2)}, p.y);
  float a = uYaw * head;
  vec2 c = vec2(uHeadX, 0.0);
  mat2 r = mat2(cos(a), sin(a), -sin(a), cos(a));
  p.xz = c + r * (p.xz - c);
  n.xz = r * n.xz;
  float b = uNod * head;
  vec2 pivot = vec2(uHeadX - 0.02, ${NECK.toFixed(2)});
  mat2 nr = mat2(cos(b), -sin(b), sin(b), cos(b));
  p.xy = pivot + nr * (p.xy - pivot);
  n.xy = nr * n.xy;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix) * n);
  vV = normalize(cameraPosition - wp.xyz);
  float d = distance(cameraPosition, wp.xyz);
  // Faint right at the lens (their backs in the foreground), clearer away.
  vFade = smoothstep(0.9, 2.8, d);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const fragment = /* glsl */ `
uniform vec3 uColor, uRim;
uniform float uAlpha;
varying vec3 vN, vV;
varying float vFade;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
  gl_FragColor = vec4(mix(uColor, uRim, f), uAlpha * vFade * (0.28 + 0.66 * f));
}`;

const PEOPLE = [
  { geo: laptopFigure, lean: -0.05, drop: 0.1, chair: CHAIRS[0], phase: 0.2 },
  { geo: crossedFigure, lean: 0.05, drop: 0, chair: CHAIRS[1], phase: 0.7 },
];

type Person = {
  meshes: Mesh[];
  uniforms: Record<string, { value: number | Vector3 | unknown }>;
  pos: Vector3;
  yaw: number;
  look: number;
};

export function Interviewers({
  hero,
  nod,
  reduced,
}: {
  /** Where his head is (office-local), for their eyes. */
  hero: RefObject<Vector3>;
  /** 0..1: while he explains, they nod now and then. */
  nod: RefObject<number>;
  reduced: boolean;
}) {
  const group = useRef<Group>(null),
    live = useRef<Person[] | null>(null);
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    const list = PEOPLE.map((person) => {
      const geometry = person.geo(),
        uniforms = {
          uTime: { value: 0 },
          uYaw: { value: 0 },
          uNod: { value: 0 },
          uPhase: { value: person.phase },
          uHeadX: { value: HEAD[0] - person.lean + 0.05 * person.drop },
          uColor: { value: new Vector3(0.28, 0.34, 0.46) },
          uRim: { value: new Vector3(1, 1, 1) },
          uAlpha: { value: 1 },
        };
      // Depth first, then colour on equal depth: only the outer surface shows.
      const depth = new ShaderMaterial({
          vertexShader: vertex,
          fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }',
          uniforms,
          transparent: true,
          colorWrite: false,
        }),
        colour = new ShaderMaterial({
          vertexShader: vertex,
          fragmentShader: fragment,
          uniforms,
          transparent: true,
          depthWrite: false,
          depthFunc: LessEqualDepth,
        });
      const { x, z, yaw } = person.chair,
        meshes = [depth, colour].map((m, i) => {
          const mesh = new Mesh(geometry, m);
          mesh.position.set(x, LIFT, z);
          // The figures face +x; the chair's yaw turns them to the board.
          mesh.rotation.y = yaw;
          mesh.renderOrder = 3 + i;
          return mesh;
        });
      g.add(...meshes);
      return { meshes, uniforms, pos: new Vector3(x, 0, z), yaw, look: 0 };
    });
    live.current = list;
    return () => {
      for (const p of list) {
        g.remove(...p.meshes);
        p.meshes[0].geometry.dispose();
        for (const m of p.meshes) (m.material as ShaderMaterial).dispose();
      }
      live.current = null;
    };
  }, []);
  const tmp = useRef(new Vector3());
  useFrame(({ clock }, dt) => {
    const list = live.current,
      at = hero.current;
    if (!list || !at || !shown(group.current)) return;
    const t = reduced ? 0 : clock.elapsedTime,
      step = Math.min(dt, 0.05);
    list.forEach((p, i) => {
      // His direction in the figure's own frame (it faces +x before its yaw).
      const d = tmp.current.copy(at).sub(p.pos);
      d.applyAxisAngle(new Vector3(0, 1, 0), -p.yaw);
      const want = MathUtils.clamp(Math.atan2(-d.z, d.x), -0.9, 0.9);
      p.look += (want - p.look) * (1 - Math.exp(-step * (2.2 - i * 0.6)));
      p.uniforms.uYaw.value = p.look;
      p.uniforms.uTime.value = t;
      // A nod every few seconds while he explains: down, and back.
      const k = nod.current ?? 0,
        beat = Math.max(0, Math.sin(t * (1.1 + i * 0.35) + i * 2.0)) ** 6;
      p.uniforms.uNod.value = -0.16 * k * beat;
    });
  });
  return <group ref={group} />;
}
