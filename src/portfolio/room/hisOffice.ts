import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import { ROOM } from './bridge';
import { FLOOR_H, HIS_PANE, HIS_WINDOW } from './valley';
import { LIGHT, SKY } from './valleyLight';

/**
 * His window on Bridge's building (the flight's last shot) looks into
 * Bridge's office itself: chapter 4's room (bridge.ts; the Blender model,
 * its desks and screens, its whiteboard, its lights and shadows), drawn
 * from where the camera would stand at the office's own scale
 * (RoomScene's officeThroughWindow), first, into where the window is on
 * screen; the valley is drawn over it (2026-11-22, the user's call: a
 * miniature of boxes behind the glass read as low quality; and no people
 * in it). This is the valley's side of it:
 * - where the office stands behind the window (OFFICE_K, `origin`): its
 *   west face on the facade, its floor just under the glass's sill, so the
 *   window shows it floor to ceiling (the buildings' shader cuts the glass
 *   from the sill up to OFFICE_TOP; above it, the dark glass in front of
 *   the ceiling's void);
 * - the room's box behind the cut glass: while the office is drawn into
 *   the window, depth only, first of everything, so the sky and the ground
 *   behind the building stay out of it; otherwise a plain lit room's
 *   colour;
 * - the sky faint on the glass over it.
 */

/** Chapter 4's units (the hero's 1.38x scale) to the valley's here: a
 *  floor of Bridge's building, FLOOR_H, is 4 m. */
export const OFFICE_K = FLOOR_H / (4 * 1.38);
/** The curtain wall's glass, from this far up a floor (valleyBuildings'
 *  skin 5). */
const SILL = 0.16;
/** The office's floor under the sill (chapter 4's units): the floor shows
 *  right down at the glass's foot. */
const BELOW = 0.15;
/** How far up its floor the window is cut (the ceiling's 0.1 over it). */
export const OFFICE_TOP = SILL + ((ROOM.h - BELOW - 0.1) * OFFICE_K) / FLOOR_H;
/** Where the office is clipped off (chapter 4's x): just inside its west
 *  glass's posts and head (0.06 in), so the corridor, the glass and its
 *  door's frame, between the camera and the room, are not in the window
 *  (the cabinet stands 0.1 in, clear of it: build_bridge.py). */
export const OFFICE_CUT_X = -ROOM.hx + 0.075;

const roomVertex = /* glsl */ `
varying float vUp;
uniform float uLo, uHi;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vUp = (w.y - uLo) / (uHi - uLo);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
// A plain white office lit from its ceiling (only while the office itself
// is not drawn into the window).
const roomFragment = /* glsl */ `
varying float vUp;
void main() {
  vec3 c = vec3(0.7, 0.71, 0.72) * (0.85 + 0.25 * vUp);
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

/** His window and the office's place behind it, in the valley's frame;
 *  `ground`, the ground's height at Bridge's building (its floors count
 *  from there). */
export function buildHisOffice(ground: number) {
  const group = new Group(),
    disposables: { dispose: () => void }[] = [];
  const K = OFFICE_K,
    [wx, , wz] = HIS_WINDOW,
    base = ground + 2 * FLOOR_H,
    sill = base + SILL * FLOOR_H,
    head = base + OFFICE_TOP * FLOOR_H;
  // Chapter 4's room's middle, on its floor (its origin).
  const origin = new Vector3(wx + 0.004 + ROOM.hx * K, sill - BELOW * K, wz);

  // The room's box (seen from inside).
  const roomGeo = new BoxGeometry(
    2 * ROOM.hx * K,
    ROOM.h * K,
    2 * ROOM.hz * K
  ).translate(origin.x, origin.y + (ROOM.h * K) / 2, origin.z);
  const room = new Mesh(
    roomGeo,
    new ShaderMaterial({
      vertexShader: roomVertex,
      fragmentShader: roomFragment,
      uniforms: {
        uLo: { value: origin.y },
        uHi: { value: origin.y + ROOM.h * K },
      },
      side: BackSide,
    })
  );
  // Before the sky (-10) and everything else.
  room.renderOrder = -11;
  group.add(room);
  disposables.push(roomGeo, room.material as ShaderMaterial);

  // The window's glass, as the buildings' shader cuts it: three panes wide
  // (each HIS_PANE; 0.47 of a pane on each side of the middle one's posts),
  // the sill up to OFFICE_TOP.
  const half = 1.47 * HIS_PANE;
  const corners = [
    new Vector3(wx, sill, wz - half),
    new Vector3(wx, sill, wz + half),
    new Vector3(wx, head, wz - half),
    new Vector3(wx, head, wz + half),
  ];

  // The sky faint on it.
  const glassGeo = new PlaneGeometry(2 * half, head - sill);
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
  glass.position.set(wx - 0.002, (sill + head) / 2, wz);
  glass.renderOrder = 2;
  group.add(glass);
  disposables.push(glassGeo, glass.material as ShaderMaterial);

  return { group, disposables, origin, room, corners };
}

/** What RoomScene needs of it (ValleyScene hands it over). */
export type HisOffice = Pick<
  ReturnType<typeof buildHisOffice>,
  'origin' | 'room' | 'corners'
>;
