import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';

// 키 매핑 정의
const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
];

export function Game() {
  return (
    <KeyboardControls map={keyboardMap}>
      <div className="w-screen h-screen">
        <Canvas camera={{ position: [0, 8, 10], fov: 50 }}>
          {/* 조명 */}
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 10, 5]} intensity={1} />

          {/* 플레이어 */}
          <Suspense fallback={null}>
            {/* TODO: Player 컴포넌트 */}
          </Suspense>

          {/* 오디오 */}
          <Suspense fallback={null}>
            {/* TODO: AudioSources 컴포넌트 */}
          </Suspense>

          {/* 임시 바닥 */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[50, 50]} />
            <meshStandardMaterial color="#1a1a2e" />
          </mesh>

          {/* 개발용 그리드 */}
          <gridHelper args={[50, 50, '#333', '#222']} />
        </Canvas>
      </div>
    </KeyboardControls>
  );
}
