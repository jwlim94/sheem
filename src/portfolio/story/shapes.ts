import { DataTexture, FloatType, NearestFilter, RGBAFormat } from 'three';

/** Particle targets are packed into a texture: one 128-wide block per shape. */
export const SHAPE_WIDTH = 128;

type Rand = () => number;
type Point = [number, number, number];
const TAU = Math.PI * 2;

function seeded(seed: number): Rand {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: Rand) =>
  Math.sqrt(-2 * Math.log(Math.max(r(), 1e-6))) * Math.cos(TAU * r());
const squircle = (a: number, w: number, h: number): [number, number] => {
  const c = Math.cos(a),
    s = Math.sin(a);
  return [
    (Math.sign(c) * Math.abs(c) ** 0.25 * w) / 2,
    (Math.sign(s) * Math.abs(s) ** 0.25 * h) / 2,
  ];
};
const blockHeight = (k: number) => 0.25 + Math.sin(k * 7.13) ** 2 * 2.4;

const nodes: Point[] = Array.from({ length: 11 }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / 11,
    rad = Math.sqrt(1 - y * y),
    a = i * 2.399963;
  return [Math.cos(a) * rad * 4.2, y * 2.9, Math.sin(a) * rad * 3.4];
});
const edges: [number, number][] = [];
nodes.forEach((p, i) =>
  nodes
    .map((q, j) => [j, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])])
    .filter(([j]) => j !== i)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .forEach(([j]) => {
      if (!edges.some(([a, b]) => (a === j && b === i) || (a === i && b === j)))
        edges.push([i, j]);
    })
);
const hill = (x: number, z: number) =>
  1.9 * Math.exp(-((x - 0.8) ** 2 + (z + 0.4) ** 2) / 5) +
  1.2 * Math.exp(-((x + 2.2) ** 2 + (z - 1.4) ** 2) / 2.6) +
  0.12 * Math.sin(x * 1.7) * Math.cos(z * 1.3);
const orbits = [
  [3.9, 1.25, 0.2],
  [3.1, 0.45, -0.9],
  [2.4, -0.35, 0.55],
];

/** One generator per chapter, in chapter order. */
const shapes: ((r: Rand, i: number, n: number) => Point)[] = [
  // Hello: a seed sphere with a loose halo.
  (r, i, n) => {
    const y = 1 - (2 * (i + 0.5)) / n,
      rad = Math.sqrt(1 - y * y),
      a = i * 2.399963,
      R = r() < 0.84 ? 3.2 : 3.2 + r() ** 2 * 2.8;
    return [Math.cos(a) * rad * R, y * R, Math.sin(a) * rad * R];
  },
  // Computer science: a lattice of grid lines and nodes.
  (r) => {
    const pick = () => [-2.7, -0.9, 0.9, 2.7][Math.floor(r() * 4)];
    if (r() < 0.14)
      return [
        pick() + gauss(r) * 0.07,
        pick() + gauss(r) * 0.07,
        pick() + gauss(r) * 0.07,
      ];
    const p: Point = [pick(), pick(), pick()];
    p[Math.floor(r() * 3)] = (r() * 2 - 1) * 2.7;
    return p;
  },
  // Broadcasting: an audio waveform surface.
  (r) => {
    const z = (Math.floor(r() * 34) / 33 - 0.5) * 5,
      x = (r() * 2 - 1) * 5.2,
      env = Math.exp((-x * x) / 9) * (0.55 + 0.45 * Math.cos(z * 1.1));
    return [
      x,
      Math.sin(x * 2.4 + z * 0.9) * env * 1.5 +
        Math.sin(x * 5.3 - z * 1.7) * env * 0.35,
      z,
    ];
  },
  // Neighbor: a city map of spaces, streets and pins.
  (r) => {
    const base = -1.4,
      m = r();
    if (m < 0.14) {
      const line = (Math.floor(r() * 8) - 3.5) * 1.1,
        t = (r() * 2 - 1) * 4.2;
      return r() < 0.5 ? [line, base, t] : [t, base, line];
    }
    if (m < 0.25) {
      const pins = [3, 11, 24, 31, 45],
        k = pins[Math.floor(r() * pins.length)],
        x = ((k % 7) - 3) * 1.1,
        z = (Math.floor(k / 7) - 3) * 1.1,
        top = base + blockHeight(k);
      if (r() < 0.45) return [x, top + r() * 1.2, z];
      const a = r() * TAU,
        b = Math.acos(2 * r() - 1);
      return [
        x + Math.sin(b) * Math.cos(a) * 0.24,
        top + 1.45 + Math.cos(b) * 0.24,
        z + Math.sin(b) * Math.sin(a) * 0.24,
      ];
    }
    const k = Math.floor(r() * 49),
      x = ((k % 7) - 3) * 1.1,
      z = (Math.floor(k / 7) - 3) * 1.1,
      h = blockHeight(k),
      s = 0.36;
    if (m < 0.6)
      return [x + (r() * 2 - 1) * s, base + h, z + (r() * 2 - 1) * s];
    const c = Math.floor(r() * 4);
    return [x + (c & 1 ? s : -s), base + r() * h, z + (c & 2 ? s : -s)];
  },
  // Fitzza: phones and modular screens.
  (r) => {
    const m = r(),
      phone = m < 0.6 ? 0 : m < 0.8 ? 1 : 2,
      [ox, oy, oz] = [
        [0, 0, 0.6],
        [-3, 0.5, -1],
        [3, -0.4, -1],
      ][phone],
      rot = [0, 0.4, -0.4][phone];
    let x: number, y: number;
    if (r() < 0.38 || (phone > 0 && r() < 0.5))
      [x, y] = squircle(r() * TAU, 3.1, 6.2);
    else {
      const card = Math.floor(r() * 5);
      if (card === 0) {
        x = -0.6 + (r() * 2 - 1) * 0.8;
        y = 2.25 + (r() * 2 - 1) * 0.1;
      } else {
        x = (r() * 2 - 1) * 1.2;
        y = 2.25 - card * 1.02 + (r() * 2 - 1) * 0.36;
      }
    }
    return [ox + x * Math.cos(rot), oy + y, oz - x * Math.sin(rot)];
  },
  // Master's: a network of connected decisions.
  (r) => {
    if (r() < 0.36) {
      const p = nodes[Math.floor(r() * nodes.length)];
      return [
        p[0] + gauss(r) * 0.26,
        p[1] + gauss(r) * 0.26,
        p[2] + gauss(r) * 0.26,
      ];
    }
    const [a, b] = edges[Math.floor(r() * edges.length)],
      t = r(),
      A = nodes[a],
      B = nodes[b];
    return [
      A[0] + (B[0] - A[0]) * t + gauss(r) * 0.03,
      A[1] + (B[1] - A[1]) * t + gauss(r) * 0.03,
      A[2] + (B[2] - A[2]) * t + gauss(r) * 0.03,
    ];
  },
  // Archaeology: stacked topographic contours.
  (r) => {
    for (let k = 0; k < 80; k++) {
      const a = r() * TAU,
        d = Math.sqrt(r()) * 5.2,
        x = Math.cos(a) * d,
        z = Math.sin(a) * d,
        level = hill(x, z) * 5;
      if (level - Math.floor(level) < 0.09)
        return [x, (Math.floor(level) / 5) * 1.35 - 1.3, z];
    }
    return [0, -1.3, 0];
  },
  // Bridge: documents flow into structured bars.
  (r) => {
    const m = r();
    if (m < 0.42) {
      const page = Math.floor(r() * 4);
      let x: number, y: number;
      if (r() < 0.35) {
        const t = r() * 4,
          side = Math.floor(t),
          u = t - side;
        [x, y] = [
          [(u - 0.5) * 2.2, 1.45],
          [1.1, (0.5 - u) * 2.9],
          [(0.5 - u) * 2.2, -1.45],
          [-1.1, (u - 0.5) * 2.9],
        ][side];
      } else {
        const line = Math.floor(r() * 9);
        x = -0.85 + r() * 1.7 * (line % 3 === 2 ? 0.55 : 0.9);
        y = 1.05 - line * 0.26;
      }
      return [
        -3.1 + page * 0.18 + x * 0.95,
        page * 0.18 - 0.3 + y,
        -page * 0.5 + x * 0.3,
      ];
    }
    if (m < 0.86) {
      const b = Math.floor(r() * 6),
        h = 0.7 + b * 0.45 + Math.sin(b * 2.1) * 0.25,
        x = 0.9 + b * 0.62,
        w = 0.21,
        q = r();
      if (q < 0.3) return [x + (r() * 2 - 1) * w, -1.6 + h, (r() * 2 - 1) * w];
      if (q < 0.75)
        return [x + (r() < 0.5 ? -w : w), -1.6 + r() * h, r() < 0.5 ? -w : w];
      return [x + (r() * 2 - 1) * w, -1.6 + r() * h, w];
    }
    const t = r();
    return [
      -1.8 + t * 3.2 + gauss(r) * 0.05,
      1.4 - t + Math.sin(t * Math.PI) * 0.9 + gauss(r) * 0.05,
      -0.3 + Math.sin(t * Math.PI * 3) * 0.15,
    ];
  },
  // What's next: an open orbit around a small core.
  (r) => {
    if (r() < 0.18) {
      const a = r() * TAU,
        b = Math.acos(2 * r() - 1);
      return [
        Math.sin(b) * Math.cos(a),
        Math.cos(b),
        Math.sin(b) * Math.sin(a),
      ];
    }
    const [R, tx, tz] = orbits[Math.floor(r() * 3)],
      a = r() * TAU,
      x = Math.cos(a) * R + gauss(r) * 0.03,
      z = Math.sin(a) * R + gauss(r) * 0.03,
      y1 = -z * Math.sin(tx),
      z1 = z * Math.cos(tx);
    return [
      x * Math.cos(tz) - y1 * Math.sin(tz),
      x * Math.sin(tz) + y1 * Math.cos(tz),
      z1,
    ];
  },
];

/** Builds every chapter's targets for `count` particles (a multiple of 128). */
export function createShapeTexture(count: number) {
  const rows = count / SHAPE_WIDTH,
    data = new Float32Array(count * shapes.length * 4);
  shapes.forEach((shape, s) => {
    const r = seeded(17 + s * 101);
    for (let i = 0; i < count; i++) {
      const o = (s * count + i) * 4,
        [x, y, z] = shape(r, i, count);
      data[o] = x;
      data[o + 1] = y;
      data[o + 2] = z;
      data[o + 3] = 1;
    }
  });
  const texture = new DataTexture(
    data,
    SHAPE_WIDTH,
    rows * shapes.length,
    RGBAFormat,
    FloatType
  );
  texture.minFilter = texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  return { texture, rows };
}
