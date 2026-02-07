import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { BasicShapes } from './BasicShapes';
import { Lights } from './Lights';
import { SpringAnimation } from './SpringAnimation';
import { ModelLoader } from './ModelLoader';
import { SpatialAudio } from './SpatialAudio';
import { CharacterController } from './CharacterController';

export function Playground() {
  return (
    <div className="w-screen h-screen">
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <Lights />
        <BasicShapes />
        <SpringAnimation />
        <CharacterController />
        {/* Suspense: 모델 로딩 중 fallback 표시 */}
        <Suspense fallback={null}>
          <ModelLoader />
          <SpatialAudio />
        </Suspense>
        {/* OrbitControls 제거 - 카메라가 캐릭터를 따라가므로 충돌 방지 */}
        <gridHelper args={[20, 20, '#444', '#222']} />
        <axesHelper args={[5]} />
      </Canvas>
    </div>
  );
}
