import { useMemo } from 'react';
import * as THREE from 'three';
import { useControls } from 'leva';

// --- Vertex Shader ---
// 각 vertex의 월드 좌표를 fragment shader에 전달
const vertexShader = `
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// --- Fragment Shader ---
// 카메라에서 이 pixel을 바라보는 방향의 elevation(높이 각도)으로 색상 결정
// elevation 1.0 (천정) → zenith color, 0.0 (수평선) → horizon color
const fragmentShader = `
uniform vec3 uZenithColor;
uniform vec3 uHorizonColor;
uniform float uExponent;

varying vec3 vWorldPosition;

void main() {
  vec3 direction = normalize(vWorldPosition);

  // direction.y: 위를 볼수록 1.0, 수평선이 0.0, 아래가 음수
  float elevation = max(direction.y, 0.0);

  // exponent로 그라데이션 커브 조절
  // > 1.0: 수평선 색이 더 넓게, 파랑은 천정 근처에만
  // < 1.0: 파랑이 수평선까지 넓게 퍼짐
  float t = pow(elevation, uExponent);

  vec3 color = mix(uHorizonColor, uZenithColor, t);
  gl_FragColor = vec4(color, 1.0);
}
`;

export function GradientSky() {
  const { zenithColor, horizonColor, exponent } = useControls('Sky', {
    zenithColor: { value: '#4a90d9', label: '천정 색' },
    horizonColor: { value: '#b0d4e8', label: '수평선 색' },
    exponent: { value: 1.2, min: 0.3, max: 3.0, step: 0.1, label: '그라데이션 커브' },
  });

  const uniforms = useMemo(
    () => ({
      uZenithColor: { value: new THREE.Color(zenithColor) },
      uHorizonColor: { value: new THREE.Color(horizonColor) },
      uExponent: { value: exponent },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Leva 값이 바뀔 때 uniform 업데이트 (useMemo 재생성 대신 직접 수정)
  uniforms.uZenithColor.value.set(zenithColor);
  uniforms.uHorizonColor.value.set(horizonColor);
  uniforms.uExponent.value = exponent;

  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[2500, 32, 32]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
