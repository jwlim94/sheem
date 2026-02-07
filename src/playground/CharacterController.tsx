import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { KeyboardControls, useKeyboardControls } from '@react-three/drei';
import { Vector3 } from 'three';
import type { Group } from 'three';

// 키 매핑 정의
const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
];

// 카메라 오프셋 (캐릭터로부터의 상대 위치)
const CAMERA_OFFSET = new Vector3(0, 8, 10);

// KeyboardControls로 전체를 감싸야 함
export function CharacterController() {
  return (
    <KeyboardControls map={keyboardMap}>
      <Player />
    </KeyboardControls>
  );
}

function Player() {
  const playerRef = useRef<Group>(null);
  const speed = 5;

  const [, getKeys] = useKeyboardControls();
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (!playerRef.current) return;

    const { forward, backward, left, right } = getKeys();

    const moveX = (right ? 1 : 0) - (left ? 1 : 0);
    const moveZ = (backward ? 1 : 0) - (forward ? 1 : 0);

    playerRef.current.position.x += moveX * speed * delta;
    playerRef.current.position.z += moveZ * speed * delta;

    if (moveX !== 0 || moveZ !== 0) {
      playerRef.current.rotation.y = Math.atan2(moveX, moveZ);
    }

    // 카메라가 캐릭터를 따라가도록 설정
    const playerPosition = playerRef.current.position;
    camera.position.set(
      playerPosition.x + CAMERA_OFFSET.x,
      playerPosition.y + CAMERA_OFFSET.y,
      playerPosition.z + CAMERA_OFFSET.z
    );
    camera.lookAt(playerPosition);
  });

  return (
    <group ref={playerRef} position={[0, 0.5, 0]}>
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="#7c3aed" />
      </mesh>
    </group>
  );
}
