# Three.js Journey — Chapter 01: Basics

---

## 01. Introduction

- **Sheem 관련도**: ⚪ 스킵 가능
- **핵심 개념**: 코스 오리엔테이션
- **Sheem 메모**: 없음

### 전체 내용
코스 소개 및 강사 소개 레슨. 코드 없음.

7개 챕터 구성:
1. Basics — 씬, 오브젝트, 텍스처, 애니메이션
2. Classic Techniques — 지오메트리, 조명, 파티클
3. Advanced — Blender 연동, 물리엔진
4. Shaders — GLSL, WebGL 핵심
5. Extra — 포스트프로세싱, 퍼포먼스 최적화
6. Portal Scene — 실전 씬 제작
7. React Three Fiber — React 환경에서 Three.js

---

## 02. What is WebGL and why use Three.js

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: WebGL, GPU 병렬 처리, Three.js의 역할
- **Sheem 메모**: 전체 플랫폼의 렌더링 기반 이해. WebGL이 왜 Three.js로 추상화되는지 알아야 셰이더/최적화 결정을 제대로 할 수 있음

### 전체 내용

**WebGL이란?**
- JavaScript API로 canvas에 삼각형을 GPU 속도로 렌더링
- GPU는 수천 개의 병렬 계산 가능 → 3D 렌더링에 최적
- 1000개 삼각형 = 3000개 꼭짓점을 GPU가 한 번에 처리
- 꼭짓점 위치 계산 → **셰이더(Shaders)** 라는 프로그램으로 작성
- 변환 데이터 → **행렬(Matrices)** 로 전달
- 네이티브 WebGL로 삼각형 하나 그리는 데 100줄 이상 필요

**Three.js란?**
- MIT 라이선스 JavaScript 라이브러리
- WebGL 바로 위에서 동작 → 복잡한 코드를 단 몇 줄로 추상화
- 필요시 WebGL과 직접 상호작용 가능 (셰이더, 행렬 작성 등)
- 제작자: Ricardo Cabello (Mr.doob)
- 매월 업데이트, 방대한 커뮤니티
- 공식 문서: https://threejs.org/docs/
- 예제: https://threejs.org/examples/

**다른 라이브러리들**
- Three.js가 가장 인기 있고 안정적이며 문서화가 잘 되어 있음
- 네이티브 WebGL에 가장 가까운 라이브러리
- Babylon.js 등 대안도 존재하나 Three.js가 표준

---

## 03. First Three.js Project

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: Scene, Camera, Renderer, Mesh, Vite 개발 환경
- **Sheem 메모**: Sheem 프로젝트 셋업의 직접적인 기반. Scene/Camera/Renderer 구조는 모든 Three.js 코드의 뼈대

### 전체 내용

**개발 환경 (Vite)**
- 브라우저에서 HTML 파일 직접 열면 보안 제한으로 Three.js 로드 불가 → 로컬 서버 필요
- Vite: 가장 인기 있는 빌드 툴. 빠른 설치, HMR(자동 새로고침), GLSL 파일 지원
- Node.js LTS 버전 필요 (v14.18 이상)

```bash
npm init -y           # Node.js 프로젝트 초기화
npm install vite      # Vite 설치
npm install three     # Three.js 설치
npm run dev           # 개발 서버 실행 (http://localhost:5173)
npm run build         # 프로덕션 빌드 → /dist/ 폴더 생성
```

**package.json scripts**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
```

**Three.js import**
```javascript
import * as THREE from 'three'
```

**씬 구성 4요소**

1. **Scene** — 모든 오브젝트, 빛, 파티클을 담는 컨테이너
```javascript
const scene = new THREE.Scene()
```

2. **Object (Mesh)** — Geometry(형태) + Material(외관)의 조합
```javascript
const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
const mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)
```

색상 지정 방법:
- `0xff0000` (JS hex)
- `'#ff0000'` (string hex)
- `'red'` (color name)
- `new THREE.Color(...)` (Color 인스턴스)

3. **Camera** — 씬을 바라보는 시점. 씬에 add 필요
```javascript
const sizes = { width: 800, height: 600 }
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height)
camera.position.z = 3
scene.add(camera)
```
- 첫 번째 파라미터: FOV(수직 시야각, 도 단위) — 보통 45~75
- 두 번째 파라미터: aspect ratio (width / height)

4. **Renderer** — 카메라 시점으로 씬을 canvas에 그림
```javascript
const canvas = document.querySelector('canvas.webgl')
const renderer = new THREE.WebGLRenderer({ canvas: canvas })
renderer.setSize(sizes.width, sizes.height)
renderer.render(scene, camera)
```

**HTML canvas 설정**
```html
<canvas class="webgl"></canvas>
```

**Vite 프로젝트 구조**
- `src/` — index.html, script.js, style.css
- `static/` — 텍스처, 모델 등 정적 파일 (URL에서 `/static` 없이 접근 가능)
- `node_modules/` — 공유 시 제외, `npm install`로 재설치

---

## 04. Transform Objects

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: position, scale, rotation, quaternion, Vector3, Group
- **Sheem 메모**: 캐릭터 이동, 카메라 제어, 오브젝트 배치 등 Sheem의 모든 3D 위치 조작에 직접 사용

### 전체 내용

**4가지 변환 속성**
Object3D를 상속받는 모든 클래스(PerspectiveCamera, Mesh 등)가 보유:
- `position` — 이동
- `scale` — 크기
- `rotation` — 회전
- `quaternion` — 회전 (수학적 방식)

이 속성들은 내부적으로 **행렬(matrices)** 로 컴파일되어 WebGL/GPU에 전달됨

**Position (Vector3)**
```javascript
mesh.position.x = 0.7
mesh.position.y = -0.6
mesh.position.z = 1

// 또는 한 번에
mesh.position.set(0.7, -0.6, 1)
```

Three.js 좌표계:
- y축: 위 방향
- z축: 뒤 방향 (카메라 방향)
- x축: 오른쪽 방향

Vector3 유용한 메서드:
```javascript
mesh.position.length()                    // 원점으로부터의 거리
mesh.position.distanceTo(camera.position) // 다른 Vector3까지의 거리
mesh.position.normalize()                 // 길이를 1로 정규화
```

**AxesHelper** — 디버깅용 축 시각화
```javascript
const axesHelper = new THREE.AxesHelper(2) // 선 길이 2
scene.add(axesHelper)
// 빨간선: x축, 초록선: y축, 파란선: z축
```

**Scale (Vector3)**
```javascript
mesh.scale.x = 2    // x축으로 2배
mesh.scale.y = 0.25
mesh.scale.z = 0.5
```
- 기본값: 1 (크기 변환 없음)
- 음수 값 가능하나 버그 유발 가능 → 지양

**Rotation (Euler)**
```javascript
mesh.rotation.x = Math.PI * 0.25  // 라디안 단위
mesh.rotation.y = Math.PI * 0.25
// Math.PI = 180도, Math.PI * 2 = 360도
```

회전 적용 순서: x → y → z (짐벌락 문제 발생 가능)
순서 변경:
```javascript
mesh.rotation.reorder('YXZ')
```

**Quaternion**
- rotation과 같은 결과지만 수학적으로 짐벌락 문제 없음
- rotation 변경 시 quaternion 자동 업데이트 (반대도 동일)

**lookAt** — 오브젝트가 특정 Vector3를 바라보도록 회전
```javascript
camera.lookAt(new THREE.Vector3(0, -1, 0))
camera.lookAt(mesh.position)
```

**Group** — 여러 오브젝트를 하나의 컨테이너로 묶음
```javascript
const group = new THREE.Group()
group.scale.y = 2
group.rotation.y = 0.2
scene.add(group)

const cube1 = new THREE.Mesh(geometry, material)
cube1.position.x = -1.5
group.add(cube1)  // scene.add 대신 group.add
```
- Group도 Object3D 상속 → position, scale, rotation 사용 가능
- 그룹 변환 시 모든 자식 오브젝트에 일괄 적용

---

## 05. Animations

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: requestAnimationFrame, Clock, deltaTime, GSAP
- **Sheem 메모**: 캐릭터 이동 애니메이션, 오디오 zone 전환 시 크로스페이드, 맵 환경 효과 등 Sheem의 모든 실시간 업데이트에 사용

### 전체 내용

**애니메이션 원리**
Three.js 애니메이션 = 스톱모션: 오브젝트 이동 → 렌더 → 이동 → 렌더 반복
대부분 화면은 60fps (약 16ms마다 1프레임)

**requestAnimationFrame**
```javascript
const tick = () => {
    mesh.rotation.y += 0.01

    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}
tick()
```
- `requestAnimationFrame`은 다음 프레임에 함수 실행을 예약
- 무한 루프로 매 프레임마다 실행

**프레임레이트 독립적 애니메이션 (deltaTime)**
고fps 기기에서 더 빠르게 도는 문제 해결:
```javascript
let time = Date.now()

const tick = () => {
    const currentTime = Date.now()
    const deltaTime = currentTime - time  // 이전 프레임 이후 경과 시간(ms)
    time = currentTime

    mesh.rotation.y += 0.01 * deltaTime
    // ...
}
```

**Three.js Clock (권장)**
```javascript
const clock = new THREE.Clock()

const tick = () => {
    const elapsedTime = clock.getElapsedTime()  // Clock 생성 후 경과 초

    mesh.rotation.y = elapsedTime
    mesh.position.x = Math.cos(elapsedTime)  // sin/cos로 원형 이동
    mesh.position.y = Math.sin(elapsedTime)
    // ...
}
```
- `getElapsedTime()`: 생성 후 경과 시간(초) 반환
- `getDelta()`: 사용 지양 (예측 불가 결과 발생 가능)

**GSAP 애니메이션 라이브러리**
```bash
npm install gsap@3.12
```
```javascript
import gsap from 'gsap'

// A에서 B로 트윈 애니메이션
gsap.to(mesh.position, { duration: 1, delay: 1, x: 2 })

const tick = () => {
    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}
tick()
```
- GSAP 내부에 자체 requestAnimationFrame 존재
- 렌더 루프는 여전히 필요
- 복잡한 시퀀스 애니메이션에 적합 (칼 휘두르기, 등장 연출 등)

**선택 기준**
- 단순 반복 회전 → 네이티브 JS (Clock)
- 복잡한 시퀀스/이징 → GSAP

---

## 06. Cameras

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: PerspectiveCamera, OrbitControls, FOV, near/far, 커스텀 마우스 컨트롤
- **Sheem 메모**: 플레이어 시점 카메라, 3인칭 카메라, 맵 탐색 컨트롤에 직접 사용. OrbitControls는 개발 중 디버깅에도 유용

### 전체 내용

**카메라 종류**
- `Camera` — 추상 클래스, 직접 사용 불가
- `ArrayCamera` — 여러 카메라로 분할 렌더 (멀티플레이어 스플릿 스크린)
- `StereoCamera` — 양안 시차 효과 (VR)
- `CubeCamera` — 6방향 렌더 (환경맵, 반사, 그림자맵)
- `OrthographicCamera` — 원근 없는 정사영 (RTS 게임 스타일)
- `PerspectiveCamera` — 원근감 있는 일반 카메라 ✅ 주로 사용

**PerspectiveCamera 파라미터**
```javascript
const camera = new THREE.PerspectiveCamera(
    75,                           // FOV: 수직 시야각(도) — 보통 45~75
    sizes.width / sizes.height,   // aspect ratio
    0.1,                          // near: 이것보다 가까우면 렌더 안 됨
    100                           // far: 이것보다 멀면 렌더 안 됨
)
```
- near/far를 너무 극단적으로 설정하면 **z-fighting** 발생 (두 면이 겹쳐 깜빡임)

**OrthographicCamera**
```javascript
const aspectRatio = sizes.width / sizes.height
const camera = new THREE.OrthographicCamera(
    -1 * aspectRatio,  // left
    1 * aspectRatio,   // right
    1,                 // top
    -1,                // bottom
    0.1,               // near
    100                // far
)
```
- 원근감 없음, 거리와 무관하게 오브젝트 크기 동일
- aspectRatio 적용 필수 (안 하면 찌그러짐)

**커스텀 마우스 컨트롤**
```javascript
const cursor = { x: 0, y: 0 }

window.addEventListener('mousemove', (event) => {
    cursor.x = event.clientX / sizes.width - 0.5   // -0.5 ~ 0.5
    cursor.y = -(event.clientY / sizes.height - 0.5) // Y축 반전
})

const tick = () => {
    // 원형 궤도 이동
    camera.position.x = Math.sin(cursor.x * Math.PI * 2) * 2
    camera.position.z = Math.cos(cursor.x * Math.PI * 2) * 2
    camera.position.y = cursor.y * 3
    camera.lookAt(mesh.position)
    // ...
}
```

**OrbitControls (권장)**
```javascript
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true  // 부드러운 감속 효과

const tick = () => {
    controls.update()  // damping 사용 시 필수
    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}
```
- 좌클릭: 카메라 회전
- 우클릭: 평행 이동
- 스크롤: 줌
- `controls.target`: 카메라가 바라보는 지점 (Vector3)
- `controls.target.y = 2; controls.update()` — 타겟 변경 후 update 필요

**기타 내장 컨트롤**
- `FlyControls` — 우주선 시점
- `FirstPersonControls` — 고정 up축 비행
- `PointerLockControls` — FPS 게임 스타일
- `TrackballControls` — 수직 각도 제한 없는 OrbitControls
- `TransformControls` — 오브젝트에 기즈모 추가
- `DragControls` — 오브젝트 드래그

---

## 07. Fullscreen and Resizing

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: 뷰포트 맞춤, resize 이벤트, pixel ratio, 풀스크린
- **Sheem 메모**: Sheem은 몰입형 경험이므로 전체 화면 지원 필수. 모바일 대응 시 pixel ratio 처리 중요

### 전체 내용

**뷰포트 전체 채우기**
```javascript
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}
```

CSS 설정:
```css
* {
    margin: 0;
    padding: 0;
}

.webgl {
    position: fixed;
    top: 0;
    left: 0;
    outline: none;  /* Chrome 드래그 시 파란 외곽선 제거 */
}

html, body {
    overflow: hidden;
}
```

**Resize 처리**
```javascript
window.addEventListener('resize', () => {
    // sizes 업데이트
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // 카메라 aspect ratio 업데이트
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()  // 행렬 재계산 필수

    // 렌더러 업데이트
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})
```

**Pixel Ratio 처리**
- 레티나 디스플레이: pixel ratio 2 → 4배 픽셀 렌더 필요
- pixel ratio 3 이상은 마케팅 용도, 품질 차이 미미하나 성능 부담 큼
- 모바일이 pixel ratio 높고 성능은 낮음 → 2로 제한
```javascript
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
```

**풀스크린 토글**
```javascript
window.addEventListener('dblclick', () => {
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement

    if (!fullscreenElement) {
        if (canvas.requestFullscreen) {
            canvas.requestFullscreen()
        } else if (canvas.webkitRequestFullscreen) {
            canvas.webkitRequestFullscreen()  // Safari 대응
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen()
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen()
        }
    }
})
```

---

## 08. Geometries

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: BufferGeometry, 내장 지오메트리들, 커스텀 BufferGeometry, Float32Array
- **Sheem 메모**: 맵 지형(PlaneGeometry + 커스텀 BufferGeometry), 파티클, 소품 오브젝트의 기반. 커스텀 지오메트리는 절차적 지형 생성에 핵심

### 전체 내용

**지오메트리란?**
- 꼭짓점(vertices, 3D 좌표)과 면(faces, 삼각형)으로 구성
- Mesh, 파티클 생성에 사용
- 꼭짓점에 position 외에 UV 좌표, normal 등 추가 데이터 저장 가능

**내장 지오메트리 (BufferGeometry 상속)**
```javascript
new THREE.BoxGeometry(w, h, d, wSeg, hSeg, dSeg)  // 박스
new THREE.PlaneGeometry(w, h, wSeg, hSeg)           // 평면 ← 지형 베이스
new THREE.SphereGeometry(r, widthSeg, heightSeg)    // 구체
new THREE.CylinderGeometry(rTop, rBottom, h, seg)   // 원기둥
new THREE.TorusGeometry(r, tube, radSeg, tubeSeg)   // 도넛
new THREE.ConeGeometry(r, h, seg)                   // 원뿔
new THREE.CircleGeometry(r, seg)                    // 원판
new THREE.RingGeometry(innerR, outerR, seg)         // 링
new THREE.TorusKnotGeometry(r, tube, tubSeg, radSeg)
new THREE.DodecahedronGeometry(r, detail)
new THREE.IcosahedronGeometry(r, detail)
new THREE.OctahedronGeometry(r, detail)
new THREE.TetrahedronGeometry(r, detail)
new THREE.ShapeGeometry(shape)                      // 패스 기반 형태
new THREE.TubeGeometry(path, tubSeg, r, radSeg)    // 패스를 따르는 튜브
new THREE.ExtrudeGeometry(shape, options)           // 돌출
new THREE.LatheGeometry(points, seg)               // 회전체 (꽃병 등)
new THREE.TextGeometry(text, options)               // 3D 텍스트
```

BoxGeometry 세그먼트 예시:
```javascript
const geometry = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2) // 면당 8삼각형
const material = new THREE.MeshBasicMaterial({ wireframe: true }) // 와이어프레임으로 확인
```
- 세그먼트 수 ↑ → 디테일 ↑, 성능 ↓

**커스텀 BufferGeometry**
```javascript
const geometry = new THREE.BufferGeometry()

// Float32Array: 고정 길이 부동소수점 배열
const positionsArray = new Float32Array([
    0, 0, 0,  // 첫 번째 꼭짓점 (x, y, z)
    0, 1, 0,  // 두 번째 꼭짓점
    1, 0, 0   // 세 번째 꼭짓점
])

// BufferAttribute로 변환 (3 = 꼭짓점당 값 개수)
const positionsAttribute = new THREE.BufferAttribute(positionsArray, 3)
geometry.setAttribute('position', positionsAttribute)
```

랜덤 삼각형 50개 생성 예시:
```javascript
const count = 50
const positionsArray = new Float32Array(count * 3 * 3) // 삼각형 * 꼭짓점 * xyz
for (let i = 0; i < count * 3 * 3; i++) {
    positionsArray[i] = (Math.random() - 0.5) * 4
}
const positionsAttribute = new THREE.BufferAttribute(positionsArray, 3)
geometry.setAttribute('position', positionsAttribute)
```

> **Sheem 지형 생성 핵심**: PlaneGeometry + 커스텀 position 값 수정으로 Perlin/Simplex noise 기반 지형 높낮이 구현 가능

---

## 09. Debug UI

- **Sheem 관련도**: 🟡 참고
- **핵심 개념**: lil-gui, 실시간 파라미터 조정, 개발 워크플로우
- **Sheem 메모**: 오디오 존 볼륨, 지형 파라미터, 셰이더 값 등을 개발 중 실시간 조정할 때 유용. 프로덕션 빌드에서는 숨기기

### 전체 내용

**lil-gui 설치 및 초기화**
```bash
npm install lil-gui
```
```javascript
import GUI from 'lil-gui'
const gui = new GUI()

// 설정 옵션
const gui = new GUI({
    width: 300,
    title: 'Debug Panel',
    closeFolders: false
})
```

**트윅 종류**

Range (숫자):
```javascript
gui.add(mesh.position, 'y').min(-3).max(3).step(0.01).name('elevation')
```

Checkbox (boolean):
```javascript
gui.add(mesh, 'visible')
gui.add(material, 'wireframe')
```

Color:
```javascript
// debugObject를 통해 색상 관리 (Three.js 내부 색상 변환 문제 우회)
const debugObject = { color: '#3a6ea6' }
const material = new THREE.MeshBasicMaterial({ color: debugObject.color })

gui.addColor(debugObject, 'color').onChange(() => {
    material.color.set(debugObject.color)
})
```

Button (함수):
```javascript
debugObject.spin = () => {
    gsap.to(mesh.rotation, { duration: 1, y: mesh.rotation.y + Math.PI * 2 })
}
gui.add(debugObject, 'spin')
```

onChange vs onFinishChange:
```javascript
gui.add(debugObject, 'subdivision')
    .min(1).max(20).step(1)
    .onFinishChange(() => {  // 조작 완료 후에만 실행 (CPU 부담 큰 작업에 적합)
        mesh.geometry.dispose()  // 이전 지오메트리 메모리 해제
        mesh.geometry = new THREE.BoxGeometry(1, 1, 1,
            debugObject.subdivision, debugObject.subdivision, debugObject.subdivision)
    })
```

**폴더 구조**
```javascript
const cubeTweaks = gui.addFolder('Awesome cube')
cubeTweaks.close()  // 기본 닫힘
cubeTweaks.add(mesh.position, 'y')
cubeTweaks.add(material, 'wireframe')
```

**숨기기/보이기 토글**
```javascript
gui.hide()
window.addEventListener('keydown', (event) => {
    if (event.key === 'h') gui.show(gui._hidden)
})
```

---

## 10. Textures

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: TextureLoader, LoadingManager, UV 언래핑, 텍스처 변환, Mipmapping, PBR 텍스처 종류
- **Sheem 메모**: 맵 지형 텍스처, 소품 표면 텍스처, 캐릭터 스킨에 직접 사용. 텍스처 최적화는 웹 성능에 중요

### 전체 내용

**텍스처 종류 (PBR 기반)**
- **Color/Albedo** — 기본 색상
- **Alpha** — 흰색=보임, 검정=안보임 (투명도)
- **Height** — 꼭짓점을 이동시켜 실제 굴곡 생성 (세그먼트 필요)
- **Normal** — 빛을 속여 굴곡처럼 보이게 함 (꼭짓점 이동 없음, 성능 우수)
- **Ambient Occlusion** — 틈새 가짜 그림자 (대비감 향상)
- **Metalness** — 금속(흰색)/비금속(검정) 구분
- **Roughness** — 거친(흰색)/매끄러운(검정) 표면

**텍스처 로딩**
```javascript
const textureLoader = new THREE.TextureLoader()
const texture = textureLoader.load('/textures/door/color.jpg')
texture.colorSpace = THREE.SRGBColorSpace  // map, matcap 용도 텍스처에 필수
```

LoadingManager (여러 텍스처 일괄 관리):
```javascript
const loadingManager = new THREE.LoadingManager()
loadingManager.onLoad = () => { console.log('모두 로딩 완료') }
loadingManager.onProgress = () => { console.log('로딩 중') }
loadingManager.onError = () => { console.log('오류') }

const textureLoader = new THREE.TextureLoader(loadingManager)
const colorTexture = textureLoader.load('/textures/door/color.jpg')
colorTexture.colorSpace = THREE.SRGBColorSpace
```

**UV 언래핑**
- 3D 지오메트리를 평면으로 펼쳐 2D 텍스처를 어떻게 입힐지 정의
- `geometry.attributes.uv`에 UV 좌표 저장
- 내장 지오메트리는 UV 자동 생성
- 커스텀 지오메트리나 Blender 모델은 UV 직접 설정 필요

**텍스처 변환**
```javascript
// 반복
colorTexture.repeat.x = 2
colorTexture.repeat.y = 3
colorTexture.wrapS = THREE.RepeatWrapping   // x축 반복
colorTexture.wrapT = THREE.RepeatWrapping   // y축 반복
// THREE.MirroredRepeatWrapping 으로 미러 반복도 가능

// 오프셋
colorTexture.offset.x = 0.5

// 회전
colorTexture.rotation = Math.PI * 0.25
colorTexture.center.x = 0.5  // 회전 중심점
colorTexture.center.y = 0.5
```

**Mipmapping과 필터링**
- Mipmapping: GPU가 텍스처의 절반 크기 버전들을 자동 생성해 최적 해상도 선택
- 텍스처 크기는 **2의 거듭제곱** 필수 (512, 1024, 2048 등)

Minification filter (텍스처 > 렌더 픽셀):
```javascript
colorTexture.minFilter = THREE.NearestFilter  // 선명하지만 모아레 패턴 가능
// 기본값: THREE.LinearMipmapLinearFilter
```

Magnification filter (텍스처 < 렌더 픽셀):
```javascript
colorTexture.magFilter = THREE.NearestFilter  // 픽셀 아트 스타일
// 기본값: THREE.LinearFilter
```

NearestFilter 사용 시 mipmapping 비활성화 가능:
```javascript
colorTexture.generateMipmaps = false
colorTexture.minFilter = THREE.NearestFilter
```

**텍스처 최적화 3요소**
1. **용량** — jpg(손실, 가벼움) vs png(무손실, 무거움). TinyPNG로 압축
2. **해상도** — 가능한 작게. 2의 거듭제곱 필수
3. **데이터** — 투명도 필요 → png. Normal 맵 → 정밀도를 위해 png

**텍스처 소스**
- poliigon.com
- 3dtextures.me
- arroway-textures.ch
- Substance Designer (절차적 생성)

---

## 11. Materials

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: MeshBasicMaterial, MeshStandardMaterial, MeshPhysicalMaterial, PBR, 환경맵, 각종 맵 속성
- **Sheem 메모**: 맵 지형, 물, 소품, 캐릭터 표현에 직접 사용. MeshStandardMaterial이 Sheem의 주력 머티리얼. 환경맵은 분위기 있는 장면 연출에 핵심

### 전체 내용

**머티리얼이란?**
- 지오메트리의 각 픽셀 색상을 결정하는 셰이더 프로그램
- Three.js가 내장 셰이더를 가진 다양한 머티리얼 클래스 제공

**MeshBasicMaterial** — 빛 불필요, 가장 단순
```javascript
const material = new THREE.MeshBasicMaterial()
material.map = doorColorTexture           // 텍스처
material.color = new THREE.Color('#ff0000') // 단색 (map과 조합 시 틴트 효과)
material.wireframe = true                 // 와이어프레임
material.transparent = true              // 투명도 활성화
material.opacity = 0.5                   // 투명도 (transparent: true 필요)
material.alphaMap = doorAlphaTexture     // 텍스처로 투명도 제어
material.side = THREE.DoubleSide         // 양면 렌더 (성능 부담)
// THREE.FrontSide (기본), THREE.BackSide, THREE.DoubleSide
```

**MeshNormalMaterial** — 법선 방향을 색상으로 시각화
```javascript
const material = new THREE.MeshNormalMaterial()
material.flatShading = true  // 면 단위 평탄 셰이딩
```
- 디버깅 또는 독특한 비주얼 연출용

**MeshMatcapMaterial** — 빛 불필요, 고성능 가짜 조명 효과
```javascript
const material = new THREE.MeshMatcapMaterial()
material.matcap = matcapTexture
```
- 구체처럼 생긴 참조 텍스처에서 색상 추출
- 카메라 방향에 무관하게 일관된 결과
- 레퍼런스: https://github.com/nidorx/matcaps

**MeshDepthMaterial** — near=흰색, far=검정 (그림자맵 등 내부 용도)

**MeshLambertMaterial** — 빛 필요, 가장 성능 좋은 조명 머티리얼
```javascript
const material = new THREE.MeshLambertMaterial()
// 빛 없으면 검정 화면
```

**MeshPhongMaterial** — Lambert보다 성능 낮지만 반사 하이라이트 지원
```javascript
const material = new THREE.MeshPhongMaterial()
material.shininess = 100
material.specular = new THREE.Color(0x1188ff)
```

**MeshToonMaterial** — 카툰 스타일
```javascript
const material = new THREE.MeshToonMaterial()
gradientTexture.minFilter = THREE.NearestFilter
gradientTexture.magFilter = THREE.NearestFilter
gradientTexture.generateMipmaps = false
material.gradientMap = gradientTexture
```
> **Sheem에서 동물의 숲 스타일 구현 시 참고**

**MeshStandardMaterial** ← Sheem 주력 머티리얼
```javascript
const material = new THREE.MeshStandardMaterial()
material.metalness = 0.7
material.roughness = 0.2
material.map = doorColorTexture
material.aoMap = doorAmbientOcclusionTexture      // 주변광 차폐 (틈새 그림자)
material.aoMapIntensity = 1
material.displacementMap = doorHeightTexture      // 실제 꼭짓점 변위
material.displacementScale = 0.1
material.metalnessMap = doorMetalnessTexture
material.roughnessMap = doorRoughnessTexture
material.normalMap = doorNormalTexture            // 가짜 굴곡
material.normalScale.set(0.5, 0.5)
material.transparent = true
material.alphaMap = doorAlphaTexture
```

**환경맵 (Environment Map)**
```javascript
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'

const rgbeLoader = new RGBELoader()
rgbeLoader.load('./textures/environmentMap/2k.hdr', (environmentMap) => {
    environmentMap.mapping = THREE.EquirectangularReflectionMapping
    scene.background = environmentMap  // 배경
    scene.environment = environmentMap // 모든 메시에 반사/조명 영향
})
```
- LambertMaterial, PhongMaterial, StandardMaterial 모두 호환

**MeshPhysicalMaterial** — StandardMaterial 확장, 최고 품질 최저 성능
```javascript
const material = new THREE.MeshPhysicalMaterial()

// Clearcoat (바니시 코팅 효과)
material.clearcoat = 1
material.clearcoatRoughness = 0

// Sheen (패브릭 질감)
material.sheen = 1
material.sheenRoughness = 0.25
material.sheenColor.set(1, 1, 1)

// Iridescence (무지개 빛)
material.iridescence = 1
material.iridescenceIOR = 1
material.iridescenceThicknessRange = [100, 800]

// Transmission (유리/물 굴절 효과)
material.transmission = 1
material.ior = 1.5   // 굴절률: 다이아몬드=2.417, 물=1.333
material.thickness = 0.5
```

**조명 추가 (Materials 레슨 맥락)**
```javascript
const ambientLight = new THREE.AmbientLight(0xffffff, 1)
scene.add(ambientLight)

const pointLight = new THREE.PointLight(0xffffff, 30)
pointLight.position.set(2, 3, 4)
scene.add(pointLight)
```

---

## 12. 3D Text

- **Sheem 관련도**: 🟡 참고
- **핵심 개념**: FontLoader, TextGeometry, 바운딩 박스, 인스턴싱 최적화
- **Sheem 메모**: UI 레이블, 존 이름 표시 등에 활용 가능. 바운딩 박스와 frustum culling 개념은 성능 최적화에 중요

### 전체 내용

**폰트 로딩**
```javascript
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'

const fontLoader = new FontLoader()
fontLoader.load('/fonts/helvetiker_regular.typeface.json', (font) => {
    // 폰트 로드 완료 후 코드 작성
})
```

폰트 파일 위치: `/node_modules/three/examples/fonts/` → `/static/fonts/` 복사

**TextGeometry 생성**
```javascript
const textGeometry = new TextGeometry('Hello Three.js', {
    font: font,
    size: 0.5,
    depth: 0.2,
    curveSegments: 12,    // 낮출수록 성능 향상
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.02,
    bevelOffset: 0,
    bevelSegments: 5      // 낮출수록 성능 향상
})
```

**텍스트 중앙 정렬**
```javascript
// 방법 1: 직접 계산
textGeometry.computeBoundingBox()
textGeometry.translate(
    -(textGeometry.boundingBox.max.x - 0.02) * 0.5,
    -(textGeometry.boundingBox.max.y - 0.02) * 0.5,
    -(textGeometry.boundingBox.max.z - 0.03) * 0.5
)

// 방법 2: 간단하게
textGeometry.center()
```

**바운딩과 Frustum Culling**
- Bounding Box/Sphere: 지오메트리가 차지하는 공간 정보
- Frustum Culling: 카메라 밖 오브젝트는 렌더 안 함 → 자동 성능 최적화

**오브젝트 최적화 (같은 지오메트리/머티리얼 재사용)**
```javascript
const donutGeometry = new THREE.TorusGeometry(0.3, 0.2, 20, 45)
const material = new THREE.MeshMatcapMaterial({ matcap: matcapTexture })

for (let i = 0; i < 100; i++) {
    const donut = new THREE.Mesh(donutGeometry, material)  // 같은 지오메트리/머티리얼 재사용
    donut.position.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
    )
    donut.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
    const scale = Math.random()
    donut.scale.set(scale, scale, scale)
    scene.add(donut)
}
```

---

## 13. Go Live

- **Sheem 관련도**: 🟡 참고
- **핵심 개념**: npm run build, Vercel 배포, 지속적 통합
- **Sheem 메모**: MVP 배포 시 Vercel 사용. 무료 플랜으로 시작, 트래픽 늘면 유료 전환

### 전체 내용

**프로덕션 빌드**
```bash
npm run build  # /dist/ 폴더에 최종 파일 생성
```

**Vercel 배포**
```bash
npm install vercel
```

package.json에 deploy 스크립트 추가:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "deploy": "vercel --prod"
  }
}
```

```bash
npm run deploy  # 첫 실행 시 계정 연결 및 설정
```

**배포 플로우**
1. 계정 생성 (vercel.com)
2. 프로젝트 폴더에서 `npm run deploy`
3. 이메일 인증
4. 프로젝트 이름 설정
5. URL 자동 생성 및 클립보드 복사

**가격**
- Hobby (무료): 소규모 개인 프로젝트, 상업적 목적 불가
- 상업용, 팀 기능, 고트래픽 → 유료 플랜

**대안**
- Netlify
- GitHub Pages
