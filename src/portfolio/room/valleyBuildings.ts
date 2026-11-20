import {
  BoxGeometry,
  DataTexture,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  Quaternion,
  RedFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
  Vector4,
} from 'three';
import type { Box } from './valley';
import { CAR } from './lehi';
import { LIGHT, SKY, SUN } from './valleyLight';

/**
 * The valley flight's buildings (valley.ts boxesOf: BYU's campus; lehi.ts:
 * round Bridge's office): every box a part of a building or the plant on
 * its roof, one instanced mesh a place, in their own shader, and their
 * shadows in the low sun from one map of heights.
 */

/** A square of the valley (units): west edge, north edge, size. */
export type Area = { x: number; z: number; size: number };

// The shadow heights: at each point of a place, the height under which
// the low sun is blocked there (the tallest of the boxes toward the sun,
// lower the farther off it is). Drawn once (shadowHeights); the ground's
// shader reads them too.
export const SHADE_AT = /* glsl */ `
uniform sampler2D uCeil;
uniform vec3 uCeilBox; // its square: west edge, north edge, size
uniform float uCeilMax;
float ceilAt(vec2 q) {
  vec2 u = (q - uCeilBox.xy) / uCeilBox.z;
  return all(greaterThan(u, vec2(0.0))) && all(lessThan(u, vec2(1.0))) ? texture2D(uCeil, u).r * uCeilMax : 0.0;
}`;
export const CEIL_MAX = 3;

const SKINS = [
  'ribbon',
  'punched',
  'precast',
  'glass',
  'plant',
  'curtain',
  'panel',
  'darkbrick',
  'garage',
  'siding',
];
const ROOFS = [
  'white',
  'grey',
  'gravel',
  'teal',
  'skylight',
  'unit',
  'deck',
  'shingle',
];

const vertex = /* glsl */ `
attribute vec4 aLook; // skin, roof, seed, the ground's height
varying vec3 vWorld, vP, vNormal, vLocal, vHalf, vNl;
varying vec2 vAx, vDir;
varying vec4 vLook;
void main() {
  vLook = aLook;
  // Its box's half size and the point in it (the unit box stands on y = 0;
  // the instance scales it, turns it about the vertical and moves it).
  vec3 ax = instanceMatrix[0].xyz, ay = instanceMatrix[1].xyz, az = instanceMatrix[2].xyz;
  vec3 s = vec3(length(ax), length(ay), length(az));
  vHalf = s * 0.5;
  vLocal = (position - vec3(0.0, 0.5, 0.0)) * s;
  vNl = normal;
  vec4 p = instanceMatrix * vec4(position, 1.0);
  vP = p.xyz;
  // The point along the box's own axes (so a turned building's windows
  // run along its walls), and its own x axis in the valley's x, z.
  vAx = vec2(dot(p.xyz, ax / s.x), dot(p.xyz, az / s.z));
  vDir = ax.xz / s.x;
  vNormal = normalize(mat3(modelMatrix) * (mat3(instanceMatrix) * normal));
  vec4 w = modelMatrix * p;
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// Its walls by its skin (a pane's width, the glass's band up each floor,
// how much of a pane is glass), its floors counted from the ground; its
// roof by its kind, a capped parapet round it. Lengths in uUnit (the
// campus's 1; Lehi, drawn larger, more). His window, on Bridge's building:
// a lamp-lit room, his monitor's cool light.
const fragment = /* glsl */ `
uniform float uFloor, uHaze, uOn, uUnit;
uniform vec4 uHis; // his window (the valley's frame); w: 1 where it is
// 1: its glass dark, the sky and the ground in it unlit by the sun (Lehi's;
// lit as the walls are, it read as tan); 0, the campus's as it was.
uniform float uDark;
${SKY}
${SHADE_AT}
varying vec3 vWorld, vP, vNormal, vLocal, vHalf, vNl;
varying vec2 vAx, vDir;
varying vec4 vLook;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), u.x), u.y);
}
// How much of a pattern with cells a unit of x still shows: 1 near, 0
// where a cell is under a pixel (there it averages instead of shimmering).
float detail(float x) { return 1.0 - smoothstep(0.3, 0.75, fwidth(x)); }
// A line at every whole x, w its half width (in x), smoothed, faded far off.
float line(float x, float w) {
  float d = abs(fract(x - 0.5) - 0.5), f = fwidth(x);
  return (1.0 - smoothstep(w - f, w + f, d)) * (1.0 - smoothstep(0.15, 0.5, f));
}
// 1 where a <= x <= b, its edges smoothed over a pixel.
float span(float x, float a, float b) {
  float f = fwidth(x);
  return smoothstep(a - f, a + f, x) * (1.0 - smoothstep(b - f, b + f, x));
}
// A parked car's colour (the garages' open decks).
vec3 carColour(float h) {
  return h < 0.3 ? vec3(0.86, 0.86, 0.84) : h < 0.5 ? vec3(0.6, 0.62, 0.64) : h < 0.68 ? vec3(0.07, 0.07, 0.08)
    : h < 0.8 ? vec3(0.32, 0.33, 0.35) : h < 0.9 ? vec3(0.45, 0.07, 0.05) : vec3(0.1, 0.17, 0.38);
}
// On a garage's top deck (q along its rows and across them, from its
// centre; ha, hc their half lengths): 1 within the footprint of a car
// parked there. Its stalls and which are taken as lehi.ts lays them out
// (deckTaken: whole numbers, so both agree).
float deckCar(vec2 q, float ha, float hc, float sw, float sd, float per, float s) {
  float y = q.y + hc - 0.12 * uUnit, m = floor(y / per), r = y - m * per;
  float y0 = -hc + 0.12 * uUnit + m * per, k = floor(q.x / sw);
  if (m < 0.0 || r >= 2.0 * sd || y0 + 2.0 * sd > hc - 0.05) return 0.0;
  if (k < ceil((0.1 - ha) / sw) || k > floor((ha - 0.1) / sw) - 1.0) return 0.0;
  float j = m * 2.0 + step(sd, r);
  if (mod(k * k * 3.0 + k * 11.0 + j * 17.0 + s, 23.0) >= 16.0) return 0.0;
  vec2 d = abs(q - vec2((k + 0.5) * sw, y0 + (j - m * 2.0) * sd + sd * 0.5));
  return (1.0 - smoothstep(${(CAR.w / 2 - 0.012).toFixed(3)}, ${(CAR.w / 2).toFixed(3)}, d.x)) * (1.0 - smoothstep(${(CAR.l / 2 - 0.02).toFixed(3)}, ${(CAR.l / 2).toFixed(3)}, d.y));
}
void main() {
  vec3 n = normalize(vNormal), ln = n;
  int skin = int(vLook.x + 0.5), roofK = int(vLook.y + 0.5);
  float seed = vLook.z, ground = vLook.w, U = uUnit;
  vec3 v = normalize(cameraPosition - vWorld);
  // The brick tan to buff, building by building; the precast pale; the
  // glass's frames grey; the plant's metal; Lehi's: the curtain wall's
  // dark spandrels, silver panels, dark brick, a garage's concrete, a
  // house's siding.
  vec3 brick = mix(vec3(0.52, 0.38, 0.23), vec3(0.62, 0.49, 0.32), fract(seed * 3.7)) * (0.95 + 0.1 * fract(seed * 11.3));
  vec3 wall = skin == 2 ? vec3(0.76, 0.73, 0.67) : skin == 3 ? vec3(0.52, 0.54, 0.56) : skin == 4 ? vec3(0.66, 0.67, 0.68)
    : skin == 5 ? vec3(0.16, 0.17, 0.19) : skin == 6 ? vec3(0.64, 0.66, 0.69) : skin == 7 ? vec3(0.21, 0.18, 0.16)
    : skin == 8 ? vec3(0.62, 0.61, 0.58) : skin == 9 ? vec3(0.74, 0.69, 0.6) : brick;
  vec3 cope = mix(wall, vec3(0.86, 0.85, 0.82), skin == 5 || skin == 7 ? 0.8 : 0.5);
  vec3 c, emit = vec3(0.0), spec = vec3(0.0);
  float ao = 1.0;
  if (abs(n.y) < 0.5) {
    float along = abs(vNl.x) > 0.5 ? vAx.y : vAx.x;
    float fl = (vP.y - ground) / uFloor, row = fract(fl);
    if (skin == 4) {
      // The plant's louvres.
      c = wall * (1.0 - 0.18 * line(vP.y / (0.014 * U), 0.2));
    } else if (skin == 6) {
      // Silver panels, their joints.
      c = wall * (1.0 - 0.16 * max(line(fl * 3.0, 0.03), line(along / (uFloor * 0.9), 0.025)));
    } else {
      // Its windows: their width along the wall (a pane), the glass's band
      // up each floor, and how much of a pane is glass (strip windows run
      // on, mullions between; punched ones stand apart in the brick).
      float pw = 0.07, bottom = 0.38, top = 0.8, half_ = 0.42;
      if (skin == 1) { pw = 0.06; bottom = 0.3; top = 0.8; half_ = 0.27; }
      else if (skin == 2) { pw = 0.07; bottom = 0.44; top = 0.84; half_ = 0.42; }
      else if (skin == 3) { pw = 0.05; bottom = 0.1; top = 0.95; half_ = 0.46; }
      else if (skin == 5) { pw = 0.058; bottom = 0.16; top = 0.93; half_ = 0.47; }
      else if (skin == 7) { pw = 0.085; bottom = 0.2; top = 0.86; half_ = 0.36; }
      else if (skin == 8) { pw = 0.14; bottom = 0.3; top = 0.88; half_ = 0.44; }
      else if (skin == 9) { pw = 0.1; bottom = 0.4; top = 0.75; half_ = 0.17; }
      pw *= U;
      // Bridge's ground floor: shop-front glass, taller, the lobby lit.
      bool lobby = skin == 5 && fl < 1.0;
      if (lobby) { bottom = 0.08; top = 0.86; }
      float pane = along / pw;
      float fp = fwidth(pane), ff = fwidth(fl);
      float band = smoothstep(bottom - ff, bottom + ff, row) * (1.0 - smoothstep(top - ff, top + ff, row));
      float col = 1.0 - smoothstep(half_ - fp, half_ + fp, abs(fract(pane) - 0.5));
      // Far off, where the panes are under a pixel, their average along
      // the floor (the windows still read as bands, as from the air);
      // where the floors are too, the wall's average (or it shimmers).
      float dp = detail(pane), df = detail(fl);
      float glassA = mix(half_ * 2.0, col, dp) * mix(top - bottom, band, df);
      float fres = pow(1.0 - abs(dot(v, n)), 3.0);
      vec3 r = reflect(-v, n);
      vec3 glass = mix(vec3(0.05, 0.07, 0.1), skyAt(r), 0.22 + 0.6 * fres);
      vec2 cell = vec2(floor(pane), floor(fl));
      if (uDark > 0.5 && skin != 8) {
        // Dark glass, a little different pane to pane; in it the sky, or
        // looking down, the far ground under the horizon's glow; the sun's
        // glint where it's mirrored. Added after the light.
        vec3 far_ = r.y >= 0.0 ? skyAt(r) : mix(skyAt(vec3(r.x, 0.0, r.z)) * 0.55, vec3(0.2, 0.19, 0.16), smoothstep(0.0, -0.5, r.y));
        spec = (far_ * (0.12 + 0.7 * fres) + uSunColor * pow(max(dot(r, uSun), 0.0), 300.0) * 3.0) * (0.85 + 0.3 * hash(cell + 0.37) * dp);
        glass = vec3(0.025, 0.03, 0.04);
      }
      if (skin == 8) {
        // A garage's open decks: dark, a car's colour here and there.
        float h = hash(cell + seed * 5.0);
        float car = span(row, bottom, bottom + (top - bottom) * 0.4) * step(0.35, h) * dp * df;
        glass = mix(vec3(0.06, 0.06, 0.07), carColour(hash(cell + 2.7)) * 0.55, car);
      }
      if (lobby) {
        glass = mix(glass, vec3(0.5, 0.42, 0.32), 0.5);
        emit += vec3(1.0, 0.78, 0.55) * 0.07 * glassA;
        spec *= 0.5;
      }
      // Some rooms lit as the light goes.
      float lit = skin == 8 || lobby ? 0.0 : step(uDark > 0.5 ? 0.86 : 0.8, hash(cell + seed * 17.0)) * uOn * dp * df;
      glass *= 1.0 - 0.5 * lit;
      vec3 room = vec3(1.0, 0.62, 0.3) * 0.26;
      if (uDark > 0.5) {
        // Lehi's lit rooms read as rooms: their ceiling lights bright at
        // the top, desks and chairs dark along the bottom.
        float up = clamp((row - bottom) / (top - bottom), 0.0, 1.0);
        room = vec3(1.0, 0.8, 0.56) * 0.3 * (0.45 + 0.75 * smoothstep(0.2, 1.0, up)) * (1.0 - 0.55 * (1.0 - smoothstep(0.18, 0.3, up)));
      }
      emit += room * lit * (1.0 - fres) * glassA;
      spec *= glassA * (1.0 - 0.6 * lit);
      c = mix(wall * 0.86, glass, glassA);
      if (skin == 5 && uHis.w > 0.5) {
        // His window: three panes on the third floor, uHis in the middle
        // one's centre. Their glass is cut away: behind it is his office,
        // a room of its own (hisOffice.ts), white, lit (2026-11-20, the
        // user's call: a flat lamp-lit picture with a phone-like monitor
        // read as nothing; the office the story goes into next is white).
        // Its light on the wall round it.
        float hp = floor(uHis.z / pw), hf = floor((uHis.y - ground) / uFloor);
        bool face = n.x < -0.5;
        float near_ = face ? 1.0 - smoothstep(0.0, 1.6, length(vec2(along - (hp + 0.5) * pw, vP.y - ground - (hf + 0.55) * uFloor) / vec2(pw * 1.8, uFloor * 0.6))) : 0.0;
        emit += vec3(1.0, 0.86, 0.68) * 0.1 * near_ * near_;
        // One wide pane, no mullions across it (they cut the whiteboard's
        // writing); its frame round it.
        if (face && cell.y == hf && band > 0.5 && abs(along - (hp + 0.5) * pw) < (1.5 - (0.5 - half_)) * pw) discard;
      }
    }
    // Its cap along the top; a little darker toward the ground.
    float t = vHalf.y - vLocal.y, ft = fwidth(t);
    c = mix(c, cope, 1.0 - smoothstep(0.016 * U - ft, 0.016 * U + ft, t));
    ao = 0.84 + 0.16 * smoothstep(0.0, 0.3 * U, vP.y - ground);
  } else if (n.y > 0.5) {
    // How far in from its edge.
    float e = min(vHalf.x - abs(vLocal.x), vHalf.z - abs(vLocal.z)), fe = fwidth(e);
    float rim = 1.0 - smoothstep(0.03 * U - fe, 0.03 * U + fe, e);
    if (roofK == 4) {
      // A skylight: glass in a grid of frames, the sky in it; lit within
      // as the light goes.
      float fres = pow(1.0 - abs(v.y), 3.0);
      vec3 glass = mix(vec3(0.06, 0.08, 0.11), skyAt(reflect(-v, n)), 0.3 + 0.6 * fres);
      float frames = max(line(vAx.x / (0.08 * U), 0.1), line(vAx.y / (0.16 * U), 0.06));
      vec3 frame = vec3(0.72, 0.72, 0.7);
      c = mix(glass, frame, max(frames, rim));
      c = mix(c, mix(glass, frame, 0.18), 1.0 - detail(vAx.x / (0.08 * U)));
      emit = vec3(1.0, 0.7, 0.4) * 0.14 * uOn * (1.0 - rim);
    } else if (roofK == 5) {
      // A unit's top: its fans, one or two.
      vec3 top = vec3(0.74, 0.75, 0.76);
      bool two = vHalf.x > vHalf.z * 1.4;
      vec2 q = vec2(two ? abs(vLocal.x) - vHalf.x * 0.5 : vLocal.x, vLocal.z);
      float r = (two ? min(vHalf.x * 0.5, vHalf.z) : min(vHalf.x, vHalf.z)) * 0.62;
      float d = length(q), fd = fwidth(d);
      c = mix(top, vec3(0.28, 0.29, 0.3), 1.0 - smoothstep(r - fd, r + fd, d));
    } else if (roofK == 6) {
      // A garage's top deck: concrete, stalls in rows back to back, aisles
      // between, their stripes; the cars parked in them are their own
      // (lehi.ts lehiCars), and here their long shadows: is a car in the
      // way toward the sun? (2026-11-20: painted, the cars were flat.)
      bool lx = vHalf.x >= vHalf.z;
      vec2 q = lx ? vLocal.xz : vLocal.zx;
      float ha = lx ? vHalf.x : vHalf.z, hc = lx ? vHalf.z : vHalf.x;
      float sw = 0.094 * U, sd = 0.19 * U, per = 2.0 * sd + 0.25 * U;
      float r = mod(q.y + hc - 0.12 * U, per);
      float inRow = span(r, 0.0, 2.0 * sd);
      vec3 deck = vec3(0.6, 0.6, 0.58);
      vec3 near_ = mix(deck, vec3(0.92), inRow * line(q.x / sw, 0.04) * 0.7);
      vec2 sun = normalize(uSun.xz), sl = vec2(dot(sun, vDir), dot(sun, vec2(-vDir.y, vDir.x)));
      if (!lx) sl = sl.yx;
      float s = floor(seed * 23.0), sh = 0.0;
      for (int i = 1; i < 5; i++) {
        float t = float(i) * 0.12;
        sh = max(sh, deckCar(q + sl * t, ha, hc, sw, sd, per, s) * (1.0 - t / 0.62));
      }
      near_ *= 1.0 - 0.5 * sh;
      c = mix(mix(deck, vec3(0.5), 0.15), near_, detail(q.x / sw));
      c = mix(c, cope, rim);
    } else if (roofK == 7) {
      // A house's shingles, its ridge along it, each side lit as it faces
      // the sun (the roof is flat; its light is a pitched roof's).
      bool lx = vHalf.x >= vHalf.z;
      float across = lx ? vLocal.z : vLocal.x;
      vec2 dir = (lx ? vec2(-vDir.y, vDir.x) : vDir) * sign(across);
      ln = normalize(vec3(dir.x * 0.6, 1.0, dir.y * 0.6));
      vec3 sh = vec3(0.34, 0.32, 0.31) * (1.0 - 0.08 * line(across / (0.02 * U), 0.2));
      c = mix(sh, sh * 0.7, 1.0 - smoothstep(0.008 * U, 0.02 * U, abs(across)));
    } else {
      vec3 roof = roofK == 0 ? vec3(0.8, 0.82, 0.83) : roofK == 1 ? vec3(0.62, 0.63, 0.62) : roofK == 2 ? vec3(0.6, 0.56, 0.5) : vec3(0.3, 0.5, 0.48);
      if (roofK == 0) roof *= 1.0 - 0.05 * line(vAx.y / (0.055 * U), 0.07);
      else if (roofK == 3) roof *= 1.0 + 0.12 * line(vAx.x / (0.035 * U), 0.12);
      else {
        float k = (roofK == 2 ? 9.0 : 4.0) / U;
        roof *= mix(1.0, 0.93 + 0.14 * vnoise(vAx * k), detail(vAx.x * k));
      }
      // Darker just inside the parapet, its shade.
      roof *= 1.0 - 0.12 * (1.0 - smoothstep(0.03 * U, 0.07 * U, e));
      c = mix(roof, cope, rim);
    }
  } else c = wall * 0.5;
  // The low sun, and the shadows of the boxes toward it (walls sampled just
  // outside themselves; faces turned from the sun are dim already).
  float ndl = max(dot(ln, uSun), 0.0);
  vec2 q = vP.xz + (abs(n.y) < 0.5 ? n.xz * 0.06 * U : vec2(0.0));
  float shade = smoothstep(0.012, 0.035, ceilAt(q) - vP.y) * smoothstep(0.0, 0.08, ndl);
  c = c * (uAmbient * 0.8 * ao + uSunColor * (0.35 + 1.1 * ndl) * (1.0 - 0.7 * shade)) + emit + spec;
  float d = length(cameraPosition - vWorld);
  c = mix(c, skyAt(normalize(vec3(-v.x, 0.04, -v.z))), (1.0 - exp(-d * uHaze)) * 0.75);
  // (three's ACES curve lifts its input 1/0.6: these colours are the
  // valley's own, so they are taken back down first.)
  gl_FragColor = vec4(c * 0.62, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** A place's shadows in the low sun, as heights: over `area`, at each of
 *  n x n texels the height under which the sun is blocked there, the
 *  highest of every box toward the sun (its top, less the sun's rise over
 *  the way from it: 12 degrees up, a fifth of a unit per unit). The
 *  terrain's shader shades its ground under it, the buildings' their walls
 *  and roofs: on the campus the Kimball Tower's shadow crosses the Tanner
 *  Building's roof, a plant room's its own. (Before 2026-11-20, each
 *  building's outline swept away from the sun on a canvas, for the ground
 *  only.) */
export function shadowHeights(boxes: Box[], area: Area, n: number) {
  const k = area.size / n,
    f = new Float32Array(n * n),
    l = Math.hypot(SUN.x, SUN.z),
    ux = SUN.x / l,
    uz = SUN.z / l,
    tanE = SUN.y / l;
  const cell = (v: number) => Math.min(n - 1, Math.max(0, Math.floor(v / k)));
  for (const b of boxes) {
    // Its own axes in the valley's x, z (three turns +x toward -z).
    const cos = Math.cos(b.rot),
      sin = Math.sin(b.rot),
      hw = b.w / 2,
      hd = b.d / 2,
      top = b.y + b.h,
      // How far from it its shadow reaches the ground.
      reach = Math.max(0, top - b.ground) / tanE,
      ex = Math.abs(cos) * hw + Math.abs(sin) * hd,
      ez = Math.abs(sin) * hw + Math.abs(cos) * hd,
      // Toward the sun, in its own frame.
      dl = ux * cos - uz * sin,
      dm = ux * sin + uz * cos,
      i0 = cell(Math.min(b.x - ex, b.x - ex - ux * reach) - area.x),
      i1 = cell(Math.max(b.x + ex, b.x + ex - ux * reach) - area.x),
      j0 = cell(Math.min(b.z - ez, b.z - ez - uz * reach) - area.z),
      j1 = cell(Math.max(b.z + ez, b.z + ez - uz * reach) - area.z);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        // From this texel toward the sun: where does it enter the box's
        // footprint?
        const rx = area.x + (i + 0.5) * k - b.x,
          rz = area.z + (j + 0.5) * k - b.z,
          lx = rx * cos - rz * sin,
          lz = rx * sin + rz * cos;
        let tin = 0,
          tout = Infinity;
        if (Math.abs(dl) < 1e-9) {
          if (Math.abs(lx) > hw) continue;
        } else {
          let a = (-hw - lx) / dl,
            c = (hw - lx) / dl;
          if (a > c) [a, c] = [c, a];
          tin = Math.max(tin, a);
          tout = Math.min(tout, c);
        }
        if (Math.abs(dm) < 1e-9) {
          if (Math.abs(lz) > hd) continue;
        } else {
          let a = (-hd - lz) / dm,
            c = (hd - lz) / dm;
          if (a > c) [a, c] = [c, a];
          tin = Math.max(tin, a);
          tout = Math.min(tout, c);
        }
        if (tin > tout) continue;
        const h = top - tin * tanE,
          at = j * n + i;
        if (h > f[at]) f[at] = h;
      }
  }
  const data = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++)
    data[i] = Math.round(Math.min(1, f[i] / CEIL_MAX) * 255);
  const t = new DataTexture(data, n, n, RedFormat, UnsignedByteType);
  t.magFilter = t.minFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}

export const ceilUniforms = (t: DataTexture, area: Area) => ({
  uCeil: { value: t },
  uCeilBox: { value: new Vector3(area.x, area.z, area.size) },
  uCeilMax: { value: CEIL_MAX },
});

/** A place's buildings, one instanced mesh: `floor` units a floor, its
 *  lengths in `unit`, its shadows' heights `ceil` over `area`; `his`, his
 *  window, where it is. */
export function buildingsMesh(
  boxes: Box[],
  {
    floor,
    unit,
    ceil,
    area,
    haze,
    his,
    dark = false,
  }: {
    floor: number;
    unit: number;
    ceil: DataTexture;
    area: Area;
    haze: number;
    his?: [number, number, number];
    dark?: boolean;
  }
) {
  const geo = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  geo.setAttribute(
    'aLook',
    new InstancedBufferAttribute(
      new Float32Array(
        boxes.flatMap((b) => [
          SKINS.indexOf(b.skin),
          ROOFS.indexOf(b.roof),
          b.seed,
          b.ground,
        ])
      ),
      4
    )
  );
  const mesh = new InstancedMesh(
    geo,
    new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        ...LIGHT,
        ...ceilUniforms(ceil, area),
        uFloor: { value: floor },
        uUnit: { value: unit },
        uHaze: { value: haze },
        uOn: { value: 0 },
        uHis: { value: his ? new Vector4(...his, 1) : new Vector4() },
        uDark: { value: dark ? 1 : 0 },
      },
    }),
    boxes.length
  );
  const up = new Vector3(0, 1, 0),
    q = new Quaternion(),
    m = new Matrix4();
  boxes.forEach((b, i) =>
    mesh.setMatrixAt(
      i,
      m.compose(
        new Vector3(b.x, b.y, b.z),
        q.setFromAxisAngle(up, b.rot),
        new Vector3(b.w, b.h, b.d)
      )
    )
  );
  mesh.frustumCulled = false;
  return mesh;
}
