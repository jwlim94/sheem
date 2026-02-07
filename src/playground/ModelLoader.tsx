import { useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

// 무료 테스트 모델 (Khronos Group 제공)
const DUCK_MODEL_URL =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb';

export function ModelLoader() {
  return (
    <group position={[0, 0, 5]}>
      <Duck position={[0, 0, 0]} />
    </group>
  );
}

function Duck({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<Group>(null);

  // useGLTF: GLB/GLTF 모델 로딩
  const { scene } = useGLTF(DUCK_MODEL_URL);

  // 천천히 회전
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/*
        primitive: Three.js 객체를 그대로 렌더링
        clone: 같은 모델 여러 개 쓸 때 필요
      */}
      <primitive object={scene.clone()} scale={0.05} />
    </group>
  );
}

// 모델 프리로딩 (선택사항 - 성능 최적화)
useGLTF.preload(DUCK_MODEL_URL);
