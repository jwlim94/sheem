import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from 'three';
import type { Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { arenaBeats } from './story';
import {
  BOWL,
  FLOOR,
  JUMBO,
  LINE_Z,
  PRESENTER,
  S,
  STAGE,
  STAIRS,
} from './arena';

/** Seeded randomness (the same crowd every time). */
function rand(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function canvas(w: number, h: number) {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return { el, ctx };
}

const SANS =
  "-apple-system, 'SF Pro Display', 'Helvetica Neue', 'Segoe UI', Arial, sans-serif";

/** A box at (x, y, z), size (w, h, d), turned yaw: for merging. */
function boxAt(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  yaw = 0
) {
  const g = new BoxGeometry(w, h, d);
  g.rotateY(yaw);
  g.translate(x, y, z);
  return g;
}

/** Points round a rounded rectangle (half extents a, b, corner radius r),
 *  counter-clockwise from the +x side's middle, n of them. */
function roundRect(a: number, b: number, r: number, n: number) {
  const sx = a - r,
    sz = b - r,
    L = 4 * sx + 4 * sz + 2 * Math.PI * r,
    pts: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    let d = (i / n) * L;
    const seg: [number, (t: number) => [number, number]][] = [
      [sz, (t) => [a, t]],
      [
        (Math.PI * r) / 2,
        (t) => [sx + r * Math.cos(t / r), sz + r * Math.sin(t / r)],
      ],
      [2 * sx, (t) => [sx - t, b]],
      [
        (Math.PI * r) / 2,
        (t) => [-sx - r * Math.sin(t / r), sz + r * Math.cos(t / r)],
      ],
      [2 * sz, (t) => [-a, sz - t]],
      [
        (Math.PI * r) / 2,
        (t) => [-sx - r * Math.cos(t / r), -sz - r * Math.sin(t / r)],
      ],
      [2 * sx, (t) => [-sx + t, -b]],
      [
        (Math.PI * r) / 2,
        (t) => [sx + r * Math.sin(t / r), -sz - r * Math.cos(t / r)],
      ],
      [sz, (t) => [a, -sz + t]],
    ];
    for (const [len, f] of seg) {
      if (d <= len) {
        const [x, z] = f(d);
        pts.push(new Vector3(x, 0, z));
        break;
      }
      d -= len;
    }
  }
  return pts;
}

/** The ceremony on the center-hung screens, as broadcast: the program's
 *  title slate (navy, gold rules, "Commencement 2025"); with his name, his
 *  lower third over it. (A drawn crowd read as polka dots up close.) */
function drawJumbo(ctx: CanvasRenderingContext2D, named: boolean) {
  const w = 1024,
    h = 600;
  const g = ctx.createRadialGradient(
    w / 2,
    h * 0.4,
    40,
    w / 2,
    h * 0.5,
    w * 0.7
  );
  g.addColorStop(0, '#24407e');
  g.addColorStop(1, '#0b1630');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Fine diagonal texture, like a broadcast background.
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 2;
  for (let x = -h; x < w; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + h, 0);
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9a64a';
  ctx.fillRect(w / 2 - 220, named ? 92 : 168, 440, 3);
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${named ? 40 : 58}px Georgia, 'Times New Roman', serif`;
  ctx.fillText('Brigham Young University', w / 2, named ? 70 : 140);
  ctx.fillStyle = '#c9d6ee';
  ctx.font = `500 ${named ? 26 : 34}px ${SANS}`;
  ctx.fillText('C O M M E N C E M E N T   2 0 2 5', w / 2, named ? 132 : 222);
  if (!named) {
    ctx.fillStyle = '#c9a64a';
    ctx.fillRect(w / 2 - 220, 252, 440, 3);
    ctx.fillStyle = '#8ea4c8';
    ctx.font = `500 26px ${SANS}`;
    ctx.fillText('Marriott Center · Provo, Utah', w / 2, 300);
  }
  ctx.textAlign = 'left';
  if (named) {
    ctx.fillStyle = 'rgba(6,12,28,0.9)';
    ctx.fillRect(0, h - 250, w, 210);
    ctx.fillStyle = '#c9a64a';
    ctx.fillRect(56, h - 226, 7, 160);
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 82px ${SANS}`;
    ctx.fillText('Jongwoo Lim', 86, h - 150);
    ctx.fillStyle = '#c9d6ee';
    ctx.font = `500 34px ${SANS}`;
    ctx.fillText('Master of Information Systems Management', 88, h - 100);
    ctx.fillStyle = '#8ea4c8';
    ctx.font = `500 26px ${SANS}`;
    ctx.fillText('Marriott School of Business', 88, h - 62);
  }
}

/** A ribbon board's text, repeated along it. */
function ribbonTexture() {
  const { el, ctx } = canvas(2048, 64);
  ctx.fillStyle = '#0f2a66';
  ctx.fillRect(0, 0, 2048, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 40px ${SANS}`;
  for (let x = 20; x < 2048; x += 512) {
    ctx.fillText('BYU  ·  COMMENCEMENT 2025', x, 47);
  }
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** The stage's banner over the drape. */
function bannerTexture() {
  const { el, ctx } = canvas(2048, 256);
  ctx.fillStyle = '#0d2351';
  ctx.fillRect(0, 0, 2048, 256);
  ctx.strokeStyle = '#c9d6ee';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, 2020, 228);
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 104px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.fillText('BRIGHAM YOUNG UNIVERSITY', 1024, 150);
  ctx.font = `500 44px ${SANS}`;
  ctx.fillStyle = '#c9d6ee';
  ctx.fillText('C O M M E N C E M E N T', 1024, 218);
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const NAVY = '#16244a',
  GOWN = '#1a2a5a',
  // Muted, as a crowd reads from across an arena.
  CLOTHES = [
    '#2b3550',
    '#5a3238',
    '#b9b4a8',
    '#3c4a3a',
    '#1d1f24',
    '#6b7385',
    '#8a6a44',
    '#d6d3cc',
    '#33507e',
    '#8a4a42',
  ],
  SKIN = ['#f1d2b8', '#e4b894', '#c99673', '#a8754f', '#7a5236', '#f5dcc6'];

function build() {
  const g = new Group(),
    disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => {
    disposables.push(x);
    return x;
  };
  const lambert = (color: string) => keep(new MeshLambertMaterial({ color }));
  const add = (geo: BufferGeometry, mat: Material) => {
    const m = new Mesh(keep(geo), mat);
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const m4 = new Matrix4(),
    q = new Quaternion(),
    sc = new Vector3(1, 1, 1),
    p = new Vector3(),
    up = new Vector3(0, 1, 0),
    col = new Color();
  const instanced = (geo: BufferGeometry, mat: Material, count: number) => {
    const im = new InstancedMesh(keep(geo), mat, count);
    im.frustumCulled = false;
    g.add(im);
    return im;
  };

  // ---------------------------------------------------------- the floor
  add(
    new PlaneGeometry(2 * FLOOR.hx + 8, 2 * FLOOR.hz + 8).rotateX(-Math.PI / 2),
    lambert('#27324a')
  );

  // ------------------------------------------------------------ the bowl
  // Rows round the floor (a rounded rectangle growing outward), treads and
  // risers in one mesh; the seats and the people in them instanced.
  type Row = { pts: Vector3[]; y: number; off: number };
  const rows: Row[] = [];
  const N = 220;
  for (let i = 0; i < BOWL.lowerRows; i++)
    rows.push({
      pts: [],
      y: BOWL.lowerRise * (i + 1),
      off: 1.5 + i * BOWL.lowerRun,
    });
  const lowerTop = BOWL.lowerRise * BOWL.lowerRows,
    upperOff0 = 1.5 + BOWL.lowerRows * BOWL.lowerRun + BOWL.concourse,
    upperY0 = lowerTop + BOWL.fascia;
  for (let i = 0; i < BOWL.upperRows; i++)
    rows.push({
      pts: [],
      y: upperY0 + BOWL.upperRise * (i + 1),
      off: upperOff0 + i * BOWL.upperRun,
    });
  const ring = (off: number) =>
    roundRect(FLOOR.hx + off, FLOOR.hz + off, FLOOR.r + off, N);
  const tread: number[] = [],
    treadCol: number[] = [];
  const quad = (
    a: Vector3,
    b: Vector3,
    c: Vector3,
    d: Vector3,
    color: Color
  ) => {
    tread.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    tread.push(...a.toArray(), ...c.toArray(), ...d.toArray());
    for (let k = 0; k < 6; k++) treadCol.push(color.r, color.g, color.b);
  };
  const stepCol = new Color('#4a4f5c'),
    riserCol = new Color('#20242e'),
    wallCol = new Color('#2a2f3c');
  let prevY = 0,
    prevOff = 1.5;
  const surfaces: [number, number, number, number, Color][] = [];
  rows.forEach((r, i) => {
    const run = i < BOWL.lowerRows ? BOWL.lowerRun : BOWL.upperRun;
    // A riser up from the last tread (or the concourse's fascia), then this
    // row's tread.
    surfaces.push([
      r.off,
      prevY,
      r.off,
      r.y,
      i === BOWL.lowerRows ? wallCol : riserCol,
    ]);
    surfaces.push([r.off, r.y, r.off + run, r.y, stepCol]);
    if (i === BOWL.lowerRows - 1) {
      surfaces.push([r.off + run, r.y, upperOff0, r.y, stepCol]); // concourse
    }
    prevY = r.y;
    prevOff = r.off + run;
    r.pts = ring(r.off + run * 0.55);
  });
  // The back wall up to the roof.
  surfaces.push([prevOff, prevY, prevOff, prevY + 9, wallCol]);
  for (const [o0, y0, o1, y1, c] of surfaces) {
    const A = ring(o0),
      B = ring(o1);
    for (let k = 0; k < N; k++) {
      const k2 = (k + 1) % N;
      quad(
        new Vector3(A[k].x, y0, A[k].z),
        new Vector3(A[k2].x, y0, A[k2].z),
        new Vector3(B[k2].x, y1, B[k2].z),
        new Vector3(B[k].x, y1, B[k].z),
        c
      );
    }
  }
  const bowl = new BufferGeometry();
  bowl.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(tread), 3)
  );
  bowl.setAttribute(
    'color',
    new BufferAttribute(new Float32Array(treadCol), 3)
  );
  bowl.computeVertexNormals();
  add(
    bowl,
    keep(new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }))
  );
  // The concourse fascia's ribbon board (lit, text running round).
  {
    const A = ring(
      1.5 + BOWL.lowerRows * BOWL.lowerRun + BOWL.concourse - 0.05
    );
    const pos: number[] = [],
      uv: number[] = [];
    let len = 0;
    for (let k = 0; k <= N; k++) {
      const a = A[k % N],
        prev = A[(k + N - 1) % N];
      if (k) len += a.distanceTo(prev);
      pos.push(a.x, lowerTop + 0.9, a.z, a.x, lowerTop + 2.1, a.z);
      uv.push(len / 40, 0, len / 40, 1);
    }
    const idx: number[] = [];
    for (let k = 0; k < N; k++) {
      const i0 = k * 2;
      idx.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
    geo.setIndex(idx);
    const tex = keep(ribbonTexture());
    tex.wrapS = RepeatWrapping;
    add(
      geo,
      keep(
        new MeshBasicMaterial({ map: tex, side: DoubleSide, toneMapped: false })
      )
    );
  }

  // Seats and the people in them.
  const seatGeo = mergeGeometries([
      boxAt(0.5 * S, 0.08 * S, 0.44 * S, 0, 0.42 * S, 0),
      boxAt(0.5 * S, 0.5 * S, 0.06 * S, 0, 0.66 * S, -0.22 * S),
    ]),
    bodyGeo = mergeGeometries([
      boxAt(0.42 * S, 0.5 * S, 0.26 * S, 0, 0.72 * S, -0.08 * S),
      boxAt(0.4 * S, 0.14 * S, 0.4 * S, 0, 0.52 * S, 0.08 * S),
    ]),
    headGeo = new SphereGeometry(0.115 * S, 8, 6).translate(
      0,
      1.1 * S,
      -0.06 * S
    );
  const seats: [Vector3, number][] = [];
  rows.forEach((r, i) => {
    const step = 0.62 * S;
    let acc = 0;
    for (let k = 0; k < N; k++) {
      const a = r.pts[k],
        b = r.pts[(k + 1) % N],
        d = a.distanceTo(b);
      // (Not behind the stage's drape: its end of the lower deck is dark.)
      for (; acc < d; acc += step) {
        const pt = a.clone().lerp(b, acc / d);
        if (i < 10 && pt.x > FLOOR.hx + 2 && Math.abs(pt.z) < STAGE.hz + 4)
          continue;
        const yaw = Math.atan2(-(b.z - a.z), b.x - a.x); // facing in
        pt.y = r.y;
        seats.push([pt, yaw]);
      }
      acc -= d;
    }
  });
  const seatMesh = instanced(seatGeo, lambert('#1e3f86'), seats.length);
  const people = seats.filter((_, i) => rand(i * 1.3) < 0.86);
  const bodyMesh = instanced(
      bodyGeo,
      keep(new MeshLambertMaterial({ color: '#ffffff' })),
      people.length
    ),
    headMesh = instanced(
      headGeo,
      keep(new MeshLambertMaterial({ color: '#ffffff' })),
      people.length
    );
  seats.forEach(([pt, yaw], i) => {
    seatMesh.setMatrixAt(i, m4.compose(pt, q.setFromAxisAngle(up, yaw), sc));
  });
  people.forEach(([pt, yaw], i) => {
    m4.compose(pt, q.setFromAxisAngle(up, yaw), sc);
    bodyMesh.setMatrixAt(i, m4);
    headMesh.setMatrixAt(i, m4);
    bodyMesh.setColorAt(
      i,
      col.set(CLOTHES[Math.floor(rand(i * 2.7) * CLOTHES.length)])
    );
    headMesh.setColorAt(
      i,
      col.set(SKIN[Math.floor(rand(i * 5.1) * SKIN.length)])
    );
  });

  // ----------------------------------------------------- the graduates
  // On the floor, on folding chairs in rows facing the stage, a centre
  // aisle and side aisles; navy gowns, white stoles, mortarboards (a few
  // gold tassels), faces turned to the stage. The roped line's aisle kept
  // clear by the stage.
  const chairGeo = mergeGeometries([
      boxAt(0.44 * S, 0.04 * S, 0.42 * S, 0, 0.44 * S, 0),
      boxAt(0.44 * S, 0.4 * S, 0.03 * S, 0, 0.66 * S, -0.2 * S),
      boxAt(0.03 * S, 0.44 * S, 0.03 * S, 0.2 * S, 0.22 * S, 0.18 * S),
      boxAt(0.03 * S, 0.44 * S, 0.03 * S, -0.2 * S, 0.22 * S, 0.18 * S),
    ]),
    gownGeo = mergeGeometries([
      boxAt(0.46 * S, 0.56 * S, 0.3 * S, 0, 0.76 * S, -0.08 * S),
      boxAt(0.46 * S, 0.16 * S, 0.44 * S, 0, 0.54 * S, 0.08 * S),
      boxAt(0.4 * S, 0.42 * S, 0.12 * S, 0, 0.26 * S, 0.3 * S),
      boxAt(0.14 * S, 0.34 * S, 0.14 * S, 0.27 * S, 0.74 * S, 0.02 * S),
      boxAt(0.14 * S, 0.34 * S, 0.14 * S, -0.27 * S, 0.74 * S, 0.02 * S),
    ]),
    stoleGeo = mergeGeometries([
      boxAt(0.09 * S, 0.5 * S, 0.02 * S, 0.1 * S, 0.8 * S, 0.075 * S),
      boxAt(0.09 * S, 0.5 * S, 0.02 * S, -0.1 * S, 0.8 * S, 0.075 * S),
    ]),
    capGeo = mergeGeometries([
      boxAt(0.36 * S, 0.02 * S, 0.36 * S, 0, 1.25 * S, -0.06 * S, Math.PI / 4),
      new CylinderGeometry(0.12 * S, 0.12 * S, 0.08 * S, 10).translate(
        0,
        1.2 * S,
        -0.06 * S
      ),
    ]),
    gradHead = new SphereGeometry(0.12 * S, 10, 8).translate(
      0,
      1.1 * S,
      -0.04 * S
    );
  const grads: Vector3[] = [];
  for (let x = -FLOOR.hx + 3; x < STAGE.x0 - 4; x += 1.25) {
    for (let z = -FLOOR.hz + 2.2; z <= FLOOR.hz - 2.2; z += 0.72) {
      if (Math.abs(z) < 1.3) continue; // centre aisle
      if (Math.abs(Math.abs(z) - 10.5) < 0.9) continue; // side aisles
      if (x > 6 && Math.abs(z - LINE_Z) < 1.6) continue; // the line's aisle
      grads.push(new Vector3(x, 0, z));
    }
  }
  const yawToStage = Math.PI / 2; // facing +x (the models face +z)
  const gc = instanced(chairGeo, lambert('#2a2c31'), grads.length),
    gg = instanced(gownGeo, lambert(GOWN), grads.length),
    gs = instanced(stoleGeo, lambert('#eef0f2'), grads.length),
    gcap = instanced(capGeo, lambert(NAVY), grads.length),
    gh = instanced(
      gradHead,
      keep(new MeshLambertMaterial({ color: '#ffffff' })),
      grads.length
    );
  grads.forEach((pt, i) => {
    const yaw = yawToStage + (rand(i * 3.3) - 0.5) * 0.3;
    m4.compose(pt, q.setFromAxisAngle(up, yaw), sc);
    gc.setMatrixAt(i, m4);
    gg.setMatrixAt(i, m4);
    gs.setMatrixAt(i, m4);
    gcap.setMatrixAt(i, m4);
    gh.setMatrixAt(i, m4);
    gh.setColorAt(i, col.set(SKIN[Math.floor(rand(i * 7.7) * SKIN.length)]));
  });
  const tassels = instanced(
    new BoxGeometry(0.015 * S, 0.14 * S, 0.015 * S).translate(
      0.17 * S,
      1.18 * S,
      0.08 * S
    ),
    lambert('#d6b64a'),
    grads.length
  );
  grads.forEach((pt, i) => {
    const yaw = yawToStage + (rand(i * 3.3) - 0.5) * 0.3;
    tassels.setMatrixAt(
      i,
      m4.compose(
        pt,
        q.setFromAxisAngle(up, yaw),
        rand(i * 9.1) < 0.25 ? sc : new Vector3(0, 0, 0)
      )
    );
  });

  // The line: graduates standing in the roped aisle to the stairs, ahead
  // of and behind his place (his is left free).
  const standGeo = mergeGeometries([
    boxAt(0.46 * S, 1.0 * S, 0.32 * S, 0, 0.55 * S, 0),
    boxAt(0.14 * S, 0.5 * S, 0.14 * S, 0.27 * S, 0.8 * S, 0),
    boxAt(0.14 * S, 0.5 * S, 0.14 * S, -0.27 * S, 0.8 * S, 0),
  ]);
  const stoleStand = mergeGeometries([
    boxAt(0.09 * S, 0.62 * S, 0.02 * S, 0.1 * S, 0.8 * S, 0.17 * S),
    boxAt(0.09 * S, 0.62 * S, 0.02 * S, -0.1 * S, 0.8 * S, 0.17 * S),
  ]);
  const standHead = new SphereGeometry(0.12 * S, 10, 8).translate(
      0,
      1.2 * S,
      0
    ),
    standCap = mergeGeometries([
      boxAt(0.36 * S, 0.02 * S, 0.36 * S, 0, 1.35 * S, 0, Math.PI / 4),
      new CylinderGeometry(0.12 * S, 0.12 * S, 0.08 * S, 10).translate(
        0,
        1.3 * S,
        0
      ),
    ]);
  const liners = [10.6, 12.3, 14.0, 15.4, 8.9, 7.2].map(
    (x) => new Vector3(x, 0, LINE_Z)
  );
  const lg = instanced(standGeo, lambert(GOWN), liners.length),
    ls = instanced(stoleStand, lambert('#eef0f2'), liners.length),
    lh = instanced(
      standHead,
      keep(new MeshLambertMaterial({ color: '#ffffff' })),
      liners.length
    ),
    lc = instanced(standCap, lambert(NAVY), liners.length);
  liners.forEach((pt, i) => {
    m4.compose(pt, q.setFromAxisAngle(up, Math.PI / 2), sc);
    lg.setMatrixAt(i, m4);
    ls.setMatrixAt(i, m4);
    lh.setMatrixAt(i, m4);
    lc.setMatrixAt(i, m4);
    lh.setColorAt(i, col.set(SKIN[i % SKIN.length]));
  });
  // Stanchions either side of the line, blue ropes sagging between.
  const chrome = keep(
    new MeshStandardMaterial({
      color: '#c9ccd2',
      metalness: 0.8,
      roughness: 0.25,
    })
  );
  const ropeMat = keep(
    new MeshStandardMaterial({ color: '#1f4fb5', roughness: 0.6 })
  );
  for (const side of [-1, 1]) {
    const zz = LINE_Z + side * 0.95;
    let last: Vector3 | null = null;
    for (let x = 6; x <= STAIRS.x0 - 0.2; x += 2.2) {
      const post = new Mesh(
        keep(new CylinderGeometry(0.03, 0.03, 1.0, 10)),
        chrome
      );
      post.position.set(x, 0.5, zz);
      g.add(post);
      const base = new Mesh(
        keep(new CylinderGeometry(0.18, 0.2, 0.04, 16)),
        chrome
      );
      base.position.set(x, 0.02, zz);
      g.add(base);
      const top = new Vector3(x, 0.96, zz);
      if (last) {
        const mid = last.clone().lerp(top, 0.5);
        mid.y -= 0.18;
        const rope = new Mesh(
          keep(
            new TubeGeometry(
              new CatmullRomCurve3([last, mid, top]),
              12,
              0.02,
              6
            )
          ),
          ropeMat
        );
        g.add(rope);
      }
      last = top;
    }
  }

  // ------------------------------------------------------------ the stage
  const stageW = 2 * STAGE.hz,
    stageD = STAGE.x1 - STAGE.x0;
  add(
    boxAt(stageD, STAGE.h, stageW, (STAGE.x0 + STAGE.x1) / 2, STAGE.h / 2, 0),
    lambert('#122046')
  );
  add(
    new PlaneGeometry(stageD, stageW)
      .rotateX(-Math.PI / 2)
      .translate((STAGE.x0 + STAGE.x1) / 2, STAGE.h + 0.005, 0),
    lambert('#2d4f9a')
  );
  add(
    boxAt(0.04, 0.06, stageW, STAGE.x0 - 0.01, STAGE.h - 0.05, 0),
    lambert('#c9a64a')
  );
  // Its stairs, four steps up to the stage's front at the line.
  for (let k = 0; k < 4; k++) {
    const h = (STAGE.h / 4) * (k + 1),
      x = STAIRS.x0 + ((STAIRS.x1 - STAIRS.x0) / 4) * (k + 0.5);
    add(
      boxAt(
        (STAIRS.x1 - STAIRS.x0) / 4 + 0.02,
        h,
        STAIRS.w,
        x,
        h / 2,
        STAIRS.z
      ),
      lambert('#1a2a55')
    );
  }
  // ...and the matching stairs down at the other end.
  for (let k = 0; k < 4; k++) {
    const h = (STAGE.h / 4) * (k + 1),
      x = STAIRS.x0 + ((STAIRS.x1 - STAIRS.x0) / 4) * (k + 0.5);
    add(
      boxAt(
        (STAIRS.x1 - STAIRS.x0) / 4 + 0.02,
        h,
        STAIRS.w,
        x,
        h / 2,
        -STAIRS.z
      ),
      lambert('#1a2a55')
    );
  }
  // The drape behind: navy, folded (vertical ridges), and the banner over it.
  {
    const w = stageW + 8,
      h = 13,
      seg = 160,
      geo = new PlaneGeometry(w, h, seg, 1);
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin((x / w) * seg * Math.PI * 0.5) * 0.18);
    }
    geo.computeVertexNormals();
    geo.rotateY(-Math.PI / 2).translate(STAGE.x1 + 0.4, h / 2, 0);
    add(
      geo,
      keep(new MeshLambertMaterial({ color: '#0e1d44', side: DoubleSide }))
    );
    const banner = new Mesh(
      keep(new PlaneGeometry(20, 2.5)),
      keep(
        new MeshBasicMaterial({ map: keep(bannerTexture()), toneMapped: false })
      )
    );
    banner.rotation.y = -Math.PI / 2;
    banner.position.set(STAGE.x1 + 0.1, 9.5, 0);
    g.add(banner);
  }
  // The lectern, centre front.
  add(
    boxAt(0.7, 1.25, 0.9, STAGE.x0 + 1.4, STAGE.h + 0.62, 4.2),
    lambert('#6b4a2e')
  );
  add(
    boxAt(0.02, 0.6, 0.6, STAGE.x0 + 1.04, STAGE.h + 0.8, 4.2),
    lambert('#1f3a7a')
  );
  // The faculty on the stage: three rows of chairs, robed figures (black,
  // a few in their own schools' colours) with coloured hoods.
  const facs: Vector3[] = [];
  for (let r = 0; r < 3; r++)
    for (let z = -STAGE.hz + 2.5; z <= STAGE.hz - 2.5; z += 1.05)
      if (Math.abs(z) > 2.0 || r > 0)
        facs.push(new Vector3(STAGE.x0 + 3.6 + r * 1.2, STAGE.h + r * 0.35, z));
  const fr = instanced(gownGeo, lambert('#15161a'), facs.length),
    fh = instanced(
      gradHead,
      keep(new MeshLambertMaterial({ color: '#ffffff' })),
      facs.length
    ),
    fhood = instanced(
      stoleGeo,
      keep(new MeshLambertMaterial({ color: '#ffffff' })),
      facs.length
    ),
    fchair = instanced(chairGeo, lambert('#3b2a1e'), facs.length);
  const hoods = [
    '#c9a64a',
    '#7a1f2b',
    '#2f6fc0',
    '#ffffff',
    '#3f7a3a',
    '#a07adb',
  ];
  facs.forEach((pt, i) => {
    m4.compose(pt, q.setFromAxisAngle(up, -Math.PI / 2), sc); // to the audience
    fr.setMatrixAt(i, m4);
    fh.setMatrixAt(i, m4);
    fhood.setMatrixAt(i, m4);
    fchair.setMatrixAt(i, m4);
    fh.setColorAt(i, col.set(SKIN[(i * 3) % SKIN.length]));
    fhood.setColorAt(i, col.set(hoods[i % hoods.length]));
  });
  // The presenter, standing to hand out the diplomas.
  {
    const pr = new Group();
    pr.position.set(...PRESENTER);
    pr.rotation.y = -2.6; // turned toward the line coming across
    for (const [geo, mat] of [
      [standGeo, lambert('#15161a')],
      [stoleStand, lambert('#7a1f2b')],
      [standHead, lambert(SKIN[1])],
      [standCap, lambert('#15161a')],
    ] as [BufferGeometry, Material][])
      pr.add(new Mesh(geo, mat));
    g.add(pr);
  }
  // Flowers along the stage's front: white and blue clusters in greenery.
  {
    const n = 26,
      flower = instanced(
        new SphereGeometry(0.16, 8, 6),
        keep(new MeshLambertMaterial({ color: '#ffffff' })),
        n * 9
      ),
      leaf = instanced(
        new SphereGeometry(0.28, 8, 6),
        lambert('#2f5a32'),
        n * 3
      );
    let fi = 0,
      li = 0;
    for (let k = 0; k < n; k++) {
      const z = -STAGE.hz + 0.6 + (k / (n - 1)) * (stageW - 1.2);
      if (Math.abs(z - STAIRS.z) < 1.4 || Math.abs(z + STAIRS.z) < 1.4)
        continue;
      for (let j = 0; j < 3; j++) {
        p.set(STAGE.x0 + 0.35, STAGE.h + 0.18, z + (j - 1) * 0.25);
        leaf.setMatrixAt(li++, m4.compose(p, q.identity(), sc));
      }
      for (let j = 0; j < 9; j++) {
        p.set(
          STAGE.x0 + 0.3 + rand(k * 9 + j) * 0.2,
          STAGE.h + 0.3 + rand(k * 3 + j) * 0.25,
          z + (rand(k * 7 + j) - 0.5) * 0.7
        );
        flower.setMatrixAt(fi, m4.compose(p, q.identity(), sc));
        flower.setColorAt(
          fi++,
          col.set(rand(k + j * 13) < 0.35 ? '#2f5fb8' : '#f7f5ef')
        );
      }
    }
    flower.count = fi;
    leaf.count = li;
  }
  // Flags either side of the stage.
  for (const [zz, c] of [
    [-STAGE.hz - 1.2, '#b8323a'],
    [STAGE.hz + 1.2, '#1f3a7a'],
  ] as [number, string][]) {
    add(boxAt(0.06, 6, 0.06, STAGE.x0 + 2, 3 + STAGE.h, zz), chrome);
    add(
      boxAt(0.02, 2.2, 1.4, STAGE.x0 + 2, 4.6 + STAGE.h, zz + 0.72),
      lambert(c)
    );
  }

  // -------------------------------------------- the roof and its screens
  const roofY = rows[rows.length - 1].y + 9;
  add(
    new PlaneGeometry(220, 200).rotateX(Math.PI / 2).translate(0, roofY, 0),
    lambert('#0d0f15')
  );
  // Trusses under the roof, catwalk lights along them.
  for (let x = -60; x <= 60; x += 12)
    add(boxAt(0.5, 1.2, 150, x, roofY - 1.5, 0), lambert('#1b1e26'));
  for (let z = -48; z <= 48; z += 12)
    add(boxAt(150, 0.4, 0.4, 0, roofY - 2.1, z), lambert('#1b1e26'));
  {
    const n = 80,
      lights = instanced(
        new CylinderGeometry(0.35, 0.35, 0.3, 10),
        keep(new MeshBasicMaterial({ color: '#fff4dc' })),
        n
      );
    for (let i = 0; i < n; i++) {
      p.set(
        -60 + (i % 10) * 13.3,
        roofY - 2.4,
        -48 + Math.floor(i / 10) * 13.7
      );
      lights.setMatrixAt(i, m4.compose(p, q.identity(), sc));
    }
  }
  // The center-hung screens: a dark box, four screens (the live ceremony),
  // lit rings above and below, cables up to the roof.
  const jumbo = canvas(1024, 600),
    jumboTex = keep(new CanvasTexture(jumbo.el));
  jumboTex.colorSpace = SRGBColorSpace;
  drawJumbo(jumbo.ctx, false);
  const jg = new Group();
  jg.position.set(JUMBO.x, JUMBO.y, JUMBO.z);
  jg.add(
    new Mesh(
      keep(new BoxGeometry(JUMBO.hw * 2, JUMBO.hh * 2 + 0.6, JUMBO.hw * 2)),
      lambert('#0b0c10')
    )
  );
  const screenMat = keep(
    new MeshBasicMaterial({ map: jumboTex, toneMapped: false })
  );
  for (let k = 0; k < 4; k++) {
    const sMesh = new Mesh(
      keep(new PlaneGeometry(JUMBO.hw * 2 - 0.4, JUMBO.hh * 2 - 0.2)),
      screenMat
    );
    const a = (k * Math.PI) / 2;
    sMesh.position.set(
      Math.sin(a) * (JUMBO.hw + 0.01),
      0,
      Math.cos(a) * (JUMBO.hw + 0.01)
    );
    sMesh.rotation.y = a;
    jg.add(sMesh);
  }
  const ringMat = keep(
    new MeshBasicMaterial({ color: '#2f6fe0', toneMapped: false })
  );
  for (const y of [JUMBO.hh + 0.55, -JUMBO.hh - 0.55]) {
    const r = new Mesh(
      keep(new BoxGeometry(JUMBO.hw * 2 + 0.3, 0.5, JUMBO.hw * 2 + 0.3)),
      ringMat
    );
    r.position.y = y;
    jg.add(r);
  }
  for (const [cx, cz] of [
    [-3, -3],
    [3, -3],
    [-3, 3],
    [3, 3],
  ]) {
    const c = new Mesh(
      keep(new CylinderGeometry(0.05, 0.05, roofY - JUMBO.y, 6)),
      lambert('#2a2d34')
    );
    c.position.set(cx, (roofY - JUMBO.y) / 2, cz);
    jg.add(c);
  }
  g.add(jg);

  let named = false;
  /** The ceremony's progress (0..1, arenaBeats). */
  const tick = (a: number) => {
    const now = arenaBeats(a).name > 0.5;
    if (now !== named) {
      named = now;
      drawJumbo(jumbo.ctx, named);
      jumboTex.needsUpdate = true;
    }
  };
  // The crowds don't cast shadows (thousands of them); the stage does.
  const dispose = () => {
    for (const d of disposables) d.dispose();
  };
  return { group: g, tick, dispose };
}

/**
 * Chapter 3: BYU's master's commencement in the Marriott Center (2025),
 * built live: the bowl of seats all round, nearly full; the floor's
 * graduates in navy; the stage with its drape, banner, flowers, lectern,
 * faculty and the presenter; the center-hung screens showing the ceremony
 * (his name, when it's called); the line in its roped aisle to the stairs.
 * Local to ARENA_ORIGIN; the hero, lights and camera stay in RoomScene.
 */
export function ArenaScene({ arena }: { arena: RefObject<number> }) {
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
  useFrame(() => {
    if (!root.current?.parent?.visible) return;
    live.current?.tick(arena.current ?? 0);
  });
  return <group ref={root} />;
}
