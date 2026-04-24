import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  KeyboardControls,
  PointerLockControls,
  useKeyboardControls,
} from '@react-three/drei';
import * as THREE from 'three';

const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
];

const MOVE_SPEED = 10;

function CameraRig() {
  const [, getKeys] = useKeyboardControls();

  // 매 프레임 새 Vector3 할당을 피하려고 ref에 한 번만 만들고 재사용
  const forwardRef = useRef(new THREE.Vector3());
  const rightRef = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const { forward, backward, left, right } = getKeys();
    const camera = state.camera;
    const forwardVec = forwardRef.current;
    const rightVec = rightRef.current;

    // 카메라가 바라보는 방향을 forwardVec에 채움
    camera.getWorldDirection(forwardVec);
    // Y축 성분 제거 → 하늘/땅 쳐다봐도 수평 이동만 하게
    forwardVec.y = 0;
    forwardVec.normalize();

    // right = forward × up (외적). 카메라 오른쪽 방향 벡터
    rightVec.crossVectors(forwardVec, camera.up).normalize();

    const step = MOVE_SPEED * delta;
    if (forward) camera.position.addScaledVector(forwardVec, step);
    if (backward) camera.position.addScaledVector(forwardVec, -step);
    if (right) camera.position.addScaledVector(rightVec, step);
    if (left) camera.position.addScaledVector(rightVec, -step);
  });

  return null;
}

function ReferenceBoxes() {
  const positions: [number, number, number][] = [
    [10, 1, 0],
    [-10, 1, 0],
    [0, 1, 10],
    [0, 1, -10],
    [7, 1, 7],
    [-7, 1, -7],
  ];

  return (
    <>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial color="#6b7fff" />
        </mesh>
      ))}
    </>
  );
}

export function SheemApp() {
  return (
    <KeyboardControls map={keyboardMap}>
      <div className="w-screen h-screen">
        <Canvas camera={{ position: [0, 5, 10], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />

          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[50, 50]} />
            <meshStandardMaterial color="#2a2a3e" />
          </mesh>

          <ReferenceBoxes />
          <CameraRig />
          <PointerLockControls />
        </Canvas>
      </div>
    </KeyboardControls>
  );
}
