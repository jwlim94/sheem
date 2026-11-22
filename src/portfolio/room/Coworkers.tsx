import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, LessEqualDepth, Mesh, ShaderMaterial, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { chairZ, PLACES } from './bridge';
import { chain, sculpt, seatedBody, v } from './figures';
import type { Ball, Box } from './figures';
import { shown } from './shown';

/**
 * The people at Bridge's desks (chapter 4): translucent figures like
 * Neighbor's interviewers (Interviewers.tsx) and the classmates, memories
 * round the one clear figure, at their places (bridge.ts), facing their
 * walls: the developer and the COO at the north glass, typing; the CEO at
 * the south wall beside him, sitting back, reading his screen. They
 * breathe; the typists' hands tap, each on its own beat. A cool slate with
 * a white rim, for the bright room.
 */
const SEAT_H = 0.56,
  LIFT = SEAT_H - 0.37; // the classmates sit on a 0.37 m cushion
const BOX: Box = { min: v(-0.62, -0.06 - LIFT, -0.62), span: 2.1, res: 84 };

/** Shins long enough for the office chairs' seats, and the feet. */
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

/** At the keyboard, leaning in a little, hands on its keys (0.8 ahead, at
 *  the desk's top less LIFT). */
function typingFigure(): BufferGeometry {
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
  return sculpt([...seatedBody(lean, 0.25), ...shins(), ...arms], BOX);
}

/** Sitting back, forearms on the chair's arms, reading. */
function readingFigure(): BufferGeometry {
  const lean = 0.06,
    sx = -0.17 - lean,
    arms: Ball[] = [];
  for (const s of [-1, 1]) {
    const sh = v(sx, 1.05, 0.25 * s),
      elbow = v(sx + 0.02, 0.74, 0.32 * s),
      hand = v(0.3, 0.7, 0.3 * s);
    arms.push(
      ...chain(sh, elbow, 0.068, 0.058),
      ...chain(elbow, hand, 0.056, 0.05),
      [hand.x, hand.y, hand.z, 0.055]
    );
  }
  return sculpt([...seatedBody(lean, 0.1), ...shins(), ...arms], BOX);
}

const vertex = /* glsl */ `
uniform float uTime, uPhase, uTyping;
varying vec3 vN, vV;
varying float vFade;
void main() {
  vec3 p = position;
  // Breathing: the upper body rises a hair.
  float above = smoothstep(0.62, 0.92, p.y);
  p.y += above * 0.007 * sin(uTime * 1.25 + uPhase * 6.283);
  // Typing: the hands (out past the elbows) tap, each on its own beat, in
  // bursts.
  float hands = smoothstep(0.55, 0.75, p.x) * uTyping;
  float side = p.z > 0.0 ? 1.0 : 0.0;
  float burst = smoothstep(0.2, 0.6, sin(uTime * 0.7 + uPhase * 9.0));
  p.y += hands * burst * 0.006 * max(0.0, sin(uTime * (17.0 + 5.0 * side) + side * 1.7 + uPhase * 3.0));
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  float d = distance(cameraPosition, wp.xyz);
  // Faint right at the lens, clearer away.
  vFade = smoothstep(0.9, 2.8, d);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const fragment = /* glsl */ `
uniform vec3 uColor, uRim;
varying vec3 vN, vV;
varying float vFade;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
  gl_FragColor = vec4(mix(uColor, uRim, f), vFade * (0.28 + 0.66 * f));
}`;

const WHO = [
  { who: 'developer', geo: typingFigure, typing: 1, phase: 0.2 },
  { who: 'coo', geo: typingFigure, typing: 1, phase: 0.55 },
  { who: 'ceo', geo: readingFigure, typing: 0, phase: 0.8 },
] as const;

/** Per frame: their clock (breathing, typing). */
function tick(list: { uniforms: { uTime: { value: number } } }[], t: number) {
  for (const p of list) p.uniforms.uTime.value = t;
}

export function Coworkers({ reduced }: { reduced: boolean }) {
  const group = useRef<Group>(null),
    live = useRef<{ uniforms: { uTime: { value: number } } }[] | null>(null);
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    const list = WHO.map((w) => {
      const place = PLACES.find((p) => p.who === w.who)!,
        geometry = w.geo(),
        uniforms = {
          uTime: { value: 0 },
          uPhase: { value: w.phase },
          uTyping: { value: w.typing },
          uColor: { value: new Vector3(0.28, 0.34, 0.46) },
          uRim: { value: new Vector3(1, 1, 1) },
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
      const meshes = [depth, colour].map((m, i) => {
        const mesh = new Mesh(geometry, m);
        mesh.position.set(place.x, LIFT, chairZ(place));
        // The figures face +x; turned to face their desks.
        mesh.rotation.y = place.face > 0 ? -Math.PI / 2 : Math.PI / 2;
        mesh.renderOrder = 3 + i;
        return mesh;
      });
      g.add(...meshes);
      return { meshes, uniforms };
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
  useFrame(({ clock }) => {
    if (!live.current || !shown(group.current)) return;
    tick(live.current, reduced ? 0 : clock.elapsedTime);
  });
  // (Named: left out of the office as his window shows it, RoomScene.)
  return <group ref={group} name="coworkers" />;
}
