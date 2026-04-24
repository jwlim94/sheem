# 02. Custom GLSL Shader

> Phase 2-3 맵/환경 학습 노트 - Step 2

---

**큰 그림: 지형의 경사도와 높이에 따라 풀/경사톤/모래가 자연스럽게 깔리도록, 여러 기법(smoothstep 블렌딩, edge noise, 색상 noise, world-coordinate UV, patch noise)을 조합한 custom shader.**

---

## Shader란?

**GPU에서 실행되는 프로그램. 각 vertex의 위치와 각 pixel의 색상을 결정.**

### Shader는 항상 실행된다

`<meshStandardMaterial>`같은 기본 material을 써도 vertex shader + fragment shader는 **항상 실행됨**.
Three.js가 자동으로 만들어줄 뿐, 모든 3D 물체가 화면에 보이는 건 이 파이프라인을 거쳐서.

```
기본 material (MeshStandardMaterial 등):
  → Three.js가 vertex shader + fragment shader를 자동 생성
  → 범용적. "이 물체는 초록색이고 빛에 반응" 정도만 가능

Custom ShaderMaterial (우리가 쓰는 것):
  → 우리가 vertex shader + fragment shader를 직접 작성
  → "경사도에 따라 풀/바위 블렌딩" 같은 커스텀 로직 가능
```

파이프라인 자체(vertex shader → fragment shader)는 동일하고,
그 안의 **로직만 커스텀**한 것.

### 왜 Custom Shader를 쓰나?

Three.js 기본 material은 범용적이지만,
SlowRoads처럼 **경사도에 따라 풀/바위를 자동 블렌딩**하려면 custom shader가 필요.

SlowRoads: "ground shader is applied dynamically based on the steepness at each point"

### Mesh = Geometry + Material

```
Mesh (3D 물체)
├── Geometry: 형태 (vertex 위치들, 삼각형 연결 정보)
└── Material: 외관 (색상, 텍스쳐, 반사 등)
    └── ShaderMaterial: custom GLSL 코드로 외관을 직접 제어
```

### Shader와 Geometry/Material의 관계

Shader는 **Material에 속하지만, Geometry 데이터를 입력으로 받아서 처리하는 구조**.
Geometry를 수정하는 게 아니라 Geometry를 **읽어서** 렌더링에 활용하는 것.

```tsx
<mesh geometry={geometry}>        ← geometry는 여기 (vertex 위치 데이터)
  <shaderMaterial                 ← shader는 material 자리에 들어감
    vertexShader={vertexShader}
    fragmentShader={fragmentShader}
  />
</mesh>
```

Vertex Shader가 "각 vertex의 위치를 처리한다"는 건 geometry를 변형하는 게 아니라,
**3D 좌표를 2D 화면 좌표로 변환**하는 것:

```
3D 세계: vertex가 (x=10, y=5, z=-30) 에 있음
                    ↓ vertex shader
2D 화면: 이 점이 모니터의 (px=340, py=220) 에 찍혀야 함
```

카메라를 돌리면 같은 vertex도 화면의 다른 위치에 그려지는데, 그 계산을 vertex shader가 함.

```
Geometry: vertex 위치 데이터를 "가지고 있음"
                    ↓ 읽기만 함
Vertex Shader:  그 데이터를 "화면 좌표로 변환" + fragment shader에 전달
                    ↓
Fragment Shader: 전달받은 데이터로 "각 pixel 색상 결정"
```

---

## GLSL 기초

### GPU와 GLSL의 관계

```
CPU (중앙처리장치)              GPU (그래픽처리장치)
├── JavaScript 실행             ├── GLSL 코드 실행
├── React, Three.js 로직        ├── vertex shader 실행
└── 순차 처리 (한 번에 하나)      ├── fragment shader 실행
                                └── 병렬 처리 (수만 개 동시)
```

**GPU** = 하드웨어 (물리적 칩). 수천 개의 작은 코어로 단순 계산을 대량 병렬 처리.
**GLSL** = GPU 위에서 실행되는 **프로그래밍 언어**. JavaScript가 CPU에서 도는 언어인 것처럼, GLSL은 GPU에서 도는 언어.

```
CPU : JavaScript  =  GPU : GLSL
```

CPU는 "범용 두뇌", GPU는 "그래픽 전용 공장". GLSL은 그 공장의 작업 지시서.

GLSL (OpenGL Shading Language) = GPU에서 실행되는 셰이더 전용 언어.
C와 문법이 비슷하며, 두 종류의 shader를 작성:

### Vertex Shader

**역할**: 각 vertex의 위치를 처리. "어디에 그릴까?"

```glsl
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

- 입력: `position` (vertex 좌표), `normal` (법선 벡터)
- 출력: `gl_Position` (화면 좌표)
- 40,000개 vertex면 40,000번 실행 (GPU가 병렬 처리하므로 빠름)

### Fragment Shader

**역할**: 각 pixel의 색상을 결정. "무슨 색으로 칠할까?"

```glsl
void main() {
  gl_FragColor = vec4(0.3, 0.6, 0.2, 1.0); // RGBA (초록색, 불투명)
}
```

- 화면에 보이는 모든 pixel마다 실행 (수백만 번)
- 여기서 경사도 계산, 텍스쳐 샘플링, 조명 등 모든 색상 로직 처리

---

## 변수 전달 시스템

`uniform`, `varying`은 npm 패키지나 라이브러리가 아니라 **GLSL 언어 자체에 내장된 키워드**.
JavaScript에서 `const`, `let`이 변수 선언 키워드인 것처럼, GLSL에서 변수의 **역할(어디서 어디로 전달되는지)**을 지정하는 문법.

GPU 렌더링 파이프라인의 표준 데이터 전달 규칙이며, 모든 WebGL/OpenGL 프로그램이 이 방식을 따름.

```
JavaScript (CPU)                         GPU
─────────────────     uniform      ─────────────────
uGrassTint: '#8f..'   ──────────→   uniform vec3 uGrassTint;
uTextureScale: 0.08   ──────────→   uniform float uTextureScale;
                                    (vertex, fragment 둘 다 접근 가능)

                      Vertex Shader            Fragment Shader
                      ────────────   varying    ────────────
                      vNormal = ..   ─────────→  vNormal (보간된 값)
                      vPosition = .. ─────────→  vPosition (보간된 값)
```

| 키워드 | 방향 | 특성 |
|---|---|---|
| `uniform` | JS → Shader (vertex & fragment 둘 다) | 모든 vertex/pixel에서 **같은 값** |
| `varying` | Vertex Shader → Fragment Shader | vertex마다 다른 값, 사이는 **GPU가 자동 보간** |

### uniform (JavaScript → GLSL)

**JavaScript에서 shader로 전달하는 값.** 모든 vertex/pixel에서 동일한 값.

```javascript
// JavaScript (React)
uniforms: {
  uGrassTint: { value: new THREE.Color('#8fbf7a') },
  uSteepnessThreshold: { value: 0.3 },
  uGrassTexture: { value: grassTexture },  // sampler2D
}
```

```glsl
// GLSL
uniform vec3 uGrassTint;            // 색상 (RGB)
uniform float uSteepnessThreshold;  // 숫자
uniform sampler2D uGrassTexture;    // 텍스쳐 이미지
```

Leva로 uniform 값을 실시간 조절 → useEffect에서 업데이트 → shader에 즉시 반영.

### varying (Vertex → Fragment)

**vertex shader에서 fragment shader로 전달하는 값.**
vertex 사이의 값은 GPU가 자동으로 보간(interpolation).

```glsl
// Vertex Shader
varying vec3 vNormal;    // 법선 벡터
varying vec3 vPosition;  // 월드 위치
varying float vFogDepth; // 카메라 거리

void main() {
  vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vPosition = position;
  // ...
}
```

```glsl
// Fragment Shader
varying vec3 vNormal;    // vertex에서 보간된 법선
varying vec3 vPosition;  // vertex에서 보간된 위치
```

### GLSL 데이터 타입

| 타입 | 설명 | 예시 |
|---|---|---|
| `float` | 실수 | `0.3`, `1.0` |
| `vec2` | 2D 벡터 | `vec2(0.5, 0.8)` - UV 좌표 |
| `vec3` | 3D 벡터 | `vec3(1.0, 0.0, 0.0)` - 빨간색 or 방향 |
| `vec4` | 4D 벡터 | `vec4(color, 1.0)` - RGBA |
| `sampler2D` | 텍스쳐 참조 | GPU 메모리의 이미지 |

---

## 경사도 기반 블렌딩 (SlowRoads 핵심 기법)

이 기법이 custom shader를 써야 하는 핵심 이유.
기본 material(`MeshStandardMaterial` 등)로는 "경사도에 따라 자동으로 다른 텍스쳐를 섞는" 로직을 넣을 수 없음.

### 텍스쳐 = 색상의 소스

fragment shader의 역할은 "이 pixel이 무슨 색이야?"를 결정하는 것.
텍스쳐를 칠하든 단색을 칠하든 **fragment shader가 하는 일은 동일**하고, 색상을 어디서 가져오느냐만 다름.

```glsl
// 단색: 직접 색상 지정 → 전부 같은 초록 → 플라스틱 느낌
gl_FragColor = vec4(0.3, 0.6, 0.2, 1.0);

// 텍스쳐: 이미지에서 색상을 가져옴 → 풀잎 디테일이 보임
gl_FragColor = texture2D(uGrassTexture, texUV);
```

### 텍스쳐의 어느 부분을 가져오나? (World-coordinate UV)

랜덤이 아니라 **vertex의 월드 위치(xz)로 정확히 지정**:

```glsl
vec2 texUV = vPosition.xz * uTextureScale;
vec3 grassTex = texture2D(uGrassTexture, texUV).rgb;
```

텍스쳐 이미지는 UV 좌표계(0~1)가 있어서, `texture2D(이미지, UV)`는 "이 이미지의 이 좌표에 있는 색상을 줘"라는 뜻.

```
vertex가 (x=10, z=25)에 있으면:
  texUV = (10, 25) * 0.08 = (0.8, 2.0)

UV가 1.0을 넘으면? → RepeatWrapping 설정 덕분에 다시 0부터 반복
  → 텍스쳐가 타일처럼 반복됨
```

`uTextureScale`의 효과:
- **작은 값 (0.02)**: UV 변화가 느림 → 텍스쳐가 크게 보임 (늘어남)
- **큰 값 (0.2)**: UV 변화가 빠름 → 텍스쳐가 작게 반복 (촘촘한 타일)

### 원리

각 vertex의 **normal(법선) 벡터**로 경사도를 판단:

```
normal.y = 1.0  → 완전히 평평 (위를 향함) → 풀
normal.y = 0.0  → 수직 절벽 (옆을 향함) → 바위
normal.y = 0.7  → 경사면 → 풀과 바위 섞임
```

```glsl
float steepness = 1.0 - vNormal.y;
// steepness: 0.0 = 평평, 1.0 = 수직
```

### smoothstep으로 부드러운 전환

```glsl
float rockBlend = smoothstep(
  threshold - 0.15,  // 전환 시작 (풀 → 섞임)
  threshold + 0.15,  // 전환 끝 (섞임 → 경사 톤)
  steepness
);
// rockBlend: 0.0 = 풀, 1.0 = 경사 톤, 0~1 = 블렌딩

// 현재 구현: 바위 텍스쳐 대신 풀에 경사 톤을 곱함 (SlowRoads 스타일)
vec3 slopeTint = grassVaried * uRockTint;  // 풀 × 마른 톤
vec3 grassFinal = mix(grassVaried, slopeTint, rockBlend);
```

`smoothstep(a, b, x)`: x가 a~b 구간에서 0→1로 부드럽게 변화.
`mix(A, B, t)`: A와 B를 t 비율로 섞음 (t=0이면 A, t=1이면 B).

### 경사 톤 (Slope Tinting) — 바위 텍스쳐 대체

초기에는 경사면에 바위 텍스쳐를 깔았지만, SlowRoads처럼 완만한 지형에서는 바위가 부자연스러움.
현재 방식: 경사면에서 **풀 텍스쳐는 유지하되, 색조만 약간 마른/어두운 톤으로 변경**.

```glsl
// 바위 텍스쳐를 쓰는 대신, 풀 색에 경사 톤을 곱함
vec3 slopeTint = grassVaried * uRockTint;  // uRockTint = '#deddd5' (마른 톤)
vec3 grassFinal = mix(grassVaried, slopeTint, rockBlend);
```

rockBlend가 1.0이면 `grassVaried × uRockTint` → 풀의 밝기/톤만 살짝 바뀜.
풀잎 디테일은 그대로 유지되면서 경사면임을 은근히 표현.

### 높이 기반 모래 블렌딩

경사도 블렌딩과 별도로, **높이(y좌표) 기반으로 모래를 깔되** 여러 조건을 조합:

```glsl
// 1. 높이 기반 + edge noise (경계 흐트러뜨리기)
float sandEdgeNoise = noise(vPosition.xz * 0.3) * 2.5
                    + noise(vPosition.xz * 0.8) * 1.0;
float sandBlend = smoothstep(
  uSandHeight + 5.0,  // 전환 상단 (풀)
  uSandHeight - 2.0,  // 전환 하단 (모래)
  vPosition.y + sandEdgeNoise
);

// 2. 평평한 곳에서만 (경사면에는 모래가 안 깔림)
sandBlend *= smoothstep(0.3, 0.0, steepness);

// 3. 패치 noise: 저지대 전부가 아니라 군데군데만 모래
float sandPatch = noise(vPosition.xz * 0.12) * 0.5
                + noise(vPosition.xz * 0.4) * 0.3;
sandBlend *= smoothstep(-0.05, 0.3, sandPatch);

// 4. 경사 톤이 이미 적용된 곳은 모래 제외
sandBlend *= (1.0 - rockBlend);
```

핵심: `sandPatch` noise가 **모래의 존재 자체를 noise로 결정**해서 풀이 메인, 모래가 패치로 존재.

### edge noise (경계 흐트러뜨리기)

smoothstep만 쓰면 경사도에 따라 **직선적인 경계**가 생김 (부자연스러움).
noise로 경계를 불규칙하게 만듦:

```glsl
float edgeNoise = noise(vPosition.xz * 0.8) * 0.15;
float rockBlend = smoothstep(
  threshold - 0.15,
  threshold + 0.15,
  steepness + edgeNoise  // noise가 경계를 흐트러뜨림
);
```

여기서 `noise()`는 GPU Noise 섹션의 hash 기반 noise. **Perlin noise와 같은 원리**의 GPU 구현체.
noise의 "가까운 입력 → 가까운 출력" 성질 덕분에 경계가 **부드럽게 흔들림**.
`Math.random()`을 썼으면 점박이가 됐을 것.

```
edge noise 없이:
  경사도 기준으로 칼같이 나뉨
  ─────풀풀풀풀풀|바위바위바위바위─────
                ↑ 직선적 경계

edge noise 있으면:
  각 위치마다 noise가 경계를 ±0.15 흔들어줌
  ─────풀풀풀바풀풀|바풀바위바바위바위─────
                   ↑ 불규칙한 경계 (자연스러움)
```

---

## World-space Normal (월드 공간 법선)

### 문제: 카메라를 돌리면 색상이 바뀜

처음에 `normalMatrix * normal`을 사용했더니, 카메라 방향에 따라
normal 값이 변해서 풀/바위 블렌딩이 달라지는 버그 발생.

### 원인

`normalMatrix`는 camera-space 기준 → 카메라가 회전하면 normal도 회전.

### 해결: modelMatrix 사용 (world-space)

```glsl
// Bad: camera-space (카메라에 따라 변함)
vNormal = normalize(normalMatrix * normal);

// Good: world-space (항상 일정)
vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
```

`modelMatrix`는 오브젝트의 월드 변환만 포함 → 카메라와 무관.
SlowRoads도 동일하게 월드 좌표 기준으로 처리.

---

## GPU Noise (GLSL에서의 noise)

### 문제: GPU에서는 simplex-noise 라이브러리를 못 쓰음

JavaScript의 `simplex-noise`는 CPU에서 실행.
Fragment shader는 GPU에서 실행되므로 별도의 noise 함수가 필요.

### 해결: hash 기반 gradient noise 직접 구현

```glsl
// hash: 좌표 → 유사 랜덤 벡터 (noise의 재료)
vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

// 2D noise: hash 격자 값을 부드럽게 보간
float noise(vec2 p) {
  vec2 i = floor(p);  // 격자 좌표
  vec2 f = fract(p);  // 격자 내 위치
  vec2 u = f * f * (3.0 - 2.0 * f);  // 부드러운 보간 커브
  // 4개 격자점의 gradient dot product를 보간
  return mix(mix(...), mix(...), u.y);
}
```

### noise 색상 변화 (SlowRoads 핵심 기법)

SlowRoads: "perlin noise for variation in grass colours"

단색 풀은 부자연스러움. 여러 스케일의 noise를 합성해서 자연스러운 색상 변화:

```glsl
// 여러 스케일의 noise 합성 (FBM과 같은 원리)
float colorNoise = noise(vPosition.xz * 0.3) * 0.5   // 큰 패턴
                 + noise(vPosition.xz * 1.0) * 0.3   // 중간 패턴
                 + noise(vPosition.xz * 3.0) * 0.2;  // 작은 디테일

vec3 grassVaried = grassColor * (1.0 + colorNoise * 0.3);
// → 같은 초록이지만 밝기/톤이 자연스럽게 변화
```

`vPosition.xz`를 사용 = **world-coordinate** 기반 → 카메라/mesh 위치와 무관.

### Sheem에서 noise가 쓰이는 곳 정리

전부 **같은 원리**(좌표 → 부드러운 불규칙 값)이고, CPU냐 GPU냐에 따라 구현체만 다름.

| 어디서 | 무슨 noise | 용도 |
|---|---|---|
| 지형 높이 (CPU) | `simplex-noise` 라이브러리 | vertex의 y값 계산 (FBM) |
| 경계 흐트러뜨리기 (GPU) | GLSL hash noise | 풀/경사톤 경계를 불규칙하게 |
| 색상 변화 (GPU) | GLSL hash noise | 풀 색조를 위치마다 다르게 |
| 모래 경계 (GPU) | GLSL hash noise 2겹 | 모래/풀 전환 경계를 불규칙하게 |
| 모래 패치 (GPU) | GLSL hash noise 2겹 | 저지대에서 모래가 깔릴 위치를 결정 |

---

## 조명 (간단한 Diffuse)

```glsl
vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));       // 빛 방향
float diffuse = max(dot(vNormal, lightDir), 0.0);      // 법선과 빛의 각도
float light = diffuse * 0.6 + 0.4;                     // 60% 방향광 + 40% 환경광
vec3 finalColor = color * light;
```

`dot(normal, lightDir)`: 표면이 빛을 향할수록 1에 가까움 (밝음).

---

_작성일: 2026-02-09_
