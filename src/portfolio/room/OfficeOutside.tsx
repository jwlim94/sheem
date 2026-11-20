import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { shown } from './shown';
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  Points,
  Quaternion,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import { GROUND_Y, OFFICE_SUN_FROM, ROOM } from './office';
import { daylight, landTint, moonAt, sunAt, twilight } from './daySky';
import { deskBeats, gradBeats } from './story';

/**
 * The view from Neighbor's meeting room (chapter 2), after the user's memory
 * and a photo of it: a typical Utah view from high up (about eight floors),
 * looking down. Below, the wide corn fields by Thanksgiving Point, a corn
 * maze's curving paths cut into them, the crop rippling as gusts roll across;
 * beyond, a cluster of modern office buildings, houses and trees; then the
 * mountains, tan foothills on the left and the blue-grey Wasatch peaks, under
 * a clear sky with big fair-weather clouds. No road or traffic in view.
 * Local to the office, the window at z = -ROOM.hz looking toward -z. All
 * inside the camera's 900 m: the mountains are scaled in, their size in the
 * frame kept.
 */
const GY = GROUND_Y;
const SUN = new Vector3(...OFFICE_SUN_FROM).normalize();
const HAZE = new Color('#c7d6e6');

/** Deterministic pseudo-random in [0, 1). */
function rand(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
/** Smooth 1D value noise, and its fractal sum. */
function noise1(x: number, seed: number) {
  const i = Math.floor(x),
    f = x - i,
    u = f * f * (3 - 2 * f);
  return rand(i + seed * 1000) * (1 - u) + rand(i + 1 + seed * 1000) * u;
}
function fbm1(x: number, seed: number) {
  let s = 0,
    a = 0.5,
    f = 1;
  for (let o = 0; o < 5; o++) {
    s += a * noise1(x * f, seed + o);
    a *= 0.5;
    f *= 2.1;
  }
  return s;
}
/** Smooth 2D value noise, and its fractal sum. */
function noise2(x: number, y: number, seed: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy,
    ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy),
    h = (i: number, j: number) => rand(i * 57.3 + j * 311.7 + seed * 101.9);
  return (
    (h(ix, iy) * (1 - ux) + h(ix + 1, iy) * ux) * (1 - uy) +
    (h(ix, iy + 1) * (1 - ux) + h(ix + 1, iy + 1) * ux) * uy
  );
}
function fbm2(x: number, y: number, seed: number) {
  let s = 0,
    a = 0.5,
    f = 1;
  for (let o = 0; o < 5; o++) {
    s += a * noise2(x * f, y * f, seed + o);
    a *= 0.5;
    f *= 2.03;
  }
  return s;
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function canvas(w: number, h: number) {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return { el, ctx };
}

// ------------------------------------------------------------------ sky

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
// The sky through a day (daySky.ts): the afternoon's blue; at sunset the
// sun's side glowing low and orange, the far side's earth shadow under the
// pink belt of Venus; the night's navy with the Milky Way's dusty band and
// twinkling stars, more of them in the band; the moon, its seas and its
// halo; the sun's disc and bloom. (Unlit, display colours, as before.)
const skyFragment = /* glsl */ `
uniform vec3 uSun, uMoon;
uniform float uDay, uTwi, uTime;
varying vec3 vDir;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
        mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
        mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
  return s;
}
void main() {
  vec3 v = normalize(vDir);
  float h = v.y, hp = max(h, 0.0), night = 1.0 - uDay;
  vec3 dayC = mix(vec3(0.80, 0.88, 0.95), vec3(0.2, 0.47, 0.86), pow(hp, 0.5));
  vec3 nightC = mix(vec3(0.05, 0.065, 0.13), vec3(0.008, 0.012, 0.035), pow(hp, 0.4));
  vec3 c = mix(nightC, dayC, uDay);
  // Twilight: toward the sun, low and warm; away from it, the earth's
  // shadow and the belt of Venus above it; a violet sky overhead.
  vec3 sunH = normalize(vec3(uSun.x, 0.0, uSun.z) + 1e-5);
  float toward = dot(normalize(vec3(v.x, 0.0, v.z) + 1e-5), sunH) * 0.5 + 0.5,
    away = 1.0 - toward,
    low = exp(-hp * 5.0);
  vec3 glowC = mix(vec3(1.0, 0.42, 0.18), vec3(1.0, 0.8, 0.45), smoothstep(0.0, 0.25, hp));
  c = mix(c, glowC, uTwi * low * pow(toward, 2.0) * 0.95);
  float belt = smoothstep(0.015, 0.07, h) * (1.0 - smoothstep(0.12, 0.3, h)),
    shade = 1.0 - smoothstep(0.0, 0.05, h);
  c = mix(c, vec3(0.95, 0.62, 0.7), uTwi * belt * pow(away, 1.4) * 0.85);
  c = mix(c, vec3(0.3, 0.36, 0.58), uTwi * shade * pow(away, 1.4) * 0.7);
  c = mix(c, vec3(0.3, 0.3, 0.56), uTwi * smoothstep(0.2, 0.7, hp) * 0.35);
  // The Milky Way.
  vec3 gal = normalize(vec3(0.42, 0.22, 0.88));
  float band = exp(-pow(dot(v, gal) / 0.2, 2.0)),
    dust = fbm(v * 6.0),
    lanes = smoothstep(0.45, 0.75, fbm(v * 14.0 + 3.0)),
    dark = night * night * smoothstep(0.0, 0.25, h);
  c += vec3(0.55, 0.6, 0.8) * band * (0.15 + 0.4 * dust) * (1.0 - 0.6 * lanes) * dark * 0.65;
  // Stars.
  vec3 sp = v * 220.0, cell = floor(sp);
  float r = hash(cell);
  if (r < 0.035 + 0.07 * band) {
    vec3 star = cell + 0.5 + (vec3(hash(cell + 1.3), hash(cell + 2.7), hash(cell + 4.1)) - 0.5) * 0.7;
    float mag = pow(hash(cell + 7.7), 6.0),
      tw = 0.7 + 0.3 * sin(uTime * (1.5 + 3.0 * hash(cell + 9.1)) + r * 40.0),
      s = smoothstep(0.45, 0.0, length(sp - star)) * (0.25 + 1.7 * mag) * tw;
    vec3 sc = mix(vec3(0.8, 0.86, 1.0), vec3(1.0, 0.88, 0.72), hash(cell + 5.5));
    c += sc * s * night * night * smoothstep(0.0, 0.12, h);
  }
  // The moon.
  float md = dot(v, uMoon),
    mvis = smoothstep(-0.02, 0.04, uMoon.y) * (0.2 + 0.8 * night);
  c += vec3(0.75, 0.8, 0.95) * pow(max(md, 0.0), 160.0) * 0.22 * mvis;
  c += vec3(0.55, 0.62, 0.82) * pow(max(md, 0.0), 14.0) * 0.07 * mvis * night;
  if (md > 0.9997) {
    float seas = smoothstep(0.48, 0.66, fbm(v * 320.0 + 7.0));
    vec3 mc = vec3(0.97, 0.95, 0.9) * (0.9 + 0.2 * fbm(v * 900.0) - 0.3 * seas);
    c = mix(c, mc * (0.55 + 0.65 * night), smoothstep(0.9997, 0.99982, md) * mvis);
  }
  // The sun.
  float sd = dot(v, uSun), svis = smoothstep(-0.05, 0.02, uSun.y);
  vec3 sunC = mix(vec3(1.0, 0.55, 0.25), vec3(1.0, 0.95, 0.85), smoothstep(0.0, 0.3, uSun.y));
  c += sunC * (0.1 * pow(max(sd, 0.0), 14.0) + 0.45 * pow(max(sd, 0.0), 500.0)) * svis;
  c = mix(c, sunC * 1.5, smoothstep(0.99972, 0.99982, sd) * svis);
  gl_FragColor = vec4(c, 1.0);
}`;

// ------------------------------------------------------------- mountains

type Palette = { low: string; high: string };

/**
 * One range: a continuous crest running across the view (its height wanders
 * with low, slow noise, sharper where the noise ridges: summits and saddles,
 * never lone spikes), falling away on both sides at a natural slope, cut by
 * spurs and gullies. Shaded by the sun, scrub low and rock high, hazed by its
 * distance (baked into vertex colours, unlit). `env` fades it toward its
 * ends; `rough` scales its peaks and gullies (low for grassy foothills).
 */
function ridge(
  z0: number,
  depth: number,
  peak: number,
  seed: number,
  haze: number,
  palette: Palette,
  env: (x: number) => number = () => 1,
  rough = 1,
  sun = SUN
) {
  const nx = 420,
    nz = 64,
    x0 = -900,
    x1 = 900;
  // The crest: ridged noise over a few octaves (big massifs, a handful of
  // summits of different heights, shoulders and saddles between; a single
  // short wavelength made an even sawtooth).
  const crest = (x: number) => {
      let r = 0,
        amp = 0.6,
        f = 1 / 420;
      for (let o = 0; o < 4; o++) {
        const n = 1 - Math.abs(noise1(x * f + seed * 7.3, seed + o) * 2 - 1);
        r += amp * n * n;
        amp *= 0.45;
        f *= 2.3;
      }
      const massif = 0.55 + 0.45 * fbm1(x / 520 + seed, seed + 2);
      return (
        peak *
        env(x) *
        massif *
        (1 - 0.6 * rough + 0.6 * rough * Math.min(1, r * 1.35))
      );
    },
    middle = (x: number) => 0.45 + 0.12 * (fbm1(x / 200, seed + 8) - 0.5);
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const k = (j * (nx + 1) + i) * 3,
        x = x0 + ((x1 - x0) * i) / nx,
        d = j / nz,
        m = middle(x),
        // 0 on the crest line, 1 at the range's front and back edges.
        t = d < m ? (m - d) / m : (d - m) / (1 - m),
        shape = Math.pow(Math.max(0, 1 - t), 1.25),
        top = crest(x),
        gully = 1 - Math.abs(fbm2(x / 17, d * 6, seed + 3) * 2 - 1), // spurs
        fine = fbm2(x / 8, d * 14, seed + 9);
      pos[k] = x;
      pos[k + 1] =
        GY -
        3 +
        top * shape -
        rough * top * 0.2 * shape * (1 - gully) +
        top * 0.025 * fine;
      pos[k + 2] = z0 - d * depth;
    }
  const idx: number[] = [];
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i,
        b = a + 1,
        c = a + nx + 1,
        d = c + 1;
      idx.push(a, b, c, b, d, c); // facing up and toward the window
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.getAttribute('normal'),
    col = new Float32Array(pos.length),
    low = new Color(palette.low),
    high = new Color(palette.high),
    shade = new Color(),
    c = new Color();
  for (let v = 0; v < pos.length / 3; v++) {
    const up = (pos[v * 3 + 1] - GY) / (peak + 1),
      light = Math.max(
        0,
        n.getX(v) * sun.x + n.getY(v) * sun.y + n.getZ(v) * sun.z
      ),
      steep = 1 - n.getY(v);
    c.copy(low).lerp(
      high,
      Math.min(1, Math.max(0, up * 1.1 - 0.35 + steep * 0.6))
    );
    shade.copy(c).multiplyScalar(0.28 + 1.0 * light);
    shade.lerp(HAZE, haze);
    col[v * 3] = shade.r;
    col[v * 3 + 1] = shade.g;
    col[v * 3 + 2] = shade.b;
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

// ----------------------------------------------------------- the town

/** Suburbs from above: blocks of roofs, lawns and trees, streets between. */
function townTexture() {
  const { el, ctx } = canvas(1024, 1024),
    roofs = ['#c9bda6', '#b5a58c', '#d6cfc0', '#9d8f7c', '#e2dccd'];
  ctx.fillStyle = '#8e9a6a';
  ctx.fillRect(0, 0, 1024, 1024);
  let n = 0;
  for (let by = 0; by < 1024; by += 128)
    for (let bx = 0; bx < 1024; bx += 128) {
      ctx.fillStyle = '#a7a59a';
      ctx.fillRect(bx, by, 128, 6);
      ctx.fillRect(bx, by, 6, 128);
      for (let k = 0; k < 14; k++) {
        const x = bx + 10 + rand(n++) * 104,
          y = by + 10 + rand(n++) * 104;
        ctx.fillStyle = roofs[Math.floor(rand(n++) * roofs.length)];
        ctx.fillRect(x, y, 10 + rand(n++) * 10, 8 + rand(n++) * 8);
        ctx.fillStyle = rand(n++) < 0.5 ? '#5c7444' : '#6c8550';
        ctx.beginPath();
        ctx.arc(x - 4, y + 12, 4 + rand(n++) * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// The distance is taken per pixel: the plane is one big quad, and taken at
// its far corners it hazed the whole town (it read as water beyond the
// field; 2026-10-13).
const hazeVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const hazeFragment = /* glsl */ `
uniform sampler2D uMap;
uniform vec2 uRepeat;
uniform vec3 uHaze, uTint;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vec3 c = texture2D(uMap, vUv * uRepeat).rgb;
  float h = smoothstep(250.0, 800.0, length(vWorld.xz - cameraPosition.xz));
  gl_FragColor = vec4(mix(c, uHaze, h * 0.75) * uTint, 1.0);
  #include <colorspace_fragment>
}`;

/** An office building's facade: glass bands between white spandrels, or a
 *  full glass curtain wall with mullions. */
function facadeTexture(glassy: boolean) {
  const { el, ctx } = canvas(256, 256);
  if (glassy) {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#9fb4c8');
    g.addColorStop(1, '#5d7286');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(230,236,242,0.6)';
    for (let x = 0; x < 256; x += 32) ctx.fillRect(x, 0, 3, 256);
    for (let y = 0; y < 256; y += 64) ctx.fillRect(0, y, 256, 4);
  } else {
    ctx.fillStyle = '#ece8df';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 18; y < 256; y += 64) {
      const g = ctx.createLinearGradient(0, y, 0, y + 30);
      g.addColorStop(0, '#7f93a6');
      g.addColorStop(1, '#4f6274');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, 256, 30);
      ctx.fillStyle = 'rgba(236,232,223,0.8)';
      for (let x = 0; x < 256; x += 40) ctx.fillRect(x, y, 3, 30);
    }
  }
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

// ----------------------------------------------------------------- corn

// The field: from just out of the window to the town, wide across the view,
// corn mazes all the way across (2026-10-13: the farm's play yard on the
// right, bare earth with sheds and a big top, read as a beach; the user
// asked for maze there too). A maze of rings on the left, a maze of
// straight paths on the right.
const FIELD = { x0: -340, x1: 350, z0: -ROOM.hz - 8, z1: -ROOM.hz - 240 };
const MAZE = { x: -105, z: -ROOM.hz - 120, r: 82 };
const GRID_MAZE = { x: 232, z: -ROOM.hz - 128, cells: 18, cell: 8.4 };

/**
 * The field from above, at about 4.4 px a metre: the crop's mottled greens
 * and golds, darker where it is dense; a corn maze's curving paths on the
 * left (rings with gaps, joined by short cuts, as cut into the real one), a
 * maze of straight paths on the right, dirt lanes around, and a
 * centre-pivot sprinkler's line across the middle.
 */
function fieldTexture() {
  const W = 3072,
    H = 1024,
    { el, ctx } = canvas(W, H),
    sx = W / (FIELD.x1 - FIELD.x0),
    sz = H / (FIELD.z0 - FIELD.z1),
    px = (x: number) => (x - FIELD.x0) * sx,
    pz = (z: number) => (FIELD.z0 - z) * sz;
  ctx.fillStyle = '#527526';
  ctx.fillRect(0, 0, W, H);
  // Mottling: big soft patches, lighter and golder or deeper green.
  for (let i = 0; i < 1350; i++) {
    const x = rand(i * 3.1) * W,
      y = rand(i * 7.3) * H,
      r = 10 + rand(i * 1.7) * 60,
      t = rand(i * 5.9);
    ctx.fillStyle =
      t < 0.4
        ? 'rgba(126,152,58,0.18)'
        : t < 0.7
          ? 'rgba(72,98,34,0.18)'
          : 'rgba(168,160,74,0.14)';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.6, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Dirt lanes: around the maze's square, and along the field's sides.
  const lane = (x0: number, z0: number, x1: number, z1: number, w = 3.2) => {
    ctx.strokeStyle = '#a58f66';
    ctx.lineWidth = w * sx;
    ctx.beginPath();
    ctx.moveTo(px(x0), pz(z0));
    ctx.lineTo(px(x1), pz(z1));
    ctx.stroke();
  };
  const m = MAZE,
    side = m.r + 12;
  lane(m.x - side, m.z + side, m.x + side, m.z + side);
  lane(m.x - side, m.z - side, m.x + side, m.z - side);
  lane(m.x - side, m.z + side, m.x - side, m.z - side);
  lane(m.x + side, m.z + side, m.x + side, m.z - side);
  lane(FIELD.x0, FIELD.z0 - 2, FIELD.x1, FIELD.z0 - 2, 4);
  lane(m.x - side, m.z + side, m.x - side - 60, FIELD.z0 - 2);
  // The maze: rings (with gaps) and short cuts between them.
  ctx.strokeStyle = 'rgba(150,128,86,0.85)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.15 * sx;
  let n = 0;
  const cx = px(m.x),
    cz = pz(m.z);
  for (let r = 10; r <= m.r; r += 7.5) {
    let a = rand(n++) * Math.PI * 2;
    const end = a + Math.PI * 2;
    while (a < end) {
      const len = 0.5 + rand(n++) * 1.4,
        stop = Math.min(end, a + len);
      // Each ring wanders a little in and out, as cut by hand.
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const t = a + ((stop - a) * k) / 24,
          rr =
            r +
            2.4 * (noise1(t * 2.2 + r, 7) - 0.5) +
            1.2 * Math.sin(t * 5 + r);
        const X = cx + Math.cos(t) * rr * sx,
          Z = cz + Math.sin(t) * rr * sz;
        if (k) ctx.lineTo(X, Z);
        else ctx.moveTo(X, Z);
      }
      ctx.stroke();
      // A cut inward from the arc's end, now and then.
      if (rand(n++) < 0.55 && r > 12) {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(stop) * r * sx, cz + Math.sin(stop) * r * sz);
        ctx.lineTo(
          cx + Math.cos(stop) * (r - 7.5) * sx,
          cz + Math.sin(stop) * (r - 7.5) * sz
        );
        ctx.stroke();
      }
      a = stop + 0.18 + rand(n++) * 0.3;
    }
  }
  // Its way in, from the lane.
  ctx.beginPath();
  ctx.moveTo(cx, cz - m.r * sz);
  ctx.lineTo(cx, cz - side * sz);
  ctx.stroke();
  // The second maze: a grid of cells, every one reached by exactly one way
  // (carved depth first), its paths cut between the cells' middles; lanes
  // round it, its way in from the near lane.
  const gm = GRID_MAZE,
    half = (gm.cells * gm.cell) / 2,
    gx0 = gm.x - half + gm.cell / 2,
    gz0 = gm.z + half - gm.cell / 2,
    at = (i: number, j: number): [number, number] => [
      px(gx0 + i * gm.cell),
      pz(gz0 - j * gm.cell),
    ],
    seen = new Uint8Array(gm.cells * gm.cells),
    stack: [number, number][] = [[0, 0]];
  const gside = half + 8;
  lane(gm.x - gside, gm.z + gside, gm.x + gside, gm.z + gside);
  lane(gm.x - gside, gm.z - gside, gm.x + gside, gm.z - gside);
  lane(gm.x - gside, gm.z + gside, gm.x - gside, gm.z - gside);
  lane(gm.x + gside, gm.z + gside, gm.x + gside, gm.z - gside);
  // (A touch wider and darker than the rings: straight paths read less
  // from the window's low angle.)
  ctx.strokeStyle = 'rgba(140,116,74,0.92)';
  ctx.lineWidth = 1.7 * sx;
  seen[0] = 1;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1],
      next = (
        [
          [i + 1, j],
          [i - 1, j],
          [i, j + 1],
          [i, j - 1],
        ] as [number, number][]
      ).filter(
        ([a, b]) =>
          a >= 0 &&
          b >= 0 &&
          a < gm.cells &&
          b < gm.cells &&
          !seen[b * gm.cells + a]
      );
    if (!next.length) {
      stack.pop();
      continue;
    }
    const [a, b] = next[Math.floor(rand(n++) * next.length)];
    seen[b * gm.cells + a] = 1;
    ctx.beginPath();
    ctx.moveTo(...at(i, j));
    ctx.lineTo(...at(a, b));
    ctx.stroke();
    stack.push([a, b]);
  }
  ctx.beginPath();
  ctx.moveTo(...at(Math.floor(gm.cells / 2), 0));
  ctx.lineTo(px(gm.x), pz(gm.z + gside));
  ctx.stroke();
  // A centre-pivot sprinkler's line across the field's right side.
  ctx.strokeStyle = 'rgba(225,226,220,0.45)';
  ctx.lineWidth = 0.45 * sx;
  ctx.beginPath();
  ctx.moveTo(px(20), pz(-ROOM.hz - 215));
  ctx.lineTo(px(125), pz(-ROOM.hz - 95));
  ctx.stroke();
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Soft patches, tiled at two scales over the field: where the crop is
 *  denser or thinner, greener or riper. */
function blotchTexture() {
  const { el, ctx } = canvas(256, 256);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const x = rand(i * 1.9) * 256,
      y = rand(i * 3.7) * 256,
      r = 14 + rand(i * 2.3) * 40,
      v = rand(i * 6.1) < 0.5 ? 40 : 215,
      g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${v},${v},${v},0.45)`);
    g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    ctx.fillStyle = g;
    for (const [dx, dy] of [
      [0, 0],
      [256, 0],
      [-256, 0],
      [0, 256],
      [0, -256],
    ]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const t = new CanvasTexture(el);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/** The crop up close, tiled: rows of plants, leaf texture, tassels. */
function rowsTexture() {
  const { el, ctx } = canvas(256, 256);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  // Rows run away from the window (along z): darker furrows between.
  for (let x = 0; x < 256; x += 32) {
    const g = ctx.createLinearGradient(x, 0, x + 32, 0);
    g.addColorStop(0, '#5f5f5f');
    g.addColorStop(0.5, '#9a9a9a');
    g.addColorStop(1, '#5f5f5f');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 32, 256);
  }
  for (let i = 0; i < 1600; i++) {
    const x = rand(i * 2.3) * 256,
      y = rand(i * 4.1) * 256,
      t = rand(i * 6.7);
    ctx.fillStyle =
      t < 0.12
        ? 'rgba(255,236,160,0.5)'
        : t < 0.6
          ? 'rgba(170,170,170,0.35)'
          : 'rgba(60,60,60,0.3)';
    ctx.fillRect(x, y, 1 + rand(i) * 3, 1 + rand(i * 9) * 2);
  }
  const t = new CanvasTexture(el);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

const fieldVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const fieldFragment = /* glsl */ `
uniform sampler2D uMap, uRows, uBlotch;
uniform vec3 uHaze, uTint;
uniform float uTime;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vec3 c = texture2D(uMap, vUv).rgb;
  float rows = texture2D(uRows, vWorld.xz / 6.0).r;
  float d = length(vWorld.xz - cameraPosition.xz);
  // Row detail near, fading into the field's colour far off.
  c *= mix(0.5 + 1.0 * rows, 1.0, smoothstep(50.0, 230.0, d));
  // Denser and thinner patches; riper, golder ones.
  float b1 = texture2D(uBlotch, vWorld.xz / 46.0).r;
  float b2 = texture2D(uBlotch, vWorld.xz / 17.0 + 0.37).r;
  c *= 0.78 + 0.44 * b1;
  c = mix(c, c * vec3(1.25, 1.12, 0.62), smoothstep(0.55, 0.85, b2) * 0.5);
  // Gusts: bands rolling across, the crop bending to show its paler side.
  float g = sin(vWorld.x * 0.03 - vWorld.z * 0.018 + uTime * 0.8)
          + 0.6 * sin(vWorld.x * 0.071 + vWorld.z * 0.05 - uTime * 1.3);
  g = smoothstep(0.6, 1.6, g);
  c = mix(c, c * vec3(1.18, 1.16, 0.98) + vec3(0.03, 0.03, 0.0), g * 0.6);
  gl_FragColor = vec4(mix(c, uHaze, smoothstep(160.0, 700.0, d) * 0.55) * uTint, 1.0);
  #include <colorspace_fragment>
}`;

// --------------------------------------------------------------- clouds

/** A cumulus: overlapping soft puffs, white on top, a grey-blue flat base. */
function cloudTexture(seed: number) {
  const { el, ctx } = canvas(512, 224);
  for (let i = 0; i < 30; i++) {
    const x = 60 + rand(seed + i * 3.3) * 390,
      base = 175,
      r = 24 + rand(seed + i * 5.9) * 52 * (1 - Math.abs(x - 256) / 300),
      y = base - r * (0.45 + rand(seed + i * 1.7) * 0.7),
      g = ctx.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.97)');
    g.addColorStop(0.6, 'rgba(246,248,252,0.78)');
    g.addColorStop(1, 'rgba(225,232,242,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-atop';
  const shade = ctx.createLinearGradient(0, 110, 0, 190);
  shade.addColorStop(0, 'rgba(180,192,212,0)');
  shade.addColorStop(1, 'rgba(160,176,200,0.6)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 512, 224);
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// --------------------------------------------------- Thanksgiving Point

type Keep = <T extends { dispose: () => void }>(x: T) => T;

/** Thanksgiving Point's grounds (no houses or trees there). */
const onFarm = (x: number, z: number) =>
  x > 10 && x < 340 && z > -ROOM.hz - 300;

/** Red board-and-batten siding with white-trimmed windows (the farm's barns
 *  and halls), tiled by size. */
function sidingTexture() {
  const { el, ctx } = canvas(256, 256);
  ctx.fillStyle = '#9b3b2d';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(60,18,12,0.35)';
  for (let x = 0; x < 256; x += 8) ctx.fillRect(x, 0, 2, 256);
  for (let y = 36; y < 256; y += 128)
    for (let x = 20; x < 256; x += 64) {
      ctx.fillStyle = '#f2ece2';
      ctx.fillRect(x - 3, y - 3, 30, 46);
      ctx.fillStyle = '#3b4652';
      ctx.fillRect(x, y, 24, 40);
      ctx.fillStyle = '#f2ece2';
      ctx.fillRect(x + 11, y, 2, 40);
      ctx.fillRect(x, y + 19, 24, 2);
    }
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/** The water tower's red band, its name around it, twice. */
function bandTexture() {
  const { el, ctx } = canvas(1024, 96);
  ctx.fillStyle = '#8f2a24';
  ctx.fillRect(0, 0, 1024, 96);
  ctx.fillStyle = '#f3e3c2';
  ctx.font = 'italic 700 52px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const x of [256, 768]) ctx.fillText('Thanksgiving Point', x, 50);
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A gable roof: a triangular prism, ridge along x, its eaves at y 0. */
function gable(w: number, d: number, h: number) {
  const g = new BufferGeometry(),
    x = w / 2,
    z = d / 2;
  // prettier-ignore
  const p = [
    -x, 0, z, x, 0, z, x, h, 0, -x, 0, z, x, h, 0, -x, h, 0, // front slope
    x, 0, -z, -x, 0, -z, -x, h, 0, x, 0, -z, -x, h, 0, x, h, 0, // back slope
    -x, 0, -z, -x, 0, z, -x, h, 0, // left end
    x, 0, z, x, 0, -z, x, h, 0, // right end
  ];
  g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Thanksgiving Point, Lehi, as seen from the office (after the user's
 * photos): beyond the corn mazes, the red halls and barns with green metal
 * roofs and cupolas on a lawn; and its water tower, a steel lattice holding
 * a dark green tank with a red band and its name, a dome, a balcony, a
 * little flag. (Its play yard on bare earth, with pastel sheds, a striped
 * big top, the giant slide, hay, tractors and pumpkins, read as a beach and
 * gave way to corn maze, 2026-10-13.)
 */
function thanksgivingPoint(keep: Keep) {
  const g = new Group(),
    lambert = (color: string) => keep(new MeshLambertMaterial({ color })),
    add = (
      geo: BufferGeometry,
      mat: MeshLambertMaterial | MeshLambertMaterial[],
      x: number,
      y: number,
      z: number,
      ry = 0
    ) => {
      const m = new Mesh(keep(geo), mat);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      g.add(m);
      return m;
    },
    Z = (d: number) => -ROOM.hz - d; // distance out from the window
  // A lawn strip by the halls (the corn mazes run up to it).
  add(
    new PlaneGeometry(260, 40).rotateX(-Math.PI / 2),
    lambert('#6f8b47'),
    150,
    GY + 0.07,
    Z(262)
  );

  const white = lambert('#f4f1ea'),
    up = new Vector3(0, 1, 0);

  // The red halls and barns, green metal roofs, cupolas.
  const siding = keep(sidingTexture()),
    roof = lambert('#3e6b4f');
  const halls = [
    [40, 250, 46, 12, 22],
    [110, 262, 60, 14, 26],
    [190, 252, 40, 11, 20],
    [260, 268, 54, 13, 24],
  ];
  for (const [x, d, w, h, dz] of halls) {
    const geo = new BoxGeometry(w, h, dz),
      uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      const face = Math.floor(i / 4),
        wide = face < 2 ? dz : w;
      uv.setXY(i, uv.getX(i) * (wide / 16), uv.getY(i) * (h / 8));
    }
    const mat = keep(new MeshLambertMaterial({ map: siding }));
    add(geo, [mat, mat, roof, roof, mat, mat], x, GY + h / 2, Z(d));
    add(gable(w + 2, dz + 2, h * 0.45), roof, x, GY + h, Z(d));
    add(new BoxGeometry(3, 3, 3), white, x, GY + h * 1.45 + 1.5, Z(d));
    add(
      new ConeGeometry(2.6, 3, 4).rotateY(Math.PI / 4),
      roof,
      x,
      GY + h * 1.45 + 4.5,
      Z(d)
    );
  }

  // The water tower: four lattice legs, braced, a balcony, the tank with its
  // red band, the dome, finial and flag.
  const wx = 92,
    wz = Z(222),
    legTop = 26,
    steel = lambert('#24302c'),
    tower = new Group();
  tower.position.set(wx, GY, wz);
  g.add(tower);
  const legs: Vector3[][] = [];
  for (const [ax, az] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const foot = new Vector3(ax * 6, 0, az * 6),
      head = new Vector3(ax * 3.2, legTop, az * 3.2);
    legs.push([foot, head]);
    const len = foot.distanceTo(head),
      leg = new Mesh(keep(new CylinderGeometry(0.35, 0.45, len, 6)), steel);
    leg.position.copy(foot).lerp(head, 0.5);
    leg.quaternion.setFromUnitVectors(up, head.clone().sub(foot).normalize());
    tower.add(leg);
  }
  // Horizontal braces at four heights.
  for (const t of [0.22, 0.45, 0.68, 0.9])
    for (let i = 0; i < 4; i++) {
      const a = legs[i][0].clone().lerp(legs[i][1], t),
        b = legs[(i + 1) % 4][0].clone().lerp(legs[(i + 1) % 4][1], t),
        brace = new Mesh(
          keep(new CylinderGeometry(0.15, 0.15, a.distanceTo(b), 5)),
          steel
        );
      brace.position.copy(a).lerp(b, 0.5);
      brace.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
      tower.add(brace);
    }
  const tankY = legTop + 4.2,
    put = (geo: BufferGeometry, mat: MeshLambertMaterial, y: number) => {
      const m = new Mesh(keep(geo), mat);
      m.position.y = y;
      tower.add(m);
      return m;
    };
  put(new CylinderGeometry(6.2, 6.2, 0.4, 24), steel, legTop + 0.2); // balcony
  put(
    new TorusGeometry(6.2, 0.12, 4, 32).rotateX(Math.PI / 2),
    steel,
    legTop + 1.3
  ); // its rail
  put(new CylinderGeometry(4.6, 4.2, 8.4, 32), lambert('#2b4a3c'), tankY);
  put(
    new CylinderGeometry(4.65, 4.65, 2.2, 48, 1, true),
    keep(new MeshLambertMaterial({ map: keep(bandTexture()) })),
    tankY + 0.6
  );
  put(
    new SphereGeometry(4.6, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    lambert('#2b4a3c'),
    tankY + 4.2
  );
  put(new CylinderGeometry(0.12, 0.12, 4, 6), steel, tankY + 10);
  const flag = put(
    new PlaneGeometry(2, 1.2),
    keep(new MeshLambertMaterial({ color: '#c8322b', side: DoubleSide })),
    tankY + 11.2
  );
  flag.position.x = 1;
  return g;
}

// ----------------------------------------------------------------- build

function build() {
  const g = new Group(),
    time = { value: 0 },
    // The light on the land through the day (daySky.ts), shared by the
    // shaders; materials with a colour are tinted from their own.
    tint = { value: new Color(1, 1, 1) },
    sky = {
      uSun: { value: SUN.clone() },
      uMoon: { value: new Vector3(0, -1, 0) },
      uDay: { value: 1 },
      uTwi: { value: 0 },
      uTime: time,
    },
    disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => {
    disposables.push(x);
    return x;
  };
  const place = (
    geometry: BufferGeometry,
    material: ShaderMaterial | MeshBasicMaterial
  ) => {
    const mesh = new Mesh(keep(geometry), keep(material));
    mesh.frustumCulled = false;
    g.add(mesh);
    return mesh;
  };

  // The sky.
  place(
    new SphereGeometry(850, 32, 16),
    new ShaderMaterial({
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      uniforms: sky,
      side: BackSide,
      depthWrite: false,
    })
  ).renderOrder = -10;

  // The mountains: tan foothills on the left, nearer; the high blue-grey
  // Wasatch peaks behind and across; a far, hazy range.
  const mtn = keep(
    new MeshBasicMaterial({ vertexColors: true, side: DoubleSide })
  );
  const ranges: [
    number,
    number,
    number,
    number,
    number,
    Palette,
    (x: number) => number,
  ][] = [
    // The far range, hazy blue.
    [-700, 190, 230, 3, 0.4, { low: '#6b7781', high: '#9aa0a8' }, () => 1],
    // The Wasatch, rugged and high: grey rock with sage scrub low down,
    // across the view and rising to the right.
    [
      -540,
      290,
      275,
      9,
      0.12,
      { low: '#6e745f', high: '#a09f9b' },
      (x) => 0.45 + 0.55 * smooth(-560, -120, x),
    ],
    // The grassy, tan foothills on the left, nearer and lower.
    [
      -420,
      230,
      100,
      5,
      0.05,
      { low: '#b79668', high: '#a28a63' },
      (x) => Math.pow(Math.sin(Math.PI * smooth(-860, 60, x)), 0.6),
    ],
  ];
  const rough = [0.9, 1, 0.35];
  for (const [
    i,
    [z0, depth, peak, seed, haze, palette, env],
  ] of ranges.entries())
    g.add(
      new Mesh(
        keep(ridge(z0, depth, peak, seed, haze, palette, env, rough[i])),
        mtn
      )
    );

  // The town beyond the field: roofs, lawns and streets, hazing away.
  const town = keep(townTexture());
  place(
    new PlaneGeometry(1800, 520)
      .rotateX(-Math.PI / 2)
      .translate(0, GY - 0.05, FIELD.z1 - 255),
    new ShaderMaterial({
      vertexShader: hazeVertex,
      fragmentShader: hazeFragment,
      uniforms: {
        uMap: { value: town },
        uRepeat: { value: [9, 2.6] },
        uHaze: { value: HAZE },
        uTint: tint,
      },
    })
  );
  // Ground beside and under the field (the near lot, out of the window's
  // view), so nothing shows below the horizon but land.
  place(
    new PlaneGeometry(1800, 600)
      .rotateX(-Math.PI / 2)
      .translate(0, GY - 0.2, -200),
    new MeshBasicMaterial({ color: '#6e7f48' })
  );

  // The field.
  const fieldMap = keep(fieldTexture()),
    rows = keep(rowsTexture()),
    blotch = keep(blotchTexture()),
    fieldMat = new ShaderMaterial({
      vertexShader: fieldVertex,
      fragmentShader: fieldFragment,
      uniforms: {
        uMap: { value: fieldMap },
        uRows: { value: rows },
        uBlotch: { value: blotch },
        uHaze: { value: HAZE },
        uTint: tint,
        uTime: time,
      },
    });
  place(
    new PlaneGeometry(FIELD.x1 - FIELD.x0, FIELD.z0 - FIELD.z1)
      .rotateX(-Math.PI / 2)
      .translate(
        (FIELD.x0 + FIELD.x1) / 2,
        GY + 0.05,
        (FIELD.z0 + FIELD.z1) / 2
      ),
    fieldMat
  );

  // Trees and houses across the town, small with distance.
  const m4 = new Matrix4(),
    q = new Quaternion(),
    s = new Vector3(),
    p = new Vector3(),
    c = new Color(),
    up = new Vector3(0, 1, 0);
  const treeMat = keep(new MeshLambertMaterial({ color: '#ffffff' })),
    trees = new InstancedMesh(
      keep(new IcosahedronGeometry(1, 1)),
      treeMat,
      240
    );
  // Few trees (this is Utah): small ones by the houses, here and there.
  for (let i = 0; i < 240; i++) {
    const z = FIELD.z1 - 10 - Math.pow(rand(i * 1.3), 0.9) * 290,
      x = (rand(i * 2.1) - 0.5) * 1300,
      sc = 1.8 + rand(i * 3.3) * 1.8;
    p.set(x, GY + sc * 0.75, z);
    s.set(sc, sc * (0.9 + rand(i) * 0.5), sc);
    if (onFarm(x, z)) s.setScalar(0); // not on Thanksgiving Point's grounds
    trees.setMatrixAt(i, m4.compose(p, q.identity(), s));
    c.set(rand(i * 5.1) < 0.5 ? '#3e5a2f' : '#55703a').lerp(
      HAZE,
      Math.min(0.7, (-z - 330) / 520)
    );
    trees.setColorAt(i, c);
  }
  g.add(trees);
  const houses = new InstancedMesh(
    keep(new BoxGeometry(1, 1, 1)),
    treeMat,
    640
  );
  for (let i = 0; i < 640; i++) {
    const z = FIELD.z1 - 10 - rand(i * 7.7) * 300,
      x = (rand(i * 4.4) - 0.5) * 1200,
      w = 8 + rand(i * 9.1) * 9;
    p.set(x, GY + 2.6, z);
    s.set(w, 5 + rand(i) * 2.5, w * (0.6 + rand(i * 2) * 0.5));
    if (onFarm(x, z)) s.setScalar(0);
    houses.setMatrixAt(
      i,
      m4.compose(p, q.setFromAxisAngle(up, rand(i * 3) * 0.5), s)
    );
    c.set(['#e4ddcf', '#c9b9a0', '#d7cfc1', '#b9a991'][i % 4]).lerp(
      HAZE,
      Math.min(0.7, (-z - 330) / 520)
    );
    houses.setColorAt(i, c);
  }
  g.add(houses);

  // The office buildings across the field (the campus seen in the photo):
  // white blocks with glass bands, and glass towers, on the left of centre.
  const facades = [keep(facadeTexture(false)), keep(facadeTexture(true))];
  const officeMats = facades.map((t) =>
    keep(new MeshLambertMaterial({ map: t }))
  );
  const roofMat = keep(new MeshLambertMaterial({ color: '#d9d6cf' }));
  // [x, z, width, height, depth, glass?]: the office blocks behind, mostly
  // on the left (the photo's), lower than the farm's landmarks matter.
  const blocks = [
    [-360, -420, 60, 40, 30, 1],
    [-280, -440, 48, 52, 32, 1],
    [-200, -415, 64, 30, 28, 0],
    [-120, -455, 44, 44, 30, 1],
    // (Further south than the photo's, so it stays out of the middle of
    // the east windows' horizon.)
    [330, -600, 70, 32, 30, 0],
  ];
  for (const [x, z, w, h, d, kind] of blocks) {
    const geo = keep(new BoxGeometry(w, h, d)),
      uv = geo.getAttribute('uv');
    // The facade tile is about 24 m wide and four floors (17 m) tall.
    for (let i = 0; i < uv.count; i++) {
      const face = Math.floor(i / 4),
        wide = face < 2 ? d : w;
      uv.setXY(i, uv.getX(i) * (wide / 24), uv.getY(i) * (h / 16.8));
    }
    const mats = [
      officeMats[kind],
      officeMats[kind],
      roofMat,
      roofMat,
      officeMats[kind],
      officeMats[kind],
    ];
    const b = new Mesh(geo, mats);
    b.position.set(x, GY + h / 2, z);
    b.rotation.y = (rand(x) - 0.5) * 0.3;
    g.add(b);
  }

  // Thanksgiving Point: its red barns and the tower.
  g.add(thanksgivingPoint(keep));

  // Big fair-weather cumulus: a bank low over the mountains (seen through
  // the window), more higher up, drifting slowly.
  const clouds = Array.from({ length: 18 }, (_, i) => {
    const sp = new Sprite(
        keep(
          new SpriteMaterial({
            map: keep(cloudTexture(i * 31)),
            transparent: true,
            depthWrite: false,
            opacity: 0.95,
            fog: false,
          })
        )
      ),
      w = 240 + rand(i * 4.7) * 260;
    sp.scale.set(w, w * (0.38 + rand(i * 2.9) * 0.14), 1);
    const low = i < 9;
    sp.position.set(
      (rand(i * 3.1) - 0.5) * 1600,
      low ? 215 + rand(i * 5.3) * 70 : 320 + rand(i * 5.3) * 140,
      low ? -840 - rand(i * 2.2) * 30 : -640 - rand(i * 2.2) * 200
    );
    sp.renderOrder = -5;
    g.add(sp);
    return { sp, x: sp.position.x };
  });

  // ------------------------------------------------ out of the east windows
  // (the Renter team's, 2026-10-15): the Wasatch close in the east, three
  // ranges deep (the near foothills, the main range, the high peaks hazing
  // behind), lit from the west by the afternoon sun; the town spread below,
  // its lights coming on at night; a few clouds catching the day's colours.
  // The ridges are built across the view and turned to face west.
  const westSun = new Vector3(SUN.z, SUN.y, -SUN.x); // SUN, seen unturned
  const east: [number, number, number, number, number, Palette, number][] = [
    // (Low on the horizon, 3-4° up from his desk, so the sky shows over
    // them through the windows, whose tops are only about 8° up from there:
    // built as tall as the meeting room's, they filled the windows.)
    [-720, 110, 92, 31, 0.45, { low: '#7d8796', high: '#b9bec6' }, 0.9],
    [-560, 180, 76, 23, 0.16, { low: '#5f6a55', high: '#a7a59f' }, 1],
    [-400, 110, 40, 17, 0.06, { low: '#8e8a5e', high: '#a59468' }, 0.4],
  ];
  for (const [z0, depth, peak, seed, haze, palette, rough] of east)
    g.add(
      new Mesh(
        keep(
          ridge(z0, depth, peak, seed, haze, palette, () => 1, rough, westSun)
        ).rotateY(-Math.PI / 2),
        mtn
      )
    );
  place(
    new PlaneGeometry(880, 1800)
      .rotateX(-Math.PI / 2)
      .translate(40 + 440, GY + 0.5, 0),
    new ShaderMaterial({
      vertexShader: hazeVertex,
      fragmentShader: hazeFragment,
      uniforms: {
        uMap: { value: town },
        uRepeat: { value: [4.4, 9] },
        uHaze: { value: HAZE },
        uTint: tint,
      },
    })
  );
  // The town's lights: warm points along its streets (a grid, thinning out
  // toward the mountains), a few cooler and brighter; they come on at dusk.
  const lightsN = 2600,
    lp = new Float32Array(lightsN * 3),
    lc = new Float32Array(lightsN * 3),
    ls = new Float32Array(lightsN);
  for (let i = 0; i < lightsN; i++) {
    const along = rand(i * 1.7) < 0.5,
      x = 60 + Math.pow(rand(i * 2.3), 1.3) * 300,
      z = (rand(i * 3.1) - 0.5) * 1400,
      sx = along ? Math.round(x / 18) * 18 : x,
      sz = along ? z : Math.round(z / 22) * 22;
    lp[i * 3] = sx + (rand(i * 5.3) - 0.5) * 2;
    lp[i * 3 + 1] = GY + 1.5;
    lp[i * 3 + 2] = sz + (rand(i * 6.1) - 0.5) * 2;
    const cool = rand(i * 7.7) < 0.15;
    lc[i * 3] = cool ? 0.75 : 1.0;
    lc[i * 3 + 1] = cool ? 0.85 : 0.72;
    lc[i * 3 + 2] = cool ? 1.0 : 0.42;
    ls[i] = 0.6 + rand(i * 8.9) * 1.4;
  }
  const lightsGeo = new BufferGeometry();
  lightsGeo.setAttribute('position', new BufferAttribute(lp, 3));
  lightsGeo.setAttribute('color', new BufferAttribute(lc, 3));
  lightsGeo.setAttribute('size', new BufferAttribute(ls, 1));
  const lightsOn = { value: 0 };
  const townLights = new Points(
    keep(lightsGeo),
    keep(
      new ShaderMaterial({
        uniforms: { uOn: lightsOn, uTime: time },
        vertexShader: /* glsl */ `
          attribute vec3 color;
          attribute float size;
          uniform float uTime;
          varying vec3 vColor;
          varying float vTw;
          void main() {
            vColor = color;
            vTw = 0.75 + 0.25 * sin(uTime * 2.0 + position.x * 0.37 + position.z * 0.53);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = clamp(size * 900.0 / -mv.z, 1.5, 6.0);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uOn;
          varying vec3 vColor;
          varying float vTw;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(vColor * vTw, a * uOn);
          }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      })
    )
  );
  townLights.frustumCulled = false;
  g.add(townLights);
  // A few clouds over the east, catching the day's colours.
  const eastClouds = Array.from({ length: 7 }, (_, i) => {
    const mat = keep(
        new SpriteMaterial({
          map: keep(cloudTexture(500 + i * 37)),
          transparent: true,
          depthWrite: false,
          opacity: 0.9,
          fog: false,
        })
      ),
      sp = new Sprite(mat),
      w = 200 + rand(i * 9.1) * 220;
    sp.scale.set(w, w * 0.4, 1);
    sp.position.set(
      760 + rand(i * 3.7) * 60,
      200 + rand(i * 2.1) * 170,
      (rand(i * 4.3) - 0.5) * 1400
    );
    sp.renderOrder = -5;
    g.add(sp);
    return { sp, z: sp.position.z };
  });

  // Everything with a colour of its own is tinted from it through the day.
  const tinted: { mat: MeshBasicMaterial; base: Color }[] = [];
  g.traverse((o) => {
    const m = (o as Mesh).material as MeshBasicMaterial | undefined;
    if (!m || Array.isArray(m) || !(m as { color?: Color }).color) return;
    if ((m as unknown as ShaderMaterial).isShaderMaterial) return;
    if (tinted.some((t) => t.mat === m)) return;
    tinted.push({ mat: m, base: m.color.clone() });
  });
  const glow = new Color(),
    pink = new Color('#ffb4a8');
  let lastDay = -1;
  /** The time of day (daySky.ts), 0..1. */
  const setDay = (p: number) => {
    if (Math.abs(p - lastDay) < 1e-4) return;
    lastDay = p;
    sunAt(p, sky.uSun.value);
    moonAt(p, sky.uMoon.value);
    sky.uDay.value = daylight(p);
    sky.uTwi.value = twilight(p);
    landTint(p, tint.value);
    for (const t of tinted) t.mat.color.copy(t.base).multiply(tint.value);
    lightsOn.value = 1 - MathUtils.smoothstep(sky.uDay.value, 0.15, 0.6);
    // The east clouds: the land's light, pinker in twilight.
    glow.copy(tint.value).lerp(pink, sky.uTwi.value * 0.6);
    for (const c of eastClouds) c.sp.material.color.copy(glow);
  };
  setDay(0);

  const tick = (dt: number) => {
    time.value += dt;
    for (const cl of clouds)
      cl.sp.position.x = ((cl.x + time.value * 1.4 + 900) % 1800) - 900;
    for (const cl of eastClouds)
      cl.sp.position.z = ((cl.z + time.value * 1.2 + 700) % 1400) - 700;
  };
  tick(0);
  const dispose = () => {
    for (const d of disposables) d.dispose();
    g.traverse((o) => {
      if ((o as InstancedMesh).isInstancedMesh) (o as InstancedMesh).dispose();
    });
  };
  return { group: g, tick, setDay, dispose };
}

export function OfficeOutside({
  reduced,
  desk,
  leave,
}: {
  reduced: boolean;
  /** 0..1 through the way to his desk: a day passes outside. */
  desk: RefObject<number>;
  /** 0..1 through his leaving: on into the night. */
  leave: RefObject<number>;
}) {
  const root = useRef<Group>(null),
    live = useRef<ReturnType<typeof build> | null>(null);
  useEffect(() => {
    const r = root.current;
    if (!r) return;
    const view = build();
    r.add(view.group);
    live.current = view;
    return () => {
      r.remove(view.group);
      view.dispose();
      live.current = null;
    };
  }, []);
  useFrame((_, dt) => {
    const view = live.current;
    if (!view || !shown(root.current)) return;
    view.tick(reduced ? 0 : Math.min(dt, 0.05));
    const g = leave.current ?? 0;
    view.setDay(
      reduced ? 0 : g > 0 ? gradBeats(g).day : deskBeats(desk.current ?? 0).day
    );
  });
  return <group ref={root} />;
}
