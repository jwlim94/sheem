import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import {
  AdditiveBlending,
  AlwaysStencilFunc,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  Group,
  LinearFilter,
  MathUtils,
  MirroredRepeatWrapping,
  PointsMaterial,
  RedFormat,
  ReplaceStencilOp,
  SRGBColorSpace,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import type { Texture } from 'three';
import { masked } from './windowMask';

// Window opening (three.js axes) from art/portfolio-room/build_room.py:
// centre x -0.9, y 2.55; 2.2 x 1.5 m; the wall's outer face is at z -2.8.
const WINDOW = new Vector3(-0.9, 2.55, -2.8);
const OPENING: [number, number] = [2.3, 1.6];

// The photo spans 0.5 x 0.333 rad, centred on the bearing of its main peak;
// the camera looks out at about -0.6 rad (start) to -0.3 (end). Each layer is a
// wider plane (1.3 x 0.62 rad) that mirrors the photo past its sides, so no
// view reaches an edge. LIFT keeps the ridge in the upper middle of the window.
const BEARING = -0.38;
const PHOTO: [number, number] = [0.5, 0.333];
const PLANE: [number, number] = [1.3, 0.62];
const LIFT = 0.032;

const LAYERS = '/models/portfolio-room/outside/';
const FILES = [
  `${LAYERS}sky.jpg`,
  `${LAYERS}mountains.webp`,
  `${LAYERS}trees.webp`,
];

/** Stencil: the portal marks the window's pixels; outside draws only there. */
const portal = {
  colorWrite: false,
  depthWrite: false,
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: AlwaysStencilFunc,
  stencilZPass: ReplaceStencilOp,
} as const;

const vertex = /* glsl */ `
uniform vec2 uScale;
varying vec2 vUv;
void main() {
  vUv = 0.5 + (uv - 0.5) * uScale;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// uNight 0..1 moves the photo from sunset toward dusk as the story scrolls;
// uWinter 0..1, the ending's winter night: the sunset gone, a deep blue
// overcast sky (it is snowing).
const skyFragment = /* glsl */ `
uniform sampler2D map;
uniform float uNight, uTime, uWinter;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(map, vUv).rgb;
  float top = smoothstep(0.45, 1.0, vUv.y);
  vec3 dusk = c * mix(vec3(0.62, 0.42, 0.48), vec3(0.16, 0.17, 0.34), top);
  c = mix(c, dusk, uNight);
  // The sun's glow just behind the peak, breathing slowly.
  vec2 d = (vUv - vec2(0.5, 0.52)) * vec2(1.5, 1.0);
  float glow = exp(-dot(d, d) * 55.0);
  c += vec3(1.0, 0.55, 0.22) * glow * (0.22 + 0.06 * sin(uTime * 0.7)) * (1.0 - 0.75 * uNight) * (1.0 - uWinter);
  // Winter: low cloud, faintly lit from the town below.
  float l = dot(texture2D(map, vUv).rgb, vec3(0.3, 0.5, 0.2));
  vec3 winter = mix(vec3(0.16, 0.15, 0.22), vec3(0.05, 0.06, 0.12), smoothstep(0.3, 1.0, vUv.y)) * (0.85 + 0.3 * l);
  c = mix(c, winter, uWinter);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

// Mountains and valley: darken and cool at dusk.
// Winter: snow on the peaks' upper slopes (the ending; the user's call,
// 2026-11-23: only near the tops, a light cover). How far below the ridge a
// point is, from the ridge's height along the photo (uRidge, read once off
// its alpha: searched for per pixel, the tree line on the ridge made the
// cover's edge flicker in dashes); its lower edge ragged, further down the
// gullies, and only on the high ridges.
const mountainFragment = /* glsl */ `
uniform sampler2D map, uRidge;
uniform vec2 uRidgeRange;
uniform float uNight, uTime, uWinter;
varying vec2 vUv;
float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float noise(float x) {
  float i = floor(x), f = fract(x);
  return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
}
void main() {
  vec4 t = texture2D(map, vUv);
  vec3 c = t.rgb * mix(vec3(1.0), vec3(0.75, 0.8, 1.0), uNight);
  c *= mix(vec3(1.0), vec3(0.55, 0.6, 0.78), uWinter);
  if (uWinter > 0.0) {
    float ridge = mix(uRidgeRange.x, uRidgeRange.y, texture2D(uRidge, vec2(vUv.x, 0.5)).r);
    float depth = max(0.0, ridge - vUv.y);
    float x = vUv.x;
    float reach = 0.02 + 0.026 * noise(x * 34.0) + 0.01 * noise(x * 140.0);
    float high = smoothstep(0.475, 0.515, ridge);
    // Gullies: the cover runs down further along some, less on the ribs.
    float gully = 0.6 * noise(x * 90.0 + 7.0) + 0.4 * noise(x * 210.0 + 3.0);
    reach *= 0.8 + 0.45 * gully;
    float snow = (1.0 - smoothstep(reach * 0.6, reach, depth)) * high;
    float lum = dot(t.rgb, vec3(0.3, 0.55, 0.15));
    vec3 white = vec3(0.52, 0.56, 0.68) * (0.8 + 0.4 * lum);
    c = mix(c, white, snow * (0.75 + 0.25 * gully) * uWinter);
  }
  gl_FragColor = vec4(c, t.a);
  #include <colorspace_fragment>
}`;

const treeFragment = /* glsl */ `
uniform sampler2D map;
uniform float uNight, uWinter;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(map, vUv);
  gl_FragColor = vec4(t.rgb * (1.0 - 0.4 * uNight) * (1.0 - 0.35 * uWinter), t.a);
  #include <colorspace_fragment>
}`;

// The valley's lights: round sprites with a soft halo, sized by distance,
// shimmering in the air (each its own slow beat; a few twinkle harder).
// Each comes on when uLit passes its rank (highway lamps first, then the
// streets, the houses last), so the town lights up as the evening goes on.
const lightVertex = /* glsl */ `
attribute float aSize, aBright, aSeed, aRank;
attribute vec3 aColor;
uniform float uTime, uPixelRatio, uLit;
varying vec3 vColor;
varying float vBright;
void main() {
  float on = smoothstep(aRank, aRank + 0.03, uLit);
  if (on < 0.002) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  float f1 = 1.1 + aSeed * 2.3, f2 = 0.31 + aSeed * 0.7;
  float shimmer = 0.86 + 0.14 * sin(uTime * f1 + aSeed * 61.0) * sin(uTime * f2 + aSeed * 17.0);
  // One in eight twinkles more (heat haze over the nearer roads).
  shimmer *= step(0.875, fract(aSeed * 7.31)) * 0.22 * sin(uTime * (3.1 + aSeed * 3.0) + aSeed * 9.0) + 1.0;
  vColor = aColor;
  vBright = aBright * shimmer * on;
  gl_PointSize = aSize * uPixelRatio * (0.94 + 0.06 * shimmer);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const lightFragment = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vBright;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float core = smoothstep(0.3, 0.0, d);
  float halo = exp(-d * d * 5.0) * 0.32;
  vec3 c = vColor * (core * 1.25 + halo) * vBright * uOpacity;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

// Cars on the valley's main roads: headlights one way, tail-lights the other,
// gliding from end to end (each its own phase and speed), fading in and out.
const carVertex = /* glsl */ `
attribute vec3 aTo;
attribute float aPhase, aSpeed, aSize;
attribute vec3 aColor;
uniform float uTime, uPixelRatio;
varying vec3 vColor;
varying float vBright;
void main() {
  float t = fract(aPhase + uTime * aSpeed);
  vec3 p = mix(position, aTo, t);
  vColor = aColor;
  vBright = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.9, t);
  gl_PointSize = aSize * uPixelRatio;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

/** Deterministic pseudo-random in [0, 1). */
function rand(n: number) {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** A photo layer `dist` metres out on BEARING, facing the window. */
function Layer({
  dist,
  material,
  order,
}: {
  dist: number;
  material: ShaderMaterial;
  order: number;
}) {
  const w = 2 * dist * Math.tan(PLANE[0] / 2),
    h = 2 * dist * Math.tan(PLANE[1] / 2);
  return (
    <mesh
      position={[
        Math.sin(BEARING) * dist,
        Math.tan(LIFT) * dist,
        -Math.cos(BEARING) * dist,
      ]}
      rotation={[0, -BEARING, 0]}
      renderOrder={order}
      material={material}
    >
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}

/**
 * The view out of the window: a real Utah sunset photo (Unsplash) split into
 * sky, mountains and tree-line layers at 600 / 300 / 60 m, so they shift
 * against each other as the camera moves. Valley lights sit between the
 * mountains and the trees; stars and lights come up as the sky darkens with
 * scroll. Only the window's pixels show it (stencil).
 */
export function Outside({
  progress,
  late,
}: {
  progress: RefObject<number>;
  /** The ending: later on, a winter night (the sunset's last glow gone). */
  late?: RefObject<boolean>;
}) {
  const group = useRef<Group>(null),
    dots = useRef<PointsMaterial | null>(null);
  const [sky, mountains, trees] = useTexture(FILES);
  // The mountains' ridge: its height (v) along the photo, a column at a
  // time from its alpha, smoothed a little; for the winter's snow on it.
  const ridge = useMemo(() => {
    const img = mountains.image as CanvasImageSource & {
        width: number;
        height: number;
      },
      W = 1024,
      H = Math.round((img.height / img.width) * W),
      lo = 0.35,
      hi = 0.65;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const v = new Float32Array(W).fill(0.5);
    if (ctx) {
      ctx.drawImage(img, 0, 0, W, H);
      const a = ctx.getImageData(0, 0, W, H).data;
      for (let x = 0; x < W; x++) {
        let y = 0;
        while (y < H && a[(y * W + x) * 4 + 3] < 128) y++;
        v[x] = 1 - (y + 0.5) / H;
      }
    }
    const data = new Uint8Array(W);
    for (let x = 0; x < W; x++) {
      let sum = 0;
      for (let k = -3; k <= 3; k++)
        sum += v[Math.min(W - 1, Math.max(0, x + k))];
      data[x] = Math.round(
        MathUtils.clamp((sum / 7 - lo) / (hi - lo), 0, 1) * 255
      );
    }
    const tex = new DataTexture(data, W, 1, RedFormat);
    tex.wrapS = MirroredRepeatWrapping;
    tex.magFilter = tex.minFilter = LinearFilter;
    tex.needsUpdate = true;
    return { tex, range: new Vector2(lo, hi) };
  }, [mountains]);
  useEffect(() => () => ridge.tex.dispose(), [ridge]);
  const materials = useMemo(() => {
    const make = (map: Texture, fragmentShader: string) => {
      map.colorSpace = SRGBColorSpace;
      map.anisotropy = 4;
      map.wrapS = MirroredRepeatWrapping;
      map.needsUpdate = true;
      return new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader,
        uniforms: {
          map: { value: map },
          uNight: { value: 0 },
          uWinter: { value: 0 },
          uTime: { value: 0 },
          uRidge: { value: ridge.tex },
          uRidgeRange: { value: ridge.range },
          uScale: {
            value: new Vector2(PLANE[0] / PHOTO[0], PLANE[1] / PHOTO[1]),
          },
        },
        ...masked,
      });
    };
    return {
      sky: make(sky, skyFragment),
      mountains: make(mountains, mountainFragment),
      trees: make(trees, treeFragment),
      stars: new PointsMaterial({
        color: '#fff6e0',
        size: 1.6,
        sizeAttenuation: false,
        opacity: 0,
        ...masked,
      }),
      lights: new ShaderMaterial({
        vertexShader: lightVertex,
        fragmentShader: lightFragment,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uOpacity: { value: 0.4 },
          uLit: { value: 0.4 },
        },
        ...masked,
        blending: AdditiveBlending,
      }),
      cars: new ShaderMaterial({
        vertexShader: carVertex,
        fragmentShader: lightFragment,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uOpacity: { value: 0.4 },
        },
        ...masked,
        blending: AdditiveBlending,
      }),
    };
  }, [sky, mountains, trees, ridge]);

  const points = useMemo(() => {
    const geo = (p: number[]) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
      return g;
    };
    // The valley floor, modelled as ground 66 m below the eye from 1.0 to
    // 1.83 km out (so it falls in the photo's hazy valley band, 0.066 to
    // 0.036 rad down), projected onto a shell 150 m out between the mountain
    // and tree layers. Neighbourhoods are street grids with lamps along the
    // streets and house lights between; two highways cross the valley with
    // brighter lamps and the cars; a few farm lights are scattered between.
    const DROP = 66,
      NEAR = 1000,
      FAR = 1830;
    const at = (x: number, d: number) => {
      const a = BEARING + x / d,
        e = -DROP / d;
      return [Math.sin(a) * 150, Math.tan(e) * 150, -Math.cos(a) * 150];
    };
    const inView = (x: number, d: number) =>
      d > NEAR && d < FAR && Math.abs(x / d) < PLANE[0] / 2;
    const tint = {
      sodium: new Color('#ffa24e'),
      amber: new Color('#ffc078'),
      warm: new Color('#ffe2b4'),
      led: new Color('#eef1ff'),
      window: new Color('#ffcc86'),
    };
    const pos: number[] = [],
      col: number[] = [],
      size: number[] = [],
      bright: number[] = [],
      seed: number[] = [],
      ranks: number[] = [];
    let n = 0;
    // `rank` 0..1: when it comes on as the evening goes (lower is earlier).
    const add = (
      x: number,
      d: number,
      c: Color,
      px: number,
      b: number,
      rank: number
    ) => {
      if (!inView(x, d)) return;
      const far = (d - NEAR) / (FAR - NEAR); // farther: smaller, hazier
      pos.push(...at(x, d));
      col.push(c.r, c.g, c.b);
      size.push(px * (1.15 - 0.45 * far));
      bright.push(b * (1 - 0.5 * far));
      seed.push(rand(n++ + 4000));
      ranks.push(rank);
    };
    const streetTint = (k: number) => {
      const r = rand(k);
      return r < 0.55 ? tint.sodium : r < 0.8 ? tint.amber : tint.led;
    };
    // Neighbourhoods: centre (x, d) and half extent (x, d), in metres.
    const towns: [number, number, number, number][] = [
      [-420, 1180, 260, 120],
      [-60, 1300, 330, 160],
      [330, 1150, 220, 110],
      [650, 1420, 300, 170],
      [-700, 1520, 280, 150],
      [120, 1650, 420, 120],
      [-300, 1730, 300, 80],
    ];
    towns.forEach(([cx, cd, hx, hd], t) => {
      // Cross streets (running across the view), lamps every 28 m...
      for (let d = cd - hd; d <= cd + hd; d += 42)
        for (let x = cx - hx; x <= cx + hx; x += 28) {
          const k = t * 10000 + Math.round(d * 7 + x);
          if (rand(k) < 0.82)
            add(
              x + (rand(k + 1) - 0.5) * 8,
              d,
              streetTint(k + 2),
              6,
              0.9,
              0.08 + rand(k + 5) * 0.62
            );
        }
      // ...and streets running away from the window.
      for (let x = cx - hx; x <= cx + hx; x += 85)
        for (let d = cd - hd; d <= cd + hd; d += 26) {
          const k = t * 20000 + Math.round(x * 3 + d);
          if (rand(k) < 0.75)
            add(
              x,
              d + (rand(k + 1) - 0.5) * 6,
              streetTint(k + 2),
              5.5,
              0.8,
              0.08 + rand(k + 5) * 0.62
            );
        }
      // House and window lights between the streets: dimmer, warmer.
      const homes = Math.round((hx * hd) / 260);
      for (let i = 0; i < homes; i++) {
        const k = t * 30000 + i;
        add(
          cx + (rand(k) * 2 - 1) * hx,
          cd + (rand(k + 1) * 2 - 1) * hd,
          rand(k + 2) < 0.8 ? tint.window : tint.warm,
          3.5 + rand(k + 3) * 1.5,
          0.35 + rand(k + 4) * 0.35,
          0.25 + rand(k + 5) * 0.75
        );
      }
    });
    // Highways straight across the valley, lamps every 38 m.
    const roads: [number, number, number, number][] = [
      [-1500, 1080, 1400, 1260],
      [-900, 1820, 1100, 1040],
    ];
    roads.forEach(([x0, d0, x1, d1], r) => {
      const len = Math.hypot(x1 - x0, d1 - d0);
      for (let s = 0; s < len; s += 38) {
        const f = s / len,
          x = x0 + (x1 - x0) * f,
          d = d0 + (d1 - d0) * f;
        add(x, d, tint.sodium, 7.5, 1.1, rand(r * 77 + s) * 0.22);
        if (rand(r * 999 + s) < 0.3)
          add(x + 14, d + 6, tint.amber, 5, 0.6, 0.2 + rand(r * 55 + s) * 0.5);
      }
    });
    // Scattered farm and porch lights.
    for (let i = 0; i < 160; i++) {
      const d = NEAR + rand(i + 7000) * (FAR - NEAR);
      add(
        (rand(i + 7300) * 2 - 1) * d * 0.65,
        d,
        rand(i + 7600) < 0.6 ? tint.warm : tint.sodium,
        4.5,
        0.55,
        0.3 + rand(i + 7900) * 0.7
      );
    }
    // Cars on the highways: headlights toward one end, tail-lights toward
    // the other, each in its lane.
    const carFrom: number[] = [],
      carTo: number[] = [],
      carCol: number[] = [],
      carPhase: number[] = [],
      carSpeed: number[] = [],
      carSize: number[] = [];
    const head = new Color('#fff3d8'),
      tail = new Color('#ff3a24');
    roads.forEach(([x0, d0, x1, d1], r) => {
      for (let i = 0; i < 14; i++) {
        const k = r * 100 + i,
          way = i % 2 ? 1 : -1,
          lane = way * 7;
        const a = at(x0, d0 + lane),
          b = at(x1, d1 + lane);
        carFrom.push(...(way > 0 ? a : b));
        carTo.push(...(way > 0 ? b : a));
        const c = way > 0 ? head : tail;
        carCol.push(c.r, c.g, c.b);
        carPhase.push(rand(k + 8000));
        carSpeed.push(1 / (55 + rand(k + 8100) * 35));
        carSize.push(way > 0 ? 5 : 4);
      }
    });
    // Stars high in the upper sky, in front of the sky layer.
    const stars: number[] = [];
    for (let i = 0; i < 200; i++) {
      const a = BEARING + (rand(i + 1300) - 0.5) * PLANE[0],
        e = 0.085 + rand(i + 1700) * 0.2;
      stars.push(Math.sin(a) * 500, Math.tan(e) * 500, -Math.cos(a) * 500);
    }
    const f32 = (v: number[], k: number) =>
      new BufferAttribute(new Float32Array(v), k);
    const lights = geo(pos);
    lights.setAttribute('aColor', f32(col, 3));
    lights.setAttribute('aSize', f32(size, 1));
    lights.setAttribute('aBright', f32(bright, 1));
    lights.setAttribute('aSeed', f32(seed, 1));
    lights.setAttribute('aRank', f32(ranks, 1));
    const cars = geo(carFrom);
    cars.setAttribute('aTo', f32(carTo, 3));
    cars.setAttribute('aColor', f32(carCol, 3));
    cars.setAttribute('aPhase', f32(carPhase, 1));
    cars.setAttribute('aSpeed', f32(carSpeed, 1));
    cars.setAttribute('aSize', f32(carSize, 1));
    return { lights, cars, stars: geo(stars) };
  }, []);

  useEffect(() => {
    dots.current = materials.stars;
  }, [materials]);
  useEffect(
    () => () => {
      Object.values(materials).forEach((m) => m.dispose());
      Object.values(points).forEach((g) => g.dispose());
    },
    [materials, points]
  );

  const tmp = useMemo(() => ({ dir: new Vector3(), axis: new Vector3() }), []);
  useFrame(({ camera, clock, gl }) => {
    const g = group.current;
    if (!g) return;
    // Keep the horizon in frame whatever the camera height: tilt about the
    // horizontal axis across the line of sight so it stays level.
    const { dir, axis } = tmp;
    dir.copy(WINDOW).sub(camera.position).normalize();
    axis.set(-dir.z, 0, dir.x).normalize();
    g.quaternion.setFromAxisAngle(
      axis,
      MathUtils.lerp(0, Math.asin(dir.y) - 0.045, 0.85)
    );
    const night = late?.current
      ? 1
      : 0.12 + 0.6 * MathUtils.smoothstep(progress.current, 0, 1);
    for (const m of [materials.sky, materials.mountains, materials.trees]) {
      m.uniforms.uNight.value = night;
      m.uniforms.uWinter.value = late?.current ? 1 : 0;
      m.uniforms.uTime.value = clock.elapsedTime;
    }
    const stars = dots.current;
    if (stars) stars.opacity = 0.7 * MathUtils.smoothstep(night, 0.3, 0.7);
    for (const m of [materials.lights, materials.cars]) {
      m.uniforms.uTime.value = clock.elapsedTime;
      m.uniforms.uPixelRatio.value = gl.getPixelRatio();
      m.uniforms.uOpacity.value =
        0.35 + 0.65 * MathUtils.smoothstep(night, 0.15, 0.6);
    }
    // About 40 % of the town is lit at sunset; the rest comes on, light by
    // light, as the story scrolls on into the night.
    materials.lights.uniforms.uLit.value =
      0.4 + 0.6 * MathUtils.smoothstep(progress.current, 0.06, 0.9);
  });

  return (
    <>
      <mesh position={WINDOW} renderOrder={1}>
        <planeGeometry args={OPENING} />
        <meshBasicMaterial {...portal} />
      </mesh>
      <group ref={group} position={WINDOW}>
        <Layer dist={600} material={materials.sky} order={2} />
        <points
          geometry={points.stars}
          material={materials.stars}
          renderOrder={3}
        />
        <Layer dist={300} material={materials.mountains} order={4} />
        <points
          geometry={points.lights}
          material={materials.lights}
          renderOrder={5}
        />
        <points
          geometry={points.cars}
          material={materials.cars}
          renderOrder={5}
          frustumCulled={false}
        />
        <Layer dist={60} material={materials.trees} order={6} />
      </group>
    </>
  );
}

useTexture.preload(FILES);
