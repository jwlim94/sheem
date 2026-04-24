import { Canvas, useFrame } from '@react-three/fiber';
import { KeyboardControls, useKeyboardControls } from '@react-three/drei';

const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
];

const MOVE_SPEED = 10; // units per second

function CameraRig() {
  const [, getKeys] = useKeyboardControls();

  useFrame((state, delta) => {
    const { forward, backward, left, right } = getKeys();
    const camera = state.camera;

    if (forward) camera.position.z -= MOVE_SPEED * delta;
    if (backward) camera.position.z += MOVE_SPEED * delta;
    if (left) camera.position.x -= MOVE_SPEED * delta;
    if (right) camera.position.x += MOVE_SPEED * delta;
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
        </Canvas>
      </div>
    </KeyboardControls>
  );
}
