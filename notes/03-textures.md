# 03. 텍스쳐 (Textures)

> Phase 2-3 맵/환경 학습 노트 - Step 3

---

## 텍스쳐란?

**3D 표면에 입히는 이미지.** 단색 대신 실제 풀/바위 사진을 사용하면 사실감 증가.

```
이전: uniform vec3 uGrassColor → 단색 초록 (#4a8c3f)
이후: uniform sampler2D uGrassTexture → 풀 사진 이미지 (1024x1024px)
```

### 단색 vs 텍스쳐

| | 단색 | 텍스쳐 |
|---|---|---|
| 사실감 | 낮음 (게임보이 느낌) | 높음 (풀잎, 바위 결 보임) |
| GPU 비용 | 거의 없음 | 약간 (텍스쳐 메모리 + 샘플링) |
| 유연성 | noise로만 변화 | 텍스쳐 + noise + tint 조합 |

---

## 텍스쳐 로딩 (React Three Fiber)

### useLoader

R3F가 제공하는 hook. Three.js의 TextureLoader를 React 방식으로 사용.

```typescript
const [grassTexture, rockTexture] = useLoader(THREE.TextureLoader, [
  '/textures/grass_diff.jpg',   // public/ 폴더 기준 경로
  '/textures/rock_diff.jpg',
]);
```

- Vite가 `public/` 폴더를 정적 파일로 서빙 → `/textures/...`로 접근 가능
- useLoader는 로딩 완료까지 Suspense를 사용 (자동 대기)
- 로딩된 텍스쳐는 GPU 메모리에 올라감 (THREE.Texture 객체)

### 텍스쳐 소스: Polyhaven

무료 CC0 라이선스 텍스쳐 제공 사이트.
API로 직접 다운로드 가능:

```
https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{asset_id}/{asset_id}_diff_1k.jpg
```

현재 사용 중:
- `forrest_ground_01` → grass_diff.jpg (숲 바닥: 풀, 낙엽, 흙)
- `rock_boulder_dry` → rock_diff.jpg (건조한 바위 표면) — 현재 경사 톤으로 대체되어 미사용
- `coast_sand_01` → sand_diff.jpg (해안 모래 표면)

---

## RepeatWrapping (타일링)

### 문제: UV가 0~1을 넘으면?

텍스쳐의 UV 좌표는 원래 0~1 범위 (이미지의 왼쪽위~오른쪽아래).
우리는 `vPosition.xz * scale`을 UV로 사용하므로 0~1을 훨씬 넘음.

### 기본값 (ClampToEdge)

UV가 범위를 넘으면 **가장자리 색이 쭉 늘어남** → 줄무늬 아티팩트.

### 해결: RepeatWrapping

UV가 범위를 넘으면 **텍스쳐가 타일처럼 반복**.

```typescript
grassTexture.wrapS = THREE.RepeatWrapping;  // S = 가로 방향
grassTexture.wrapT = THREE.RepeatWrapping;  // T = 세로 방향
```

이러면 UV (3.7, 2.1)은 텍스쳐의 (0.7, 0.1) 위치를 샘플링 (소수 부분만 사용).

---

## GLSL에서 텍스쳐 사용

### sampler2D

GLSL에서 텍스쳐를 참조하는 타입. GPU 메모리에 올라간 이미지를 가리킴.

```glsl
uniform sampler2D uGrassTexture;  // JavaScript에서 전달된 텍스쳐
```

### texture2D(sampler, uv)

텍스쳐의 특정 UV 좌표에서 색상(vec4)을 가져오는 함수.

```glsl
vec2 texUV = vPosition.xz * uTextureScale;
vec3 grassColor = texture2D(uGrassTexture, texUV).rgb;
// .rgb → vec4에서 RGB 채널만 추출 (alpha 제외)
```

---

## World-coordinate UV (SlowRoads 핵심 기법)

### 일반적인 UV

보통 3D 모델은 UV 좌표가 모델에 매핑되어 있음 (UV unwrapping).
하지만 procedural 지형은 UV가 없음.

### SlowRoads 방식: world position을 UV로 사용

```glsl
vec2 texUV = vPosition.xz * uTextureScale;
```

- `vPosition.xz`: vertex의 **월드 좌표** (x, z)
- `uTextureScale`: 타일 크기 조절 (0.08이면 1/0.08 = 12.5m마다 반복)

### 장점

- UV unwrapping 필요 없음 (procedural 지형에 적합)
- 카메라/mesh 이동과 무관하게 **일관된 패턴**
- scale로 반복 크기를 실시간 조절 가능

### textureScale의 의미

```
uTextureScale = 0.08 → 텍스쳐가 12.5m (1/0.08)마다 반복
uTextureScale = 0.05 → 텍스쳐가 20m마다 반복 (더 큰 패턴)
uTextureScale = 0.15 → 텍스쳐가 6.7m마다 반복 (더 촘촘)
```

---

## 색조 보정 (Tint)

텍스쳐 색상 그대로 쓰면 너무 사실적이거나 원하는 톤과 안 맞을 수 있음.
**tint 색상을 곱해서** 전체적인 색조를 조절:

```glsl
vec3 grassVaried = grassTex * uGrassTint * (1.0 + colorNoise * 0.3);
//                  텍스쳐     색조 보정     noise 변화
```

- `uGrassTint = vec3(1,1,1)` → 텍스쳐 원본 그대로
- `uGrassTint = vec3(0.5, 0.8, 0.3)` → 더 초록하게 보정
- Leva에서 실시간 조절 가능

### 최종 색상 합성 파이프라인

```
1. 텍스쳐 원본색 × tint 색조 × (1.0 + noise 변화) = grassVaried, sandVaried

2. 경사 톤: grassVaried × uRockTint = slopeTint
   → mix(grassVaried, slopeTint, rockBlend) = grassFinal
   (바위 텍스쳐 대신 풀에 마른 톤을 곱하는 방식)

3. 모래 블렌딩: 높이 + 평탄도 + 패치 noise 조합
   → mix(grassFinal, sandVaried, sandBlend) = color

4. diffuse 조명 적용

5. fog 적용 (활성화 시)

6. gl_FragColor 출력
```

---

## 현재 Shader Uniforms 정리

| Uniform | 타입 | 역할 | Leva 조절 |
|---|---|---|---|
| `uGrassTexture` | sampler2D | 풀 텍스쳐 이미지 | X |
| `uRockTexture` | sampler2D | 바위 텍스쳐 이미지 (현재 미사용) | X |
| `uSandTexture` | sampler2D | 모래 텍스쳐 이미지 | X |
| `uTextureScale` | float | 텍스쳐 타일 크기 | O (0.01~0.5) |
| `uGrassTint` | vec3 | 풀 색조 보정 (#e4efd7) | O (color picker) |
| `uRockTint` | vec3 | 경사 톤 보정 (#deddd5) — 경사면에서 풀에 곱하는 마른 톤 | O (color picker) |
| `uSandTint` | vec3 | 모래 색조 보정 (#fffcf5) | O (color picker) |
| `uSteepnessThreshold` | float | 경사도 블렌딩 기준 (0.15) | O (0.05~0.8) |
| `uSandHeight` | float | 모래 높이 기준 (0) — 이 높이 이하 + 평탄 + 패치 = 모래 | O (-15~10) |
| `fogColor` | vec3 | fog 색상 (Three.js 자동) | - |
| `fogNear/Far` | float | fog 거리 (Three.js 자동) | - |

---

_작성일: 2026-02-09_
