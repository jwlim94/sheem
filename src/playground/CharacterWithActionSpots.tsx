/**
 * 캐릭터 애니메이션 테스트용 컴포넌트
 * GLTF 모델의 모든 애니메이션을 액션 스팟으로 배치하여 테스트
 * 모델 교체 시 경로만 바꾸면 새 모델의 애니메이션을 자동 감지
 */
import { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  KeyboardControls,
  useKeyboardControls,
  useGLTF,
  useAnimations,
  Html,
} from '@react-three/drei';
import { Vector3 } from 'three';
import type { Group } from 'three';

// 키 매핑 정의
const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
];

// 이동 제어에 쓰이는 애니메이션 (액션 스팟에서 제외)
const MOVEMENT_ANIMATIONS = ['Idle', 'Walk'];

// 액션 스팟 트리거 거리
const TRIGGER_DISTANCE = 2;

// 카메라 오프셋
const CAMERA_OFFSET = new Vector3(0, 8, 10);

// 랜덤 색상 생성 (애니메이션 이름 기반)
function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 55%)`;
}

export function CharacterWithActionSpots() {
  return (
    <KeyboardControls map={keyboardMap}>
      <Player />
    </KeyboardControls>
  );
}

function Player() {
  const playerRef = useRef<Group>(null);
  const speed = 5;

  const { scene, animations } = useGLTF('/models/Knight_Golden_Male.gltf');
  const { actions, names } = useAnimations(animations, playerRef);

  const [, getKeys] = useKeyboardControls();
  const { camera } = useThree();

  const currentAction = useRef<string>('');
  const [activeSpot, setActiveSpot] = useState<string | null>(null);

  // Idle/Walk 제외한 액션들을 원형으로 배치
  const actionSpots = useMemo(() => {
    const spotActions = names.filter((n) => !MOVEMENT_ANIMATIONS.includes(n));
    const radius = 8;
    return spotActions.map((name, i) => {
      const angle = (i / spotActions.length) * Math.PI * 2;
      return {
        name,
        position: new Vector3(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius,
        ),
        color: colorFromName(name),
      };
    });
  }, [names]);

  // Idle로 시작
  useEffect(() => {
    console.log('Available animations:', names);
    console.log(
      'Action spots:',
      names.filter((n) => !MOVEMENT_ANIMATIONS.includes(n)),
    );
    const idle = actions['Idle'];
    if (idle) {
      idle.play();
      currentAction.current = 'Idle';
    }
  }, [actions, names]);

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

    // 가장 가까운 액션 스팟 찾기
    const playerPos = playerRef.current.position;
    let nearestSpot: string | null = null;

    for (const spot of actionSpots) {
      const dist = playerPos.distanceTo(spot.position);
      if (dist < TRIGGER_DISTANCE) {
        nearestSpot = spot.name;
        break;
      }
    }

    // 애니메이션 결정: 스팟 안 + 정지 → 스팟 액션, 그 외 → Walk/Idle
    let targetAction: string;

    if (nearestSpot && !isMoving) {
      targetAction = nearestSpot;
    } else if (isMoving) {
      targetAction = 'Walk';
    } else {
      targetAction = 'Idle';
    }

    if (currentAction.current !== targetAction) {
      actions[currentAction.current]?.fadeOut(0.2);
      actions[targetAction]?.reset().fadeIn(0.2).play();
      currentAction.current = targetAction;
    }

    // UI 상태 업데이트
    if (nearestSpot !== activeSpot) {
      setActiveSpot(nearestSpot);
    }

    // 카메라 팔로우
    camera.position.set(
      playerPos.x + CAMERA_OFFSET.x,
      playerPos.y + CAMERA_OFFSET.y,
      playerPos.z + CAMERA_OFFSET.z,
    );
    camera.lookAt(playerPos);
  });

  return (
    <>
      <group ref={playerRef} position={[0, 0, 0]}>
        <primitive object={scene} scale={0.5} />
      </group>

      {/* 액션 스팟들 */}
      {actionSpots.map((spot) => (
        <ActionSpot
          key={spot.name}
          name={spot.name}
          position={spot.position}
          color={spot.color}
          isActive={activeSpot === spot.name}
        />
      ))}
    </>
  );
}

// 액션 스팟 시각화
function ActionSpot({
  name,
  position,
  color,
  isActive,
}: {
  name: string;
  position: Vector3;
  color: string;
  isActive: boolean;
}) {
  return (
    <group position={position}>
      {/* 바닥 원형 마커 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[TRIGGER_DISTANCE * 0.6, TRIGGER_DISTANCE * 0.8, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 1 : 0.3}
          transparent
          opacity={isActive ? 0.8 : 0.4}
        />
      </mesh>

      {/* 중앙 이펙트 */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 2 : 0.5}
        />
      </mesh>

      {/* 라벨 */}
      <Html center position={[0, 1.2, 0]}>
        <div
          style={{
            color: 'white',
            background: isActive ? color : 'rgba(0,0,0,0.7)',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            fontWeight: isActive ? 'bold' : 'normal',
            border: isActive ? '2px solid white' : 'none',
          }}
        >
          {name}
        </div>
      </Html>
    </group>
  );
}

useGLTF.preload('/models/Knight_Golden_Male.gltf');
