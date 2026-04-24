# 04. Scene 구성 (카메라, Sky, Fog)

> Phase 2-3 맵/환경 학습 노트 - Step 4

---

## Procedural이란?

**"코드/알고리즘으로 콘텐츠를 생성하는 것"** (= 미리 만든 에셋을 사용하지 않음)

```
Procedural Terrain: noise 함수로 지형 생성 (사람이 직접 모델링하지 않음)
Procedural Texture: shader에서 noise로 색상 패턴 생성
Procedural Animation: 물리 법칙으로 움직임 계산
```

SlowRoads의 모든 지형, 도로, 풀, 나무가 procedural.
장점: 무한한 콘텐츠, 작은 파일 크기, 실시간 변형 가능.

---

## Sky (하늘)

### drei Sky → 커스텀 GradientSky로 변경

처음에는 drei의 `<Sky>` 컴포넌트를 사용:

```tsx
<Sky sunPosition={[100, 50, 100]} distance={5000} />
```

내부적으로 **Preetham 대기 산란 모델** 사용 — 물리 기반 시뮬레이션.
하지만 **Mie 산란으로 인한 하얀 빛기둥**이 태양 방향에 항상 생기는 문제가 있었음.
파라미터(mieCoefficient, mieDirectionalG 등)를 조절해도 빛기둥을 없애면 하늘색 자체가 망가지는 커플링 이슈.

**SlowRoads도 Preetham 모델을 안 쓰고 커스텀 그라데이션 셰이더를 사용.**
→ 우리도 같은 접근으로 변경.

### 현재: GradientSky (커스텀 셰이더)

```tsx
<GradientSky />
```

SphereGeometry(2500) + 커스텀 ShaderMaterial로 하늘 돔을 그림.

**원리**: 카메라에서 각 pixel을 바라보는 방향의 **elevation(높이 각도)**로 색상 결정.

```glsl
vec3 direction = normalize(vWorldPosition);
float elevation = max(direction.y, 0.0);  // 0.0=수평선, 1.0=천정
float t = pow(elevation, uExponent);       // 그라데이션 커브 조절
vec3 color = mix(uHorizonColor, uZenithColor, t);
```

- `elevation = 1.0` (천정) → zenith color (진한 파랑)
- `elevation = 0.0` (수평선) → horizon color (밝은 하늘)
- `pow(elevation, exponent)`: exponent > 1이면 수평선 색이 넓게 퍼지고 파랑은 천정 근처에만

### Leva 컨트롤

| 파라미터 | 기본값 | 의미 |
|---|---|---|
| 천정 색 | `#4a90d9` | 하늘 꼭대기 색 |
| 수평선 색 | `#b0d4e8` | 수평선 근처 색 |
| 그라데이션 커브 | 1.2 | >1: 수평선 색 넓게, <1: 파랑 넓게 |

### 렌더링 설정

```tsx
<mesh renderOrder={-1}>
  <sphereGeometry args={[2500, 32, 32]} />
  <shaderMaterial side={THREE.BackSide} depthWrite={false} depthTest={false} />
</mesh>
```

- **반지름 2500**: 카메라 `far=3000` 안에 들어와야 렌더링됨
- **BackSide**: 구체 안쪽 면을 그림 (카메라가 구체 안에 있으므로)
- **renderOrder={-1}**: 다른 모든 오브젝트보다 먼저 렌더
- **depthWrite/depthTest=false**: depth buffer에 영향 안 줌 → 항상 가장 뒤에 보임

### Preetham vs 커스텀 그라데이션 비교

| | drei Sky (Preetham) | GradientSky (커스텀) |
|---|---|---|
| 원리 | 물리 기반 대기 산란 | 단순 elevation 기반 gradient |
| 파라미터 커플링 | 있음 (하나 바꾸면 전체 영향) | 없음 (색상 독립 제어) |
| Mie 빛기둥 | 있음 (제거 어려움) | 없음 |
| 노을/석양 | 자동 (sunPosition 조절) | 수동 (색상 직접 변경) |
| SlowRoads 방식 | X | O |

### background color (유지)

```tsx
<color attach="background" args={['#87CEEB']} />
```

GradientSky 구체가 360° 덮지만, 줌아웃 시 구체 경계 부근에서 검은색이 보이는 경우가 있음.
안전 fallback으로 유지. 비용 0이라 남겨둬도 손해 없음.

---

## Clouds (구름)

### drei의 Cloud 컴포넌트

```tsx
<Clouds material={THREE.MeshBasicMaterial} limit={1000}>
  <Cloud position={[-400, 120, -600]} segments={35} bounds={[60, 8, 25]}
         volume={20} opacity={0.5} speed={0.03} fade={800} color="white" />
  ...  {/* 총 45개 */}
</Clouds>
```

`<Clouds>`: 여러 `<Cloud>`를 하나의 instanced draw call로 묶는 래퍼.
`<Cloud>`: 개별 구름. billboarded sprite 여러 장을 겹쳐서 입체감 표현.

### 주요 props

| prop | 의미 |
|---|---|
| `segments` | 구름을 구성하는 sprite 수. 많을수록 디테일↑, 비용↑ |
| `bounds` | [가로, 세로, 깊이] — sprite가 분포하는 범위 |
| `volume` | sprite 크기 배율. 클수록 뭉게구름, 작으면 얇은 구름 |
| `opacity` | 투명도 (0~1) |
| `speed` | 미세 애니메이션 속도 (구름 흐름) |
| `fade` | 카메라에서 이 거리 이상이면 페이드아웃 |
| `seed` | 생략 시 `Math.random()` → 새로고침마다 다른 형태 |

### 구름 배치 전략 (4가지 카테고리, 총 45개)

```
큰 구름 (8개):      segments 28-35, volume 15-20, fade 800  — 높은 고도에 넓고 두꺼운 구름
중간 구름 (16개):    segments 18-22, volume 9-12,  fade 600  — 사방에 고르게 분포
작은 구름 (12개):    segments 7-9,   volume 4-6,   fade 400  — 낮은 고도에 얇고 가벼움
클러스터 (3그룹×3):  segments 8-12,  volume 5-8,   fade 500  — 가까이 모여 뭉게구름 효과
```

- 45개 구름을 **-850 ~ +850 범위**에 배치 → 2000×2000 지형 전체에 걸쳐 분포
- `material={THREE.MeshBasicMaterial}`: 씬 조명 영향 안 받음 → 항상 밝은 흰색
- `limit={1000}`: 전체 Cloud의 총 segment 상한. 45개 구름의 합산 segments를 커버
- `seed` 미지정: 새로고침마다 다른 구름 형태 (지형도 매번 다르므로 통일)
- 지형이 커질수록 구름 수/분포 범위도 비례해서 늘려야 자연스러움

---

## Fog (안개)

### 원리

카메라에서 멀어질수록 물체 색상이 fog 색상으로 변해감.
**먼 곳의 지형 끝이 자연스럽게 사라지도록** 하는 기법.

```tsx
<fog attach="fog" args={['#b0d4e8', fogNear, fogFar]} />
// fogNear: 이 거리까지는 완전 맑음
// fogFar: 이 거리 이후는 완전히 fog 색으로 덮임
```

### Three.js fog + Custom Shader

Three.js가 `fogColor`, `fogNear`, `fogFar` uniform을 자동 주입.
ShaderMaterial에서 `fog: true` 설정 필요.

```glsl
// Fragment Shader에서 수동 처리
if (fogFar > 0.0) {
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  finalColor = mix(finalColor, fogColor, fogFactor);
}
```

`vFogDepth = -mvPosition.z`: 카메라로부터의 거리 (view space에서 z가 깊이).

### 주의: fogFar > 0 체크

Scene에 fog이 없으면 `fogNear=0, fogFar=0`이 기본값.
이 상태에서 smoothstep(0, 0, x) = 1.0 → **모든 것이 fog 색(검정)으로 덮임**.
반드시 `fogFar > 0.0` 체크 필요.

### 우리 프로젝트의 fog 이슈

fog 적용 시 반복적으로 "안개만 보이는" 문제 발생:
1. fog 거리가 너무 가까움 (near=30 등) → 대부분의 지형이 fog에 묻힘
2. 카메라가 지형 아래(땅속)에 위치 → 보이는 모든 것이 fog 거리 안에 있음
3. fog 없을 때 fogFar=0 → 검은 화면 (위의 체크로 해결)

**현재 상태**: fog 비활성화. 카메라 클램핑은 useFrame으로 해결됨. Fog 재적용 시 shader의 fog 코드는 이미 준비되어 있음 (`fogFar > 0.0` 체크 포함).

---

## 카메라 배치

### 문제: Procedural 지형에서의 카메라 높이

고정 높이 (y=3)로 카메라를 놓으면, 그 위치의 지형이 y=10일 수 있음 → 땅속 묻힘.

### 해결: getTerrainHeight() + useFrame 클램핑

지형 생성과 동일한 FBM 로직으로 카메라 (x,z) 위치의 높이를 계산:

```typescript
function getTerrainHeight(x, z, scale, height, persistence) {
  let y = 0, freq = scale, amp = height;
  for (let o = 0; o < 4; o++) {
    y += noise2D(x * freq, z * freq) * amp;
    freq *= 2;
    amp *= persistence;
  }
  return y;
}

// 매 프레임 카메라가 지면 아래로 내려가지 않도록 클램핑
const minCameraHeight = 3;
useFrame(() => {
  const terrainY = getTerrainHeight(camera.position.x, camera.position.z, scale, height, persistence);
  const minY = terrainY + minCameraHeight;
  if (camera.position.y < minY) {
    camera.position.y = minY;
  }
});
```

- `useFrame`: 매 프레임 실행 → 카메라 회전/줌 중에도 항상 지면 위 유지
- 초기에는 `useEffect`로 1회 배치했지만, 사용자가 OrbitControls로 카메라를 움직이면 지면 아래로 내려가는 문제 발생
- `+ 3`: 지면 위 최소 3m 유지

### 카메라 설정

```tsx
<Canvas camera={{ position: [0, 30, 40], fov: 60, far: 3000 }}>
```

- `far: 3000`: 카메라가 볼 수 있는 최대 거리. 지형이 2000×2000이므로 3000이면 충분
- GradientSky 구체 반지름 (2500) < camera `far` (3000) 이어야 하늘이 렌더링됨

### OrbitControls

```tsx
<OrbitControls target={[0, 0, -20]} maxPolarAngle={Math.PI / 2.15} />
```

- 마우스 드래그로 카메라 회전/줌/이동
- `target`: 카메라가 바라보는 중심점
- `maxPolarAngle={Math.PI / 2.15}`: 수평선 아래로 카메라가 내려가지 않도록 제한 (지형 뚫림 방지)
- SlowRoads처럼 주변을 둘러보는 효과

---

## 지형 파라미터 튜닝 (SlowRoads 스타일)

### 현재 설정값과 의미

| 파라미터 | 기본값 | Leva 범위 | 의미 |
|---|---|---|---|
| size | 2000 | 500-5000 | 지형 크기 2000m × 2000m (-1000 ~ +1000) |
| scale | 0.005 | 0.002-0.05 | 매우 낮은 주파수 → 넓고 완만한 언덕 |
| height | 8 | 1-40 | 최대 약 ±10m → 완만한 경사 (SlowRoads 스타일) |
| persistence | 0.35 | 0.1-0.7 | 작은 굴곡 최소화 → 매끄러운 초원 |
| segments | 400 | 64-600 | 401×401 = 160,801 vertex |
| steepnessThreshold | 0.15 | — | 15% 이상 경사에서 경사 톤 시작 (바위 대신 색조 변화) |

`size`는 Leva 컨트롤로 실시간 조절 가능. 지형이 커지면 같은 segments로는 해상도가 떨어지므로, segments도 함께 올려야 디테일 유지.

### SlowRoads 느낌을 위한 핵심

1. **낮은 scale (0.005)**: 언덕이 수백 미터에 걸쳐 완만하게 변화
2. **낮은 height (8)**: 완만한 경사, 절벽이 거의 없음
3. **낮은 persistence (0.35)**: 작은 울퉁불퉁 최소화 → 매끄러운 초원
4. **큰 지형 (2000+)**: 먼 곳까지 보이는 광활한 느낌
5. **낮은 steepnessThreshold (0.15)**: 약간의 경사에도 톤 변화 → 자연스러운 색 그라데이션

---

## 전체 렌더링 파이프라인 요약

```
1. JavaScript (CPU)
   - FBM으로 PlaneGeometry의 vertex 높이 설정
   - 텍스쳐 로드, uniform 값 설정

2. Vertex Shader (GPU, ~160,000번 실행)
   - 각 vertex의 world-space normal 계산
   - position, normal을 fragment shader에 전달

3. Fragment Shader (GPU, 수백만 번 실행)
   - 경사도 계산 (normal.y)
   - 풀/바위 텍스쳐 샘플링 (world-coordinate UV)
   - noise 색상 변화 적용
   - 경사 톤 블렌딩 (경사면에 마른 톤)
   - 높이 + 평탄도 + 패치 기반 모래 블렌딩
   - 조명 적용
   - (fog 적용)
   - 최종 색상 출력

4. Scene
   - GradientSky: 커스텀 그라데이션 셰이더 (elevation 기반)
   - Clouds: drei Cloud 컴포넌트 (45개, 4종류 크기/밀도, limit=1000)
   - OrbitControls: 카메라 조작
   - Leva: 실시간 파라미터 조절
```

---

## 아직 구현하지 않은 SlowRoads 기법들

- [ ] Fog (안정적인 구현 필요)
- [ ] Instanced 풀/나무 (InstancedMesh로 대량 렌더링)
- [ ] 도로 생성 (gradient minimization 기반)
- [ ] LOD (Level of Detail - 먼 곳은 저해상도)
- [ ] 무한 타일 시스템 (청크 기반 지형 확장)
- [ ] 오브젝트 풀링 (GC 방지)

---

_작성일: 2026-02-09_
