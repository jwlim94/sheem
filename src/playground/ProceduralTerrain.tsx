import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { createNoise2D } from 'simplex-noise';
import { useControls } from 'leva';
import * as THREE from 'three';

/**
 * Step 3: 텍스쳐 기반 Custom Shader
 *
 * 원리:
 * 1. 각 vertex의 normal(법선) 벡터를 shader에 전달
 * 2. normal.y 값으로 경사도를 계산 (1 = 평평, 0 = 수직 절벽)
 * 3. 경사도에 따라 풀 텍스쳐 ↔ 바위 텍스쳐를 블렌딩
 * 4. texture2D(텍스쳐, UV좌표)로 이미지에서 색상을 샘플링
 * 5. UV좌표 = vPosition.xz * scale → world-coordinate UV (SlowRoads 기법)
 *    → 텍스쳐가 월드 좌표 기준으로 타일처럼 반복됨
 *
 * sampler2D: GLSL에서 텍스쳐를 참조하는 타입 (이미지를 GPU 메모리에서 읽음)
 * texture2D(sampler, uv): 텍스쳐의 uv 좌표에서 색상(vec4)을 가져오는 함수
 */

// --- GLSL Vertex Shader ---
// 역할: 각 vertex의 normal과 position을 fragment shader에 전달
const vertexShader = /* glsl */ `
  // varying = vertex shader → fragment shader 로 값을 전달하는 변수
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vFogDepth; // fog 거리 계산용

  void main() {
    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vPosition = position;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vFogDepth = -mvPosition.z; // 카메라로부터의 거리
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// --- GLSL Fragment Shader ---
// 역할: 각 pixel의 색상을 경사도에 따라 결정
const fragmentShader = /* glsl */ `
  // uniform = JavaScript에서 shader로 전달하는 값 (Leva로 실시간 조절)
  uniform sampler2D uGrassTexture;  // 풀 텍스쳐 이미지 (GPU 메모리에 올라간 이미지)
  uniform sampler2D uRockTexture;   // 바위 텍스쳐 이미지
  uniform sampler2D uSandTexture;   // 모래 텍스쳐 이미지
  uniform float uTextureScale;      // 텍스쳐 타일 크기 (클수록 텍스쳐가 작게 반복)
  uniform vec3 uGrassTint;          // 풀 색조 보정 (텍스쳐 색상에 곱해서 톤 조절)
  uniform vec3 uRockTint;           // 바위 색조 보정
  uniform vec3 uSandTint;           // 모래 색조 보정
  uniform float uSteepnessThreshold;
  uniform float uSandHeight;        // 이 높이 이하 = 모래 (평평한 곳에서)

  // Three.js fog uniforms (자동으로 주입됨)
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;

  // vertex shader에서 전달받은 값
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vFogDepth;

  // --- GLSL용 간단한 noise 함수 ---
  // GPU에서는 simplex-noise 라이브러리를 못 쓰므로 직접 구현
  // hash: 좌표를 넣으면 유사 랜덤 값을 리턴 (noise의 재료)
  vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  // 2D noise: hash로 만든 격자 값을 부드럽게 보간
  float noise(vec2 p) {
    vec2 i = floor(p);   // 격자 좌표 (정수 부분)
    vec2 f = fract(p);   // 격자 내 위치 (소수 부분)

    // 부드러운 보간 커브 (smoothstep과 비슷)
    vec2 u = f * f * (3.0 - 2.0 * f);

    // 격자의 4개 꼭짓점에서 값을 구해서 보간
    return mix(
      mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
          dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
      mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
          dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    // --- 1. 경사도 계산 ---
    float steepness = 1.0 - vNormal.y;

    // --- 2. 풀/바위 블렌딩 (경사도 기반) ---
    // noise로 경계선 자체를 흐트러뜨림 → 점박이 대신 자연스러운 전환
    float edgeNoise = noise(vPosition.xz * 0.8) * 0.15;
    float rockBlend = smoothstep(
      uSteepnessThreshold - 0.15,       // 전환 구간을 넓힘 (0.1 → 0.15)
      uSteepnessThreshold + 0.15,
      steepness + edgeNoise              // noise로 경계를 불규칙하게
    );

    // --- 3. 텍스쳐 샘플링 (world-coordinate UV) ---
    // vPosition.xz를 UV 좌표로 사용 → 텍스쳐가 월드 좌표 기준으로 타일 반복
    // texture2D(이미지, UV) → 해당 위치의 색상(vec4)을 리턴
    vec2 texUV = vPosition.xz * uTextureScale;
    vec3 grassTex = texture2D(uGrassTexture, texUV).rgb;
    vec3 rockTex = texture2D(uRockTexture, texUV).rgb;
    vec3 sandTex = texture2D(uSandTexture, texUV).rgb;

    // --- 4. noise로 색상 변화 (SlowRoads 핵심 기법) ---
    // 텍스쳐 위에 noise를 더해서 대규모 색상 변화를 줌
    float colorNoise = noise(vPosition.xz * 0.3)  * 0.5   // 큰 패턴
                      + noise(vPosition.xz * 1.0)  * 0.3   // 중간 패턴
                      + noise(vPosition.xz * 3.0)  * 0.2;  // 작은 디테일

    // 풀: 텍스쳐 색상 × 색조 보정 × noise 변화
    vec3 grassVaried = grassTex * uGrassTint * (1.0 + colorNoise * 0.3);

    // 바위: 텍스쳐 색상 × 색조 보정 × noise 변화
    float rockNoise = noise(vPosition.xz * 2.0);
    vec3 rockVaried = rockTex * uRockTint * (1.0 + rockNoise * 0.2);

    // 모래: 텍스쳐 색상 × 색조 보정 × noise 변화
    float sandNoise = noise(vPosition.xz * 1.5);
    vec3 sandVaried = sandTex * uSandTint * (1.0 + sandNoise * 0.15);

    // --- 5. 최종 색상 합성 ---
    // 경사면: 풀 텍스쳐는 유지하되 약간 마른/어두운 톤으로 (SlowRoads 스타일)
    vec3 slopeTint = grassVaried * uRockTint;
    vec3 grassFinal = mix(grassVaried, slopeTint, rockBlend);

    // 높이 기반 모래 블렌딩: 낮은 곳 + 평평한 곳 = 모래
    // noise 2겹: 큰 불규칙 + 작은 디테일 → 경계가 자연스러움
    float sandEdgeNoise = noise(vPosition.xz * 0.3) * 2.5
                        + noise(vPosition.xz * 0.8) * 1.0;
    float sandBlend = smoothstep(
      uSandHeight + 5.0,    // 전환 구간 상단 (풀) — 넓은 전환
      uSandHeight - 2.0,    // 전환 구간 하단 (모래)
      vPosition.y + sandEdgeNoise
    );
    // 평평한 곳에서만 모래 (경사면에는 모래가 안 깔림)
    sandBlend *= smoothstep(0.3, 0.0, steepness);
    // 모래 패치: 저지대라도 전부 모래가 아니라 군데군데만
    float sandPatch = noise(vPosition.xz * 0.12) * 0.5
                    + noise(vPosition.xz * 0.4) * 0.3;
    sandBlend *= smoothstep(-0.05, 0.3, sandPatch);
    // 가파른 곳은 바위 우선
    sandBlend *= (1.0 - rockBlend);

    vec3 color = mix(grassFinal, sandVaried, sandBlend);

    // --- 6. 간단한 조명 ---
    vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
    float diffuse = max(dot(vNormal, lightDir), 0.0);
    float light = diffuse * 0.6 + 0.4;

    // --- 7. Fog (먼 곳이 자연스럽게 흐려짐) ---
    // fogFar > 0 일 때만 fog 적용 (scene에 fog이 없으면 0이므로 무시)
    vec3 finalColor = color * light;
    if (fogFar > 0.0) {
      float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      finalColor = mix(finalColor, fogColor, fogFactor);
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const noise2D = createNoise2D();

// --- 지형 높이 계산 함수 ---
// 지형 생성과 동일한 FBM 로직으로 임의의 (x,z) 좌표의 높이를 계산
// 용도: 카메라를 지면 위에 정확히 배치하기 위해
function getTerrainHeight(x: number, z: number, scale: number, height: number, persistence: number): number {
  const octaves = 4;
  let y = 0;
  let freq = scale;
  let amp = height;
  for (let o = 0; o < octaves; o++) {
    y += noise2D(x * freq, z * freq) * amp;
    freq *= 2;
    amp *= persistence;
  }
  return y;
}

export function ProceduralTerrain() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  // --- Terrain 설정 ---
  // SlowRoads 느낌: 넓고 완만한 언덕 + 멀리서 경사가 보이는 느낌
  const { size, scale, height, persistence, segments, wireframe } = useControls('Terrain', {
    size: { value: 2000, min: 500, max: 5000, step: 500, label: 'Size (크기)' },
    scale: { value: 0.005, min: 0.002, max: 0.05, step: 0.001, label: 'Scale (주파수)' },
    height: { value: 8, min: 1, max: 40, step: 1, label: 'Height (높이)' },
    persistence: { value: 0.35, min: 0.1, max: 0.7, step: 0.05, label: 'Persistence (거칠기)' },
    segments: { value: 400, min: 64, max: 600, step: 16, label: 'Segments (해상도)' },
    wireframe: { value: false, label: 'Wireframe' },
  });

  // --- 카메라를 지면 아래로 못 가게 ---
  // 매 프레임 카메라 위치의 지형 높이를 계산해서, 그 아래로 내려가면 끌어올림
  const minCameraHeight = 3; // 지면 위 최소 높이 (m)
  useFrame(() => {
    const terrainY = getTerrainHeight(camera.position.x, camera.position.z, scale, height, persistence);
    const minY = terrainY + minCameraHeight;
    if (camera.position.y < minY) {
      camera.position.y = minY;
    }
  });

  // --- 텍스쳐 로드 ---
  // useLoader: R3F가 제공하는 hook. TextureLoader로 이미지를 GPU 텍스쳐로 변환
  // public/ 폴더 기준 경로 사용 (Vite가 정적 파일로 서빙)
  const [grassTexture, rockTexture, sandTexture] = useLoader(THREE.TextureLoader, [
    '/textures/grass_diff.jpg',
    '/textures/rock_diff.jpg',
    '/textures/sand_diff.jpg',
  ]);

  // 텍스쳐 타일링 설정: RepeatWrapping → UV가 0~1 범위를 넘어도 반복
  // (기본값 ClampToEdge면 가장자리 색이 쭉 늘어남)
  useMemo(() => {
    [grassTexture, rockTexture, sandTexture].forEach((tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    });
  }, [grassTexture, rockTexture, sandTexture]);

  // --- Shader 설정 ---
  const { grassTint, rockTint, sandTint, textureScale, steepnessThreshold, sandHeight } = useControls('Shader', {
    grassTint: { value: '#e4efd7', label: '풀 색조' },
    rockTint: { value: '#deddd5', label: '경사 톤' },
    sandTint: { value: '#fffcf5', label: '모래 색조' },
    textureScale: { value: 0.08, min: 0.01, max: 0.5, step: 0.01, label: '텍스쳐 스케일' },
    steepnessThreshold: { value: 0.15, min: 0.05, max: 0.8, step: 0.05, label: '경사도 기준' },
    sandHeight: { value: 0, min: -15, max: 10, step: 0.5, label: '모래 높이 기준' },
  });

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    // --- FBM (Fractal Brownian Motion) ---
    // 여러 스케일의 noise를 합성해서 자연스러운 지형 생성
    // 각 레이어(octave)마다: 주파수 2배 ↑, 높이는 persistence배 ↓
    // persistence = 0.5면 표준, 낮을수록 작은 굴곡이 줄어 매끄러운 지형
    // → 넓고 완만한 언덕 + 약간의 디테일
    const octaves = 4;

    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      let y = 0;
      let freq = scale;     // 시작 주파수
      let amp = height;     // 시작 높이

      for (let o = 0; o < octaves; o++) {
        y += noise2D(x * freq, z * freq) * amp;
        freq *= 2;              // 주파수 2배 (더 세밀한 패턴)
        amp *= persistence;     // persistence로 감쇠 (낮을수록 부드러움)
      }

      positions.setY(i, y);
    }

    positions.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [size, scale, height, persistence, segments]);

  // --- Shader uniforms (JavaScript → GLSL 전달) ---
  // 텍스쳐는 sampler2D uniform으로 전달 (GPU 메모리의 이미지 참조)
  const uniforms = useMemo(
    () => ({
      uGrassTexture: { value: grassTexture },
      uRockTexture: { value: rockTexture },
      uSandTexture: { value: sandTexture },
      uTextureScale: { value: textureScale },
      uGrassTint: { value: new THREE.Color(grassTint) },
      uRockTint: { value: new THREE.Color(rockTint) },
      uSandTint: { value: new THREE.Color(sandTint) },
      uSteepnessThreshold: { value: steepnessThreshold },
      uSandHeight: { value: sandHeight },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // 최초 1번만 생성, 이후 업데이트는 useEffect로 처리
  );

  // Leva 값이 바뀔 때 uniform 업데이트 (렌더 중이 아닌 effect에서 ref 접근)
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  useEffect(() => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uGrassTint.value.set(grassTint);
      shaderRef.current.uniforms.uRockTint.value.set(rockTint);
      shaderRef.current.uniforms.uSandTint.value.set(sandTint);
      shaderRef.current.uniforms.uTextureScale.value = textureScale;
      shaderRef.current.uniforms.uSteepnessThreshold.value = steepnessThreshold;
      shaderRef.current.uniforms.uSandHeight.value = sandHeight;
    }
  }, [grassTint, rockTint, sandTint, textureScale, steepnessThreshold, sandHeight]);

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <shaderMaterial
        ref={shaderRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        wireframe={wireframe}
        fog={true}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
