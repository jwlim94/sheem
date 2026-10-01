import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { Color } from 'three';
import {
  TEST_GROUND_ORIGIN,
  TEST_GROUND_SIZE,
  TEST_GROUND_STEP,
  testGroundHeight,
} from './slopeTestGround';

export function SlopeTestEnvironment() {
  const mesh = useMemo(() => {
    const nx = TEST_GROUND_SIZE[0] / TEST_GROUND_STEP;
    const nz = TEST_GROUND_SIZE[1] / TEST_GROUND_STEP;
    const positions: number[] = [],
      colors: number[] = [],
      indices: number[] = [];
    const color = new Color();
    for (let j = 0; j <= nz; j++)
      for (let i = 0; i <= nx; i++) {
        const x = TEST_GROUND_ORIGIN[0] + i * TEST_GROUND_STEP;
        const z = TEST_GROUND_ORIGIN[1] + j * TEST_GROUND_STEP;
        positions.push(x, testGroundHeight(x, z), z);
        color.set(x < -6 ? '#a8b794' : x > 6 ? '#b6ad8b' : '#9cac91');
        if (i % 2 === 0 || j % 2 === 0) color.multiplyScalar(0.97);
        colors.push(color.r, color.g, color.b);
        if (j < nz && i < nx) {
          const a = j * (nx + 1) + i,
            b = a + 1,
            c = a + nx + 1,
            d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    const grid: number[] = [];
    const segment = (x1: number, z1: number, x2: number, z2: number) => {
      grid.push(
        x1,
        testGroundHeight(x1, z1) + 0.012,
        z1,
        x2,
        testGroundHeight(x2, z2) + 0.012,
        z2
      );
    };
    for (let x = -18; x <= 18; x += 2) {
      for (let z = -22; z < 18; z += TEST_GROUND_STEP)
        segment(x, z, x, z + TEST_GROUND_STEP);
    }
    for (let z = -22; z <= 18; z += 2) {
      for (let x = -18; x < 18; x += TEST_GROUND_STEP)
        segment(x, z, x + TEST_GROUND_STEP, z);
    }
    return {
      grid: new Float32Array(grid),
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
      indices: new Uint16Array(indices),
    };
  }, []);
  return (
    <>
      <color attach="background" args={['#e3e7db']} />
      <fog attach="fog" args={['#e3e7db', 35, 80]} />
      <hemisphereLight args={['#fff8e5', '#657653', 2]} />
      <mesh name="SlopeTestGround" receiveShadow>
        <bufferGeometry
          onUpdate={(geometry) => geometry.computeVertexNormals()}
        >
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
          <bufferAttribute attach="attributes-position" args={[mesh.grid, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color="#536749"
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </lineSegments>
      {[
        { text: 'Gentle · 11°', x: -10, z: 1 },
        { text: 'Steep · 22°', x: 0, z: 1 },
        { text: 'Side slope · 14°', x: 12, z: -4 },
        { text: 'Crest → downhill', x: 0, z: -6 },
      ].map(({ text, x, z }) => (
        <group key={text} position={[x + 2, testGroundHeight(x + 2, z), z]}>
          <mesh position-y={0.55}>
            <cylinderGeometry args={[0.035, 0.035, 1.1, 6]} />
            <meshStandardMaterial color="#788369" />
          </mesh>
          <Html
            position={[0, 1.25, 0]}
            center
            distanceFactor={9}
            style={{ pointerEvents: 'none' }}
          >
            <span className="slope-marker">{text}</span>
          </Html>
        </group>
      ))}
      {Array.from({ length: 48 }, (_, i) => {
        const angle = (i / 48) * Math.PI * 2;
        const x = Math.sin(angle) * 17,
          z = -2 + Math.cos(angle) * 17;
        return (
          <mesh key={i} position={[x, testGroundHeight(x, z) + 0.04, z]}>
            <sphereGeometry args={[0.085, 6, 4]} />
            <meshStandardMaterial color="#eff0df" />
          </mesh>
        );
      })}
    </>
  );
}
