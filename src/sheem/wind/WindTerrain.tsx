import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group } from 'three';
import { windTestHeight, WIND_TEST_SPOTS } from './windTestGround';
import type { TerrainWindField, TerrainWindSample } from './terrainWind';

const MARKERS = [-12, -6, 0, 6, 12].flatMap((x) =>
  [-22, -14, -6, 2].map((z) => ({ x, z }))
);
export function WindTerrain({ field }: { field: TerrainWindField }) {
  const mesh = useMemo(() => {
    const positions: number[] = [],
      colors: number[] = [],
      indices: number[] = [];
    const n = 104,
      step = 0.5;
    for (let j = 0; j <= n; j++)
      for (let i = 0; i <= n; i++) {
        const x = -26 + i * step,
          z = -34 + j * step,
          y = windTestHeight(x, z);
        positions.push(x, y, z);
        const contour =
          Math.abs(y - Math.round(y / 0.5) * 0.5) < 0.025 && y > 0.05;
        const line = i % 4 === 0 || j % 4 === 0;
        const tint = contour ? 0.86 : line ? 0.96 : 1;
        colors.push(
          (0.64 + y * 0.025) * tint,
          (0.7 + y * 0.012) * tint,
          0.55 * tint
        );
        if (i < n && j < n) {
          const a = j * (n + 1) + i;
          indices.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2);
        }
      }
    return {
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
      indices: new Uint16Array(indices),
    };
  }, []);
  const markers = useRef<Group>(null);
  const elapsed = useRef(1);
  const sample = useMemo<TerrainWindSample>(
    () => ({
      velocity: { x: 0, y: 0, z: 0 },
      speed: 0,
      exposure: 1,
      gust: 1,
      zone: 1,
    }),
    []
  );
  const point = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
  useFrame(({ clock }, dt) => {
    elapsed.current += dt;
    if (elapsed.current < 0.125 || !markers.current) return;
    elapsed.current = 0;
    markers.current.children.forEach((node, i) => {
      const p = MARKERS[i];
      point.x = p.x;
      point.z = p.z;
      point.y = windTestHeight(p.x, p.z) + 1.08;
      field.sample(point, clock.elapsedTime, sample);
      node.visible = sample.speed > 0.01;
      node.rotation.y = Math.atan2(sample.velocity.x, sample.velocity.z);
      node.scale.set(0.6, 0.6, 0.2 + Math.min(sample.speed, 20) * 0.16);
    });
  });
  const grid = useMemo(() => {
    const vertices: number[] = [];
    const segment = (x: number, z: number, nx: number, nz: number) =>
      vertices.push(
        x,
        windTestHeight(x, z) + 0.018,
        z,
        nx,
        windTestHeight(nx, nz) + 0.018,
        nz
      );
    for (let x = -24; x <= 24; x += 2)
      for (let z = -32; z < 16; z += 0.5) segment(x, z, x, z + 0.5);
    for (let z = -32; z <= 16; z += 2)
      for (let x = -24; x < 24; x += 0.5) segment(x, z, x + 0.5, z);
    return new Float32Array(vertices);
  }, []);
  return (
    <>
      <color attach="background" args={['#e3e7db']} />
      <fog attach="fog" args={['#e3e7db', 35, 90]} />
      <hemisphereLight args={['#fff8e5', '#657653', 2]} />
      <mesh receiveShadow name="WindTestTerrain">
        <bufferGeometry onUpdate={(g) => g.computeVertexNormals()}>
          <bufferAttribute
            attach="attributes-position"
            args={[mesh.positions, 3]}
          />
          <bufferAttribute attach="attributes-color" args={[mesh.colors, 3]} />
          <bufferAttribute attach="index" args={[mesh.indices, 1]} />
        </bufferGeometry>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[grid, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color="#748666"
          transparent
          opacity={0.25}
          depthWrite={false}
        />
      </lineSegments>
      <mesh position={[0, 0.022, -8]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[21.9, 22, 128]} />
        <meshBasicMaterial color="#809074" />
      </mesh>
      <group ref={markers} name="WindFieldMarkers">
        {MARKERS.map((p) => (
          <group
            key={`${p.x}:${p.z}`}
            position={[p.x, windTestHeight(p.x, p.z) + 1.08, p.z]}
          >
            <mesh rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.04, 0.04, 0.8, 6]} />
              <meshBasicMaterial color="#718460" />
            </mesh>
            <mesh position-z={0.55} rotation-x={Math.PI / 2}>
              <coneGeometry args={[0.14, 0.3, 8]} />
              <meshBasicMaterial color="#718460" />
            </mesh>
          </group>
        ))}
      </group>
      {WIND_TEST_SPOTS.map((p) => (
        <group
          key={p.name}
          position={[p.x, windTestHeight(p.x, p.z), p.z + 1.8]}
        >
          <mesh position-y={0.4}>
            <cylinderGeometry args={[0.04, 0.04, 0.8, 6]} />
            <meshStandardMaterial color="#788363" />
          </mesh>
          <Html
            position={[0, 0.9, 0]}
            center
            distanceFactor={4}
            zIndexRange={[10, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <span className="wind-location">{p.name}</span>
          </Html>
        </group>
      ))}
    </>
  );
}
