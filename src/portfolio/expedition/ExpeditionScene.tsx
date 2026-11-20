import { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { Color, Group, MathUtils, Mesh, Vector3 } from 'three';
import { planetVertex, planetFragment } from './shaders';
import { experiences } from '../experience';
import { advancePilot, sectors, steerTo } from './mission';
import type { Pilot } from './mission';
function makeStars() {
  let seed = 381;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  return new Float32Array(
    Array.from({ length: 2200 }, () => [
      (rand() - 0.5) * 210,
      (rand() - 0.5) * 140,
      -15 - rand() * 110,
    ]).flat()
  );
}
function Starfield() {
  const positions = useMemo(() => makeStars(), []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#b6cfdc"
        size={0.085}
        sizeAttenuation
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </points>
  );
}
function Station({
  index,
  visited,
  onCourse,
}: {
  index: number;
  visited: boolean;
  onCourse: (i: number) => void;
}) {
  const s = sectors[index];
  const globe = useRef<Group>(null);
  const uniforms = useMemo(
    () => ({
      uColor: { value: new Color(s.color) },
      uSeed: { value: index * 12.7 },
    }),
    [s.color, index]
  );
  return (
    <group
      position={[s.x, s.y, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        onCourse(index);
      }}
    >
      <group ref={globe} rotation={[0.4, 0.2, -0.4]}>
        <mesh>
          <sphereGeometry args={[s.radius, 48, 32]} />
          <shaderMaterial
            vertexShader={planetVertex}
            fragmentShader={planetFragment}
            uniforms={uniforms}
          />
        </mesh>
        <mesh rotation={[1.1, 0.2, 0.3]}>
          <torusGeometry args={[s.radius * 1.5, 0.025, 6, 100]} />
          <meshBasicMaterial color={s.color} transparent opacity={0.5} />
        </mesh>
        <mesh rotation={[1.1, 0.2, 0.3]}>
          <ringGeometry args={[s.radius * 1.28, s.radius * 1.7, 100]} />
          <meshBasicMaterial
            color={s.color}
            transparent
            opacity={0.09}
            side={2}
          />
        </mesh>
      </group>
      <Html center position={[0, s.radius + 1.35, 0]} zIndexRange={[8, 1]}>
        <button
          className={`exp-beacon ${visited ? 'is-found' : ''}`}
          onClick={() => onCourse(index)}
          aria-label={`Fly to ${experiences[index].company}`}
        >
          <small>
            {visited ? '✓ LOG RECOVERED' : `0${index + 1} / ${s.type}`}
          </small>
          <strong>
            {experiences[index].company.replace(' Digital Media', '')}
          </strong>
        </button>
      </Html>
      <mesh position={[0, -s.radius - 1.8, -0.2]}>
        <ringGeometry args={[0.65, 0.7, 48]} />
        <meshBasicMaterial
          color={visited ? '#a8e3b4' : s.color}
          transparent
          opacity={0.65}
        />
      </mesh>
    </group>
  );
}
export function ExpeditionScene({
  pilot,
  onNear,
  onFree,
  onCourse,
  found,
  reduced,
  marker,
}: {
  pilot: RefObject<Pilot>;
  onNear: (i: number | null) => void;
  onFree: () => void;
  onCourse: (i: number) => void;
  found: number[];
  reduced: boolean;
  marker: RefObject<HTMLSpanElement | null>;
}) {
  const ship = useRef<Group>(null),
    flame = useRef<Mesh>(null),
    last = useRef<number | null>(null);
  const trail = useRef<Group>(null);
  const history = useMemo(
    () => Array.from({ length: 28 }, () => new Vector3(0, -3, 0)),
    []
  );
  useFrame(({ size, camera }, delta) => {
    const p = pilot.current;
    const ox = p.x,
      oy = p.y;
    advancePilot(p, delta);
    if (last.current !== p.near) {
      last.current = p.near;
      onNear(p.near);
    }
    if (ship.current) {
      ship.current.position.set(p.x, p.y, 0.7);
      const x = p.targetX - p.x,
        y = p.targetY - p.y;
      if (Math.hypot(x, y) > 0.1) {
        const angle = Math.atan2(-x, y);
        ship.current.rotation.z +=
          Math.atan2(
            Math.sin(angle - ship.current.rotation.z),
            Math.cos(angle - ship.current.rotation.z)
          ) *
          (1 - Math.exp(-delta * 7));
      }
    }
    if (flame.current)
      flame.current.scale.y =
        Math.hypot(ox - p.x, oy - p.y) > 0.005 ? 1.8 : 0.35;
    if (!reduced) {
      for (let i = history.length - 1; i > 0; i--)
        history[i].lerp(history[i - 1], 1 - Math.exp(-delta * 18));
      history[0].set(p.x, p.y, 0.2);
      trail.current?.children.forEach((child, i) =>
        child.position.copy(history[i])
      );
    }
    if (marker.current) {
      marker.current.style.setProperty('left', `${((p.x + 29) / 58) * 100}%`);
      marker.current.style.setProperty('top', `${((17 - p.y) / 34) * 100}%`);
    }
    const desiredZ = size.width < 700 ? 66 : 49;
    camera.position.z = reduced
      ? desiredZ
      : MathUtils.damp(camera.position.z, desiredZ, 2, delta);
    camera.position.x = MathUtils.damp(
      camera.position.x,
      size.width < 700 ? p.x * 0.68 : 0,
      2,
      delta
    );
    camera.position.y = MathUtils.damp(
      camera.position.y,
      size.width < 700 ? p.y * 0.5 : 0,
      2,
      delta
    );
  });
  return (
    <>
      <color attach="background" args={['#050c18']} />
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[-10, 15, 20]}
        intensity={2.4}
        color="#e0efff"
      />
      <Starfield />
      <mesh
        position={[0, 0, -4]}
        onPointerDown={(e) => {
          if (pilot.current.paused) return;
          e.stopPropagation();
          steerTo(pilot.current, e.point.x, e.point.y);
          onFree();
        }}
      >
        <planeGeometry args={[300, 300]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Line
        points={[
          [3, 7, -2],
          [-13, 0, -2],
          [-10, -9, -2],
          [13, -7, -2],
          [21, 7, -2],
          [3, 7, -2],
        ]}
        color="#63969d"
        transparent
        opacity={0.22}
        dashed
        dashSize={0.22}
        gapSize={0.25}
        lineWidth={1}
      />
      {sectors.map((_, i) => (
        <Station
          key={i}
          index={i}
          visited={found.includes(i)}
          onCourse={onCourse}
        />
      ))}
      <group ref={trail}>
        {history.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.035 + (28 - i) * 0.002, 5, 5]} />
            <meshBasicMaterial
              color="#9ae6e6"
              transparent
              opacity={reduced ? 0 : (1 - i / 28) * 0.32}
            />
          </mesh>
        ))}
      </group>
      <group ref={ship} position={[0, -3, 0.7]} name="expedition-ship">
        <mesh rotation={[0, 0, 0]} scale={[0.5, 1, 0.25]}>
          <coneGeometry args={[0.6, 1.8, 3]} />
          <meshStandardMaterial
            color="#e8eee9"
            metalness={0.35}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, -0.25, 0.15]} scale={[1.3, 0.35, 0.18]}>
          <octahedronGeometry args={[0.7]} />
          <meshStandardMaterial
            color="#788b95"
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0, 0.2, 0.17]} scale={[0.22, 0.45, 0.16]}>
          <sphereGeometry args={[0.5, 16, 12]} />
          <meshBasicMaterial color="#a4ffff" />
        </mesh>
        <mesh ref={flame} position={[0, -1.1, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.14, 0.85, 12]} />
          <meshBasicMaterial color="#77dcff" transparent opacity={0.75} />
        </mesh>
      </group>
    </>
  );
}
