import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  MathUtils,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three';
import { flyBeats } from './story';
import { shown } from './shown';
import {
  BRIDGE_AT,
  CAMPUS,
  CAMPUS_AREA,
  campusBoxes,
  CAMPUS_FLOOR,
  FLOOR,
  FLOOR_H,
  height,
  HIS_WINDOW,
  I15,
  LAKE,
  TOWNS,
} from './valley';
import {
  LEHI_AREA,
  LEHI_BUILDINGS,
  LEHI_NEAR,
  lehiCars,
  LEHI_UNIT,
  lehiBoxes,
  SR92_WAY,
} from './lehi';
import { LIGHT, rand, SKY } from './valleyLight';
import {
  buildingsMesh,
  ceilUniforms,
  SHADE_AT,
  shadowHeights,
} from './valleyBuildings';
import { drawCampusGround, drawLehiGround } from './valleyGround';
import { parkedCarsMesh } from './valleyCars';
import { buildHisOffice, OFFICE_TOP } from './hisOffice';
import type { HisOffice } from './hisOffice';

/**
 * Chapter 4's way in: Utah Valley from the air at the end of a day (valley.ts
 * has the places). The terrain, one mesh, its ground drawn in its shader
 * at any altitude (a small mask says where the lake, the towns and the
 * parks are; the fields' parcels, the towns' blocks, lots and trees, and
 * I-15 are the shader's), the Wasatch and the other ridges raised from it,
 * Utah Lake shining with the sky and the sun going down over it; a haze
 * with distance. BYU's campus: its buildings, each of a few masses in its
 * own skin and roof, the plant on its roofs, its trees, walks and lots
 * painted on its ground, their shadows from one map of heights. Lehi's
 * offices by I-15, Bridge's among them, his window lit. The sky, a few
 * clouds. As the flight goes on the towns' lights come on, cars run both
 * ways on I-15, and the marketplace's clusters pop up over the towns,
 * Lehi's opening into its listings' cards (RoomPortfolio puts its search
 * bar over them). Its own shaders, unlit by the scene's lights (its light
 * is the low sun's, in them), so it never changes the other places'
 * programs.
 */

/** The map's mask (px), over FLOOR: red the lake, green the towns, blue
 *  the parks (BYU's campus, Thanksgiving Point's gardens). Soft-edged; the
 *  detail is the shader's. */
const N = 1024;
const toPx = (x: number, z: number): [number, number] => [
  ((x - (FLOOR.cx - FLOOR.size / 2)) / FLOOR.size) * N,
  ((z - (FLOOR.cz - FLOOR.size / 2)) / FLOOR.size) * N,
];
const PX = N / FLOOR.size; // px a unit

function drawMask() {
  const el = document.createElement('canvas');
  el.width = el.height = N;
  const c = el.getContext('2d')!;
  c.fillStyle = '#000';
  c.fillRect(0, 0, N, N);
  c.globalCompositeOperation = 'lighter';
  // The lake.
  c.filter = 'blur(1.5px)';
  c.beginPath();
  LAKE.forEach(([x, z], i) => {
    const [px, py] = toPx(x, z);
    if (i) c.lineTo(px, py);
    else c.moveTo(px, py);
  });
  c.closePath();
  c.fillStyle = '#ff0000';
  c.fill();
  c.filter = 'none';
  // The towns: where they are, roughly, and how far they spread (the
  // shader breaks their edges along the street grid, with noise): a few
  // overlapping ellipses each, grown out along their main streets, and the
  // corridor along I-15, built up nearly all the way from Provo to Lehi.
  c.filter = 'blur(6px)';
  for (const t of TOWNS) {
    const [cx, cy] = toPx(...t.at),
      r = t.r * PX;
    for (let i = 0; i < 5; i++) {
      const a = rand(i + cx) * Math.PI * 2,
        d = r * 0.45 * rand(i + cy),
        x = cx + Math.cos(a) * d,
        y = cy + Math.sin(a) * d;
      c.fillStyle = 'rgba(0, 150, 0, 1)';
      c.beginPath();
      c.ellipse(
        x,
        y,
        r * (0.45 + 0.35 * rand(i * 3 + cx)),
        r * (0.3 + 0.3 * rand(i * 5 + cy)),
        rand(i * 7 + cx) * Math.PI,
        0,
        Math.PI * 2
      );
      c.fill();
    }
    // Along its main streets, north-south and east-west.
    c.fillStyle = 'rgba(0, 110, 0, 1)';
    c.fillRect(cx - r * 0.18, cy - r * 1.25, r * 0.36, r * 2.5);
    c.fillRect(cx - r * 1.2, cy - r * 0.16, r * 2.4, r * 0.32);
  }
  c.strokeStyle = 'rgba(0, 90, 0, 1)';
  c.lineWidth = 2.6 * 20 * PX;
  c.lineJoin = c.lineCap = 'round';
  c.beginPath();
  I15.forEach(([x, z], i) => {
    const [px, py] = toPx(x, z);
    if (i) c.lineTo(px, py);
    else c.moveTo(px, py);
  });
  c.stroke();
  c.filter = 'none';
  // The parks, as blocks of the grid: BYU's campus. (Lehi round Bridge's
  // office is its own painted ground.)
  c.fillStyle = '#0000ff';
  for (const [x, z, w, d] of [[CAMPUS[0] + 2, CAMPUS[1] - 1, 28, 20]]) {
    const [px, py] = toPx(x - w / 2, z - d / 2);
    c.beginPath();
    c.roundRect(px, py, w * PX, d * PX, 2);
    c.fill();
  }
  const t = new CanvasTexture(el);
  t.anisotropy = 8;
  return t;
}

const terrainVertex = /* glsl */ `
varying vec3 vWorld, vNormal;
varying vec2 vUv, vP;
varying float vH;
void main() {
  vUv = uv;
  vH = position.y;
  vP = position.xz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
// The ground, drawn here at any altitude: fields in parcels; in the towns a
// grid of blocks (the valley's streets run north-south), their roofs and
// trees, arterials every mile; I-15; the lake with the sky and the sun in
// it; the mountains' scrub and rock; the low sun on all of it, and the haze.
const terrainFragment = /* glsl */ `
uniform sampler2D uMask;
uniform float uHaze;
uniform vec3 uBox; // the mask's square: west edge, north edge, size
uniform sampler2D uCampusGround; // over uCeilBox (drawCampusGround)
uniform vec2 uRoad[${I15.length}];
// Lehi round Bridge's office: its painted ground and its shadows' heights,
// over uLehiBox; SR-92 east from I-15.
uniform sampler2D uLehiGround, uLehiCeil, uLehiNear;
uniform vec3 uLehiBox, uLehiNearBox;
uniform vec2 uSr92[${SR92_WAY.length}];
${SKY}
// The campus's buildings' shadows, long in the low sun.
${SHADE_AT}
varying vec3 vWorld, vNormal;
varying vec2 vUv, vP;
varying float vH;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), u.x), u.y);
}
// How much of a pattern of cells this size still shows (1 near; 0 where a
// cell is under a pixel, so it averages instead of shimmering).
float detail(vec2 p, float cell) {
  float f = max(fwidth(p.x), fwidth(p.y)) / cell;
  return 1.0 - smoothstep(0.25, 0.7, f);
}
// A line every cell of the coordinate, w its half width (cells), smoothed.
float grid(float x, float w) {
  float d = abs(fract(x - 0.5) - 0.5), f = fwidth(x);
  return (1.0 - smoothstep(w - f, w + f, d)) * (1.0 - smoothstep(0.15, 0.5, f));
}
// The mask at a place (not at this fragment: at a block's centre).
vec4 maskAt(vec2 q) {
  return textureLod(uMask, vec2((q.x - uBox.x) / uBox.z, 1.0 - (q.y - uBox.y) / uBox.z), 0.0);
}
float sr92(vec2 p) {
  float d = 1e9;
  for (int i = 0; i < ${SR92_WAY.length - 1}; i++) {
    vec2 a = uSr92[i], b = uSr92[i + 1], ab = b - a;
    float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    d = min(d, length(p - a - ab * t));
  }
  return d;
}
float road(vec2 p) {
  float d = 1e9;
  for (int i = 0; i < ${I15.length - 1}; i++) {
    vec2 a = uRoad[i], b = uRoad[i + 1], ab = b - a;
    float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    d = min(d, length(p - a - ab * t));
  }
  return d;
}
void main() {
  vec3 n = normalize(vNormal);
  vec4 m = texture2D(uMask, vUv);
  vec2 p = vP;
  // Fields: parcels of a quarter kilometre, green and gold.
  vec2 pc = floor(p / 5.0);
  float h1 = hash(pc);
  vec2 big = floor(p / 15.0);
  vec3 fieldAvg = vec3(0.47, 0.44, 0.3);
  vec3 field = mix(vec3(0.5, 0.45, 0.31), vec3(0.37, 0.43, 0.26), step(0.62, h1) * step(0.35, hash(big)));
  field *= 0.92 + 0.14 * hash(pc + 3.1);
  field = mix(fieldAvg, field, detail(p, 5.0));
  field *= 0.92 + 0.16 * vnoise(p / 40.0);
  field = mix(field, field * 0.8, max(grid(p.x / 5.0, 0.03), grid(p.y / 5.0, 0.03)) * 0.6);
  // Towns: 200 m blocks of lots, roofs and trees.
  vec2 lot = floor(p / 0.5);
  float hl = hash(lot);
  // Roofs and yards, and the trees over them (the valley's towns are
  // leafy: from the air, more green than roof).
  vec3 lotC = mix(vec3(0.5, 0.48, 0.44), vec3(0.3, 0.37, 0.23), smoothstep(0.3, 0.6, hl));
  lotC *= 0.92 + 0.12 * hash(lot + 7.0);
  lotC = mix(vec3(0.37, 0.4, 0.3), lotC, detail(p, 0.5));
  float street = max(grid(p.x / 4.0, 0.06), grid(p.y / 4.0, 0.06));
  float arterial = max(grid(p.x / 32.0, 0.012), grid(p.y / 32.0, 0.012));
  vec3 town = mix(lotC, vec3(0.46, 0.45, 0.44), street);
  town = mix(town, vec3(0.6, 0.59, 0.57), arterial);
  // Where the towns are, block by block: each 200 m block built up or not
  // by the mask at its centre, its outline roughened by noise at two
  // sizes and a little per block, so a town's edge runs ragged along its
  // streets (2026-11-20: the mask alone drew them as round discs). Far
  // off, where a block is under a pixel, the smooth outline instead.
  vec2 blk = floor(p / 4.0), bc = (blk + 0.5) * 4.0;
  vec4 mb = maskAt(bc);
  float ragged = (vnoise(bc / 26.0) - 0.5) * 0.7 + (vnoise(bc / 8.0) - 0.5) * 0.3;
  float townB = step(0.34, mb.g + ragged + (hash(blk) - 0.5) * 0.18);
  float townS = smoothstep(0.24, 0.44, m.g + (vnoise(p / 26.0) - 0.5) * 0.7);
  float park = mix(smoothstep(0.3, 0.7, m.b), step(0.5, mb.b), detail(p, 4.0));
  float t = mix(townS, townB, detail(p, 4.0)) * (1.0 - park);
  vec3 ground = mix(field, town, t);
  // The parks: lawns, mown in stripes; on BYU's campus, its trees, walks
  // and lots over them (the buildings are their own).
  float mown = 0.94 + 0.06 * step(0.5, fract(p.x / 0.8));
  vec3 lawn = vec3(0.31, 0.44, 0.22) * mown;
  ground = mix(ground, lawn, park);
  // SR-92 (Lehi's ground draws it in full round Bridge's office).
  float r92 = sr92(p), f92 = fwidth(r92);
  ground = mix(ground, vec3(0.3, 0.3, 0.31), 1.0 - smoothstep(0.32 - f92, 0.32 + f92, r92));
  vec2 cu = (p - uCeilBox.xy) / uCeilBox.z;
  if (all(greaterThan(cu, vec2(0.0))) && all(lessThan(cu, vec2(1.0)))) {
    vec4 cg = texture2D(uCampusGround, cu);
    ground = mix(ground, cg.rgb, cg.a);
  }
  vec2 lu = (p - uLehiBox.xy) / uLehiBox.z;
  bool inLehi = all(greaterThan(lu, vec2(0.0))) && all(lessThan(lu, vec2(1.0)));
  if (inLehi) {
    vec4 lg = texture2D(uLehiGround, lu);
    // Where the camera comes down to his window, the same, sharper.
    vec2 nu = (p - uLehiNearBox.xy) / uLehiNearBox.z;
    float ne = min(min(nu.x, nu.y), min(1.0 - nu.x, 1.0 - nu.y));
    if (ne > 0.0) lg = mix(lg, texture2D(uLehiNear, nu), smoothstep(0.0, 0.08, ne));
    // Close to, a grain in it (its texels are ~3 m).
    lg.rgb *= mix(1.0, 0.95 + 0.1 * vnoise(p * 7.0), detail(p, 1.0 / 7.0));
    ground = mix(ground, lg.rgb, lg.a);
  }
  // I-15: its carriageways.
  float rd = road(p);
  float fw = fwidth(rd);
  ground = mix(ground, vec3(0.3, 0.3, 0.31), 1.0 - smoothstep(0.42 - fw, 0.42 + fw, rd));
  ground = mix(ground, vec3(0.42, 0.42, 0.4), (1.0 - smoothstep(0.05 - fw, 0.05 + fw, rd)) * 0.8);
  // The mountains: scrub, rock where steep, paler toward the tops.
  float slope = 1.0 - n.y;
  vec3 scrub = vec3(0.3, 0.34, 0.22) * (0.8 + 0.35 * vnoise(p / 3.0) + 0.15 * vnoise(p / 0.8));
  vec3 rock = vec3(0.5, 0.45, 0.39) * (0.9 + 0.2 * vnoise(p / 2.0));
  vec3 mtn = mix(scrub, rock, smoothstep(0.25, 0.6, slope));
  mtn = mix(mtn, vec3(0.62, 0.58, 0.54), smoothstep(30.0, 58.0, vH) * 0.5);
  vec3 base = mix(ground, mtn, smoothstep(0.8, 5.0, vH));
  // The low sun, warm, raking; the sky's light, cool.
  float ndl = max(dot(n, uSun), 0.0);
  float shade = smoothstep(0.0, 0.06, ceilAt(p) - vH);
  if (inLehi) shade = max(shade, smoothstep(0.0, 0.06, texture2D(uLehiCeil, lu).r * uCeilMax - vH));
  vec3 c = base * (uAmbient * 0.75 + uSunColor * (0.3 + 1.35 * ndl) * (1.0 - 0.8 * shade));
  vec3 v = normalize(cameraPosition - vWorld);
  // The lake: the sky in it, the sun's glitter on it, a sandy shore.
  float lake = smoothstep(0.35, 0.65, m.r);
  if (m.r > 0.05) {
    vec3 r = reflect(-v, vec3(0.0, 1.0, 0.0));
    float fres = 0.2 + 0.8 * pow(1.0 - max(v.y, 0.0), 5.0);
    vec3 water = mix(vec3(0.07, 0.15, 0.2), skyAt(r), fres);
    water += uSunColor * pow(max(dot(r, uSun), 0.0), 90.0) * 2.0;
    c = mix(c, vec3(0.62, 0.56, 0.42) * (uAmbient * 0.75 + uSunColor * 0.6), smoothstep(0.05, 0.3, m.r) * (1.0 - lake));
    c = mix(c, water, lake);
  }
  // Aerial haze: warm toward the sun, blue away from it.
  float d = length(cameraPosition - vWorld);
  float haze = 1.0 - exp(-d * uHaze);
  c = mix(c, skyAt(normalize(vec3(-v.x, 0.04, -v.z))), haze * 0.75);
  // (three's ACES curve lifts its input 1/0.6: these colours are the
  // valley's own, so they are taken back down first.)
  gl_FragColor = vec4(c * 0.62, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const skyFragment = /* glsl */ `
${SKY}
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 c = skyAt(d);
  // The sun's disc, low over the lake.
  c += uSunColor * smoothstep(0.9993, 0.9997, dot(d, uSun)) * 1.5;
  // (three's ACES curve lifts its input 1/0.6: these colours are the
  // valley's own, so they are taken back down first.)
  gl_FragColor = vec4(c * 0.62, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const lightsVertex = /* glsl */ `
attribute float aSeed;
uniform float uTime, uOn, uPx;
varying float vA;
void main() {
  // Each comes on at its own moment as the valley darkens, and twinkles.
  float on = smoothstep(aSeed * 0.8, aSeed * 0.8 + 0.2, uOn);
  vA = on * (0.6 + 0.3 * aSeed);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uPx * (0.6 + aSeed) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const lightsFragment = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(uColor * smoothstep(0.5, 0.0, d) * vA, 1.0);
}`;

// The cars on I-15: each runs its lane, one way or the other.
const carsVertex = /* glsl */ `
attribute float aSeed, aWay;
uniform vec2 uRoad[${I15.length}];
uniform float uLen[${I15.length}];
uniform float uTotal, uTime, uPx, uOn;
varying float vA;
varying float vWay;
void main() {
  float s = fract(aSeed + uTime * 0.004 * aWay * (0.8 + 0.4 * fract(aSeed * 13.0))) * uTotal;
  vec2 p = uRoad[0];
  vec2 dir = vec2(0.0, -1.0);
  for (int i = 0; i < ${I15.length - 1}; i++) {
    if (s >= uLen[i] && s <= uLen[i + 1]) {
      float t = (s - uLen[i]) / max(uLen[i + 1] - uLen[i], 1e-3);
      p = mix(uRoad[i], uRoad[i + 1], t);
      dir = normalize(uRoad[i + 1] - uRoad[i]);
    }
  }
  // Their lanes either side of the median.
  vec2 side = vec2(-dir.y, dir.x) * 0.16 * aWay;
  vec4 mv = modelViewMatrix * vec4(p.x + side.x, 0.12, p.y + side.y, 1.0);
  vA = uOn;
  vWay = aWay;
  gl_PointSize = uPx / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const carsFragment = /* glsl */ `
varying float vA;
varying float vWay;
void main() {
  float d = length(gl_PointCoord - 0.5);
  // Northbound away from us (tail lights), southbound toward us.
  vec3 c = vWay > 0.0 ? vec3(1.0, 0.25, 0.18) : vec3(1.0, 0.93, 0.8);
  gl_FragColor = vec4(c * smoothstep(0.5, 0.0, d) * vA, 1.0);
}`;

/** A soft cloud puff, drawn once. */
function puff() {
  const el = document.createElement('canvas');
  el.width = el.height = 256;
  const c = el.getContext('2d')!;
  for (let i = 0; i < 14; i++) {
    const x = 70 + rand(i) * 116,
      y = 90 + rand(i + 3) * 70,
      r = 30 + rand(i + 7) * 50,
      g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
  }
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** The clusters' counts, by town (made up, of a believable size), and
 *  Lehi's listings' asking prices, round Bridge's offices (units off): all
 *  under the search's $1.5M. */
const CLUSTERS: Record<string, string> = {
  Provo: '60+',
  Orem: '40+',
  'Pleasant Grove': '20+',
  'American Fork': '30+',
  Lehi: '50+',
  Springville: '10+',
  'Saratoga Springs': '10+',
  Highland: '10+',
};
/** Lehi's listings as the marketplace's cards, each over a business's
 *  building (made up, under the search's $1.5M). */
const CARDS = [
  {
    category: 'Food & Beverage',
    title: 'Specialty Coffee Roaster & Café',
    price: '$850K',
    sde: '$240K',
    from: '#c79a6b',
    to: '#6e4630',
    icon: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M11 3v3',
  },
  {
    category: 'Home Services',
    title: 'Established HVAC Service Company',
    price: '$1.4M',
    sde: '$410K',
    from: '#9fb7c9',
    to: '#4b6478',
    icon: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 4c3 0 3 4 0 6M20 12c0 3-4 3-6 0M12 20c-3 0-3-4 0-6M4 12c0-3 4-3 6 0',
  },
  {
    category: 'Health & Fitness',
    title: 'Boutique Fitness Studio',
    price: '$420K',
    sde: '$130K',
    from: '#d8a3a0',
    to: '#8a4f5c',
    icon: 'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10',
  },
  {
    category: 'Technology',
    title: 'IT Managed Services Firm',
    price: '$1.2M',
    sde: '$360K',
    from: '#a9b6d8',
    to: '#4a5888',
    icon: 'M4 5h16v10H4zM9 19h6M12 15v4',
  },
];

/** A listing's card, as the marketplace shows one, small: its picture (a
 *  gradient and an icon), category, name, town, asking price and SDE; its
 *  point down to the building. Drawn at twice its size, for sharpness. */
function cardTexture(card: (typeof CARDS)[number]) {
  const w = 600,
    h = 196,
    el = document.createElement('canvas'),
    c = el.getContext('2d')!;
  el.width = w + 24;
  el.height = h + 40;
  const font = (wt: number, px: number) =>
    `${wt} ${px}px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
  c.shadowColor = 'rgba(0, 0, 0, 0.3)';
  c.shadowBlur = 14;
  c.shadowOffsetY = 4;
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.roundRect(12, 8, w, h, 22);
  c.moveTo(12 + w / 2 - 16, 8 + h - 1);
  c.lineTo(12 + w / 2, 8 + h + 22);
  c.lineTo(12 + w / 2 + 16, 8 + h - 1);
  c.fill();
  c.shadowColor = 'transparent';
  // The picture.
  c.save();
  c.beginPath();
  c.roundRect(12, 8, 176, h, [22, 0, 0, 22]);
  c.clip();
  const g = c.createLinearGradient(12, 8, 188, 8 + h);
  g.addColorStop(0, card.from);
  g.addColorStop(1, card.to);
  c.fillStyle = g;
  c.fillRect(12, 8, 176, h);
  c.translate(12 + 88 - 36, 8 + h / 2 - 36);
  c.scale(3, 3);
  c.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  c.lineWidth = 1.6;
  c.lineCap = c.lineJoin = 'round';
  c.stroke(new Path2D(card.icon));
  c.restore();
  // The words.
  const x = 214;
  c.fillStyle = '#f1f1f3';
  c.font = font(600, 20);
  const cw = c.measureText(card.category).width;
  c.beginPath();
  c.roundRect(x, 26, cw + 20, 32, 9);
  c.fill();
  c.fillStyle = '#5a5d66';
  c.textBaseline = 'middle';
  c.fillText(card.category, x + 10, 43);
  c.fillStyle = '#1d1d20';
  c.font = font(700, 27);
  c.fillText(card.title, x, 86, w - x - 10);
  c.fillStyle = '#5f626b';
  c.font = font(500, 23);
  c.fillText('Lehi, Utah', x, 118);
  c.fillStyle = '#7d808a';
  c.font = font(700, 18);
  c.fillText('ASKING', x, 152);
  c.fillText('SDE', x + 150, 152);
  c.fillStyle = '#1d1d20';
  c.font = font(700, 29);
  c.fillText(card.price, x, 180);
  c.fillText(card.sde, x + 150, 180);
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return { t, aspect: el.width / el.height };
}

/** A cluster's marker: its count white in a dark disc ringed white, with a
 *  soft shadow. */
function clusterTexture(text: string) {
  const el = document.createElement('canvas'),
    c = el.getContext('2d')!,
    font = `700 32px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
  c.font = font;
  const d = Math.max(84, Math.ceil(c.measureText(text).width) + 40);
  el.width = el.height = d + 16;
  c.shadowColor = 'rgba(0, 0, 0, 0.35)';
  c.shadowBlur = 8;
  c.shadowOffsetY = 2;
  c.fillStyle = '#1d1d20';
  c.beginPath();
  c.arc(el.width / 2, el.height / 2, d / 2, 0, Math.PI * 2);
  c.fill();
  c.shadowColor = 'transparent';
  c.strokeStyle = '#ffffff';
  c.lineWidth = 4;
  c.stroke();
  c.font = font;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#ffffff';
  c.fillText(text, el.width / 2, el.height / 2 + 1);
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return { t, aspect: el.width / el.height };
}

/** A town's name, as a map labels it. */
function label(text: string, size = 44) {
  const el = document.createElement('canvas'),
    c = el.getContext('2d')!;
  c.font = `600 ${size}px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
  const w = Math.ceil(c.measureText(text).width) + 24;
  el.width = w;
  el.height = size + 24;
  c.font = `600 ${size}px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.strokeStyle = 'rgba(30, 32, 40, 0.75)';
  c.lineWidth = 8;
  c.strokeText(text, 12, el.height / 2);
  c.fillStyle = '#ffffff';
  c.fillText(text, 12, el.height / 2);
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  return { t, aspect: w / el.height };
}

function build() {
  const mask = drawMask(),
    boxes = campusBoxes(),
    shadows = shadowHeights(boxes, CAMPUS_AREA, 768),
    campusGround = drawCampusGround(boxes, CAMPUS_AREA),
    lehi = lehiBoxes(),
    lehiShadows = shadowHeights(lehi, LEHI_AREA, 1024),
    lehiGround = drawLehiGround(lehi, LEHI_AREA, 2048),
    lehiNear = drawLehiGround(lehi, LEHI_NEAR, 1536);
  const disposables: { dispose: () => void }[] = [
    mask,
    shadows,
    campusGround,
    lehiShadows,
    lehiGround,
    lehiNear,
  ];
  const HAZE = 0.0009;
  const group = new Group();

  // The terrain.
  const seg = 288,
    plane = new PlaneGeometry(FLOOR.size, FLOOR.size, seg, seg).rotateX(
      -Math.PI / 2
    );
  plane.translate(FLOOR.cx, 0, FLOOR.cz);
  const pos = plane.attributes.position as BufferAttribute;
  for (let i = 0; i < pos.count; i++)
    pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  plane.computeVertexNormals();
  const terrain = new Mesh(
    plane,
    new ShaderMaterial({
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
      uniforms: {
        ...LIGHT,
        uMask: { value: mask },
        uBox: {
          value: new Vector3(
            FLOOR.cx - FLOOR.size / 2,
            FLOOR.cz - FLOOR.size / 2,
            FLOOR.size
          ),
        },
        uCampusGround: { value: campusGround },
        ...ceilUniforms(shadows, CAMPUS_AREA),
        uLehiGround: { value: lehiGround },
        uLehiNear: { value: lehiNear },
        uLehiNearBox: {
          value: new Vector3(LEHI_NEAR.x, LEHI_NEAR.z, LEHI_NEAR.size),
        },
        uLehiCeil: { value: lehiShadows },
        uLehiBox: {
          value: new Vector3(LEHI_AREA.x, LEHI_AREA.z, LEHI_AREA.size),
        },
        uSr92: { value: SR92_WAY.map(([x, z]) => new Vector2(x, z)) },
        uHaze: { value: HAZE },
        uRoad: { value: I15.map(([x, z]) => new Vector2(x, z)) },
      },
    })
  );
  terrain.frustumCulled = false;
  group.add(terrain);
  disposables.push(plane, terrain.material as ShaderMaterial);

  // The sky, round the camera (moved with it each frame).
  const skyGeo = new SphereGeometry(820, 32, 16);
  const sky = new Mesh(
    skyGeo,
    new ShaderMaterial({
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      uniforms: { ...LIGHT },
      side: BackSide,
      depthWrite: false,
    })
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  group.add(sky);
  disposables.push(skyGeo, sky.material as ShaderMaterial);

  // The towns' lights, coming on at dusk.
  const lightPts: number[] = [],
    lightSeed: number[] = [];
  TOWNS.forEach((t, k) => {
    const n = Math.round(t.r * t.r * 0.12);
    for (let i = 0; i < n; i++) {
      const a = rand(i * 1.3 + k * 7) * Math.PI * 2,
        d = Math.sqrt(rand(i * 2.1 + k * 3)) * t.r * 0.85,
        x = t.at[0] + Math.cos(a) * d,
        z = t.at[1] + Math.sin(a) * d;
      // None over Lehi's painted ground round Bridge's office (close up,
      // they floated on the grass).
      if (Math.hypot(x - BRIDGE_AT[0], z - BRIDGE_AT[1]) < 32) continue;
      lightPts.push(x, height(x, z) + 0.08, z);
      lightSeed.push(rand(i * 5.7 + k));
    }
  });
  const lightGeo = new BufferGeometry();
  lightGeo.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(lightPts), 3)
  );
  lightGeo.setAttribute(
    'aSeed',
    new BufferAttribute(new Float32Array(lightSeed), 1)
  );
  const townLights = new Points(
    lightGeo,
    new ShaderMaterial({
      vertexShader: lightsVertex,
      fragmentShader: lightsFragment,
      uniforms: {
        uTime: { value: 0 },
        uOn: { value: 0 },
        uPx: { value: 260 },
        uColor: { value: new Color('#ffcf8a') },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
  );
  townLights.frustumCulled = false;
  group.add(townLights);
  disposables.push(lightGeo, townLights.material as ShaderMaterial);

  // The cars on I-15.
  const road = I15.map(([x, z]) => new Vector2(x, z)),
    len = [0];
  for (let i = 1; i < road.length; i++)
    len.push(len[i - 1] + road[i].distanceTo(road[i - 1]));
  const cars = 520,
    carGeo = new BufferGeometry();
  carGeo.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(cars * 3), 3)
  );
  carGeo.setAttribute(
    'aSeed',
    new BufferAttribute(
      new Float32Array(cars).map((_, i) => rand(i * 3.7)),
      1
    )
  );
  carGeo.setAttribute(
    'aWay',
    new BufferAttribute(
      new Float32Array(cars).map((_, i) => (i % 2 ? 1 : -1)),
      1
    )
  );
  const traffic = new Points(
    carGeo,
    new ShaderMaterial({
      vertexShader: carsVertex,
      fragmentShader: carsFragment,
      uniforms: {
        uRoad: { value: road },
        uLen: { value: len },
        uTotal: { value: len[len.length - 1] },
        uTime: { value: 0 },
        uPx: { value: 120 },
        uOn: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
  );
  traffic.frustumCulled = false;
  group.add(traffic);
  disposables.push(carGeo, traffic.material as ShaderMaterial);

  // The listings, as the marketplace's map shows them (2026-11-20, the
  // user's calls: pins scattered everywhere read as nothing in particular;
  // then bare prices, as not saying what was for sale): over each town a
  // cluster, its count in a dark disc, popping up in a wave out from
  // Pleasant Grove; then, coming down over Lehi, its cluster opening into
  // its listings' cards, each over a business's building. Same size on
  // screen at any distance, over everything, as a map's markers are.
  const wave = new Vector2(...TOWNS[5].at),
    markers: {
      sprite: Sprite;
      at: number;
      size: number;
      kind: 'cluster' | 'card';
    }[] = [];
  const marker = (
    { t, aspect }: { t: CanvasTexture; aspect: number },
    x: number,
    y: number,
    z: number,
    at: number,
    kind: 'cluster' | 'card'
  ) => {
    const m = new SpriteMaterial({
      map: t,
      sizeAttenuation: false,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0,
      // Interface, not scenery: its white stays white.
      toneMapped: false,
    });
    const sp = new Sprite(m);
    sp.position.set(x, y, z);
    sp.center.set(0.5, kind === 'card' ? 0 : 0.5);
    sp.renderOrder = 6;
    sp.userData.aspect = aspect;
    sp.visible = false;
    group.add(sp);
    disposables.push(t, m);
    const size = kind === 'card' ? 0.11 : 0.068;
    markers.push({ sprite: sp, at, size, kind });
  };
  for (const t of TOWNS) {
    const count = CLUSTERS[t.name];
    if (!count) continue;
    marker(
      clusterTexture(count),
      t.at[0],
      height(...t.at) + 2.5,
      t.at[1],
      Math.min(0.8, (wave.distanceTo(new Vector2(...t.at)) / 420) * 0.9),
      'cluster'
    );
  }

  // The buildings: Lehi's round Bridge's office (lehi.ts: Spaces, his
  // window lit on its west face, its garage, the hotel, the offices along
  // Innovation Way, the townhouses) and BYU's campus (its buildings' parts
  // and the plant on their roofs; the Marriott Center and the stadium came
  // out: the user's call, only its buildings). Each place one instanced
  // mesh in their shader (valleyBuildings.ts). (No parking lots as slabs:
  // they flickered against the ground, 2026-11-20; the lots are painted.)
  const offices = buildingsMesh(lehi, {
    floor: FLOOR_H,
    unit: LEHI_UNIT,
    ceil: lehiShadows,
    area: LEHI_AREA,
    haze: HAZE,
    his: HIS_WINDOW,
    hisTop: OFFICE_TOP,
    dark: true,
  });
  const campus = buildingsMesh(boxes, {
    floor: CAMPUS_FLOOR,
    unit: 1,
    ceil: shadows,
    area: CAMPUS_AREA,
    haze: HAZE,
  });
  // Lehi's parked cars, in its lots and on its garages' decks.
  const parked = parkedCarsMesh(lehiCars(lehi), {
    ceil: lehiShadows,
    area: LEHI_AREA,
    haze: HAZE,
  });
  for (const m of [offices, campus, parked]) {
    group.add(m);
    disposables.push(m.geometry, m.material as ShaderMaterial);
  }
  // His office, behind his window (the offices' shader cuts its glass;
  // RoomScene draws Bridge's office into it).
  const office = buildHisOffice(lehi.find((b) => b.building === 0)!.ground);
  group.add(office.group);
  disposables.push(...office.disposables);

  // Lehi's listings' cards, over four of its offices round Bridge's (any
  // will do, the user's call), one in each quarter, the nearest there past
  // its own lot, so they stand apart; one after another.
  const tops = LEHI_BUILDINGS.map((b, i) => ({
    b,
    top: Math.max(
      ...lehi.filter((x) => x.building === i && x.part).map((x) => x.y + x.h)
    ),
  })).filter(({ b }) => b.use === 'office');
  [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ].forEach(([sx, sz], i) => {
    const off = (o: { b: { x: number; z: number } }) =>
      Math.hypot(o.b.x - BRIDGE_AT[0], o.b.z - BRIDGE_AT[1]);
    const o = tops
      .filter(
        (o) =>
          Math.sign(o.b.x - BRIDGE_AT[0]) === sx &&
          Math.sign(o.b.z - BRIDGE_AT[1]) === sz &&
          off(o) > 8
      )
      .sort((a, b) => off(a) - off(b))[0];
    if (o)
      marker(
        cardTexture(CARDS[i]),
        o.b.x,
        o.top + 0.15,
        o.b.z,
        i * 0.14,
        'card'
      );
  });

  // The clouds, high, off to the sides of the way.
  const cloudTex = puff();
  disposables.push(cloudTex);
  const clouds: Sprite[] = [];
  const cloud = (x: number, y: number, z: number, s: number, o: number) => {
    const m = new SpriteMaterial({
      map: cloudTex,
      color: '#fff0e2',
      transparent: true,
      opacity: o,
      depthWrite: false,
    });
    const sp = new Sprite(m);
    sp.position.set(x, y, z);
    sp.scale.set(s, s * 0.55, 1);
    sp.renderOrder = 3;
    clouds.push(sp);
    group.add(sp);
    disposables.push(m);
  };
  for (let i = 0; i < 30; i++) {
    const t = rand(i * 2.3),
      side = (rand(i * 7.1) < 0.5 ? -1 : 1) * (70 + rand(i * 5.9) * 120);
    cloud(
      -20 - t * 170 + side,
      135 + rand(i * 1.9) * 45,
      -30 - t * 420 + side * 0.3,
      60 + rand(i * 3.7) * 70,
      0.5
    );
  }

  // The towns' names, as on a map.
  const labels: Sprite[] = [];
  const named = [
    ...TOWNS.filter((t) => t.label).map((t) => ({
      text: t.name,
      at: t.at,
      size: 0.03,
    })),
    {
      text: 'Utah Lake',
      at: [-15 * 20, -6 * 20] as [number, number],
      size: 0.03,
    },
    { text: 'BYU', at: CAMPUS, size: 0.034 },
  ];
  for (const n of named) {
    const { t, aspect } = label(n.text);
    const m = new SpriteMaterial({
      map: t,
      sizeAttenuation: false,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    const sp = new Sprite(m);
    sp.position.set(n.at[0], height(...n.at) + 2, n.at[1]);
    sp.scale.set(n.size * aspect, n.size, 1);
    // A town's name over its cluster (they'd overlap, both at its centre).
    if (CLUSTERS[n.text]) sp.center.set(0.5, -1.25);
    sp.renderOrder = 4;
    sp.userData.campus = n.text === 'BYU';
    labels.push(sp);
    group.add(sp);
    disposables.push(t, m);
  }

  return {
    group,
    sky,
    townLights,
    traffic,
    markers,
    offices,
    campus,
    office,
    labels,
    clouds,
    disposables,
  };
}

/** Per frame: the sky round the camera (`eye`, in the valley's frame),
 *  the time, and how far along the lights, the listings and the labels
 *  are. */
function update(
  parts: ReturnType<typeof build>,
  fb: ReturnType<typeof flyBeats>,
  time: number,
  px: number,
  reduced: boolean,
  eye: Vector3
) {
  parts.sky.position.copy(eye);
  const tl = parts.townLights.material as ShaderMaterial,
    tr = parts.traffic.material as ShaderMaterial,
    bl = parts.offices.material as ShaderMaterial;
  tl.uniforms.uTime.value = time;
  tl.uniforms.uOn.value = fb.dusk;
  tl.uniforms.uPx.value = 0.18 * px;
  tr.uniforms.uTime.value = time;
  tr.uniforms.uOn.value = 0.4 + 0.6 * fb.dusk;
  tr.uniforms.uPx.value = 0.1 * px;
  // The markers: each pops up at its moment (a little overshoot), Lehi's
  // cluster gives way to its prices, and all go as it comes down to his
  // window.
  for (const { sprite, at, size, kind } of parts.markers) {
    const lehi = kind === 'cluster' && sprite.position.z < -400,
      p = kind === 'card' ? fb.split : fb.pins,
      t = reduced
        ? p > at
          ? 1
          : 0
        : Math.min(1, Math.max(0, (p - at) / 0.08)),
      pop = reduced ? 1 : t * (1 + 0.25 * Math.sin(t * Math.PI)),
      // The cards stay a little longer than the clusters, till just
      // before his window.
      o =
        t *
        (kind === 'card'
          ? 1 - MathUtils.smoothstep(fb.window, 0.45, 0.75)
          : 1 - fb.window) *
        (lehi ? 1 - fb.split : 1);
    sprite.visible = o > 0.01;
    (sprite.material as SpriteMaterial).opacity = o;
    sprite.scale.set(size * sprite.userData.aspect * pop, size * pop, 1);
  }
  bl.uniforms.uOn.value = 0.3 + 0.7 * fb.dusk;
  (parts.campus.material as ShaderMaterial).uniforms.uOn.value = fb.dusk;
  for (const l of parts.labels)
    (l.material as SpriteMaterial).opacity = l.userData.campus
      ? fb.campus
      : fb.labels;
}

export function ValleyScene({
  fly,
  reduced,
  officeRef,
}: {
  /** 0..1 through the way into chapter 4. */
  fly: RefObject<number>;
  reduced: boolean;
  /** His window and the office's place behind it, for RoomScene to draw
   *  Bridge's office into (hisOffice.ts). */
  officeRef: RefObject<HisOffice | null>;
}) {
  const parts = useMemo(() => build(), []);
  useEffect(() => () => parts.disposables.forEach((d) => d.dispose()), [parts]);
  useEffect(() => {
    officeRef.current = parts.office;
    return () => {
      officeRef.current = null;
    };
  }, [parts, officeRef]);
  const root = useRef<Group>(null),
    time = useRef(0),
    inv = useMemo(() => new Matrix4(), []),
    tmp = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }, dt) => {
    const g = root.current;
    if (!g || !shown(g)) return;
    if (!reduced) time.current += Math.min(dt, 0.05);
    inv.copy(g.matrixWorld).invert();
    update(
      parts,
      flyBeats(fly.current ?? 0),
      time.current,
      size.height * Math.min(devicePixelRatio, 1.75),
      reduced,
      tmp.copy(camera.position).applyMatrix4(inv)
    );
  });
  return (
    <group ref={root}>
      <primitive object={parts.group} />
    </group>
  );
}
