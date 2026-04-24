# Chapter 04: Shaders

---

## 27. Shaders 🔴필수
**시간:** 2:17:57 | **난이도:** Very Hard

**Sheem 관련성:** 지형 셰이더, 물 효과, 파티클 등 모든 커스텀 비주얼의 기반

### 핵심 개념

**셰이더란?**
- GPU에서 실행되는 GLSL 프로그램
- **Vertex Shader**: 모든 정점의 위치를 결정
- **Fragment Shader**: 모든 보이는 픽셀(fragment)의 색상을 결정
- Fragment shader는 vertex shader 이후에 실행

**데이터 타입:**
- `attribute`: 정점마다 다른 데이터 (position 등) → vertex shader에서만 사용
- `uniform`: 모든 정점/픽셀에서 동일한 데이터 → 양쪽 모두 사용 가능
- `varying`: vertex → fragment로 전달하는 데이터 (정점 사이에서 보간됨)

### RawShaderMaterial vs ShaderMaterial
- `RawShaderMaterial`: 순수 GLSL, 아무것도 자동 추가 안 됨
- `ShaderMaterial`: projectionMatrix, viewMatrix, modelMatrix, position, uv 등 자동 prepend

### vite-plugin-glsl 설정
```js
// vite.config.js
import glsl from 'vite-plugin-glsl'
export default {
  plugins: [glsl()]
}
```
```js
import testVertexShader from './shaders/test/vertex.glsl'
import testFragmentShader from './shaders/test/fragment.glsl'
```

### Vertex Shader 기본 구조
```glsl
// RawShaderMaterial용
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
attribute vec3 position;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;
}
```

**행렬 역할:**
- `modelMatrix`: Mesh의 position/rotation/scale 변환
- `viewMatrix`: 카메라 변환 (카메라가 왼쪽으로 돌면 정점은 오른쪽으로)
- `projectionMatrix`: 최종 clip space 좌표로 변환

### Fragment Shader 기본 구조
```glsl
precision mediump float; // ShaderMaterial에선 자동

void main() {
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // r, g, b, a
}
```

### GLSL 기본 문법
```glsl
// 변수 (타입 명시 필수)
float foo = 0.123;     // 항상 소수점 필요
int bar = 2;
bool baz = true;

// vec2, vec3, vec4
vec2 a = vec2(1.0, 2.0);
vec3 b = vec3(0.5, 0.0, 1.0);
b.r = 0.5; // .x/.y/.z 와 .r/.g/.b 혼용 가능

// swizzle
vec3 foo = vec3(1.0, 2.0, 3.0);
vec2 bar = foo.xy; // vec2(1.0, 2.0)
vec2 baz = foo.yx; // swizzle: vec2(2.0, 1.0)

// 타입 변환
float c = a * float(b); // int → float 명시적 변환
```

### Attributes 추가
```js
// JS
const randoms = new Float32Array(count)
for(let i = 0; i < count; i++) randoms[i] = Math.random()
geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1))
```
```glsl
// vertex shader
attribute float aRandom;
void main() {
    modelPosition.z += aRandom * 0.1;
}
```

### Varyings (vertex → fragment)
```glsl
// vertex shader
varying float vRandom;
void main() {
    vRandom = aRandom;
}

// fragment shader
varying float vRandom;
void main() {
    gl_FragColor = vec4(0.5, vRandom, 1.0, 1.0);
}
```

### Uniforms
```js
// JS
const material = new THREE.RawShaderMaterial({
    uniforms: {
        uFrequency: { value: new THREE.Vector2(10, 5) },
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('orange') }
    }
})
// tick에서 업데이트
material.uniforms.uTime.value = elapsedTime
```
```glsl
// vertex shader
uniform vec2 uFrequency;
uniform float uTime;
void main() {
    modelPosition.z += sin(modelPosition.x * uFrequency.x - uTime) * 0.1;
}
```

### Textures
```glsl
// vertex shader
attribute vec2 uv;
varying vec2 vUv;
void main() { vUv = uv; }

// fragment shader
uniform sampler2D uTexture;
varying vec2 vUv;
void main() {
    vec4 textureColor = texture2D(uTexture, vUv);
    gl_FragColor = textureColor;
}
```

### 디버깅 팁
- `gl_FragColor = vec4(vUv, 1.0, 1.0)` — UV 시각화
- Three.js가 컴파일 에러 라인 번호 알려줌 (ERROR: 0:71 형식)
- 값을 색상으로 시각화해서 디버그

### Sheem 메모
> 지형 vertex displacement, 물 효과, 파티클 모두 여기서 시작. RawShaderMaterial보다 ShaderMaterial 사용 권장 (행렬, UV 자동 prepend). uTime uniform으로 애니메이션.

---

## 28. Shader Patterns 🔴필수
**시간:** 1:49:25 | **난이도:** Hard

**Sheem 관련성:** 지형 텍스처, 물 표면 패턴, 분위기 연출에 활용

### 핵심 개념

UV를 fragment shader에서 받아 다양한 패턴 생성.

```glsl
// vertex shader
varying vec2 vUv;
void main() { vUv = uv; }

// fragment shader - strength 변수로 패턴 제어
varying vec2 vUv;
void main() {
    float strength = /* 패턴 */;
    gl_FragColor = vec4(vec3(strength), 1.0);
}
```

### 주요 패턴 기법

```glsl
// 그라디언트
float strength = vUv.x;
float strength = 1.0 - vUv.y;

// 반복 (modulo)
float strength = mod(vUv.y * 10.0, 1.0);

// 이진화 (step)
float strength = step(0.5, mod(vUv.y * 10.0, 1.0));

// 격자 패턴
float strength = step(0.8, mod(vUv.x * 10.0, 1.0));
strength += step(0.8, mod(vUv.y * 10.0, 1.0));

// 곱셈 교차점만
float strength = step(0.8, mod(vUv.x * 10.0, 1.0));
strength *= step(0.8, mod(vUv.y * 10.0, 1.0));

// abs로 중앙 기준
float strength = abs(vUv.x - 0.5);

// min/max 조합
float strength = min(abs(vUv.x - 0.5), abs(vUv.y - 0.5));
float strength = max(abs(vUv.x - 0.5), abs(vUv.y - 0.5));

// 사각형
float strength = step(0.2, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));

// floor (계단식)
float strength = floor(vUv.x * 10.0) / 10.0;

// 원 (distance)
float strength = distance(vUv, vec2(0.5));
float strength = 1.0 - distance(vUv, vec2(0.5));

// 빛 렌즈 효과
float strength = 0.015 / distance(vUv, vec2(0.5));
```

### 랜덤 함수
```glsl
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}
float strength = random(vUv);

// 격자 랜덤
vec2 gridUv = vec2(floor(vUv.x * 10.0) / 10.0, floor(vUv.y * 10.0) / 10.0);
float strength = random(gridUv);
```

### 2D 회전 함수
```glsl
vec2 rotate(vec2 uv, float rotation, vec2 mid) {
    return vec2(
        cos(rotation) * (uv.x - mid.x) + sin(rotation) * (uv.y - mid.y) + mid.x,
        cos(rotation) * (uv.y - mid.y) - sin(rotation) * (uv.x - mid.x) + mid.y
    );
}
#define PI 3.1415926535897932384626433832795
vec2 rotatedUv = rotate(vUv, PI * 0.25, vec2(0.5));
```

### atan으로 각도 기반 패턴
```glsl
float angle = atan(vUv.x - 0.5, vUv.y - 0.5) / (PI * 2.0) + 0.5;
float strength = mod(angle * 20.0, 1.0); // 부채꼴 반복
float strength = sin(angle * 100.0);     // 방사형 파형
```

### 2D Perlin (Classic) Noise
```glsl
// 필요: permute 함수 먼저 선언
vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float cnoise(vec2 P) { /* ... Stefan Gustavson 구현 ... */ }

float strength = cnoise(vUv * 10.0);
float strength = step(0.0, cnoise(vUv * 10.0)); // 젖소 패턴
float strength = step(0.9, sin(cnoise(vUv * 10.0) * 20.0)); // 불규칙 원형
```

### 색상 혼합
```glsl
vec3 blackColor = vec3(0.0);
vec3 uvColor = vec3(vUv, 1.0);
float strength = /* 패턴 */;
strength = clamp(strength, 0.0, 1.0); // 교차점 버그 방지
vec3 mixedColor = mix(blackColor, uvColor, strength);
gl_FragColor = vec4(mixedColor, 1.0);
```

**핵심 함수 요약:** `mod`, `step`, `abs`, `min`, `max`, `floor`, `distance`, `length`, `atan`, `sin`, `cos`, `mix`, `clamp`, `smoothstep`, `pow`, `fract`

### Sheem 메모
> 지형 텍스처링, 물 표면 패턴 생성에 직접 활용. cnoise로 자연스러운 지형 변화 표현 가능.

---

## 29. Raging Sea 🔴필수
**시간:** 1:15:33 | **난이도:** Hard

**Sheem 관련성:** Sheem의 핵심 - 물 표면 구현, 오디오 존 시각화

### 핵심 개념

PlaneGeometry에 ShaderMaterial 적용, vertex shader에서 파도 애니메이션.

### Big Waves (sin 기반)
```glsl
// vertex shader
uniform float uBigWavesElevation;
uniform vec2 uBigWavesFrequency;
uniform float uBigWavesSpeed;
uniform float uTime;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);

    float elevation = sin(modelPosition.x * uBigWavesFrequency.x + uTime * uBigWavesSpeed) *
                      sin(modelPosition.z * uBigWavesFrequency.y + uTime * uBigWavesSpeed) *
                      uBigWavesElevation;

    modelPosition.y += elevation;
    // ...
    vElevation = elevation;
}
```

### Small Waves (3D Perlin Noise 루프)
```glsl
// cnoise(vec3 P) 함수 포함 (Stefan Gustavson Classic Perlin 3D)

uniform float uSmallWavesElevation;
uniform float uSmallWavesFrequency;
uniform float uSmallWavesSpeed;
uniform float uSmallIterations;

void main() {
    // ...
    for(float i = 1.0; i <= uSmallIterations; i++) {
        elevation -= abs(cnoise(vec3(modelPosition.xz * uSmallWavesFrequency * i,
                                    uTime * uSmallWavesSpeed)) * uSmallWavesElevation / i);
    }
    // abs() + 음수 → 날카로운 파도 마루, 부드러운 골
}
```

### 색상 (깊이/표면 그라디언트)
```js
// JS
uniforms: {
    uDepthColor: { value: new THREE.Color('#186691') },
    uSurfaceColor: { value: new THREE.Color('#9bd8ff') },
    uColorOffset: { value: 0.08 },
    uColorMultiplier: { value: 5 }
}
```
```glsl
// fragment shader
varying float vElevation;

void main() {
    float mixStrength = (vElevation + uColorOffset) * uColorMultiplier;
    vec3 color = mix(uDepthColor, uSurfaceColor, mixStrength);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
}
```

### JS 설정
```js
const waterGeometry = new THREE.PlaneGeometry(2, 2, 512, 512) // 높은 세분화
const waterMaterial = new THREE.ShaderMaterial({
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    uniforms: {
        uTime: { value: 0 },
        uBigWavesElevation: { value: 0.2 },
        uBigWavesFrequency: { value: new THREE.Vector2(4, 1.5) },
        uBigWavesSpeed: { value: 0.75 },
        uSmallWavesElevation: { value: 0.15 },
        uSmallWavesFrequency: { value: 3 },
        uSmallWavesSpeed: { value: 0.2 },
        uSmallIterations: { value: 4 },
        // 색상 uniforms...
    }
})
```

### Sheem 메모
> Sheem의 핵심 기능. 빗속 puddle 표면, 강 흐름 등에 직접 활용. elevation varying으로 깊이감 표현.

---

## 30. Animated Galaxy 🟡참고
**시간:** 1:14:11 | **난이도:** Very Hard

**Sheem 관련성:** 파티클 시스템 참고 (별빛 분위기 연출)

### 핵심 개념

PointsMaterial → ShaderMaterial 교체 + vertex shader에서 파티클 애니메이션.

### gl_PointSize (파티클 크기)
```glsl
uniform float uSize;
uniform vec2 uResolution; // width * pixelRatio, height * pixelRatio
attribute float aScale;

void main() {
    // ...
    gl_PointSize = uSize * aScale;
    gl_PointSize *= uResolution.y; // 렌더 높이 비례
    gl_PointSize *= (1.0 / - viewPosition.z); // 원근 효과
}
```

### gl_PointCoord (파티클 내부 UV)
```glsl
// fragment shader - 파티클 패턴 그리기
void main() {
    // 디스크
    float strength = distance(gl_PointCoord, vec2(0.5));
    strength = step(0.5, strength);
    strength = 1.0 - strength;

    // 확산 포인트
    float strength = distance(gl_PointCoord, vec2(0.5));
    strength *= 2.0;
    strength = 1.0 - strength;

    // 빛 포인트 (별 느낌)
    float strength = distance(gl_PointCoord, vec2(0.5));
    strength = 1.0 - strength;
    strength = pow(strength, 10.0);

    vec3 color = mix(vec3(0.0), vColor, strength);
    gl_FragColor = vec4(color, 1.0);
}
```

### 갤럭시 회전 애니메이션
```glsl
// vertex shader
uniform float uTime;
attribute vec3 aRandomness;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);

    // 각도 계산 및 회전
    float angle = atan(modelPosition.x, modelPosition.z);
    float distanceToCenter = length(modelPosition.xz);
    float angleOffset = (1.0 / distanceToCenter) * uTime * 0.2;
    angle += angleOffset;

    modelPosition.x = cos(angle) * distanceToCenter;
    modelPosition.z = sin(angle) * distanceToCenter;
    modelPosition.xyz += aRandomness; // 나중에 적용

    // ...
}
```

### Pixel Ratio 처리
```js
// 픽셀 비율 포함 uSize
material = new THREE.ShaderMaterial({
    uniforms: {
        uSize: { value: 30 * renderer.getPixelRatio() }
    }
})
```

### Sheem 메모
> 별빛 파티클, 빗방울 파티클 구현에 참고. gl_PointCoord + gl_PointSize 패턴은 모든 파티클 셰이더의 기반.

---

## 31. Modified Materials 🔴필수
**시간:** 51:55 | **난이도:** Very Hard

**Sheem 관련성:** Three.js 내장 Material을 커스터마이징하는 핵심 기법

### 핵심 개념

`onBeforeCompile` 훅으로 MeshStandardMaterial 등의 셰이더를 수정.

### onBeforeCompile 기본
```js
const material = new THREE.MeshStandardMaterial()
const customUniforms = {
    uTime: { value: 0 }
}

material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = customUniforms.uTime

    // #include <common> 교체 → 함수 추가
    shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
            #include <common>

            mat2 get2dRotateMatrix(float _angle) {
                return mat2(cos(_angle), - sin(_angle), sin(_angle), cos(_angle));
            }
        `
    )

    // #include <begin_vertex> 교체 → 정점 변형
    shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
            #include <begin_vertex>
            float angle = (position.y + uTime) * 0.9;
            mat2 rotateMatrix = get2dRotateMatrix(angle);
            transformed.xz = rotateMatrix * transformed.xz;
        `
    )

    // #include <beginnormal_vertex> 교체 → 노멀 수정
    shader.vertexShader = shader.vertexShader.replace(
        '#include <beginnormal_vertex>',
        `
            #include <beginnormal_vertex>
            float angle = (position.y + uTime) * 0.9;
            mat2 rotateMatrix = get2dRotateMatrix(angle);
            objectNormal.xz = rotateMatrix * objectNormal.xz;
        `
    )
}
```

**주의:** `beginnormal_vertex`는 `begin_vertex`보다 먼저 실행되므로, angle/rotateMatrix는 beginnormal_vertex에서만 선언.

### tick에서 uniform 업데이트
```js
const tick = () => {
    customUniforms.uTime.value = elapsedTime
}
```

### Shadow 수정 (customDepthMaterial)
```js
const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking
})
depthMaterial.onBeforeCompile = (shader) => {
    // material과 동일한 수정 적용
    shader.uniforms.uTime = customUniforms.uTime
    // ...
}
mesh.customDepthMaterial = depthMaterial
```

### 주요 Three.js Shader Chunk
- `/node_modules/three/src/renderers/shaders/ShaderChunk/`
- `begin_vertex.glsl.js` → `transformed` 변수 (정점 위치)
- `beginnormal_vertex.glsl.js` → `objectNormal` 변수
- `common.glsl.js` → 공통 함수들 (PI 포함)

### Sheem 메모
> 커스텀 지형 셰이더에 그림자 지원할 때 필수. Custom Shader Material 라이브러리가 이 과정을 단순화함 (레슨 42, 43, 44 참고).

---

## 32. Coffee Smoke 🔴필수
**시간:** 1:25:07 | **난이도:** Hard

**Sheem 관련성:** 연기/안개 효과, Perlin 텍스처 기법

### 핵심 개념

**Perlin 함수 대신 Perlin 이미지 사용 → 성능 대폭 향상**

게임에서 많이 쓰는 방식: 노이즈를 텍스처로 저장 후 샘플링.

### Perlin 텍스처 규칙
- 반복 패턴 (tiling 가능)
- 충분한 해상도 (128×128 정도면 충분, GPU가 보간)
- 여러 채널에 다른 노이즈 저장 가능

### Fragment Shader (연기 패턴)
```glsl
uniform sampler2D uPerlinTexture;
uniform float uTime;
varying vec2 vUv;

void main() {
    // UV 스케일 + 애니메이션
    vec2 smokeUv = vUv;
    smokeUv.x *= 0.5;
    smokeUv.y *= 0.3;
    smokeUv.y -= uTime * 0.03; // 위로 이동

    // 텍스처 샘플링 (r 채널만)
    float smoke = texture(uPerlinTexture, smokeUv).r;

    // 값 리맵 (희박한 연기)
    smoke = smoothstep(0.4, 1.0, smoke);

    // 엣지 페이드
    smoke *= smoothstep(0.0, 0.1, vUv.x);
    smoke *= smoothstep(1.0, 0.9, vUv.x);
    smoke *= smoothstep(0.0, 0.1, vUv.y);
    smoke *= smoothstep(1.0, 0.4, vUv.y);

    gl_FragColor = vec4(0.6, 0.3, 0.2, smoke);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
```

### Vertex Shader (트위스트 + 바람)
```glsl
uniform float uTime;
uniform sampler2D uPerlinTexture;

vec2 rotate2D(vec2 value, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    mat2 m = mat2(c, s, -s, c);
    return m * value;
}

void main() {
    vec3 newPosition = position;

    // 트위스트
    float twistPerlin = texture(uPerlinTexture, vec2(0.5, uv.y * 0.2 - uTime * 0.005)).r;
    float angle = twistPerlin * 10.0;
    newPosition.xz = rotate2D(newPosition.xz, angle);

    // 바람
    vec2 windOffset = vec2(
        texture(uPerlinTexture, vec2(0.25, uTime * 0.01)).r - 0.5,
        texture(uPerlinTexture, vec2(0.75, uTime * 0.01)).r - 0.5
    );
    windOffset *= pow(uv.y, 2.0) * 10.0; // 위쪽으로 갈수록 강해짐
    newPosition.xz += windOffset;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    vUv = uv;
}
```

### 텍스처 설정
```js
const perlinTexture = textureLoader.load('./perlin.png')
perlinTexture.wrapS = THREE.RepeatWrapping
perlinTexture.wrapT = THREE.RepeatWrapping
```

### 투명도 설정
```js
const smokeMaterial = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
})
```

### #include 로 GLSL 파일 분리
```glsl
// src/shaders/includes/rotate2D.glsl 에 함수 저장
#include ../includes/rotate2D.glsl
```

### Sheem 메모
> 숲 안개, 비 파티클 배경 연기, 캠프파이어 연기 등에 활용. Perlin 텍스처 방식은 모바일에서도 성능 안정적.

---

## 33. Hologram 🔴필수
**시간:** 1:21:18 | **난이도:** Hard

**Sheem 관련성:** 홀로그램 UI, 오디오 존 인디케이터 등 SF 효과

### 핵심 개념

**Fresnel 효과**: 카메라 각도에 따라 밝기가 달라지는 물리 현상.
- 수직으로 볼 때 → 어두움
- 비스듬히 볼 때 → 밝음 (엣지가 빛남)

### Fresnel 계산
```glsl
// vertex shader
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
    vec4 modelNormal = modelMatrix * vec4(normal, 0.0); // w=0 → 회전만 적용
    vNormal = modelNormal.xyz;
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
}

// fragment shader
void main() {
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    vec3 normal = normalize(vNormal);

    // Fresnel
    float fresnel = dot(viewDirection, normal) + 1.0; // 0~2 범위로
    fresnel = pow(fresnel, 2.0);
}
```

### 줄무늬 패턴 (stripes)
```glsl
uniform float uTime;
varying vec3 vPosition;

void main() {
    // 월드 공간 기준 줄무늬 (오브젝트 회전과 무관)
    float stripes = mod((vPosition.y - uTime * 0.02) * 20.0, 1.0);
    stripes = pow(stripes, 3.0);
}
```

### 홀로그램 합성
```glsl
void main() {
    vec3 normal = normalize(vNormal);
    if(!gl_FrontFacing) normal *= -1.0; // 뒷면 노멀 반전

    // Fresnel
    float fresnel = dot(viewDirection, normal) + 1.0;
    fresnel = pow(fresnel, 2.0);

    // Falloff (엣지에서 페이드)
    float falloff = smoothstep(0.8, 0.0, fresnel);

    // 홀로그램 = 줄무늬 × Fresnel
    float holographic = stripes * fresnel;
    holographic += fresnel * 1.25;
    holographic *= falloff;

    gl_FragColor = vec4(uColor, holographic);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
```

### 머티리얼 설정
```js
const material = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
        uColor: new THREE.Uniform(new THREE.Color('#70c1ff')),
        uTime: new THREE.Uniform(0)
    }
})
```

### 글리치 효과 (vertex shader)
```glsl
float random2D(vec2 value) {
    return fract(sin(dot(value.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
    // ...
    float glitchTime = uTime - modelPosition.y;
    float glitchStrength = sin(glitchTime) + sin(glitchTime * 3.45) + sin(glitchTime * 8.76);
    glitchStrength /= 3.0;
    glitchStrength = smoothstep(0.3, 1.0, glitchStrength);
    glitchStrength *= 0.25;

    modelPosition.x += (random2D(modelPosition.xz + uTime) - 0.5) * glitchStrength;
    modelPosition.z += (random2D(modelPosition.zx + uTime) - 0.5) * glitchStrength;
}
```

### Sheem 메모
> 공간 인디케이터(오디오 존 경계), NPC 아바타의 홀로그램 효과에 활용 가능.

---

## 34. Fireworks 🔴필수
**시간:** 1:47:28 | **난이도:** Hard

**Sheem 관련성:** 파티클 애니메이션 패턴, 이벤트 효과

### 핵심 개념

복잡한 멀티페이즈 파티클 애니메이션을 단일 vertex shader에서 처리.

### createFirework 패턴
```js
const createFirework = (count, position, size, texture, radius, color) => {
    // 구면 분포
    for(let i = 0; i < count; i++) {
        const spherical = new THREE.Spherical(
            radius * (0.75 + Math.random() * 0.25),
            Math.random() * Math.PI,
            Math.random() * Math.PI * 2
        )
        const pos = new THREE.Vector3()
        pos.setFromSpherical(spherical)
        positionsArray[i3] = pos.x
        // ...
    }

    // GSAP으로 uProgress 0→1 애니메이션
    gsap.fromTo(material.uniforms.uProgress, { value: 0 }, {
        value: 1, duration: 3, ease: 'linear',
        onComplete: destroy
    })
}

const destroy = () => {
    scene.remove(firework)
    geometry.dispose()
    material.dispose()
}
```

### uResolution (픽셀 비율 포함)
```js
sizes.resolution = new THREE.Vector2(
    sizes.width * sizes.pixelRatio,
    sizes.height * sizes.pixelRatio
)
```

### remap 함수
```glsl
float remap(float value, float originMin, float originMax, float destinationMin, float destinationMax) {
    return destinationMin + (value - originMin) * (destinationMax - destinationMin) / (originMax - originMin);
}
```

### 멀티페이즈 애니메이션 (vertex shader)
```glsl
uniform float uProgress;
attribute float aTimeMultiplier;

void main() {
    float progress = uProgress * aTimeMultiplier; // 각 파티클이 다른 속도

    // 1. 폭발 (0~0.1)
    float explodingProgress = remap(progress, 0.0, 0.1, 0.0, 1.0);
    explodingProgress = clamp(explodingProgress, 0.0, 1.0);
    explodingProgress = 1.0 - pow(1.0 - explodingProgress, 3.0); // 감속
    vec3 newPosition = mix(vec3(0.0), position, explodingProgress);

    // 2. 낙하 (0.1~1.0)
    float fallingProgress = remap(progress, 0.1, 1.0, 0.0, 1.0);
    fallingProgress = clamp(fallingProgress, 0.0, 1.0);
    fallingProgress = 1.0 - pow(1.0 - fallingProgress, 3.0);
    newPosition.y -= fallingProgress * 0.2;

    // 3. 크기 (열리고 닫힘)
    float sizeOpeningProgress = remap(progress, 0.0, 0.125, 0.0, 1.0);
    float sizeClosingProgress = remap(progress, 0.125, 1.0, 1.0, 0.0);
    float sizeProgress = clamp(min(sizeOpeningProgress, sizeClosingProgress), 0.0, 1.0);

    // 4. 반짝임 (0.2~0.8)
    float twinklingProgress = clamp(remap(progress, 0.2, 0.8, 0.0, 1.0), 0.0, 1.0);
    float sizeTwinkling = sin(progress * 30.0) * 0.5 + 0.5;
    sizeTwinkling = 1.0 - sizeTwinkling * twinklingProgress;

    gl_PointSize = uSize * uResolution.y * aSize * sizeProgress * sizeTwinkling;
    gl_PointSize *= (1.0 / - viewPosition.z);

    // Windows 버그 수정: 너무 작은 파티클 숨기기
    if(gl_PointSize < 1.0) gl_Position = vec4(9999.9);
}
```

### 텍스처 파티클
```glsl
// fragment shader
uniform sampler2D uTexture;
void main() {
    float textureAlpha = texture(uTexture, gl_PointCoord).r;
    gl_FragColor = vec4(uColor, textureAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
```

### Sky 클래스 (보너스)
```js
import { Sky } from 'three/addons/objects/Sky.js'
const sky = new Sky()
sky.scale.setScalar(450000)
scene.add(sky)
// uniforms으로 태양 위치, 대기 설정
```

### Sheem 메모
> 이벤트 파티클, 비 파티클 애니메이션, 빛 포인트 효과에 활용. aTimeMultiplier 기법은 파티클마다 다른 속도를 줄 때 핵심.

---

## 35. Lights Shading 🔴필수
**시간:** 1:17:09 | **난이도:** Very Hard

**Sheem 관련성:** 커스텀 셰이더에 라이팅 추가 (물, 지형에 반사광)

### 핵심 개념

Three.js 내장 라이트 없이 GLSL로 직접 조명 구현.

### 구조 패턴
```glsl
// fragment shader
vec3 light = vec3(0.0);
light += ambientLight(...);
light += directionalLight(...);
light += pointLight(...);
color *= light; // 조명 = 색상 × 빛
```

### Ambient Light
```glsl
// src/shaders/includes/ambientLight.glsl
vec3 ambientLight(vec3 lightColor, float lightIntensity) {
    return lightColor * lightIntensity;
}

// 사용
light += ambientLight(
    vec3(1.0), // 색상
    0.03       // 강도
);
```

### Directional Light (방향광 + 스페큘러)
```glsl
// src/shaders/includes/directionalLight.glsl
vec3 directionalLight(vec3 lightColor, float lightIntensity, vec3 normal,
                       vec3 lightPosition, vec3 viewDirection, float specularPower) {
    vec3 lightDirection = normalize(lightPosition);
    vec3 lightReflection = reflect(-lightDirection, normal);

    // 셰이딩 (dot product)
    float shading = dot(normal, lightDirection);
    shading = max(0.0, shading);

    // 스페큘러
    float specular = -dot(lightReflection, viewDirection);
    specular = max(0.0, specular);
    specular = pow(specular, specularPower);

    return lightColor * lightIntensity * (shading + specular);
}
```

### Point Light (거리 감쇠)
```glsl
// src/shaders/includes/pointLight.glsl
vec3 pointLight(vec3 lightColor, float lightIntensity, vec3 normal,
                vec3 lightPosition, vec3 viewDirection, float specularPower,
                vec3 position, float lightDecay) {
    vec3 lightDelta = lightPosition - position;
    float lightDistance = length(lightDelta);
    vec3 lightDirection = normalize(lightDelta);
    vec3 lightReflection = reflect(-lightDirection, normal);

    float shading = max(0.0, dot(normal, lightDirection));
    float specular = pow(max(0.0, -dot(lightReflection, viewDirection)), specularPower);

    float decay = max(0.0, 1.0 - lightDistance * lightDecay);

    return lightColor * lightIntensity * decay * (shading + specular);
}
```

### Vertex → Fragment 준비
```glsl
// vertex shader
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vec4 modelNormal = modelMatrix * vec4(normal, 0.0); // w=0 중요
    vNormal = modelNormal.xyz;
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
}

// fragment shader
void main() {
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    vec3 normal = normalize(vNormal); // 재정규화 필수 (보간 오류 방지)
    // ...
}
```

### Sheem 메모
> 커스텀 물 셰이더에 반사광 추가할 때 directionalLight/pointLight 함수 재사용. include 파일로 분리해서 여러 셰이더에서 공유.

---

## 36. Raging Sea Shading 🔴필수
**시간:** 57:02 | **난이도:** Hard

**Sheem 관련성:** 물 표면에 라이팅 추가 (Sheem 핵심 비주얼)

### 핵심 개념

파도 셰이더에 노멀 계산 추가 → 현실적인 물 반사.

**문제**: 파도를 vertex shader에서 변형하면 노멀(법선)이 업데이트되지 않음
**해결**: 이웃 정점(neighbours) 기법으로 노멀 직접 계산

### waveElevation 함수
```glsl
// 파도 계산을 함수로 분리 (정점 + 이웃 정점에 재사용)
float waveElevation(vec3 position) {
    float elevation = sin(position.x * uBigWavesFrequency.x + uTime * uBigWavesSpeed) *
                      sin(position.z * uBigWavesFrequency.y + uTime * uBigWavesSpeed) *
                      uBigWavesElevation;

    for(float i = 1.0; i <= uSmallIterations; i++) {
        elevation -= abs(perlinClassic3D(vec3(position.xz * uSmallWavesFrequency * i,
                                             uTime * uSmallWavesSpeed)) * uSmallWavesElevation / i);
    }
    return elevation;
}
```

### 이웃 정점 기법으로 노멀 계산
```glsl
void main() {
    // 이웃 정점 위치 (이론상의 위치)
    float shift = 0.01;
    vec3 modelPositionA = modelPosition.xyz + vec3(shift, 0.0, 0.0);
    vec3 modelPositionB = modelPosition.xyz + vec3(0.0, 0.0, -shift); // 음수 z 중요

    // 파도 적용
    float elevation = waveElevation(modelPosition.xyz);
    modelPosition.y += elevation;
    modelPositionA.y += waveElevation(modelPositionA);
    modelPositionB.y += waveElevation(modelPositionB);

    // 방향 벡터
    vec3 toA = normalize(modelPositionA - modelPosition.xyz);
    vec3 toB = normalize(modelPositionB - modelPosition.xyz);

    // 크로스 프로덕트 → 노멀
    vNormal = cross(toA, toB);
}
```

### 최적화
```js
waterGeometry.deleteAttribute('normal') // 직접 계산하므로 불필요
```

### 색상 설정 (에픽한 느낌)
```js
debugObject.depthColor = '#ff4000'  // 붉은 깊이
debugObject.surfaceColor = '#151c37' // 어두운 표면
uniforms.uColorOffset.value = 0.925
uniforms.uColorMultiplier.value = 1
```

### 토닝
```js
renderer.toneMapping = THREE.ACESFilmicToneMapping
```

### Point Light 적용
```glsl
light += pointLight(
    vec3(1.0),            // 흰빛
    10.0,                 // 강도
    normal,
    vec3(0.0, 0.25, 0.0), // 물 위 중앙
    viewDirection,
    30.0,                 // 스페큘러 파워
    vPosition,
    0.95                  // 감쇠
);
```

### Sheem 메모
> Sheem의 물 표면 핵심. 빗소리 존과 물 시각화를 연동할 때 이 기법으로 반사/굴절 표현.

---

## 37. Halftone Shading 🔴필수
**시간:** 56:04 | **난이도:** Hard

**Sheem 관련성:** 스타일라이즈드 셰이딩, 셀 쉐이딩 대안

### 핵심 개념

**Halftone**: 같은 색의 점들을 크기 변화로 그라디언트를 표현하는 인쇄 기법 (Spider-Man: Into the Spider-Verse 스타일).

### 스크린 기반 그리드 (gl_FragCoord)
```glsl
uniform vec2 uResolution;

void main() {
    float repetitions = 50.0;
    vec2 uv = gl_FragCoord.xy / uResolution.y; // y로만 나눔 → 정방형 유지
    uv *= repetitions;
    uv = mod(uv, 1.0); // 0~1 반복 그리드
}
```

### halftone 함수
```glsl
vec3 halftone(
    vec3 color,
    float repetitions,
    vec3 direction,
    float low,
    float high,
    vec3 pointColor,
    vec3 normal
) {
    // 빛 강도 (dot product)
    float intensity = dot(normal, direction);
    intensity = smoothstep(low, high, intensity);

    // 그리드 UV
    vec2 uv = gl_FragCoord.xy / uResolution.y;
    uv *= repetitions;
    uv = mod(uv, 1.0);

    // 원형 점
    float point = distance(uv, vec2(0.5));
    point = 1.0 - step(0.5 * intensity, point);

    return mix(color, pointColor, point);
}
```

### 적용 예시 (그림자 + 빛 halftone)
```glsl
// 그림자 halftone (아래쪽 방향)
color = halftone(
    color,
    uShadowRepetitions,
    vec3(0.0, -1.0, 0.0), // 아래 방향
    -0.8, 1.5,
    uShadowColor,
    normal
);

// 빛 halftone (위쪽 방향)
color = halftone(
    color,
    uLightRepetitions,
    vec3(1.0, 1.0, 0.0), // 대각선 방향
    0.5, 1.5,
    uLightColor,
    normal
);
```

### Sheem 메모
> 독특한 시각 스타일이 필요할 때 활용. 일반 라이팅과 조합해서 만화 느낌 연출 가능.

---

## 38. Earth 🔴필수
**시간:** 1:40:43 | **난이도:** Very Hard

**Sheem 관련성:** 환경맵 + Fresnel + 분위기 구현 기법

### 핵심 개념

다양한 텍스처와 셰이더 기법을 조합한 사실적인 지구 렌더링.

### 텍스처 설정
```js
// sRGB 색상 공간 설정 (표시용 텍스처)
earthDayTexture.colorSpace = THREE.SRGBColorSpace
earthNightTexture.colorSpace = THREE.SRGBColorSpace
// specularClouds는 linear (데이터 텍스처)

// 선명도 향상
earthDayTexture.anisotropy = 8 // 비스듬한 각도에서도 선명
```

### 태양 방향 기반 낮/밤
```glsl
uniform vec3 uSunDirection;

void main() {
    // 태양 방향과 노멀의 dot product
    float sunOrientation = dot(uSunDirection, normal);

    // 낮/밤 혼합
    float dayMix = smoothstep(-0.25, 0.5, sunOrientation);
    vec3 dayColor = texture(uDayTexture, vUv).rgb;
    vec3 nightColor = texture(uNightTexture, vUv).rgb;
    color = mix(nightColor, dayColor, dayMix);
}
```

### 구름
```glsl
// specularClouds.jpg: r = 스페큘러, g = 구름
vec2 specularCloudColor = texture(uSpecularCloudsTexture, vUv).rg;
float cloudsMix = smoothstep(0.5, 1.0, specularCloudColor.g);
cloudsMix *= dayMix; // 밤에는 구름 숨김
color = mix(color, vec3(1.0), cloudsMix);
```

### Fresnel 기반 대기
```glsl
// Fresnel
float fresnel = dot(viewDirection, normal) + 1.0;
fresnel = pow(fresnel, 2.0);

// 대기 색상 그라디언트 (낮=파랑, 황혼=빨강)
float atmosphereDayMix = smoothstep(-0.5, 1.0, sunOrientation);
vec3 atmosphereColor = mix(uAtmosphereTwilightColor, uAtmosphereDayColor, atmosphereDayMix);
color = mix(color, atmosphereColor, fresnel * atmosphereDayMix);
```

### 스페큘러 (물에만 반사)
```glsl
vec3 reflection = reflect(-uSunDirection, normal);
float specular = -dot(reflection, viewDirection);
specular = max(specular, 0.0);
specular = pow(specular, 32.0);
specular *= specularCloudColor.r; // 스페큘러 맵으로 바다만 반짝임

vec3 specularColor = mix(vec3(1.0), atmosphereColor, fresnel);
color += specular * specularColor;
```

### 대기권 구체 (별도 BackSide 구체)
```js
const atmosphereMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true
})
const atmosphere = new THREE.Mesh(earthGeometry, atmosphereMaterial)
atmosphere.scale.set(1.04, 1.04, 1.04)
```

```glsl
// atmosphere fragment shader
float edgeAlpha = smoothstep(0.0, 0.5, dot(viewDirection, normal));
float dayAlpha = smoothstep(-0.5, 0.0, sunOrientation);
float alpha = edgeAlpha * dayAlpha;
gl_FragColor = vec4(atmosphereColor, alpha);
```

### CanvasTexture
```js
// CanvasTexture: 2D 캔버스를 Three.js 텍스처로 변환
const canvas = document.createElement('canvas')
const texture = new THREE.CanvasTexture(canvas)
```

### Sheem 메모
> Fresnel + 대기 효과 패턴은 물 표면, 아바타 경계 빛 효과에 재사용 가능. sunOrientation 기법으로 빛의 방향에 따른 색상 전환 구현.

---

## 39. Particles Cursor Animation 🔴필수
**시간:** 1:48:08 | **난이도:** Hard

**Sheem 관련성:** 인터랙티브 파티클 (사용자 인터랙션 + 공간 효과)

### 핵심 개념

2D Canvas를 Three.js 텍스처로 변환 → 파티클 displacement에 활용.

### 파티클 디스크 (discard 사용)
```glsl
// fragment shader
void main() {
    vec2 uv = gl_PointCoord;
    float distanceToCenter = length(uv - vec2(0.5));

    if(distanceToCenter > 0.5) discard; // 원형 마스킹

    gl_FragColor = vec4(vColor, 1.0);
}
```

### 그림 강도로 파티클 크기/색상
```glsl
// vertex shader
uniform sampler2D uPictureTexture;

void main() {
    float pictureIntensity = texture(uPictureTexture, uv).r;
    gl_PointSize = 0.15 * pictureIntensity * uResolution.y;
    gl_PointSize *= (1.0 / - viewPosition.z);

    vColor = vec3(pow(pictureIntensity, 2.0)); // 어두운 부분 더 어둡게
}
```

### 2D Canvas 커서 트레일
```js
const displacement = {}
displacement.canvas = document.createElement('canvas')
displacement.canvas.width = 128
displacement.canvas.height = 128
displacement.context = displacement.canvas.getContext('2d')
displacement.context.fillRect(0, 0, 128, 128) // 검정 배경

displacement.glowImage = new Image()
displacement.glowImage.src = './glow.png'

displacement.texture = new THREE.CanvasTexture(displacement.canvas)
```

### tick에서 캔버스 업데이트
```js
const tick = () => {
    // 페이드 아웃 (globalAlpha로 불투명도 조절)
    displacement.context.globalCompositeOperation = 'source-over'
    displacement.context.globalAlpha = 0.02
    displacement.context.fillRect(0, 0, 128, 128)

    // 커서 위치에 글로우 그리기
    const glowSize = 128 * 0.25
    displacement.context.globalCompositeOperation = 'lighten'
    displacement.context.globalAlpha = alpha // 속도 기반
    displacement.context.drawImage(
        displacement.glowImage,
        displacement.canvasCursor.x - glowSize * 0.5,
        displacement.canvasCursor.y - glowSize * 0.5,
        glowSize, glowSize
    )

    displacement.texture.needsUpdate = true
}
```

### Raycaster → UV 좌표 변환
```js
const intersections = displacement.raycaster.intersectObject(displacement.interactivePlane)
if(intersections.length) {
    const uv = intersections[0].uv
    displacement.canvasCursor.x = uv.x * displacement.canvas.width
    displacement.canvasCursor.y = (1 - uv.y) * displacement.canvas.height // Y 반전!
}
```

### 파티클 displacement
```glsl
// vertex shader
uniform sampler2D uDisplacementTexture;
attribute float aIntensity;
attribute float aAngle;

void main() {
    vec3 newPosition = position;
    float displacementIntensity = texture(uDisplacementTexture, uv).r;
    displacementIntensity = smoothstep(0.1, 0.3, displacementIntensity); // 트레일 효과

    vec3 displacement = vec3(
        cos(aAngle) * 0.2, // 무작위 방향
        sin(aAngle) * 0.2,
        1.0
    );
    displacement = normalize(displacement);
    displacement *= displacementIntensity * 3.0 * aIntensity;

    newPosition += displacement;
    // ...
}
```

### 속도 기반 알파 (속도 멈추면 효과 사라짐)
```js
const cursorDistance = displacement.canvasCursorPrevious.distanceTo(displacement.canvasCursor)
displacement.canvasCursorPrevious.copy(displacement.canvasCursor)
const alpha = Math.min(cursorDistance * 0.1, 1)
```

### 인덱스 제거 + 노멀 삭제
```js
particlesGeometry.setIndex(null) // 중복 파티클 제거 (성능)
particlesGeometry.deleteAttribute('normal')
```

### Sheem 메모
> 사용자가 지도를 터치할 때 파티클 반응, 오디오 존 경계 인터랙션에 활용 가능.

---

## 40. Particles Morphing 🔴필수
**시간:** 1:35:12 | **난이도:** Hard

**Sheem 관련성:** 모델 형태 전환 파티클 (캐릭터 스폰 효과 등)

### 핵심 개념

두 위치 사이를 Simplex Noise 딜레이로 자연스럽게 모핑.

### 위치 배열 균일화
```js
// 모든 포지션을 maxCount 크기로 맞춤
const positions = gltf.scene.children.map(child => child.geometry.attributes.position)
particles.maxCount = Math.max(...positions.map(p => p.count))

particles.positions = []
for(const position of positions) {
    const originalArray = position.array
    const newArray = new Float32Array(particles.maxCount * 3)
    for(let i = 0; i < particles.maxCount; i++) {
        const i3 = i * 3
        if(i3 < originalArray.length) {
            newArray[i3] = originalArray[i3]
            newArray[i3 + 1] = originalArray[i3 + 1]
            newArray[i3 + 2] = originalArray[i3 + 2]
        } else {
            // 부족한 부분은 랜덤 기존 정점으로 채움
            const randomIndex = Math.floor(position.count * Math.random()) * 3
            newArray[i3] = originalArray[randomIndex]
            newArray[i3 + 1] = originalArray[randomIndex + 1]
            newArray[i3 + 2] = originalArray[randomIndex + 2]
        }
    }
    particles.positions.push(new THREE.Float32BufferAttribute(newArray, 3))
}
```

### mix + uProgress
```glsl
// vertex shader
attribute vec3 aPositionTarget;
uniform float uProgress;

void main() {
    vec3 mixedPosition = mix(position, aPositionTarget, progress);
    // ...
}
```

### Simplex Noise 딜레이 (자연스러운 전환)
```glsl
#include ../includes/simplexNoise3d.glsl

void main() {
    float noiseOrigin = simplexNoise3d(position * 0.2);
    float noiseTarget = simplexNoise3d(aPositionTarget * 0.2);
    float noise = mix(noiseOrigin, noiseTarget, uProgress);
    noise = smoothstep(-1.0, 1.0, noise);

    float duration = 0.4;
    float delay = (1.0 - duration) * noise;
    float end = delay + duration;
    float progress = smoothstep(delay, end, uProgress);

    vec3 mixedPosition = mix(position, aPositionTarget, progress);
}
```

### morph 함수
```js
particles.morph = (index) => {
    particles.geometry.attributes.position = particles.positions[particles.index]
    particles.geometry.attributes.aPositionTarget = particles.positions[index]

    gsap.fromTo(
        particles.material.uniforms.uProgress,
        { value: 0 },
        { value: 1, duration: 3, ease: 'linear' }
    )
    particles.index = index
}
```

### frustumCulled 버그
```js
particles.points.frustumCulled = false // 큰 형태 전환 시 컬링 버그 방지
```

### 색상 그라디언트
```glsl
varying vec3 vColor;
void main() {
    vColor = mix(uColorA, uColorB, noise); // 노이즈에 따라 색상 변화
}
```

### Sheem 메모
> 캐릭터 스폰/디스폰 효과, 오디오 존 입장/퇴장 시각화에 활용 가능.

---

## 41. GPGPU Flow Field Particles 🔴필수
**시간:** 2:22:59 | **난이도:** Very Hard

**Sheem 관련성:** 대규모 인터랙티브 파티클 (Sheem 핵심 비주얼 후보)

### 핵심 개념

**GPGPU**: GPU로 데이터 처리 (파티클 위치를 FBO 텍스처에 저장, 매 프레임 업데이트)
**Flow Field**: 공간 모든 지점에 방향 벡터 → 파티클이 그 방향으로 이동

**핵심 원리**: 파티클 위치를 픽셀(rgba = xyz + 생명)로 FBO에 저장 → 매 프레임 셰이더로 업데이트 → 위치 지속

### GPUComputationRenderer 설정
```js
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'

const gpgpu = {}
gpgpu.size = Math.ceil(Math.sqrt(baseGeometry.count)) // 정사각형 크기
gpgpu.computation = new GPUComputationRenderer(gpgpu.size, gpgpu.size, renderer)
```

### Base Position 텍스처 초기화
```js
const baseParticlesTexture = gpgpu.computation.createTexture()
for(let i = 0; i < baseGeometry.count; i++) {
    const i3 = i * 3, i4 = i * 4
    baseParticlesTexture.image.data[i4] = positions[i3]     // x → r
    baseParticlesTexture.image.data[i4 + 1] = positions[i3 + 1] // y → g
    baseParticlesTexture.image.data[i4 + 2] = positions[i3 + 2] // z → b
    baseParticlesTexture.image.data[i4 + 3] = Math.random() // 생명값 → a
}
```

### 변수 등록 + 자기 참조 (ping-pong)
```js
gpgpu.particlesVariable = gpgpu.computation.addVariable('uParticles', gpgpuParticlesShader, baseParticlesTexture)
gpgpu.computation.setVariableDependencies(gpgpu.particlesVariable, [gpgpu.particlesVariable]) // 자기 루프
gpgpu.particlesVariable.material.uniforms.uTime = new THREE.Uniform(0)
gpgpu.particlesVariable.material.uniforms.uDeltaTime = new THREE.Uniform(0)
gpgpu.particlesVariable.material.uniforms.uBase = new THREE.Uniform(baseParticlesTexture)
gpgpu.computation.init()
```

### GPGPU Shader (gpgpu/particles.glsl)
```glsl
#include ../includes/simplexNoise4d.glsl

uniform float uTime;
uniform float uDeltaTime;
uniform sampler2D uBase;
uniform float uFlowFieldInfluence;
uniform float uFlowFieldStrength;
uniform float uFlowFieldFrequency;

void main() {
    float time = uTime * 0.2;
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 particle = texture(uParticles, uv);
    vec4 base = texture(uBase, uv);

    // 죽은 파티클 → 초기 위치로 리셋
    if(particle.a >= 1.0) {
        particle.a = mod(particle.a, 1.0); // long frame 버그 방지
        particle.xyz = base.xyz;
    }
    else {
        // Flow field 강도 제어
        float strength = simplexNoise4d(vec4(base.xyz * 0.2, time + 1.0));
        float influence = (uFlowFieldInfluence - 0.5) * (-2.0);
        strength = smoothstep(influence, 1.0, strength);

        // Flow field 방향
        vec3 flowField = vec3(
            simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 0.0, time)),
            simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 1.0, time)),
            simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 2.0, time))
        );
        flowField = normalize(flowField);
        particle.xyz += flowField * uDeltaTime * strength * uFlowFieldStrength;

        // 생명 감소
        particle.a += uDeltaTime * 0.3;
    }

    gl_FragColor = particle;
}
```

### 파티클 UV 계산 (중앙값)
```js
const particlesUvArray = new Float32Array(baseGeometry.count * 2)
for(let y = 0; y < gpgpu.size; y++) {
    for(let x = 0; x < gpgpu.size; x++) {
        const i = y * gpgpu.size + x
        const i2 = i * 2
        particlesUvArray[i2] = (x + 0.5) / gpgpu.size     // 셀 중앙값
        particlesUvArray[i2 + 1] = (y + 0.5) / gpgpu.size
    }
}
particles.geometry.setAttribute('aParticlesUv', new THREE.BufferAttribute(particlesUvArray, 2))
```

### Vertex Shader (GPGPU 텍스처로 위치 결정)
```glsl
uniform sampler2D uParticlesTexture;
attribute vec2 aParticlesUv;
attribute float aSize;

void main() {
    vec4 particle = texture(uParticlesTexture, aParticlesUv);

    vec4 modelPosition = modelMatrix * vec4(particle.xyz, 1.0);
    // ...

    // 생명 기반 크기 (태어나고 죽을 때 작아짐)
    float sizeIn = smoothstep(0.0, 0.1, particle.a);
    float sizeOut = 1.0 - smoothstep(0.7, 1.0, particle.a);
    float size = min(sizeIn, sizeOut);
    gl_PointSize = size * aSize * uSize * uResolution.y;
}
```

### tick 업데이트
```js
const tick = () => {
    gpgpu.particlesVariable.material.uniforms.uTime.value = elapsedTime
    gpgpu.particlesVariable.material.uniforms.uDeltaTime.value = deltaTime
    gpgpu.computation.compute()
    particles.material.uniforms.uParticlesTexture.value =
        gpgpu.computation.getCurrentRenderTarget(gpgpu.particlesVariable).texture
}
```

### async 모델 로딩
```js
const gltf = await gltfLoader.loadAsync('./model.glb')
// vite.config.js: build: { target: 'esnext' }
```

### Sheem 메모
> Sheem에서 수백만 파티클로 캐릭터 형태 + 흐름 효과를 구현할 때 핵심. uFlowFieldInfluence로 파티클이 캐릭터 형태를 유지하는 정도 조절 가능.

---

## 42. Wobbly Sphere 🔴필수
**시간:** 1:16:27 | **난이도:** Hard

**Sheem 관련성:** 물 표면 재질, 아바타 셀 효과

### 핵심 개념

**Custom Shader Material (CSM)**: Three.js 내장 Material에 셰이더 코드를 쉽게 주입하는 라이브러리.

```bash
npm install three-custom-shader-material@6.3
```

```js
import CustomShaderMaterial from 'three-custom-shader-material/vanilla'
```

### CSM 기본 사용
```js
const material = new CustomShaderMaterial({
    baseMaterial: THREE.MeshPhysicalMaterial,
    vertexShader: wobbleVertexShader,
    fragmentShader: wobbleFragmentShader,
    uniforms: uniforms,
    metalness: 0,
    roughness: 0.5,
    transparent: true
})
```

### CSM 변수 (내장 Material 제어)
```glsl
// vertex shader
csm_Position.y += 2.0;        // 정점 위치
csm_Normal = computedNormal;   // 노멀

// fragment shader
csm_DiffuseColor.rgb = vec3(1.0, 0.0, 0.0); // 라이팅 적용 전 색상
csm_Roughness = 0.1;
csm_Metalness = 1.0;
csm_FragColor.rgb = vec3(1.0); // 최종 색상 (라이팅 무시)
```

### Wobble 구현
```glsl
// vertex shader
#include ../includes/simplexNoise4d.glsl

uniform float uTime, uPositionFrequency, uTimeFrequency, uStrength;
uniform float uWarpPositionFrequency, uWarpTimeFrequency, uWarpStrength;

float getWobble(vec3 position) {
    vec3 warpedPosition = position;
    warpedPosition += simplexNoise4d(vec4(
        position * uWarpPositionFrequency,
        uTime * uWarpTimeFrequency
    )) * uWarpStrength;

    return simplexNoise4d(vec4(
        warpedPosition * uPositionFrequency,
        uTime * uTimeFrequency
    )) * uStrength;
}

void main() {
    vec3 biTangent = cross(normal, tangent.xyz);
    float shift = 0.01;
    vec3 positionA = csm_Position + tangent.xyz * shift;
    vec3 positionB = csm_Position + biTangent * shift;

    float wobble = getWobble(csm_Position);
    csm_Position += wobble * normal;
    positionA += getWobble(positionA) * normal;
    positionB += getWobble(positionB) * normal;

    // 노멀 계산
    vec3 toA = normalize(positionA - csm_Position);
    vec3 toB = normalize(positionB - csm_Position);
    csm_Normal = cross(toA, toB);

    vWobble = wobble / uStrength;
}
```

### Tangent 속성 생성
```js
// indexed geometry 필요
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
let geometry = new THREE.IcosahedronGeometry(2.5, 50)
geometry = mergeVertices(geometry)
geometry.computeTangents()
// tangent는 vec4 attribute로 자동 주입
```

### 그림자 수정
```js
const depthMaterial = new CustomShaderMaterial({
    baseMaterial: THREE.MeshDepthMaterial,
    vertexShader: wobbleVertexShader,
    uniforms: uniforms,
    depthPacking: THREE.RGBADepthPacking
})
wobble.customDepthMaterial = depthMaterial
```

### Fragment 색상
```glsl
// fragment shader
varying float vWobble;
uniform vec3 uColorA, uColorB;

void main() {
    float colorMix = smoothstep(-1.0, 1.0, vWobble);
    csm_DiffuseColor.rgb = mix(uColorA, uColorB, colorMix);
    csm_Roughness = 1.0 - colorMix; // 끝부분 반짝임
}
```

### Sheem 메모
> 물 표면 물결 효과 + MeshPhysicalMaterial transmission 조합으로 사실적인 물 구현 가능. Custom Shader Material은 레슨 43, 44에서도 핵심.

---

## 43. Sliced Model 🔴필수
**시간:** 1:03:59 | **난이도:** Hard

**Sheem 관련성:** 모델 내부 공개 효과, 공간 가시화

### 핵심 개념

방사형 좌표계로 모델을 잘라서 내부를 공개하는 효과.

### 라디안 슬라이싱
```glsl
// fragment shader
uniform float uSliceStart; // -PI ~ PI
uniform float uSliceArc;   // 0 ~ 2PI

varying vec3 vPosition;

void main() {
    float angle = atan(vPosition.y, vPosition.x);
    angle -= uSliceStart;
    angle = mod(angle, PI * 2.0); // 음수 처리

    if(angle > 0.0 && angle < uSliceArc) discard;
    // ...
}
```

**PI는 Three.js built-in shader에서 자동 제공** (common chunk)

### three-bvh-csg (보드 테두리)
```bash
npm install three-bvh-csg@0.0.16
```
```js
import { SUBTRACTION, Evaluator, Brush } from 'three-bvh-csg'

const boardFill = new Brush(new THREE.BoxGeometry(11, 2, 11))
const boardHole = new Brush(new THREE.BoxGeometry(10, 2.1, 10))

const evaluator = new Evaluator()
const board = evaluator.evaluate(boardFill, boardHole, SUBTRACTION)
board.geometry.clearGroups() // 그룹 제거
board.material = new THREE.MeshStandardMaterial({ color: '#ffffff' })
```

### patchMap (CSM 커스텀 패치)
```js
const patchMap = {
    csm_Slice: {
        '#include <colorspace_fragment>':
        `
            #include <colorspace_fragment>
            if(!gl_FrontFacing)
                gl_FragColor = vec4(0.75, 0.15, 0.3, 1.0); // 내부 색상
        `
    }
}
const slicedMaterial = new CustomShaderMaterial({
    patchMap: patchMap,
    side: THREE.DoubleSide,
    // ...
})
```

```glsl
// fragment shader에서 패치 활성화
void main() {
    // ...
    float csm_Slice; // 이 변수 선언으로 패치 활성화
}
```

### 그림자 수정
```js
const slicedDepthMaterial = new CustomShaderMaterial({
    baseMaterial: THREE.MeshDepthMaterial,
    vertexShader: slicedVertexShader,
    fragmentShader: slicedFragmentShader,
    uniforms: uniforms,
    patchMap: patchMap,
    depthPacking: THREE.RGBADepthPacking
})
mesh.customDepthMaterial = slicedDepthMaterial
```

### traverse로 특정 메시에만 적용
```js
model.traverse((child) => {
    if(child.isMesh) {
        if(child.name === 'outerHull') {
            child.material = slicedMaterial
            child.customDepthMaterial = slicedDepthMaterial
        } else {
            child.material = material
        }
    }
})
```

### Sheem 메모
> 오디오 존 내부 공개, 지도 단면 표시에 활용 가능. patchMap 패턴은 CSM의 강력한 기능.

---

## 44. Procedural Terrain 🔴필수
**시간:** 1:24:18 | **난이도:** Hard

**Sheem 관련성:** Sheem 지형 시스템의 핵심 레슨

### 핵심 개념

Simplex Noise + Custom Shader Material로 절차적 지형 생성.

### getElevation 함수
```glsl
#include ../includes/simplexNoise2d.glsl

uniform float uPositionFrequency;
uniform float uStrength;
uniform float uWarpFrequency;
uniform float uWarpStrength;
uniform float uTime;

float getElevation(vec2 position) {
    // 워프 (위치 비틀기)
    vec2 warpedPosition = position;
    warpedPosition += uTime * 0.2; // 애니메이션
    warpedPosition += simplexNoise2d(warpedPosition * uPositionFrequency * uWarpFrequency) * uWarpStrength;

    // 옥타브 노이즈
    float elevation = 0.0;
    elevation += simplexNoise2d(warpedPosition * uPositionFrequency      ) / 2.0;
    elevation += simplexNoise2d(warpedPosition * uPositionFrequency * 2.0) / 4.0;
    elevation += simplexNoise2d(warpedPosition * uPositionFrequency * 4.0) / 8.0;

    // 평원 효과 (pow로 낮은 부분 평평하게)
    float elevationSign = sign(elevation);
    elevation = pow(abs(elevation), 2.0) * elevationSign;
    elevation *= uStrength;

    return elevation;
}
```

### 노멀 계산 (이웃 정점)
```glsl
void main() {
    float shift = 0.01;
    vec3 positionA = position.xyz + vec3(shift, 0.0, 0.0);
    vec3 positionB = position.xyz + vec3(0.0, 0.0, -shift);

    float elevation = getElevation(csm_Position.xz);
    csm_Position.y += elevation;
    positionA.y += getElevation(positionA.xz);
    positionB.y += getElevation(positionB.xz);

    vec3 toA = normalize(positionA - csm_Position);
    vec3 toB = normalize(positionB - csm_Position);
    csm_Normal = cross(toA, toB);

    vPosition = csm_Position;
    vPosition.xz += uTime * 0.2; // fragment shader와 동기화
    vUpDot = dot(csm_Normal, vec3(0.0, 1.0, 0.0));
}
```

### 색상 레이어링
```glsl
// fragment shader
varying vec3 vPosition;
varying float vUpDot;

void main() {
    vec3 color = vec3(1.0);

    // 물 (깊이 → 표면)
    float surfaceWaterMix = smoothstep(-1.0, -0.1, vPosition.y);
    color = mix(uColorWaterDeep, uColorWaterSurface, surfaceWaterMix);

    // 모래 (급격한 전환)
    color = mix(color, uColorSand, step(-0.1, vPosition.y));

    // 풀
    color = mix(color, uColorGrass, step(-0.06, vPosition.y));

    // 눈 (노이즈로 불규칙)
    float snowThreshold = 0.45;
    snowThreshold += simplexNoise2d(vPosition.xz * 15.0) * 0.1;
    color = mix(color, uColorSnow, step(snowThreshold, vPosition.y));

    // 바위 (수직 면)
    float rockMix = 1.0 - step(0.8, vUpDot);
    rockMix *= step(-0.06, vPosition.y); // 풀 위에서만
    color = mix(color, uColorRock, rockMix);

    csm_DiffuseColor = vec4(color, 1.0);
}
```

### 기하학 최적화
```js
const geometry = new THREE.PlaneGeometry(10, 10, 500, 500)
geometry.rotateX(-Math.PI * 0.5) // 기하학 자체 회전 (행렬 계산 단순화)
geometry.deleteAttribute('uv')
geometry.deleteAttribute('normal')
```

### three-bvh-csg 보드
```js
const boardFill = new Brush(new THREE.BoxGeometry(11, 2, 11))
const boardHole = new Brush(new THREE.BoxGeometry(10, 2.1, 10))
const board = evaluator.evaluate(boardFill, boardHole, SUBTRACTION)
board.geometry.clearGroups()
board.material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 })
```

### 물 표면 (MeshPhysicalMaterial transmission)
```js
const water = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10, 1, 1),
    new THREE.MeshPhysicalMaterial({
        transmission: 1,
        roughness: 0.3
    })
)
water.rotation.x = -Math.PI * 0.5
water.position.y = -0.1
```

### Sheem 메모
> Sheem 지형 시스템의 핵심 레슨. 오디오 존별 지형 타입(숲=풀, 도시=바위, 물가=모래) 색상 구분에 직접 활용. uTime으로 지형 천천히 흘러가는 효과.
