import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  KeyboardControls,
  useKeyboardControls,
  useGLTF,
  useAnimations,
} from '@react-three/drei';
import { useControls, folder } from 'leva';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { playerPosition } from './playerState';

// 키 매핑 정의
const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
];

// 사용 가능한 모델 목록
const MODELS: Record<string, string> = {
  'Knight': '/models/Knight_Golden_Male.gltf',
  'Wizard': '/models/Wizard.gltf',
  'Worker': '/models/Worker_Male.gltf',
  'Viking': '/models/Viking_Male.gltf',
};

const _cameraOffset = new Vector3();

export function CharacterController() {
  // 모델 선택은 Player 밖에서 관리 (key로 Player 리마운트)
  const { model } = useControls('Character', {
    model: { value: 'Knight', options: Object.keys(MODELS) },
  });

  return (
    <KeyboardControls map={keyboardMap}>
      <Player key={model} modelPath={MODELS[model]} />
    </KeyboardControls>
  );
}

function Player({ modelPath }: { modelPath: string }) {
  const playerRef = useRef<Group>(null);

  const { scene, animations } = useGLTF(modelPath);
  const { actions } = useAnimations(animations, playerRef);

  const [, getKeys] = useKeyboardControls();
  const { camera } = useThree();

  const currentAction = useRef<string>('');

  // Leva 어드민 컨트롤
  const { speed, cameraHeight, cameraDistance, modelScale } = useControls('Character', {
    speed: { value: 5, min: 1, max: 20, step: 0.5 },
    modelScale: { value: 0.5, min: 0.1, max: 2, step: 0.1 },
    camera: folder({
      cameraHeight: { value: 8, min: 1, max: 30, step: 0.5 },
      cameraDistance: { value: 10, min: 2, max: 30, step: 0.5 },
    }),
  });

  // Idle로 시작
  useEffect(() => {
    const idle = actions['Idle'];
    if (idle) {
      idle.play();
      currentAction.current = 'Idle';
    }
  }, [actions]);

  useFrame((_, delta) => {
    if (!playerRef.current) return;

    const { forward, backward, left, right } = getKeys();
    const moveX = (right ? 1 : 0) - (left ? 1 : 0);
    const moveZ = (backward ? 1 : 0) - (forward ? 1 : 0);
    const isMoving = moveX !== 0 || moveZ !== 0;

    // 플레이어 위치
    playerRef.current.position.x += moveX * speed * delta;
    playerRef.current.position.z += moveZ * speed * delta;

    if (isMoving) {
      playerRef.current.rotation.y = Math.atan2(moveX, moveZ);
    }

    // 애니메이션: Walk / Idle
    const targetAction = isMoving ? 'Walk' : 'Idle';

    if (currentAction.current !== targetAction) {
      actions[currentAction.current]?.fadeOut(0.2);
      actions[targetAction]?.reset().fadeIn(0.2).play();
      currentAction.current = targetAction;
    }

    // 카메라 팔로우
    const playerPos = playerRef.current.position;
    _cameraOffset.set(0, cameraHeight, cameraDistance);
    camera.position.set(
      playerPos.x + _cameraOffset.x,
      playerPos.y + _cameraOffset.y,
      playerPos.z + _cameraOffset.z,
    );
    camera.lookAt(playerPos);

    // 공유 상태 업데이트 (SpatialAudio의 AudioListener 위치용)
    playerPosition.copy(playerPos);
  });

  return (
    <group ref={playerRef} position={[0, 0, 0]}>
      <primitive object={scene} scale={modelScale} />
    </group>
  );
}

// 모든 모델 프리로드
Object.values(MODELS).forEach((path) => useGLTF.preload(path));
