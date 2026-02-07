import { useState } from 'react';
import { useSpring, animated } from '@react-spring/three';

// animated.mesh = React Spring이 제어하는 mesh
const AnimatedMesh = animated.mesh;

export function SpringAnimation() {
  return (
    <group position={[0, 0, -5]}>
      {/* 호버 애니메이션 박스 */}
      <HoverBox position={[-2, 1, 0]} />

      {/* 클릭 애니메이션 구 */}
      <ClickSphere position={[0, 1, 0]} />

      {/* 토글 애니메이션 박스 */}
      <ToggleBox position={[2, 1, 0]} />
    </group>
  );
}

// 1. 호버하면 커지는 박스
function HoverBox({ position }: { position: [number, number, number] }) {
  const [hovered, setHovered] = useState(false);

  // useSpring: 상태 변화에 따른 부드러운 전환
  const springs = useSpring({
    scale: hovered ? 1.5 : 1,
    color: hovered ? '#ff6b6b' : '#4ecdc4',
    config: { tension: 300, friction: 10 }, // 스프링 강도 설정
  });

  return (
    <AnimatedMesh
      position={position}
      scale={springs.scale}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <animated.meshStandardMaterial color={springs.color} />
    </AnimatedMesh>
  );
}

// 2. 클릭하면 튀어오르는 구
function ClickSphere({ position }: { position: [number, number, number] }) {
  const [clicked, setClicked] = useState(false);

  const springs = useSpring({
    positionY: clicked ? 2.5 : 1, // Y 위치 애니메이션
    scale: clicked ? 1.2 : 1,
    config: { tension: 400, friction: 12 },
  });

  return (
    <AnimatedMesh
      position-x={position[0]}
      position-y={springs.positionY}
      position-z={position[2]}
      scale={springs.scale}
      onClick={() => setClicked(!clicked)}
    >
      <sphereGeometry args={[0.6, 32, 32]} />
      <meshStandardMaterial color="#ffe66d" />
    </AnimatedMesh>
  );
}

// 3. 클릭하면 회전하며 색이 바뀌는 박스
function ToggleBox({ position }: { position: [number, number, number] }) {
  const [active, setActive] = useState(false);

  const springs = useSpring({
    rotation: active ? Math.PI : 0,
    color: active ? '#a855f7' : '#22c55e',
    config: { tension: 200, friction: 20 },
  });

  return (
    <AnimatedMesh
      position={position}
      rotation-y={springs.rotation}
      onClick={() => setActive(!active)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <animated.meshStandardMaterial color={springs.color} />
    </AnimatedMesh>
  );
}
