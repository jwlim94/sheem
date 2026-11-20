import { CanvasTexture, SRGBColorSpace } from 'three';
import { BRIDGE_AT, CAMPUS } from './valley';
import type { Box } from './valley';
import { CAR, LOTS, lotStalls, POOL, ROADS, SR92, STALL, TRAILS } from './lehi';
import type { Area } from './valleyBuildings';
import { rand, SUN } from './valleyLight';

/**
 * The valley flight's painted grounds: BYU's campus's and Lehi's round
 * Bridge's office, each a canvas over its square, mipmapped, laid over the
 * terrain where its alpha is (the terrain's own pattern under the rest).
 * Flat, so nothing stands off the ground to flicker.
 */

/** The way away from the low sun (x, z), for the trees' and cars'
 *  shadows. */
const sl = Math.hypot(SUN.x, SUN.z),
  AWAY = { x: -SUN.x / sl, z: -SUN.z / sl, ang: Math.atan2(-SUN.z, -SUN.x) };

/** The convex hull of some points (a shape swept away from the sun). */
function hull(pts: [number, number][]) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    cross = (o: number[], a: number[], b: number[]) =>
      (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]),
    lower: [number, number][] = [],
    upper: [number, number][] = [];
  for (const q of p) {
    while (
      lower.length > 1 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0
    )
      lower.pop();
    lower.push(q);
  }
  for (const q of p.reverse()) {
    while (
      upper.length > 1 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0
    )
      upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** BYU's campus's ground, drawn once over `area` (2026-11-20, after an
 *  aerial photo the user sent: from above, the campus is its roofs among
 *  trees, walks and lots, not a lawn ruled in a grid): its ring road and
 *  parking lots (cars in their stalls), its malls, plazas and the walks to
 *  every building, and its trees, each with its long shadow away from the
 *  low sun. Painted (alpha where it's drawn; the lawn under the rest), so
 *  nothing stands off the ground to flicker; mipmapped, so far off it
 *  averages. */
export function drawCampusGround(boxes: Box[], area: Area) {
  const N = 1536,
    k = N / area.size,
    el = document.createElement('canvas');
  el.width = el.height = N;
  const c = el.getContext('2d')!;
  const X = (x: number) => (x - area.x) * k,
    Z = (z: number) => (z - area.z) * k;
  const rect = (x0: number, z0: number, x1: number, z1: number, r = 0) => {
    c.beginPath();
    c.roundRect(X(x0), Z(z0), (x1 - x0) * k, (z1 - z0) * k, r * k);
  };
  // The campus: the park on the map (drawMask's), the buildings' pads.
  const [cx, cz] = [CAMPUS[0] + 2, CAMPUS[1] - 1],
    edge = { x0: cx - 14, x1: cx + 14, z0: cz - 10, z1: cz + 10 };
  const pads = boxes
    .filter((b) => b.part)
    .map((b) => ({
      x0: b.x - b.w / 2,
      x1: b.x + b.w / 2,
      z0: b.z - b.d / 2,
      z1: b.z + b.d / 2,
    }));
  const near = (x: number, z: number, m: number) =>
    pads.some(
      (p) => x > p.x0 - m && x < p.x1 + m && z > p.z0 - m && z < p.z1 + m
    );
  const paving = '#cbc6bb',
    asphalt = '#8d8c8a';

  // The ring road, just inside the campus's edge.
  c.strokeStyle = asphalt;
  c.lineWidth = 0.24 * k;
  rect(edge.x0 + 0.5, edge.z0 + 0.5, edge.x1 - 0.5, edge.z1 - 0.5, 1.2);
  c.stroke();
  // Its parking lots, where they fit clear of the buildings: asphalt, the
  // stalls' lines, and most stalls taken.
  const lots: { x0: number; z0: number; x1: number; z1: number }[] = [];
  for (const [x, z, w, d] of [
    [-10.2, 6.4, 2.6, 2],
    [12.8, -5.6, 3, 1.4],
    [15, 7.4, 2.6, 1.6],
    [-9.6, -8.6, 2.4, 1.8],
    [7.8, -9.4, 2.4, 1.1],
    [0.6, 7.6, 2.6, 1.4],
  ]) {
    const l = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 };
    if (
      pads.some(
        (p) =>
          p.x1 > l.x0 - 0.3 &&
          p.x0 < l.x1 + 0.3 &&
          p.z1 > l.z0 - 0.3 &&
          p.z0 < l.z1 + 0.3
      )
    )
      continue;
    lots.push(l);
    c.fillStyle = '#7d7c79';
    rect(l.x0, l.z0, l.x1, l.z1, 0.08);
    c.fill();
    // Rows of stalls (2.5 m wide, 5 m deep), back to back, aisles between.
    const sw = 0.05,
      sd = 0.1,
      CARS = [
        '#e9e9e6',
        '#c3c5c8',
        '#3b3d42',
        '#8b8f96',
        '#9c3a33',
        '#3c5582',
        '#e9e9e6',
        '#c3c5c8',
      ];
    let i = 0;
    for (let z = l.z0 + 0.1; z + 2 * sd <= l.z1 - 0.1; z += 2 * sd + 0.16)
      for (let x = l.x0 + 0.1; x + sw <= l.x1 - 0.1; x += sw)
        for (const zz of [z, z + sd]) {
          i++;
          c.fillStyle = 'rgba(238, 238, 232, 0.75)';
          c.fillRect(X(x), Z(zz), 0.012 * k, sd * k);
          if (rand(i * 1.37 + x) < 0.72) {
            c.fillStyle = CARS[Math.floor(rand(i * 2.9 + z) * CARS.length)];
            c.fillRect(
              X(x + 0.008),
              Z(zz + 0.015),
              (sw - 0.016) * k,
              (sd - 0.03) * k
            );
          }
        }
  }

  // The malls: east-west north of the library, north-south past it; the
  // plaza between the student centre and the library; diagonal walks.
  c.fillStyle = c.strokeStyle = paving;
  rect(edge.x0 + 1, -1.95, edge.x1 - 1, -1.65);
  c.fill();
  rect(-0.65, edge.z0 + 1, -0.35, edge.z1 - 1);
  c.fill();
  rect(-1.3, -3.4, 0.2, -1.1, 0.1);
  c.fill();
  c.lineCap = 'round';
  c.lineWidth = 0.1 * k;
  for (const [x0, z0, x1, z1] of [
    [-9.5, 6.8, -0.5, -1.8],
    [13, -7.5, -0.5, -1.8],
    [12.6, 6.2, -0.5, -1.8],
    [-9.5, -8, -0.5, -1.8],
  ]) {
    c.beginPath();
    c.moveTo(X(x0), Z(z0));
    c.lineTo(X(x1), Z(z1));
    c.stroke();
  }
  // Every building: a pad of paving round it, a walk to the nearer mall.
  c.lineWidth = 0.08 * k;
  boxes
    .filter((b) => b.part)
    .forEach((b) => {
      rect(
        b.x - b.w / 2 - 0.16,
        b.z - b.d / 2 - 0.16,
        b.x + b.w / 2 + 0.16,
        b.z + b.d / 2 + 0.16,
        0.12
      );
      c.fill();
      c.beginPath();
      c.moveTo(X(b.x), Z(b.z));
      if (Math.abs(b.z + 1.8) < Math.abs(b.x + 0.5)) c.lineTo(X(b.x), Z(-1.8));
      else c.lineTo(X(-0.5), Z(b.z));
      c.stroke();
    });

  // The trees: in clumps over the lawns, in lines along the malls; none on
  // the buildings' pads or the lots. Their shadows first, long and away
  // from the sun, then their crowns, lit on the sun's side.
  const trees: [number, number, number][] = [];
  const lotAt = (x: number, z: number) =>
    lots.some(
      (l) =>
        x > l.x0 - 0.15 && x < l.x1 + 0.15 && z > l.z0 - 0.15 && z < l.z1 + 0.15
    );
  const clump = (x: number, z: number) =>
    Math.sin(x * 0.9 + 1.3) * Math.sin(z * 1.1 - 0.7) +
    Math.sin(x * 2.3 + z * 1.7) * 0.5;
  for (let z = edge.z0 + 0.8; z < edge.z1 - 0.8; z += 0.3)
    for (let x = edge.x0 + 0.8; x < edge.x1 - 0.8; x += 0.3) {
      const s = x * 13.1 + z * 7.7,
        tx = x + (rand(s) - 0.5) * 0.26,
        tz = z + (rand(s + 1) - 0.5) * 0.26;
      if (clump(tx, tz) < 0.1 || near(tx, tz, 0.3) || lotAt(tx, tz)) continue;
      if (Math.abs(tz + 1.8) < 0.3 || Math.abs(tx + 0.5) < 0.3) continue;
      trees.push([tx, tz, 0.12 + rand(s + 2) * 0.1]);
    }
  for (let t = edge.x0 + 1.2; t < edge.x1 - 1.2; t += 0.38)
    for (const side of [-0.32, 0.32])
      if (!near(t, -1.8 + side, 0.2)) trees.push([t, -1.8 + side, 0.13]);
  for (let t = edge.z0 + 1.2; t < edge.z1 - 1.2; t += 0.38)
    for (const side of [-0.32, 0.32])
      if (!near(-0.5 + side, t, 0.2) && !lotAt(-0.5 + side, t))
        trees.push([-0.5 + side, t, 0.13]);
  const { x: ax, z: az, ang } = AWAY;
  c.fillStyle = 'rgba(38, 46, 30, 0.42)';
  for (const [x, z, r] of trees) {
    c.beginPath();
    c.ellipse(
      X(x + ax * r * 1.4),
      Z(z + az * r * 1.4),
      r * 1.9 * k,
      r * 0.85 * k,
      ang,
      0,
      Math.PI * 2
    );
    c.fill();
  }
  const CROWNS = ['#5d7a43', '#58733f', '#647f45', '#4f6b3a', '#6b8148'];
  trees.forEach(([x, z, r], i) => {
    c.fillStyle = CROWNS[i % CROWNS.length];
    c.beginPath();
    c.arc(X(x), Z(z), r * k, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(150, 168, 104, 0.55)';
    c.beginPath();
    c.arc(
      X(x - ax * r * 0.35),
      Z(z - az * r * 0.35),
      r * 0.55 * k,
      0,
      Math.PI * 2
    );
    c.fill();
  });
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  t.flipY = false;
  t.anisotropy = 8;
  return t;
}

/** Lehi's ground round Bridge's office, drawn once over `area`, N px
 *  square (2026-11-20, after the user's satellite view): bare dirt, scrub
 *  and graded pads between; SR-92 with its frontage roads and median;
 *  Triumph Boulevard, its planted median, and the other streets; the
 *  trails; the lots, their stalls and cars; the walks and verges round the
 *  buildings; the hotel's pool. No trees (the user's call for here; and
 *  painted, close to they were flat discs). Its edge fades into the town
 *  round it. Drawn the same over any square of it (each thing at its own
 *  place), so a smaller square, sharper, matches. */
export function drawLehiGround(boxes: Box[], area: Area, N: number) {
  const k = N / area.size,
    el = document.createElement('canvas');
  el.width = el.height = N;
  const c = el.getContext('2d')!;
  // From Bridge's building's centre (units) to the canvas.
  const ox = BRIDGE_AT[0] - area.x,
    oz = BRIDGE_AT[1] - area.z;
  const X = (x: number) => (x + ox) * k,
    Z = (z: number) => (z + oz) * k;
  const path = (pts: [number, number][]) => {
    c.beginPath();
    pts.forEach(([x, z], i) =>
      i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z))
    );
  };
  // A rectangle turned as a building is (three turns +x toward -z: on the
  // canvas, its y south, that's -rot).
  const turned = (
    x: number,
    z: number,
    w: number,
    d: number,
    rot: number,
    r: number,
    draw: () => void
  ) => {
    c.save();
    c.translate(X(x), Z(z));
    c.rotate(-rot);
    c.beginPath();
    c.roundRect((-w / 2) * k, (-d / 2) * k, w * k, d * k, r * k);
    draw();
    c.restore();
  };
  const R = (n: number) => rand(n * 1.913 + 7.7);
  const DIRT = '#bcae90',
    ASPHALT = '#58585b',
    CONCRETE = '#c9c6bd',
    VERGE = '#8d9a68',
    PAINT = 'rgba(240, 240, 232, 0.9)';
  c.lineCap = c.lineJoin = 'round';

  // The bare dirt, blotched lighter and darker; graded pads; scrub; tracks.
  c.fillStyle = DIRT;
  c.fillRect(0, 0, N, N);
  for (let i = 0; i < 260; i++) {
    const x = (R(i) - 0.5) * 64,
      z = (R(i + 500) - 0.5) * 64,
      r = (0.8 + R(i + 900) * 3.2) * k,
      g = c.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), r),
      light = R(i + 1300) < 0.5;
    g.addColorStop(
      0,
      light ? 'rgba(214, 202, 176, 0.3)' : 'rgba(150, 136, 108, 0.16)'
    );
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = g;
    c.fillRect(X(x) - r, Z(z) - r, r * 2, r * 2);
  }
  for (let i = 0; i < 9; i++)
    turned(
      (R(i + 40) - 0.5) * 56,
      (R(i + 60) - 0.5) * 56,
      2 + R(i + 80) * 4,
      1.5 + R(i + 90) * 3,
      R(i + 95) * 0.6 - 0.3,
      0.2,
      () => {
        c.fillStyle = 'rgba(214, 204, 182, 0.55)';
        c.fill();
      }
    );
  for (let i = 0; i < 9000; i++) {
    const x = (R(i + 3000) - 0.5) * 64,
      z = (R(i + 9000) - 0.5) * 64;
    c.fillStyle =
      R(i + 15000) < 0.5
        ? 'rgba(112, 112, 78, 0.38)'
        : 'rgba(134, 122, 90, 0.34)';
    c.beginPath();
    c.arc(X(x), Z(z), (0.02 + R(i + 21000) * 0.035) * k, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = 'rgba(210, 198, 170, 0.6)';
  c.lineWidth = 0.08 * k;
  for (let i = 0; i < 7; i++) {
    const x = (R(i + 200) - 0.5) * 50,
      z = (R(i + 220) - 0.5) * 50;
    c.beginPath();
    c.moveTo(X(x), Z(z));
    c.bezierCurveTo(
      X(x + (R(i + 240) - 0.5) * 16),
      Z(z + (R(i + 260) - 0.5) * 16),
      X(x + (R(i + 280) - 0.5) * 20),
      Z(z + (R(i + 300) - 0.5) * 20),
      X(x + (R(i + 320) - 0.5) * 24),
      Z(z + (R(i + 340) - 0.5) * 24)
    );
    c.stroke();
  }

  // SR-92: its two carriageways, a barrier between, frontage roads either
  // side, verges between them; its lanes dashed.
  const [[ax0, az0], [ax1, az1]] = SR92,
    len = Math.hypot(ax1 - ax0, az1 - az0),
    nx = -(az1 - az0) / len,
    nz = (ax1 - ax0) / len;
  const along = (off: number, w: number, style: string, dash?: number[]) => {
    c.strokeStyle = style;
    c.lineWidth = w * k;
    c.setLineDash(dash ? dash.map((d) => d * k) : []);
    path([
      [ax0 + nx * off, az0 + nz * off],
      [ax1 + nx * off, az1 + nz * off],
    ]);
    c.stroke();
    c.setLineDash([]);
  };
  along(0, 3.9, VERGE);
  for (const s of [-1, 1]) {
    along(s * 0.6, 0.8, ASPHALT);
    along(s * 1.62, 0.5, ASPHALT);
    for (const o of [0.47, 0.73]) along(s * o, 0.025, PAINT, [0.3, 0.45]);
  }
  along(0, 0.1, CONCRETE);

  // The streets: asphalt, white edge lines, Triumph's planted median.
  for (const r of ROADS) {
    c.strokeStyle = CONCRETE;
    c.lineWidth = (r.w + 0.24) * k;
    path(r.pts);
    c.stroke();
    c.strokeStyle = PAINT;
    c.lineWidth = (r.w - 0.06) * k;
    c.stroke();
    c.strokeStyle = ASPHALT;
    c.lineWidth = (r.w - 0.1) * k;
    c.stroke();
    if (r.median) {
      c.strokeStyle = '#7f9157';
      c.lineWidth = r.median * k;
      c.stroke();
    } else if (r.w > 0.55) {
      c.strokeStyle = 'rgba(232, 196, 90, 0.85)';
      c.lineWidth = 0.025 * k;
      c.setLineDash([0.3 * k, 0.3 * k]);
      c.stroke();
      c.setLineDash([]);
    }
  }
  // The trails: concrete, dirt shoulders.
  for (const t of TRAILS) {
    c.strokeStyle = 'rgba(206, 192, 160, 0.9)';
    c.lineWidth = 0.32 * k;
    path(t);
    c.stroke();
    c.strokeStyle = '#a3a19b';
    c.lineWidth = 0.15 * k;
    c.stroke();
  }

  // The buildings' walks and a lawn round them (none round a garage).
  const parts = boxes.filter((b) => b.part);
  for (const b of parts) {
    if (b.skin === 'garage' || b.skin === 'siding') continue;
    turned(
      b.x - BRIDGE_AT[0],
      b.z - BRIDGE_AT[1],
      b.w + 0.9,
      b.d + 0.9,
      b.rot,
      0.2,
      () => {
        c.fillStyle = VERGE;
        c.fill();
      }
    );
  }
  for (const b of parts)
    turned(
      b.x - BRIDGE_AT[0],
      b.z - BRIDGE_AT[1],
      b.w + 0.32,
      b.d + 0.32,
      b.rot,
      0.06,
      () => {
        c.fillStyle = CONCRETE;
        c.fill();
      }
    );
  // The townhouses' drives, to their streets.
  for (const b of parts)
    if (b.skin === 'siding')
      for (let i = 0; i < 4; i++) {
        const x = b.x - BRIDGE_AT[0] - b.w / 2 + (i + 0.5) * (b.w / 4),
          z = b.z - BRIDGE_AT[1],
          s =
            Math.abs(z - 8.2) < Math.abs(z - 13.4)
              ? Math.sign(8.2 - z)
              : Math.sign(13.4 - z);
        c.fillStyle = CONCRETE;
        c.fillRect(
          X(x - 0.16),
          Z(Math.min(z, z + s * 1.25)),
          0.32 * k,
          1.25 * k
        );
      }

  // The lots: asphalt, rows of stalls back to back with aisles between
  // (lotStalls). The cars in them are their own (lehiCars, standing on the
  // ground; 2026-11-20, the user's call: painted, they were flat); here,
  // each one's long shadow away from the low sun.
  const tanE = SUN.y / sl,
    stalls = lotStalls();
  LOTS.forEach(([x, z, w, d, rot = 0], li) => {
    turned(x, z, w, d, rot, 0.12, () => {
      c.fillStyle = '#6b6b6c';
      c.fill();
    });
    c.save();
    c.translate(X(x), Z(z));
    c.rotate(-rot);
    // Away from the sun, in the lot's frame.
    const dl = AWAY.x * Math.cos(rot) - AWAY.z * Math.sin(rot),
      dm = AWAY.x * Math.sin(rot) + AWAY.z * Math.cos(rot),
      reach = CAR.h / tanE;
    for (const st of stalls) {
      if (st.lot !== li) continue;
      c.fillStyle = PAINT;
      c.fillRect(st.u * k, st.v * k, 0.022 * k, STALL.d * k);
      if (st.u + 2 * STALL.w > w / 2 - 0.3)
        c.fillRect((st.u + STALL.w) * k, st.v * k, 0.022 * k, STALL.d * k);
      if (!st.car) continue;
      const cx = st.u + STALL.w / 2,
        cz = st.v + STALL.d / 2,
        hw = CAR.w / 2 - 0.01,
        hl = CAR.l / 2 - 0.02,
        corners: [number, number][] = [
          [cx - hw, cz - hl],
          [cx + hw, cz - hl],
          [cx + hw, cz + hl],
          [cx - hw, cz + hl],
        ];
      c.fillStyle = 'rgba(28, 28, 26, 0.42)';
      c.beginPath();
      hull([
        ...corners,
        ...corners.map(([a, b]): [number, number] => [
          a + dl * reach,
          b + dm * reach,
        ]),
      ]).forEach(([a, b], i) =>
        i ? c.lineTo(a * k, b * k) : c.moveTo(a * k, b * k)
      );
      c.fill();
    }
    c.restore();
  });
  // The hotel's pool, its deck round it.
  c.fillStyle = CONCRETE;
  c.fillRect(
    X(POOL.x - POOL.w / 2 - 0.25),
    Z(POOL.z - POOL.d / 2 - 0.2),
    (POOL.w + 0.5) * k,
    (POOL.d + 0.4) * k
  );
  c.fillStyle = '#4fb4cf';
  c.beginPath();
  c.roundRect(
    X(POOL.x - POOL.w / 2),
    Z(POOL.z - POOL.d / 2),
    POOL.w * k,
    POOL.d * k,
    0.12 * k
  );
  c.fill();

  // Its edge, fading into the town round it.
  c.globalCompositeOperation = 'destination-in';
  const g = c.createRadialGradient(X(0), Z(0), 25 * k, X(0), Z(0), 31.5 * k);
  g.addColorStop(0, 'rgba(0, 0, 0, 1)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  c.fillStyle = g;
  c.fillRect(0, 0, N, N);
  c.globalCompositeOperation = 'source-over';
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  t.flipY = false;
  t.anisotropy = 8;
  return t;
}
