import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { arrow, INK, rand, stroke, text } from './officeBoard';
import { FLOOR_H, HIS_PANE, HIS_WINDOW } from './valley';
import { LIGHT, SKY } from './valleyLight';

/**
 * His office, behind his window on Bridge's building (2026-11-20, the
 * user's call: through the window, the office in there, in 3D, its walls
 * white as the office the story goes into next is; on the wall farthest
 * from the window a whiteboard, written on). A room of its own in the
 * building's block (the buildings' shader cuts the window's glass away):
 * white walls, a grey carpet, light panels in the ceiling; a white table
 * with chairs round it; on the far wall the whiteboard: the search the
 * flight typed, worked through in marker. A faint reflection on the glass.
 *
 * In the valley's frame, at Bridge's scale (FLOOR_H a floor). The window
 * faces west (-x); the room runs east from it.
 */

/** The room: its depth (east), width (north-south), from its floor. */
const DEPTH = 0.5,
  WIDTH = 0.82,
  HEIGHT = FLOOR_H * 0.95;
/** The whiteboard: its size and how high its bottom is. */
const BOARD = { w: 0.37, h: 0.15, y: 0.088, cw: 1536, ch: 622 };

/** The whiteboard, drawn in marker (officeBoard.ts's hand): the search
 *  the flight typed, taken apart into its filters; a note to ship. */
export function drawHisBoard(ctx: CanvasRenderingContext2D) {
  const { cw: w, ch: h } = BOARD;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#fdfdfd');
  g.addColorStop(1, '#eef0f1');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  // Ghosts of what was wiped off.
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = INK.grey;
  for (let i = 0; i < 12; i++) {
    const x = 90 + rand(i + 11) * 1300,
      y = 80 + rand(i + 31) * 460;
    stroke(
      ctx,
      x,
      y,
      x + 90 + rand(i + 5) * 260,
      y + (rand(i) - 0.5) * 24,
      i * 9,
      10
    );
  }
  ctx.restore();
  // The search, in quotes; its parts, each to its filter.
  text(ctx, 'Search v2', 70, 118, 100, INK.black, true);
  ctx.strokeStyle = INK.red;
  stroke(ctx, 68, 142, 470, 136, 3, 9);
  text(
    ctx,
    '"profitable · Utah County · under $1.5M"',
    70,
    228,
    56,
    INK.blue,
    true
  );
  const rows: [string, string][] = [
    ['profitable', 'SDE > 0'],
    ['Utah County', 'location'],
    ['under $1.5M', 'price'],
  ];
  ctx.strokeStyle = INK.black;
  rows.forEach(([a, b], i) => {
    const y = 330 + i * 86;
    text(ctx, a, 110, y, 60, INK.black, true);
    arrow(ctx, { x: 470, y: y - 20 }, { x: 600, y: y - 20 }, 1, 40 + i * 7, 7);
    text(ctx, b, 630, y, 60, INK.blue, true);
  });
  // To the right: ranked, then the listings; and when it ships.
  ctx.strokeStyle = INK.blue;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(1010, 262, 200, 92, 18);
  ctx.stroke();
  text(ctx, 'rank', 1052, 326, 58, INK.blue, true);
  ctx.strokeStyle = INK.black;
  arrow(ctx, { x: 1110, y: 362 }, { x: 1110, y: 440 }, 1, 71, 7);
  text(ctx, 'listings', 1028, 500, 58, INK.black, true);
  text(ctx, 'ship Thu!', 1150, 590, 62, INK.red, true);
  ctx.strokeStyle = INK.red;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(1272, 570, 150, 48, -0.04, 0, Math.PI * 2);
  ctx.stroke();
  // Its aluminium frame.
  ctx.strokeStyle = '#a9adb2';
  ctx.lineWidth = 22;
  ctx.strokeRect(11, 11, w - 22, h - 22);
}

const roomVertex = /* glsl */ `
varying vec3 vP, vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = (modelMatrix * vec4(position, 1.0)).xyz;
  vN = normal;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
// Seen from inside (its back faces): white walls lighter toward the
// ceiling, darker into the corners; a grey carpet; the ceiling's light
// panels. Its own light, the room's (no sun in here).
const roomFragment = /* glsl */ `
uniform vec3 uMin, uMax;
varying vec3 vP, vN;
float span(float x, float a, float b) {
  float f = fwidth(x);
  return smoothstep(a - f, a + f, x) * (1.0 - smoothstep(b - f, b + f, x));
}
void main() {
  vec3 n = -normalize(vN), size = uMax - uMin, q = vP - uMin;
  vec3 c = n.y > 0.5 ? vec3(0.6, 0.6, 0.6) : vec3(0.94, 0.94, 0.93);
  float e;
  if (abs(n.x) > 0.5) e = min(min(q.y, size.y - q.y), min(q.z, size.z - q.z));
  else if (abs(n.z) > 0.5) e = min(min(q.y, size.y - q.y), min(q.x, size.x - q.x));
  else e = min(min(q.x, size.x - q.x), min(q.z, size.z - q.z));
  float light = (abs(n.y) < 0.5 ? 0.86 + 0.2 * (q.y / size.y) : 1.0) * (0.78 + 0.22 * smoothstep(0.0, 0.05, e));
  c *= light;
  if (n.y < -0.5) {
    // The light panels, two rows of them.
    float u = q.x / size.x, v = q.z / size.z;
    float p = max(span(u, 0.2, 0.38), span(u, 0.62, 0.8)) * max(span(v, 0.18, 0.42), span(v, 0.58, 0.82));
    c = mix(c, vec3(1.25, 1.22, 1.15), p);
  }
  gl_FragColor = vec4(c * 0.62, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// The table and chairs: flat colours, lit from the ceiling.
const propVertex = /* glsl */ `
varying vec3 vN, vColour;
void main() {
  vColour = instanceColor;
  vN = normalize(mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const propFragment = /* glsl */ `
varying vec3 vN, vColour;
void main() {
  vec3 n = normalize(vN);
  vec3 c = vColour * (0.72 + 0.3 * max(n.y, 0.0) - 0.12 * max(-n.y, 0.0) + 0.06 * n.z);
  gl_FragColor = vec4(c * 0.62, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// The glass: the sky in it, faint (added over the room).
const glassVertex = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const glassFragment = /* glsl */ `
${SKY}
varying vec3 vW;
void main() {
  vec3 v = normalize(cameraPosition - vW), n = vec3(-1.0, 0.0, 0.0);
  vec3 r = reflect(-v, n);
  float fres = pow(1.0 - abs(dot(v, n)), 3.0);
  vec3 sky = r.y >= 0.0 ? skyAt(r) : skyAt(vec3(r.x, 0.0, r.z)) * 0.45;
  gl_FragColor = vec4(sky * (0.05 + 0.45 * fres) * 0.62, 1.0);
}`;

/** His office, in the valley's frame; `ground`, the ground's height at
 *  Bridge's building (its floors count from there). */
export function buildHisOffice(ground: number) {
  const group = new Group(),
    disposables: { dispose: () => void }[] = [];
  const [wx, , wz] = HIS_WINDOW,
    y0 = ground + 2 * FLOOR_H + 0.004,
    min = new Vector3(wx + 0.004, y0, wz - WIDTH / 2),
    max = new Vector3(wx + DEPTH, y0 + HEIGHT, wz + WIDTH / 2);

  // The room.
  const roomGeo = new BoxGeometry(DEPTH - 0.004, HEIGHT, WIDTH).translate(
    (min.x + max.x) / 2,
    (min.y + max.y) / 2,
    wz
  );
  const room = new Mesh(
    roomGeo,
    new ShaderMaterial({
      vertexShader: roomVertex,
      fragmentShader: roomFragment,
      uniforms: { uMin: { value: min }, uMax: { value: max } },
      side: BackSide,
    })
  );
  group.add(room);
  disposables.push(roomGeo, room.material as ShaderMaterial);

  // The whiteboard on the far wall, facing the window.
  const el = document.createElement('canvas');
  el.width = BOARD.cw;
  el.height = BOARD.ch;
  const ctx = el.getContext('2d')!;
  drawHisBoard(ctx);
  const boardTex = new CanvasTexture(el);
  boardTex.colorSpace = SRGBColorSpace;
  boardTex.anisotropy = 8;
  const boardGeo = new PlaneGeometry(BOARD.w, BOARD.h);
  const board = new Mesh(
    boardGeo,
    new MeshBasicMaterial({ map: boardTex, color: new Color(0.9, 0.9, 0.9) })
  );
  board.rotation.y = -Math.PI / 2;
  board.position.set(max.x - 0.003, y0 + BOARD.y + BOARD.h / 2, wz);
  group.add(board);
  disposables.push(boardGeo, board.material as MeshBasicMaterial, boardTex);

  // A white table across the room.
  const props: [number, number, number, number, number, number, string][] = [
    // x (from the window), y, z (from the window's middle), w, h, d, colour
    [0.27, 0.058, 0, 0.13, 0.008, 0.3, '#f2f2f0'],
    [0.27, 0.027, 0, 0.03, 0.054, 0.18, '#9a9da2'],
  ];
  // Its chairs on the far side, facing the window (on the near side they
  // stood dark against the whiteboard); light grey.
  for (const z of [-0.1, 0, 0.1]) {
    props.push([0.37, 0.035, z, 0.04, 0.007, 0.04, '#8c9098']);
    props.push([0.388, 0.057, z, 0.005, 0.04, 0.038, '#8c9098']);
    props.push([0.37, 0.016, z, 0.006, 0.03, 0.006, '#b4b7bc']);
  }
  const propGeo = new BoxGeometry(1, 1, 1);
  const furniture = new InstancedMesh(
    propGeo,
    new ShaderMaterial({
      vertexShader: propVertex,
      fragmentShader: propFragment,
    }),
    props.length
  );
  const m = new Matrix4(),
    q = new Quaternion(),
    at = new Vector3(),
    s = new Vector3();
  props.forEach(([x, y, z, w, h, d, colour], i) => {
    furniture.setMatrixAt(
      i,
      m.compose(at.set(wx + x, y0 + y, wz + z), q, s.set(w, h, d))
    );
    furniture.setColorAt(i, new Color(colour));
  });
  group.add(furniture);
  disposables.push(propGeo, furniture.material as ShaderMaterial);

  // The glass over the window: three panes, the sky faint in it.
  const glassGeo = new PlaneGeometry(HIS_PANE * 3, FLOOR_H * 0.8);
  const glass = new Mesh(
    glassGeo,
    new ShaderMaterial({
      vertexShader: glassVertex,
      fragmentShader: glassFragment,
      uniforms: { ...LIGHT },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
  );
  glass.rotation.y = -Math.PI / 2;
  glass.position.set(wx - 0.002, y0 + FLOOR_H * 0.545, wz);
  glass.renderOrder = 2;
  group.add(glass);
  disposables.push(glassGeo, glass.material as ShaderMaterial);

  return {
    group,
    disposables,
    /** Once the marker's font is in, the board again in it. */
    redraw() {
      drawHisBoard(ctx);
      boardTex.needsUpdate = true;
    },
  };
}
