import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BasicShapes } from './BasicShapes';
import { Lights } from './Lights';
import { SpringAnimation } from './SpringAnimation';
import { ModelLoader } from './ModelLoader';

export function Lab() {
  return (
    <div className="w-screen h-screen">
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <Lights />
        <BasicShapes />
        <SpringAnimation />
        <Suspense fallback={null}>
          <ModelLoader />
        </Suspense>
        <OrbitControls />
        <gridHelper args={[20, 20, '#444', '#222']} />
        <axesHelper args={[5]} />
      </Canvas>
    </div>
  );
}
