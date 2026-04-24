# Chapter 05: Extra

---

## 45. Post-processing 🟡참고
**시간:** 1:36:39 | **난이도:** Hard

**Sheem 관련성:** 분위기 연출 후처리 효과 (bloom, 색상 보정 등)

### 핵심 개념

**Post-processing**: 최종 렌더 이미지에 효과 추가 (영화 후처리와 동일 원리).

**작동 원리:**
1. 씬을 캔버스가 아닌 **Render Target** (FBO 텍스처)에 렌더
2. 텍스처를 카메라 앞 전체 화면 Plane에 적용
3. Fragment shader로 효과 처리
4. **Ping-pong buffering**: 패스가 여러 개일 때 두 RT를 교대로 사용
5. 마지막 패스만 캔버스에 출력

### EffectComposer 기본 설정
```js
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'

const effectComposer = new EffectComposer(renderer)
effectComposer.setSize(sizes.width, sizes.height)
effectComposer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// 첫 번째 패스: 씬 렌더
const renderPass = new RenderPass(scene, camera)
effectComposer.addPass(renderPass)

// tick에서 renderer.render 대신
effectComposer.render()
```

### resize 시 업데이트
```js
window.addEventListener('resize', () => {
    effectComposer.setSize(sizes.width, sizes.height)
    effectComposer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})
```

### 내장 패스들
```js
// DotScreenPass (흑백 래스터 효과)
import { DotScreenPass } from 'three/examples/jsm/postprocessing/DotScreenPass.js'
const dotScreenPass = new DotScreenPass()
dotScreenPass.enabled = false // 비활성화
effectComposer.addPass(dotScreenPass)

// GlitchPass
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass.js'
const glitchPass = new GlitchPass()
glitchPass.goWild = true
effectComposer.addPass(glitchPass)

// ShaderPass (RGBShift)
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js'
const rgbShiftPass = new ShaderPass(RGBShiftShader)
effectComposer.addPass(rgbShiftPass)

// UnrealBloomPass (글로우 효과)
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
const unrealBloomPass = new UnrealBloomPass()
unrealBloomPass.strength = 1
unrealBloomPass.radius = 1
unrealBloomPass.threshold = 0.5
effectComposer.addPass(unrealBloomPass) // GammaCorrection 전에 추가
```

### 색상 보정 필수 (항상 마지막에)
```js
// 렌더 타겟은 outputColorSpace 지원 안 함 → 수동으로 감마 보정
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js'
const gammaCorrectionPass = new ShaderPass(GammaCorrectionShader)
effectComposer.addPass(gammaCorrectionPass) // 항상 마지막!
```

### 안티앨리어싱 수정
EffectComposer의 기본 렌더 타겟은 안티앨리어싱 미지원.

**방법 1: samples 속성 (WebGL2 지원 브라우저)**
```js
const renderTarget = new THREE.WebGLRenderTarget(800, 600, {
    samples: renderer.getPixelRatio() === 1 ? 2 : 0 // 픽셀 비율 1일 때만
})
const effectComposer = new EffectComposer(renderer, renderTarget)
```

**방법 2: SMAA 패스**
```js
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
const smaaPass = new SMAAPass()
effectComposer.addPass(smaaPass) // GammaCorrection 이후에 추가
```

**권장 조합: 둘 다 적용 (각자 지원 범위 커버)**
```js
if(renderer.getPixelRatio() === 1 && !renderer.capabilities.isWebGL2) {
    const smaaPass = new SMAAPass()
    effectComposer.addPass(smaaPass)
}
```

### 커스텀 패스 만들기

**Tint Pass (색조 조절)**
```js
const TintShader = {
    uniforms: {
        tDiffuse: { value: null }, // EffectComposer가 자동으로 이전 패스 텍스처 주입
        uTint: { value: null }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            vUv = uv;
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec3 uTint;
        varying vec2 vUv;
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            color.rgb += uTint;
            gl_FragColor = color;
        }
    `
}

const tintPass = new ShaderPass(TintShader)
tintPass.material.uniforms.uTint.value = new THREE.Vector3() // 패스 생성 후 설정
effectComposer.addPass(tintPass)
```

**Displacement Pass (UV 왜곡 + 노말맵)**
```js
const DisplacementShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: null },
        uNormalMap: { value: null }
    },
    vertexShader: `/* uv varying */`,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform sampler2D uNormalMap;
        varying vec2 vUv;

        void main() {
            vec3 normalColor = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
            vec2 newUv = vUv + normalColor.xy * 0.1;
            vec4 color = texture2D(tDiffuse, newUv);

            // 라이팅 효과
            vec3 lightDirection = normalize(vec3(-1.0, 1.0, 0.0));
            float lightness = clamp(dot(normalColor, lightDirection), 0.0, 1.0);
            color.rgb += lightness * 2.0;

            gl_FragColor = color;
        }
    `
}
```

**패스 순서 (중요)**
```
renderPass → (효과 패스들) → unrealBloomPass → gammaCorrectionPass → smaaPass
```

### Sheem 메모
> UnrealBloomPass로 물 반사 글로우, 빛 효과 연출. 커스텀 패스로 분위기별 색조 변환 가능. 패스 수를 최소화할 것 (성능 영향 큼).

---

## 46. Performance Tips 🟡참고
**시간:** 1:12:24 | **난이도:** Medium

**Sheem 관련성:** 모바일 대응, 대규모 파티클 성능 최적화

### 핵심 개념

목표: **60fps 이상** 유지, 특히 모바일에서.

### 모니터링 도구
```js
// stats.js
import Stats from 'stats.js'
const stats = new Stats()
stats.showPanel(0) // 0: FPS, 1: ms, 2: MB
document.body.appendChild(stats.dom)

const tick = () => {
    stats.begin()
    // ...
    stats.end()
}

// 렌더러 정보
console.log(renderer.info) // draw calls, 삼각형 수 등
```

### 라이팅
- **피할 것**: Three.js 라이트는 성능 소모 큼
- **사용해야 한다면**: `AmbientLight`, `DirectionalLight` 등 저렴한 것 우선
- **동적 추가/제거 금지**: 모든 Material이 재컴파일됨 → 화면 프리즈

### 그림자
- **최대한 피하고** Baked Shadow 사용
- **써야 한다면**:
  ```js
  // 그림자 맵 영역 최소화
  directionalLight.shadow.camera.top = 3
  directionalLight.shadow.mapSize.set(1024, 1024) // 최소 해상도

  // 필요한 오브젝트에만 활성화
  cube.castShadow = true
  floor.receiveShadow = true

  // 자동 업데이트 비활성화 (정적 씬에서)
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true // 필요할 때만
  ```

### 텍스처
- 해상도 최소화 (GPU 메모리가 파일 크기가 아닌 해상도에 비례)
- **2의 거듭제곱 해상도 필수** (256, 512, 1024... 미믹맵 생성에 필요)
- TinyPNG, Basis 포맷으로 파일 크기 압축

### 지오메트리
```js
// 같은 지오메트리 공유 (재사용)
const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)
for(let i = 0; i < 50; i++) {
    const mesh = new THREE.Mesh(geometry, material) // 동일 geometry 재사용
}

// 정적 오브젝트 → 지오메트리 병합 (draw call 최소화)
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'
const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries)
const mesh = new THREE.Mesh(mergedGeometry, material) // 단 1개의 draw call
```

### 재질
```js
// 같은 Material 공유
const material = new THREE.MeshNormalMaterial()
for(let i = 0; i < 50; i++) {
    const mesh = new THREE.Mesh(geometry, material) // 동일 material 재사용
}

// 저렴한 순서: Basic < Lambert < Phong < Standard < Physical
// 가능하면 MeshBasicMaterial 사용
```

### InstancedMesh (독립 제어 + 성능 최적화)
```js
const mesh = new THREE.InstancedMesh(geometry, material, 50) // count=50
scene.add(mesh)

for(let i = 0; i < 50; i++) {
    const matrix = new THREE.Matrix4()
    matrix.makeRotationFromQuaternion(quaternion)
    matrix.setPosition(position)
    mesh.setMatrixAt(i, matrix)
}

// tick에서 변경할 경우
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
```

### 렌더러 설정
```js
// 픽셀 비율 제한 (고밀도 스크린 성능 영향)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// 파워 힌트
const renderer = new THREE.WebGLRenderer({
    powerPreference: 'high-performance' // 또는 'default'
})

// 안티앨리어싱 (필요한 경우에만)
// 픽셀 비율 > 1이면 앨리어싱 안 보임 → 불필요
```

### 셰이더 최적화
```glsl
// 정밀도 낮추기
const shaderMaterial = new THREE.ShaderMaterial({
    precision: 'lowp', // RawShaderMaterial에는 수동으로
})

// 텍스처 사용 (Perlin 함수보다 훨씬 저렴)
float value = texture2D(uNoiseTexture, uv).r;

// defines 사용 (uniform보다 성능 좋음, 변하지 않는 값)
const shaderMaterial = new THREE.ShaderMaterial({
    defines: {
        uDisplacementStrength: 1.5
    }
})
// 셰이더에서: #define uDisplacementStrength 1.5

// 가능하면 vertex shader에서 계산, fragment로 varying 전달
```

### 카메라 최적화
```js
camera.fov = 60 // FOV 줄이면 화면 밖 오브젝트 컬링 증가
camera.near = 0.1
camera.far = 50 // 불필요하게 멀리 렌더하지 않도록
```

### 포스트 프로세싱
```
패스 수를 최소화. 1920×1080 × 픽셀비율² × 패스 수 = 처리 픽셀 수
커스텀 패스들을 하나로 통합할 것
```

### 일반
```js
// dispose로 메모리 해제
scene.remove(mesh)
mesh.geometry.dispose()
mesh.material.dispose()
```

### Sheem 메모
> 512×512 파티클 그리드 + GPGPU + 실시간 오디오 연동 → 성능 중요. InstancedMesh로 나무/풀 표현, 텍스처 노이즈로 Perlin 함수 대체.

---

## 47. Intro and Loading Progress 🔴필수
**시간:** 49:54 | **난이도:** Medium

**Sheem 관련성:** 학습 앱의 로딩 화면 + 부드러운 인트로 구현

### 핵심 개념

LoadingManager + 셰이더 오버레이 + HTML 로딩 바 조합으로 부드러운 인트로 구현.

### 셰이더 오버레이 (행렬 없는 전체화면 Plane)
```js
const overlayGeometry = new THREE.PlaneGeometry(2, 2, 1, 1) // size=2 → 화면 전체
const overlayMaterial = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
        uAlpha: { value: 1 } // 처음엔 완전 불투명
    },
    vertexShader: `
        void main() {
            // 행렬 없이 → 카메라 무관하게 항상 전체 화면
            gl_Position = vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uAlpha;
        void main() {
            gl_FragColor = vec4(0.0, 0.0, 0.0, uAlpha);
        }
    `
})
const overlay = new THREE.Mesh(overlayGeometry, overlayMaterial)
scene.add(overlay)
```

### LoadingManager 설정
```js
const loadingManager = new THREE.LoadingManager(
    // 로딩 완료
    () => {
        window.setTimeout(() => {
            // 오버레이 페이드 아웃
            gsap.to(overlayMaterial.uniforms.uAlpha, { duration: 3, value: 0, delay: 1 })

            // 로딩 바 숨기기
            loadingBarElement.classList.add('ended')
            loadingBarElement.style.transform = ''
        }, 500) // 0.5초 대기 (렌더 초기화 시간)
    },
    // 로딩 진행
    (itemUrl, itemsLoaded, itemsTotal) => {
        const progressRatio = itemsLoaded / itemsTotal
        loadingBarElement.style.transform = `scaleX(${progressRatio})`
    }
)

const gltfLoader = new GLTFLoader(loadingManager)
const cubeTextureLoader = new THREE.CubeTextureLoader(loadingManager)
```

### HTML 로딩 바
```html
<!-- index.html -->
<canvas class="webgl"></canvas>
<div class="loading-bar"></div>
```

```css
/* style.css */
.loading-bar {
    position: absolute;
    top: 50%;
    width: 100%;
    height: 2px;
    background: #ffffff;
    transform: scaleX(0);
    transform-origin: top left;
    transition: transform 0.5s; /* 부드러운 진행 */
}

/* 로딩 완료 시 오른쪽으로 사라짐 */
.loading-bar.ended {
    transform: scaleX(0);
    transform-origin: 100% 0; /* 오른쪽 기준 */
    transition: transform 1.5s ease-in-out;
}
```

```js
// JS에서 바 업데이트
const loadingBarElement = document.querySelector('.loading-bar')
```

### GSAP 설치
```bash
npm install --save gsap@3.12
```
```js
import { gsap } from 'gsap'
gsap.to(overlayMaterial.uniforms.uAlpha, { duration: 3, value: 0 })
```

### Sheem 메모
> Sheem 앱 시작 시 필수. "쉼"의 느낌에 맞는 부드러운 검정→씬 페이드인 구현. 로딩 바는 CSS로 간단히.

---

## 48. Mixing HTML and WebGL 🔴필수
**시간:** 58:07 | **난이도:** Hard

**Sheem 관련성:** 3D 공간에 UI 요소 붙이기 (오디오 존 라벨, 정보 포인트)

### 핵심 개념

3D 위치를 2D 화면 좌표로 변환 → HTML 요소를 3D 위치에 고정.

### 핵심 변환 공식
```js
// 3D position → 화면 좌표
const screenPosition = point.position.clone()
screenPosition.project(camera) // -1 ~ +1 범위

// 픽셀 좌표로 변환
const translateX = screenPosition.x * sizes.width * 0.5
const translateY = -screenPosition.y * sizes.height * 0.5 // Y 반전!

element.style.transform = `translateX(${translateX}px) translateY(${translateY}px)`
```

### 포인트 저장 구조
```js
const points = [
    {
        position: new THREE.Vector3(1.55, 0.3, -0.6),
        element: document.querySelector('.point-0')
    },
    {
        position: new THREE.Vector3(0.5, 0.8, -1.6),
        element: document.querySelector('.point-1')
    }
]
```

### tick에서 포인트 업데이트
```js
const raycaster = new THREE.Raycaster()

const tick = () => {
    if(sceneReady) {
        for(const point of points) {
            // 3D → 2D 변환
            const screenPosition = point.position.clone()
            screenPosition.project(camera)

            // Raycaster로 오클루전 체크
            raycaster.setFromCamera(screenPosition, camera)
            const intersects = raycaster.intersectObjects(scene.children, true)

            if(intersects.length === 0) {
                point.element.classList.add('visible')
            } else {
                const intersectionDistance = intersects[0].distance
                const pointDistance = point.position.distanceTo(camera.position)

                if(intersectionDistance < pointDistance) {
                    point.element.classList.remove('visible') // 앞에 물체 있음
                } else {
                    point.element.classList.add('visible')
                }
            }

            // 위치 업데이트
            const translateX = screenPosition.x * sizes.width * 0.5
            const translateY = -screenPosition.y * sizes.height * 0.5
            point.element.style.transform = `translateX(${translateX}px) translateY(${translateY}px)`
        }
    }
}
```

### 씬 준비 완료 후 표시
```js
let sceneReady = false
const loadingManager = new THREE.LoadingManager(
    () => {
        window.setTimeout(() => {
            sceneReady = true
        }, 2000) // 인트로 끝나고 나서
    }
)
```

### HTML 구조
```html
<div class="point point-0">
    <div class="label">1</div>
    <div class="text">포인트 설명 텍스트</div>
</div>
```

### CSS (라벨 + 텍스트 + 호버 효과)
```css
.point {
    position: absolute;
    top: 50%; left: 50%; /* JS가 translate로 정확한 위치 설정 */
}

.point .label {
    position: absolute;
    top: -20px; left: -20px;
    width: 40px; height: 40px;
    border-radius: 50%;
    background: #00000077;
    border: 1px solid #ffffff77;
    color: #ffffff;
    text-align: center;
    line-height: 40px;
    cursor: help;
    transform: scale(0, 0); /* 기본 숨김 */
    transition: transform 0.3s;
}

.point.visible .label {
    transform: scale(1, 1); /* 표시 */
}

.point .text {
    position: absolute;
    top: 30px; left: -120px;
    width: 200px;
    padding: 20px;
    border-radius: 4px;
    background: #00000077;
    border: 1px solid #ffffff77;
    color: #ffffff;
    opacity: 0;
    pointer-events: none; /* 호버 안됨 */
    transition: opacity 0.3s;
}

.point:hover .text {
    opacity: 1;
}
```

### 성능 주의사항
- HTML + WebGL 조합은 성능에 부담
- 보이는 포인트만 업데이트 (최적화)
- 가능하면 Three.js 내부에서만 처리

### Sheem 메모
> 오디오 존 이름 라벨, 사용자 닉네임 표시, 존 정보 팝업에 활용. `raycaster`로 오클루전 처리해서 물체 뒤에 숨은 라벨 자동으로 숨김.
