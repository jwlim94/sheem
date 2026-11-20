import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  MathUtils,
  Plane,
  Points,
  Raycaster,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { createShapeTexture, SHAPE_WIDTH } from './shapes';
import { chapters, LAST } from './story';

const vertexShader = /* glsl */ `
uniform sampler2D uShapes;
uniform int uRows;
uniform float uFrom, uTo, uMix, uTime, uSize, uScatter;
uniform vec3 uPointer;
uniform float uPointerStrength;
attribute float aIndex;
attribute vec4 aRandom;
varying float vAlpha;
varying float vAccent;
vec3 target(float shape) {
  int i = int(aIndex);
  return texelFetch(uShapes, ivec2(i % ${SHAPE_WIDTH}, int(shape) * uRows + i / ${SHAPE_WIDTH}), 0).xyz;
}
void main() {
  float delay = aRandom.x * 0.45;
  float t = smoothstep(delay, delay + 0.55, uMix);
  vec3 p = mix(target(uFrom), target(uTo), t);
  float burst = sin(t * 3.14159);
  p += (aRandom.yzw - 0.5) * burst * uScatter;
  p += vec3(
    sin(uTime * 0.7 + aRandom.x * 40.0 + p.y),
    cos(uTime * 0.6 + aRandom.y * 40.0 + p.x),
    sin(uTime * 0.5 + aRandom.z * 40.0)
  ) * 0.035;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vec3 away = world.xyz - uPointer;
  float push = uPointerStrength * exp(-dot(away, away) * 0.45);
  world.xyz += normalize(away + 1e-4) * push * 1.1;
  vec4 view = viewMatrix * world;
  gl_Position = projectionMatrix * view;
  gl_PointSize = uSize * (0.55 + aRandom.w * 0.9) / -view.z;
  vAlpha = mix(0.28, 0.95, smoothstep(-24.0, -12.0, view.z)) * (1.0 - burst * 0.35);
  vAccent = step(0.84, aRandom.y);
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uAccent;
varying float vAlpha;
varying float vAccent;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.18, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(uInk, uAccent, vAccent), a);
  #include <colorspace_fragment>
}`;

export function StoryScene({
  progress,
  pointer,
  reduced,
}: {
  progress: RefObject<number>;
  pointer: RefObject<{ x: number; y: number; active: boolean }>;
  reduced: boolean;
}) {
  const { gl, size } = useThree();
  // Particle count is fixed per mount; phones get fewer points.
  const [count] = useState(() =>
    size.width < 760 ? SHAPE_WIDTH * 64 : SHAPE_WIDTH * 112
  );
  const { texture, rows } = useMemo(() => createShapeTexture(count), [count]);
  const geometry = useMemo(() => {
    const g = new BufferGeometry(),
      index = new Float32Array(count),
      random = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      index[i] = i;
      for (let k = 0; k < 4; k++) {
        const v = Math.sin((i * 4 + k) * 12.9898 + 78.233) * 43758.5453;
        random[i * 4 + k] = v - Math.floor(v);
      }
    }
    // Positions come from the texture; this attribute only sets the draw count.
    g.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(count * 3), 3)
    );
    g.setAttribute('aIndex', new BufferAttribute(index, 1));
    g.setAttribute('aRandom', new BufferAttribute(random, 4));
    return g;
  }, [count]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uShapes: { value: texture },
          uRows: { value: rows },
          uFrom: { value: 0 },
          uTo: { value: 0 },
          uMix: { value: 0 },
          uTime: { value: 0 },
          uSize: { value: 40 },
          uScatter: { value: 2.4 },
          uPointer: { value: new Vector3(99, 99, 99) },
          uPointerStrength: { value: 0 },
          uInk: { value: new Color('#14161c') },
          uAccent: { value: new Color(chapters[0].color) },
        },
      }),
    [texture, rows]
  );
  useEffect(
    () => () => {
      texture.dispose();
      geometry.dispose();
      material.dispose();
    },
    [texture, geometry, material]
  );
  const group = useRef<Points>(null),
    spin = useRef(0);
  const tools = useMemo(
    () => ({
      ray: new Raycaster(),
      ndc: new Vector2(),
      plane: new Plane(new Vector3(0, 0, 1), 0),
      hit: new Vector3(),
      next: new Color(),
    }),
    []
  );
  useFrame(({ camera, clock, size }, dt) => {
    const g = group.current;
    if (!g) return;
    const u = (g.material as ShaderMaterial).uniforms,
      p = Math.min(LAST, Math.max(0, progress.current)),
      from = Math.min(LAST, Math.floor(p)),
      to = Math.min(LAST, from + 1),
      f = p - from,
      morph = MathUtils.smoothstep(f, 0.48, 1),
      mix = reduced ? Math.round(morph) : morph,
      mobile = size.width < 760,
      step = Math.min(dt, 0.05);
    u.uFrom.value = from;
    u.uTo.value = to;
    u.uMix.value = mix;
    u.uScatter.value = reduced ? 0 : 2.4;
    u.uTime.value = reduced ? 0 : clock.elapsedTime;
    u.uSize.value = 40 * gl.getPixelRatio() * (mobile ? 0.85 : 1);
    u.uAccent.value
      .set(chapters[from].color)
      .lerp(tools.next.set(chapters[to].color), mix);

    if (!reduced) spin.current += step * 0.06;
    g.rotation.y = spin.current + p * 0.55 + pointer.current.x * 0.12;
    g.rotation.x =
      MathUtils.lerp(chapters[from].tilt, chapters[to].tilt, mix) -
      pointer.current.y * 0.06;
    g.position.set(mobile ? 0 : 3.3, mobile ? 2.3 : 0.25, 0);
    g.scale.setScalar(mobile ? 0.58 : 0.8);
    const strength = u.uPointerStrength;
    if (pointer.current.active && !reduced) {
      tools.ndc.set(pointer.current.x, pointer.current.y);
      tools.ray.setFromCamera(tools.ndc, camera);
      if (tools.ray.ray.intersectPlane(tools.plane, tools.hit))
        u.uPointer.value.copy(tools.hit);
      strength.value += (1 - strength.value) * (1 - Math.exp(-step * 6));
    } else strength.value *= Math.exp(-step * 6);
  });
  return (
    <points
      ref={group}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  );
}
