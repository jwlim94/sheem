import { useEffect, useMemo } from 'react';
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import { occupants } from './occupants';
import type { Room } from './Classmates';

/**
 * What the class has on their desks (chapter 3's classroom, 2026-11-20: the
 * desks stood bare round the one laptop, his): by each sitter's pose, an
 * open laptop (the typists, and some others), a notebook and a pen (chin on
 * hand), a closed laptop (arms crossed), here and there a phone. The open
 * laptops show the case's slides, notes or a risk sheet. (Water bottles,
 * plain cylinders, looked cheap: gone, the user's call 2026-11-20. His
 * tumbler is the classroom model's own.)
 * Every kind is one instanced mesh; built once, never animated.
 *
 * Each sitter's desk is in their seat's frame (Classmates: +X toward the
 * front, +Z to their right): its top `top` above their tier's floor, its
 * near edge `edge` ahead of the seat.
 */

/** Deterministic pseudo-random in [0, 1). */
function rand(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function canvas(
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D) => void
) {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  const ctx = el.getContext('2d');
  if (ctx) draw(ctx);
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const SANS = "-apple-system, 'Helvetica Neue', Arial, sans-serif";

/** A screen's frame: a black bezel round a page. */
function bezel(
  c: CanvasRenderingContext2D,
  w: number,
  h: number,
  page: string
) {
  c.fillStyle = '#0d0e10';
  c.fillRect(0, 0, w, h);
  c.fillStyle = page;
  c.fillRect(14, 14, w - 28, h - 28);
}

/** Lines of grey "text", their lengths varied. */
function lines(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  n: number,
  gap: number,
  seed: number,
  colour = '#b9bec7'
) {
  c.fillStyle = colour;
  for (let i = 0; i < n; i++)
    c.fillRect(x, y + i * gap, w * (0.45 + 0.55 * rand(seed + i)), 5);
}

/** The case's slides, as the class follows them. */
function slides(c: CanvasRenderingContext2D, w: number, h: number) {
  bezel(c, w, h, '#f4f5f8');
  c.fillStyle = '#1f2a44';
  c.fillRect(14, 14, w - 28, 34);
  c.fillStyle = '#c0442f';
  c.font = `700 13px ${SANS}`;
  c.fillText('CASE 7', 34, 80);
  c.fillStyle = '#1b1d22';
  c.font = `800 26px ${SANS}`;
  c.fillText('One password, four steps.', 34, 112);
  for (let i = 0; i < 4; i++) {
    const x = 34 + i * 112;
    c.fillStyle = '#ffffff';
    c.fillRect(x, 140, 100, 96);
    c.strokeStyle = '#dde0e6';
    c.strokeRect(x, 140, 100, 96);
    c.fillStyle = '#c94a3a';
    c.beginPath();
    c.arc(x + 16, 156, 8, 0, Math.PI * 2);
    c.fill();
    lines(c, x + 10, 176, 76, 3, 14, i * 9, '#9aa0aa');
  }
  lines(c, 34, 262, 200, 1, 12, 40, '#8b919b');
}

/** Their notes on the case, in a document. */
function notes(c: CanvasRenderingContext2D, w: number, h: number) {
  bezel(c, w, h, '#ffffff');
  c.fillStyle = '#eef0f3';
  c.fillRect(14, 14, w - 28, 26);
  c.fillStyle = '#1b1d22';
  c.font = `700 20px ${SANS}`;
  c.fillText('Case 7: notes', 40, 78);
  let y = 104;
  for (let b = 0; b < 4; b++) {
    c.fillStyle = '#2c2f36';
    c.beginPath();
    c.arc(46, y + 2, 3, 0, Math.PI * 2);
    c.fill();
    lines(c, 58, y, 360, b === 2 ? 2 : 3, 16, b * 13);
    if (b === 1) {
      c.fillStyle = 'rgba(255, 214, 77, 0.55)';
      c.fillRect(56, y + 12, 230, 12);
    }
    y += b === 2 ? 44 : 60;
  }
}

/** A risk register: a sheet, its cells graded green to red. */
function sheet(c: CanvasRenderingContext2D, w: number, h: number) {
  bezel(c, w, h, '#ffffff');
  c.fillStyle = '#1e7a46';
  c.fillRect(14, 14, w - 28, 22);
  const x0 = 30,
    y0 = 52,
    cw = [120, 70, 70, 70, 120],
    rh = 22;
  c.fillStyle = '#eef0f2';
  c.fillRect(
    x0,
    y0,
    cw.reduce((a, b) => a + b),
    rh
  );
  const grade = ['#cfe9d4', '#fbe7b0', '#f6c3b5'];
  for (let r = 1; r < 11; r++)
    for (let k = 0, x = x0; k < cw.length; x += cw[k], k++) {
      if (k === 3) {
        c.fillStyle = grade[Math.floor(rand(r * 3.3) * 3)];
        c.fillRect(x, y0 + r * rh, cw[k], rh);
      }
      c.fillStyle = '#a7adb6';
      c.fillRect(
        x + 8,
        y0 + r * rh + 9,
        cw[k] * (0.3 + 0.5 * rand(r * 7 + k)),
        4
      );
    }
  c.strokeStyle = '#d9dce1';
  c.lineWidth = 1;
  for (let r = 0; r <= 11; r++) {
    c.beginPath();
    c.moveTo(x0, y0 + r * rh);
    c.lineTo(x0 + 450, y0 + r * rh);
    c.stroke();
  }
  for (let k = 0, x = x0; k <= cw.length; x += cw[k] ?? 0, k++) {
    c.beginPath();
    c.moveTo(x, y0);
    c.lineTo(x, y0 + 11 * rh);
    c.stroke();
  }
}

/** An open notebook's spread: ruled pages, a margin, handwriting. */
function pages(c: CanvasRenderingContext2D, w: number, h: number) {
  c.fillStyle = '#f7f2e4';
  c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(w / 2 - 24, 0, w / 2 + 24, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.5, 'rgba(60,50,30,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(w / 2 - 24, 0, 48, h);
  c.strokeStyle = 'rgba(90, 130, 190, 0.35)';
  c.lineWidth = 1.5;
  for (let y = 40; y < h; y += 22) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
  }
  c.strokeStyle = 'rgba(200, 70, 70, 0.35)';
  for (const x of [34, w / 2 + 34]) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, h);
    c.stroke();
  }
  // Handwriting: short wavy words along the lines, the left page fuller.
  c.strokeStyle = 'rgba(30, 40, 80, 0.75)';
  c.lineWidth = 2;
  let s = 0;
  for (let y = 58; y < h - 20; y += 22)
    for (const [x0, x1] of [
      [44, w / 2 - 30],
      [w / 2 + 44, w - 30],
    ]) {
      if (x0 > w / 2 && y > h * 0.6) continue;
      let x = x0;
      const end = x0 + (x1 - x0) * (0.5 + 0.5 * rand(++s));
      while (x < end) {
        const wl = 14 + rand(++s) * 34;
        c.beginPath();
        c.moveTo(x, y);
        for (let t = 0; t <= wl; t += 3)
          c.lineTo(x + t, y - 3 - 4 * Math.abs(Math.sin(t * 0.7 + s)));
        c.stroke();
        x += wl + 7;
      }
    }
}

/** The kinds of things, each an instanced mesh; per instance a colour. */
type Kind = {
  geometry: BufferGeometry;
  material: Material;
  cast: boolean;
  colour: boolean;
  at: { m: Matrix4; c?: Color }[];
};

const ALU = ['#c9ccd1', '#6c7077', '#3d434d'].map((c) => new Color(c));
const COVER = ['#2a3550', '#1f1f22', '#a8865c', '#7d2f2f'].map(
  (c) => new Color(c)
);
const INK = ['#1d1f26', '#1f3f8a', '#b33a2e'].map((c) => new Color(c));
const PHONE = ['#1b1c1f', '#2f3b52', '#c9c2b4'].map((c) => new Color(c));

export function DeskThings({
  room,
  top,
  edge,
}: {
  room: Room;
  /** The desks' top above a tier's floor. */
  top: number;
  /** Their near edge ahead of a seat. */
  edge: number;
}) {
  const { meshes, dispose } = useMemo(() => {
    const textures = [
      canvas(512, 320, (c) => slides(c, 512, 320)),
      canvas(512, 320, (c) => notes(c, 512, 320)),
      canvas(512, 320, (c) => sheet(c, 512, 320)),
      canvas(512, 360, (c) => pages(c, 512, 360)),
    ];
    const alu = new MeshStandardMaterial({ roughness: 0.38, metalness: 0.55 }),
      matte = new MeshStandardMaterial({ roughness: 0.6 }),
      glossy = new MeshStandardMaterial({ roughness: 0.3, metalness: 0.2 });
    // A laptop (the hero's measures, a touch smaller): base 0.5 x 0.34 m.
    const base = new BoxGeometry(0.34, 0.018, 0.5),
      lid = new BoxGeometry(0.008, 0.33, 0.5),
      screen = new PlaneGeometry(0.47, 0.3).rotateY(-Math.PI / 2),
      keys = new PlaneGeometry(0.15, 0.42).rotateX(-Math.PI / 2),
      closed = new BoxGeometry(0.34, 0.03, 0.5),
      cover = new BoxGeometry(0.31, 0.008, 0.44),
      // The spread read from the chair: its pages left and right (+Z), its
      // top away from them (+X).
      paper = new PlaneGeometry(0.42, 0.29)
        .rotateX(-Math.PI / 2)
        .rotateY(-Math.PI / 2),
      pen = new CylinderGeometry(0.006, 0.006, 0.19, 8).rotateZ(Math.PI / 2),
      phone = new BoxGeometry(0.11, 0.012, 0.22);
    const kinds: Record<string, Kind> = {
      base: { geometry: base, material: alu, cast: true, colour: true, at: [] },
      lid: { geometry: lid, material: alu, cast: true, colour: true, at: [] },
      keys: {
        geometry: keys,
        material: new MeshStandardMaterial({
          color: '#1f2124',
          roughness: 0.7,
        }),
        cast: false,
        colour: false,
        at: [],
      },
      ...Object.fromEntries(
        textures.slice(0, 3).map((t, i) => [
          `screen${i}`,
          {
            geometry: screen,
            // A screen in a bright room: lit by itself, not glaring.
            material: new MeshBasicMaterial({
              map: t,
              color: '#d6dae2',
              toneMapped: false,
            }),
            cast: false,
            colour: false,
            at: [],
          },
        ])
      ),
      closed: {
        geometry: closed,
        material: alu,
        cast: true,
        colour: true,
        at: [],
      },
      cover: {
        geometry: cover,
        material: matte,
        cast: true,
        colour: true,
        at: [],
      },
      paper: {
        geometry: paper,
        material: new MeshStandardMaterial({
          map: textures[3],
          roughness: 0.95,
        }),
        cast: false,
        colour: false,
        at: [],
      },
      pen: {
        geometry: pen,
        material: glossy,
        cast: false,
        colour: true,
        at: [],
      },
      phone: {
        geometry: phone,
        material: glossy,
        cast: true,
        colour: true,
        at: [],
      },
    };

    const up = new Vector3(0, 1, 0),
      q = new Quaternion();
    for (const { seat, pose, yaw, n } of occupants(room)) {
      // The sitter's frame (unscaled: the desk is the room's), at desk height.
      const frame = new Matrix4().compose(
        new Vector3(seat.x, seat.y + top, seat.z),
        q.setFromAxisAngle(up, yaw),
        new Vector3(1, 1, 1)
      );
      const r = (k: number) => rand(n * 7.13 + k * 1.37);
      const put = (
        kind: string,
        x: number,
        y: number,
        z: number,
        turn = 0,
        c?: Color,
        tail?: Matrix4
      ) => {
        const m = frame
          .clone()
          .multiply(new Matrix4().makeTranslation(x, y, z))
          .multiply(new Matrix4().makeRotationY(turn));
        if (tail) m.multiply(tail);
        kinds[kind].at.push({ m, c });
        return m;
      };
      const laptop = () => {
        const x = edge + 0.21 + (r(1) - 0.5) * 0.05,
          z = (r(2) - 0.5) * 0.1,
          turn = (r(3) - 0.5) * 0.2,
          c = ALU[Math.floor(r(4) * ALU.length)],
          tilt = 0.2 + r(5) * 0.16;
        const b = put('base', x, 0.009, z, turn, c);
        kinds.keys.at.push({
          m: b.clone().multiply(new Matrix4().makeTranslation(0.06, 0.0095, 0)),
        });
        // The lid: from the hinge (the base's far edge), leaning back.
        const hinge = b
          .clone()
          .multiply(new Matrix4().makeTranslation(0.17, 0.009, 0))
          .multiply(new Matrix4().makeRotationZ(-tilt))
          .multiply(new Matrix4().makeTranslation(0, 0.165, 0));
        kinds.lid.at.push({ m: hinge, c });
        kinds[`screen${Math.floor(r(6) * 3)}`].at.push({
          m: hinge
            .clone()
            .multiply(new Matrix4().makeTranslation(-0.0045, 0, 0)),
        });
      };
      const notebook = () => {
        const z = (r(7) - 0.5) * 0.18,
          turn = (r(8) - 0.5) * 0.6;
        const b = put(
          'cover',
          edge + 0.2,
          0.004,
          z,
          turn,
          COVER[Math.floor(r(9) * 4)]
        );
        kinds.paper.at.push({
          m: b.clone().multiply(new Matrix4().makeTranslation(0, 0.0045, 0)),
        });
        kinds.pen.at.push({
          m: b
            .clone()
            .multiply(new Matrix4().makeTranslation(-0.02, 0.011, 0.11))
            .multiply(new Matrix4().makeRotationY(0.5 + r(10) * 0.8)),
          c: INK[Math.floor(r(11) * INK.length)],
        });
      };
      const phoneDown = (side: number) =>
        put(
          'phone',
          edge + 0.1 + r(12) * 0.08,
          0.006,
          side * (0.2 + r(13) * 0.06),
          (r(14) - 0.5) * 1.2,
          PHONE[Math.floor(r(15) * PHONE.length)]
        );
      const pick = r(0);
      if (pose === 0) laptop();
      else if (pose === 1) {
        if (pick < 0.45) laptop();
        else if (pick < 0.75) phoneDown(r(16) < 0.5 ? -1 : 1);
      } else if (pose === 2) {
        if (pick < 0.6) notebook();
        else laptop();
      } else {
        if (pick < 0.5)
          put(
            'closed',
            edge + 0.22,
            0.015,
            (r(2) - 0.5) * 0.1,
            (r(3) - 0.5) * 0.3,
            ALU[Math.floor(r(4) * ALU.length)]
          );
        else if (pick < 0.8) notebook();
        if (r(17) < 0.2) phoneDown(1);
      }
    }

    const meshes = Object.values(kinds)
      .filter((k) => k.at.length)
      .map((k) => {
        const mesh = new InstancedMesh(k.geometry, k.material, k.at.length);
        k.at.forEach(({ m, c }, i) => {
          mesh.setMatrixAt(i, m);
          if (k.colour) mesh.setColorAt(i, c ?? ALU[0]);
        });
        mesh.castShadow = k.cast;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        return mesh;
      });
    const dispose = () => {
      for (const t of textures) t.dispose();
      for (const k of Object.values(kinds)) k.material.dispose();
      for (const g of [
        base,
        lid,
        screen,
        keys,
        closed,
        cover,
        paper,
        pen,
        phone,
      ])
        g.dispose();
      for (const m of meshes) m.dispose();
    };
    return { meshes, dispose };
  }, [room, top, edge]);
  useEffect(() => dispose, [dispose]);
  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}
