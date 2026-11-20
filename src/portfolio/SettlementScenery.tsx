import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, ShaderMaterial } from 'three';
import { oceanHeightAt } from './oceanSurface';
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type SettlementKind =
  | 'harbor'
  | 'village'
  | 'farm'
  | 'fishing'
  | 'keeper'
  | 'camp';

/** Batch the many little architectural details into one draw call per settlement. */
function sceneryBuilder() {
  const parts: BufferGeometry[] = [];
  function add(
    source: BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    scale: [number, number, number] = [1, 1, 1],
    yaw = 0,
    roll = 0
  ) {
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    geometry.deleteAttribute('uv');
    geometry.scale(...scale);
    geometry.rotateZ(roll);
    geometry.rotateY(yaw);
    geometry.translate(x, y, z);
    const rgb = new Color(color);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = rgb.r;
      colors[i + 1] = rgb.g;
      colors[i + 2] = rgb.b;
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    parts.push(geometry);
  }
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    c: string,
    yaw = 0,
    roll = 0
  ) => add(new BoxGeometry(w, h, d), c, x, y, z, [1, 1, 1], yaw, roll);
  const ball = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    c: string
  ) => add(new SphereGeometry(1, 8, 6), c, x, y, z, [sx, sy, sz]);
  function cottage(
    x: number,
    z: number,
    roof: string,
    scale = 1,
    wall = '#eadbb9'
  ) {
    // All footprints face the local waterfront; variation comes from scale and palette.
    const b = (
      dx: number,
      y: number,
      dz: number,
      w: number,
      h: number,
      d: number,
      c: string
    ) =>
      box(
        x + dx * scale,
        0.45 + y * scale,
        z + dz * scale,
        w * scale,
        h * scale,
        d * scale,
        c
      );
    b(0, 0.12, 0, 3.1, 0.24, 2.7, '#b5aa8f');
    b(0, 1.2, 0, 2.65, 2.15, 2.3, wall);
    add(
      new ConeGeometry(2.28, 1.35, 4),
      roof,
      x,
      0.45 + 2.85 * scale,
      z,
      [scale, scale, scale],
      Math.PI / 4
    );
    b(0.56, 0.91, 1.18, 0.63, 1.6, 0.08, '#577b7c');
    b(-0.65, 1.32, 1.18, 0.78, 0.68, 0.07, '#597a7e');
    b(-0.65, 1.32, 1.23, 0.06, 0.68, 0.05, '#f3e8cd');
    b(-0.65, 1.32, 1.23, 0.78, 0.05, 0.05, '#f3e8cd');
    b(0.8, 2.95, -0.55, 0.34, 1.25, 0.36, '#c6baa2');
    b(-0.67, 0.9, 1.36, 0.95, 0.16, 0.3, '#9e8567');
    for (let i = 0; i < 3; i++)
      ball(
        x + (-0.92 + i * 0.24) * scale,
        0.45 + 1.01 * scale,
        z + 1.37 * scale,
        0.14 * scale,
        0.16 * scale,
        0.14 * scale,
        '#b4bd84'
      );
    b(0.55, 0.13, 1.5, 0.9, 0.18, 0.55, '#cec2a6');
  }
  function dock(x: number, z: number, length = 3.8) {
    const count = Math.ceil(length / 0.35);
    for (let i = 0; i < count; i++)
      box(
        x,
        0.06,
        z + i * 0.35,
        1.65,
        0.17,
        0.3,
        i % 2 ? '#b99971' : '#c5a77f'
      );
    for (const side of [-0.72, 0.72])
      for (const dz of [0, length - 0.5])
        box(x + side, -0.05, z + dz, 0.14, 1.4, 0.14, '#8e795f');
    box(x - 0.7, 0.55, z + 0.15, 0.1, 0.12, 0.7, '#dfd0aa');
  }
  function path(points: readonly (readonly [number, number])[]) {
    for (const [x, z] of points)
      add(
        new CylinderGeometry(0.26, 0.3, 0.055, 7),
        '#d9cfb3',
        x,
        0.47,
        z,
        [1, 1, 0.8],
        x * 0.3
      );
  }
  function fence(x: number, z: number, count: number) {
    for (let i = 0; i < count; i++)
      box(x + i * 0.65, 0.91, z, 0.08, 0.85, 0.08, '#d0be98');
    box(
      x + (count - 1) * 0.325,
      0.86,
      z,
      (count - 1) * 0.65,
      0.09,
      0.07,
      '#d0be98'
    );
    box(
      x + (count - 1) * 0.325,
      1.15,
      z,
      (count - 1) * 0.65,
      0.08,
      0.07,
      '#d0be98'
    );
  }
  function garden(x: number, z: number) {
    box(x, 0.5, z, 2.4, 0.1, 2.8, '#947c58');
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 4; col++) {
        ball(
          x - 0.8 + row * 0.8,
          0.73,
          z - 1 + col * 0.64,
          0.22,
          0.24,
          0.23,
          row % 2 ? '#97aa65' : '#608c64'
        );
      }
    fence(x - 1.3, z - 1.5, 5);
  }
  function barrel(x: number, z: number) {
    add(new CylinderGeometry(0.25, 0.28, 0.62, 8), '#9d8260', x, 0.73, z);
    add(new CylinderGeometry(0.265, 0.265, 0.065, 8), '#637b73', x, 0.87, z);
  }
  function resident(x: number, z: number, coat: string) {
    box(x, 0.83, z, 0.34, 0.65, 0.27, coat);
    ball(x, 1.34, z, 0.2, 0.22, 0.19, '#dfb994');
    add(new ConeGeometry(0.3, 0.25, 8), '#d7c28f', x, 1.61, z);
    box(x - 0.11, 0.51, z, 0.12, 0.17, 0.25, '#596b61');
    box(x + 0.11, 0.51, z, 0.12, 0.17, 0.25, '#596b61');
  }
  function finish() {
    const geometry = mergeGeometries(parts);
    parts.forEach((part) => part.dispose());
    if (!geometry) throw new Error('Could not assemble island scenery');
    geometry.computeBoundingSphere();
    return geometry;
  }
  return {
    add,
    box,
    ball,
    cottage,
    dock,
    path,
    fence,
    garden,
    barrel,
    resident,
    finish,
  };
}

function buildSettlement(kind: SettlementKind) {
  const b = sceneryBuilder();
  if (kind === 'harbor') {
    b.cottage(-3, -1.5, '#b6775b', 1);
    b.cottage(0.8, -2.6, '#6f9694', 0.9);
    b.cottage(4, -0.5, '#bb965f', 0.75);
    b.dock(-0.8, 3.6, 5);
    b.dock(3.6, 2.7, 3.4);
    b.path([
      [-1, 3],
      [-1, 2.2],
      [-1, 1.4],
      [-2, 0.8],
      [0, 0.7],
      [1, 0],
      [2, 0.4],
      [3, 0.6],
    ]);
    b.barrel(-2.1, 2.5);
    b.barrel(-2.6, 2.4);
    b.box(1.7, 0.76, 2.1, 0.8, 0.6, 0.7, '#b59770');
    b.resident(-0.5, 2, '#be795f');
    b.resident(2.3, 0.8, '#729592');
    b.fence(-5, -3.6, 5);
  } else if (kind === 'village') {
    b.cottage(-3, -1.8, '#c18d67', 0.9);
    b.cottage(1, -2.4, '#879a8a', 1.05);
    b.cottage(3.8, 1.1, '#ac7360', 0.8);
    b.garden(-3, 1.6);
    b.path([
      [0, 3.6],
      [0, 2.7],
      [0, 1.8],
      [0, 0.9],
      [-1, 0.5],
      [1, 0.5],
      [2, 1],
    ]);
    b.dock(0.3, 4, 3.2);
    b.resident(0.3, 1.6, '#a192bb');
    // A bench and a small well make a recognizable shared square.
    b.box(1.5, 0.94, 2.8, 1.5, 0.12, 0.45, '#b29368');
    for (const dx of [-0.5, 0.5])
      b.box(1.5 + dx, 0.66, 2.8, 0.1, 0.5, 0.38, '#7b8370');
    b.add(
      new CylinderGeometry(0.6, 0.66, 0.65, 10),
      '#a6afa1',
      -0.6,
      0.76,
      -1.7
    );
    b.add(
      new CylinderGeometry(0.45, 0.45, 0.04, 10),
      '#557b7d',
      -0.6,
      1.1,
      -1.7
    );
  } else if (kind === 'farm') {
    b.cottage(-2.8, -1.2, '#b37757', 1.1);
    b.garden(1.6, -0.7);
    b.garden(1.6, 2.7);
    b.fence(-5.3, -3.3, 8);
    b.fence(-4.8, 3.8, 6);
    b.barrel(-0.7, -2.6);
    b.path([
      [-1, 2.2],
      [-1, 3],
      [-1, 3.8],
      [-1, 4.6],
    ]);
    b.dock(-1, 5.2, 2.8);
    b.resident(-0.9, 1, '#729586');
    // Windmill body; blades are a single separately animated batch.
    b.add(new CylinderGeometry(0.6, 1.05, 3.8, 10), '#e1d5b8', 4, 2.35, -3);
    b.add(new ConeGeometry(1.1, 1.25, 10), '#8f7764', 4, 4.65, -3);
  } else if (kind === 'fishing') {
    b.cottage(-1.8, -0.8, '#729698', 0.86);
    b.cottage(2, -1.1, '#ae8669', 0.7);
    b.dock(-0.4, 3, 4.1);
    b.barrel(-1.7, 1.7);
    b.barrel(-2.3, 1.6);
    b.path([
      [-0.5, 2.3],
      [-0.5, 1.5],
      [0.2, 0.9],
      [1, 0.8],
    ]);
    b.resident(0.3, 1.8, '#bfa469');
    b.box(2.3, 0.8, 1.5, 1.2, 0.7, 0.7, '#ad9470');
    // Net-drying rack beside the fishing cottage.
    b.box(-4, 1.4, 0.8, 0.1, 1.8, 0.1, '#9a8465');
    b.box(-2.4, 1.4, 0.8, 0.1, 1.8, 0.1, '#9a8465');
    b.box(-3.2, 2.25, 0.8, 1.8, 0.09, 0.1, '#9a8465');
    for (let i = 0; i < 6; i++)
      b.box(-3.95 + i * 0.3, 1.7, 0.8, 0.025, 0.95, 0.025, '#9eae94');
    for (let i = 0; i < 4; i++)
      b.box(-3.2, 1.25 + i * 0.27, 0.8, 1.6, 0.025, 0.025, '#9eae94');
  } else if (kind === 'keeper') {
    b.cottage(0, 3.2, '#b48a6c', 0.53);
    b.path([
      [0.5, 4],
      [0.5, 4.8],
      [0.5, 5.4],
    ]);
    b.dock(0.5, 5.5, 2.8);
    b.barrel(1.3, 3.2);
  } else {
    b.cottage(-3.2, 1.1, '#758d82', 0.58);
    b.barrel(-2, 2);
    b.path([
      [-1.8, 1.4],
      [-1, 1.8],
      [0, 2.2],
    ]);
  }
  return b.finish();
}

export function Settlement({ kind }: { kind: SettlementKind }) {
  const geometry = useMemo(() => buildSettlement(kind), [kind]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name={`settlement-${kind}`} geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.92} />
    </mesh>
  );
}

export function Windmill({ reducedMotion }: { reducedMotion: boolean }) {
  const blades = useRef<Group>(null);
  const geometry = useMemo(() => {
    const b = sceneryBuilder();
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      b.box(
        Math.sin(angle) * 1.15,
        Math.cos(angle) * 1.15,
        0,
        0.35,
        1.9,
        0.09,
        '#e6d7b2',
        0,
        -angle
      );
      b.box(
        Math.sin(angle) * 0.75,
        Math.cos(angle) * 0.75,
        -0.07,
        0.07,
        1.7,
        0.12,
        '#927c5c',
        0,
        -angle
      );
    }
    b.ball(0, 0, 0.08, 0.23, 0.23, 0.18, '#927c5c');
    return b.finish();
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, delta) => {
    if (blades.current && !reducedMotion)
      blades.current.rotation.z -= Math.min(delta, 0.05) * 0.35;
  });
  return (
    <group
      position={[4, 3.8, -2.25]}
      name="island-windmill-blades"
      ref={blades}
    >
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </mesh>
    </group>
  );
}

export function Boat({
  position,
  heading = 0,
  sail = false,
  reducedMotion,
}: {
  position: [number, number, number];
  heading?: number;
  sail?: boolean;
  reducedMotion: boolean;
}) {
  const boat = useRef<Group>(null);
  const water = useRef<ShaderMaterial | null>(null);
  const geometry = useMemo(() => {
    const b = sceneryBuilder();
    b.ball(0, 0, 0, 0.55, 0.28, 1.2, '#7d6850');
    b.ball(0, 0.12, 0, 0.46, 0.14, 1.05, '#dfc9a1');
    b.box(0, 0.19, 0, 0.86, 0.08, 0.22, '#ae8e65');
    if (sail) {
      b.add(new CylinderGeometry(0.045, 0.06, 2.6, 6), '#977d57', 0, 1.38, 0);
      const triangle = new BufferGeometry();
      triangle.setAttribute(
        'position',
        new Float32BufferAttribute(
          [
            0.06, 0.4, 0, 0.06, 2.6, 0, 1.2, 0.4, 0, 1.2, 0.4, 0, 0.06, 2.6, 0,
            0.06, 0.4, 0,
          ],
          3
        )
      );
      triangle.computeVertexNormals();
      b.add(triangle, '#f3e7c7', 0, 0, 0);
    } else {
      b.box(0.1, 0.22, 0, 0.09, 0.06, 2.4, '#d5bb8a', 0.45);
    }
    return b.finish();
  }, [sail]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ scene }, delta) => {
    if (!boat.current) return;
    if (!water.current)
      water.current =
        (
          scene.getObjectByName('portfolio-ocean') as
            | Mesh<BufferGeometry, ShaderMaterial>
            | undefined
        )?.material ?? null;
    const time = water.current?.uniforms.time.value ?? 0;
    const [x, , z] = position;
    const height = oceanHeightAt(x, z, time);
    const dx = Math.sin(heading) * 0.4,
      dz = Math.cos(heading) * 0.4;
    const pitch = -Math.atan2(
      oceanHeightAt(x + dx, z + dz, time) - oceanHeightAt(x - dx, z - dz, time),
      0.8
    );
    const roll = Math.atan2(
      oceanHeightAt(x + dz, z - dx, time) - oceanHeightAt(x - dz, z + dx, time),
      0.8
    );
    // Reduced motion freezes the shared ocean phase, so boats remain on that surface.
    const blend = reducedMotion ? 1 : 1 - Math.exp(-8 * Math.min(delta, 0.05));
    boat.current.position.y +=
      (height - position[1] + 0.12 - boat.current.position.y) * blend;
    boat.current.rotation.x += (pitch - boat.current.rotation.x) * blend;
    boat.current.rotation.z += (roll - boat.current.rotation.z) * blend;
  });
  return (
    <group position={position} rotation-y={heading}>
      <group name={`island-boat-${position[0]}`} ref={boat}>
        <mesh geometry={geometry}>
          <meshStandardMaterial vertexColors roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}
