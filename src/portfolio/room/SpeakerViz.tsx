import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Box3,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';
import type { InstancedMesh, Object3D, PointLight } from 'three';
import type { RoomAudio } from './audio';

/**
 * The soundbar on the bookcase as an RGB "stereo": while sound is on, a
 * mirrored LED spectrum (bass in the middle, treble toward both ends) dances
 * to what the viewer hears, in a slowly flowing rainbow, with falling peak
 * caps, a soft halo, a light strip along the bottom edge and coloured light
 * spilling onto the shelf. With sound off only a white standby light shows.
 */
const BANDS = 16; // per side; mirrored to 32 columns
const COLS = BANDS * 2;
const SEGS = 9; // LED segments per column
const F_LO = 45,
  F_HI = 13000;

const HSV = /* glsl */ `
vec3 hsv(float h, float s, float v) {
  vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1.0), k, s);
}
// Rainbow by distance from the centre, flowing outward over time.
vec3 rainbow(float side, float t) {
  return hsv(fract(side * 0.78 - t * 0.06), 0.8, 1.0);
}`;

const barsVertex = /* glsl */ `
attribute float aIndex, aLevel, aPeak;
varying vec2 vUv;
varying float vIndex, vLevel, vPeak;
void main() {
  vUv = uv;
  vIndex = aIndex;
  vLevel = aLevel;
  vPeak = aPeak;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;

const barsFragment = /* glsl */ `
uniform float uTime, uOn;
varying vec2 vUv;
varying float vIndex, vLevel, vPeak;
${HSV}
void main() {
  float c = ${(COLS - 1).toFixed(1)} * 0.5;
  vec3 col = rainbow(abs(vIndex - c) / c, uTime);
  float dx = abs(vUv.x - 0.5) * 2.0;
  float seg = fract(vUv.y * ${SEGS.toFixed(1)});
  float mid = (floor(vUv.y * ${SEGS.toFixed(1)}) + 0.5) / ${SEGS.toFixed(1)};
  // One rounded LED per cell.
  float led = (1.0 - smoothstep(0.6, 0.72, dx)) * smoothstep(0.1, 0.22, seg) * (1.0 - smoothstep(0.78, 0.9, seg));
  float lit = step(mid, vLevel);
  float peak = step(abs(mid - vPeak), 0.5 / ${SEGS.toFixed(1)}) * step(0.06, vPeak) * (1.0 - lit);
  vec3 hot = mix(col * 0.6, col * 1.35, clamp(vUv.y / max(vLevel, 0.1), 0.0, 1.0));
  vec3 rgb = led * (lit * hot + peak * mix(col, vec3(1.0), 0.5) * 1.3 + 0.05 * col);
  // Soft glow around the lit column.
  rgb += col * exp(-dx * 2.6) * smoothstep(vLevel + 0.2, vLevel - 0.05, vUv.y) * 0.16 * step(0.02, vLevel);
  gl_FragColor = vec4(rgb * uOn, 1.0);
}`;

const glowVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// mode 0: halo around the speaker; 1: light strip; 2: light pool on the shelf.
const glowFragment = /* glsl */ `
uniform float uTime, uOn, uEnergy, uMode;
varying vec2 vUv;
${HSV}
void main() {
  float side = abs(vUv.x - 0.5) * 2.0;
  vec3 col = rainbow(side, uTime);
  float a;
  if (uMode < 0.5) {
    vec2 d = (vUv - 0.5) * vec2(2.0, 2.0);
    a = exp(-dot(d * vec2(1.8, 3.4), d * vec2(1.8, 3.4))) * (0.02 + 0.1 * uEnergy);
  } else if (uMode < 1.5) {
    a = (1.0 - smoothstep(0.9, 1.0, side)) * (0.75 + 0.5 * uEnergy);
  } else {
    // Laid flat: vUv.y runs toward the speaker, where the light is strongest.
    a = pow(vUv.y, 2.2) * (1.0 - smoothstep(0.75, 1.0, side)) * (0.08 + 0.25 * uEnergy);
  }
  gl_FragColor = vec4(col * a * uOn, 1.0);
}`;

const additive = {
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  toneMapped: false,
} as const;

function boxOf(root: Object3D, name: string) {
  const o = root.getObjectByName(name);
  return o ? new Box3().setFromObject(o) : null;
}

export function SpeakerViz({
  room,
  audio,
  reduced,
  pool = true,
  light: withLight = true,
}: {
  room: Object3D;
  audio: RefObject<RoomAudio | null>;
  reduced: boolean;
  /** The light pool on the surface it stands on (off for one on a wall). */
  pool?: boolean;
  /** Its small coloured point light. Each place keeps one such light, so
   *  the number of lights (and the shaders) stays the same from place to
   *  place. */
  light?: boolean;
}) {
  // The speaker's front faces +Z (toward the room).
  const fit = useMemo(() => {
    room.updateMatrixWorld(true);
    const grille = boxOf(room, 'Speaker_grille'),
      body = boxOf(room, 'Speaker');
    if (!grille || !body) return null;
    return {
      x: (grille.min.x + grille.max.x) / 2,
      y: (grille.min.y + grille.max.y) / 2,
      z: grille.max.z + 0.0015,
      w: grille.max.x - grille.min.x,
      h: grille.max.y - grille.min.y,
      bodyW: body.max.x - body.min.x,
      bottom: body.min.y,
      front: body.max.z,
      shelf: body.min.y - 0.0065,
    };
  }, [room]);

  const parts = useMemo(() => {
    if (!fit) return null;
    const pitch = (fit.w * 0.96) / COLS;
    const bars = new PlaneGeometry(pitch, fit.h * 0.84);
    const index = new Float32Array(COLS).map((_, i) => i);
    bars.setAttribute('aIndex', new InstancedBufferAttribute(index, 1));
    const level = new InstancedBufferAttribute(new Float32Array(COLS), 1),
      peak = new InstancedBufferAttribute(new Float32Array(COLS), 1);
    level.setUsage(DynamicDrawUsage);
    peak.setUsage(DynamicDrawUsage);
    bars.setAttribute('aLevel', level);
    bars.setAttribute('aPeak', peak);
    const barMat = new ShaderMaterial({
      vertexShader: barsVertex,
      fragmentShader: barsFragment,
      uniforms: { uTime: { value: 0 }, uOn: { value: 0 } },
      ...additive,
    });
    const glow = (mode: number) =>
      new ShaderMaterial({
        vertexShader: glowVertex,
        fragmentShader: glowFragment,
        uniforms: {
          uTime: { value: 0 },
          uOn: { value: 0 },
          uEnergy: { value: 0 },
          uMode: { value: mode },
        },
        ...additive,
      });
    const standby = new MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      toneMapped: false,
    });
    return {
      pitch,
      bars,
      level,
      peak,
      barMat,
      halo: glow(0),
      strip: glow(1),
      pool: glow(2),
      standby,
    };
  }, [fit]);
  useEffect(
    () => () => {
      if (!parts) return;
      parts.bars.dispose();
      for (const m of [
        parts.barMat,
        parts.halo,
        parts.strip,
        parts.pool,
        parts.standby,
      ])
        m.dispose();
    },
    [parts]
  );

  // Frame-time state goes through a ref (the hook-returned value stays immutable).
  const live = useRef<typeof parts>(null);
  useEffect(() => {
    live.current = parts;
  }, [parts]);
  const columns = useRef<InstancedMesh>(null),
    light = useRef<PointLight>(null);
  // Lay the columns out once the instanced mesh exists.
  useEffect(() => {
    const m = columns.current;
    if (!m || !parts) return;
    const at = new Matrix4();
    for (let i = 0; i < COLS; i++) {
      m.setMatrixAt(
        i,
        at.makeTranslation((i - (COLS - 1) / 2) * parts.pitch, 0, 0)
      );
    }
    m.instanceMatrix.needsUpdate = true;
  }, [parts]);

  const sim = useRef({
    bins: new Uint8Array(1024),
    level: new Float32Array(BANDS),
    peak: new Float32Array(BANDS),
    hold: new Float32Array(BANDS),
    fall: new Float32Array(BANDS),
    norm: new Float32Array(BANDS),
    on: 0,
    energy: 0,
    time: 0,
    color: new Color(),
  });

  useFrame((_, delta) => {
    const g = live.current;
    if (!g) return;
    const s = sim.current,
      dt = Math.min(delta, 0.05),
      a = audio.current,
      binHz = a ? a.spectrum(s.bins) : 0,
      playing = binHz > 0;
    s.on += ((playing ? 1 : 0) - s.on) * (1 - Math.exp(-dt * 4));
    if (!reduced) s.time += dt;

    let sum = 0;
    for (let b = 0; b < BANDS; b++) {
      let target = 0;
      if (playing && reduced) {
        target = 0.35 + 0.25 * Math.cos((b / BANDS) * Math.PI); // still arc
      } else if (playing) {
        const f0 = F_LO * Math.pow(F_HI / F_LO, b / BANDS),
          f1 = F_LO * Math.pow(F_HI / F_LO, (b + 1) / BANDS);
        const i0 = Math.max(1, Math.floor(f0 / binHz)),
          i1 = Math.max(i0 + 1, Math.ceil(f1 / binHz));
        let acc = 0;
        for (let i = i0; i < i1 && i < s.bins.length; i++) acc += s.bins[i];
        const v = acc / (i1 - i0) / 255;
        // Per-band auto gain: each band is scaled to its own recent peak, so
        // quiet treble dances as much as the bass.
        s.norm[b] = Math.max(s.norm[b] * Math.exp(-dt * 0.3), v, 0.05);
        target = Math.min(1, Math.max(0, (v / s.norm[b] - 0.3) / 0.7)) ** 1.25;
      }
      // Fast rise, steady fall; peaks hold, then drop with gravity.
      s.level[b] =
        target > s.level[b] ? target : Math.max(target, s.level[b] - dt * 1.6);
      if (s.level[b] >= s.peak[b]) {
        s.peak[b] = s.level[b];
        s.hold[b] = 0.35;
        s.fall[b] = 0;
      } else if ((s.hold[b] -= dt) < 0) {
        s.fall[b] += dt * 2.2;
        s.peak[b] = Math.max(s.level[b], s.peak[b] - s.fall[b] * dt);
      }
      sum += s.level[b];
    }
    // Mirror: bass in the middle, treble toward both ends.
    const lv = g.level.array as Float32Array,
      pk = g.peak.array as Float32Array;
    for (let i = 0; i < COLS; i++) {
      const b = i < BANDS ? BANDS - 1 - i : i - BANDS;
      lv[i] = s.level[b];
      pk[i] = s.peak[b];
    }
    g.level.needsUpdate = g.peak.needsUpdate = true;
    const bass = (s.level[0] + s.level[1] + s.level[2]) / 3;
    s.energy +=
      (Math.max(sum / BANDS, bass * 0.8) - s.energy) * (1 - Math.exp(-dt * 10));

    for (const m of [g.barMat, g.halo, g.strip, g.pool]) {
      m.uniforms.uTime.value = s.time;
      m.uniforms.uOn.value = s.on;
      if (m.uniforms.uEnergy) m.uniforms.uEnergy.value = s.energy;
    }
    g.standby.opacity = 0.85 * (1 - s.on);
    const l = light.current;
    if (l) {
      // The light takes the colour flowing through the middle of the bar.
      s.color.setHSL((((-s.time * 0.06) % 1) + 1) % 1, 0.85, 0.55);
      l.color.copy(s.color);
      l.intensity = s.on * (0.04 + 0.16 * s.energy);
    }
  });

  if (!fit || !parts) return null;
  return (
    <group>
      <instancedMesh
        ref={columns}
        args={[parts.bars, parts.barMat, COLS]}
        position={[fit.x, fit.y, fit.z]}
        renderOrder={3}
        frustumCulled={false}
      />
      <mesh
        position={[fit.x, fit.y, fit.z + 0.002]}
        renderOrder={4}
        material={parts.halo}
      >
        <planeGeometry args={[fit.bodyW * 1.2, fit.h * 2.4]} />
      </mesh>
      <mesh
        position={[fit.x, fit.bottom + 0.006, fit.front + 0.001]}
        renderOrder={3}
        material={parts.strip}
      >
        <planeGeometry args={[fit.bodyW - 0.05, 0.0035]} />
      </mesh>
      {pool && (
        <mesh
          position={[fit.x, fit.shelf, fit.front + 0.04]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={3}
          material={parts.pool}
        >
          <planeGeometry args={[fit.bodyW * 1.1, 0.1]} />
        </mesh>
      )}
      <mesh
        position={[fit.x, fit.bottom + 0.016, fit.z + 0.0005]}
        material={parts.standby}
      >
        <circleGeometry args={[0.0028, 16]} />
      </mesh>
      {withLight && (
        <pointLight
          ref={light}
          position={[fit.x, fit.y, fit.front + 0.14]}
          intensity={0}
          distance={0.7}
          decay={2}
        />
      )}
    </group>
  );
}
