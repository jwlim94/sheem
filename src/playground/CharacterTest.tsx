import { Canvas } from '@react-three/fiber';
import { Lights } from './Lights';
import { CharacterWithActionSpots } from './CharacterWithActionSpots';

export function CharacterTest() {
  return (
    <div className="w-screen h-screen">
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <Lights />
        <CharacterWithActionSpots />
        <gridHelper args={[20, 20, '#444', '#222']} />
        <axesHelper args={[5]} />
      </Canvas>
    </div>
  );
}
