import { Canvas } from '@react-three/fiber';

export function SheemApp() {
  return (
    <div className="w-screen h-screen">
      <Canvas camera={{ position: [0, 5, 10], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#2a2a3e" />
        </mesh>

        <gridHelper args={[50, 50, '#444', '#333']} />
      </Canvas>
    </div>
  );
}
