import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';

export function BasicShapes() {
  const boxRef = useRef<Mesh>(null);
  const sphereRef = useRef<Mesh>(null);

  // useFrame - 매 프레임마다 실행 (애니메이션용)
  useFrame((_, delta) => {
    if (boxRef.current) {
      boxRef.current.rotation.y += delta * 0.5;
    }
    if (sphereRef.current) {
      sphereRef.current.rotation.x += delta * 0.3;
    }
  });

  return (
    <group>
      {/* Box - 기본 육면체 */}
      <mesh ref={boxRef} position={[-2, 1, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="hotpink" />
      </mesh>

      {/* Sphere - 구 */}
      <mesh ref={sphereRef} position={[0, 1, 0]}>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshStandardMaterial color="lightblue" />
      </mesh>

      {/* Cylinder - 원기둥 */}
      <mesh position={[2, 1, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 1.5, 32]} />
        <meshStandardMaterial color="lightgreen" />
      </mesh>

      {/* Torus - 도넛 */}
      <mesh position={[4, 1, 0]} rotation={[Math.PI / 4, 0, 0]}>
        <torusGeometry args={[0.5, 0.2, 16, 32]} />
        <meshStandardMaterial color="orange" />
      </mesh>

      {/* Cone - 원뿔 */}
      <mesh position={[-4, 1, 0]}>
        <coneGeometry args={[0.5, 1.5, 32]} />
        <meshStandardMaterial color="purple" />
      </mesh>

      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
    </group>
  );
}
