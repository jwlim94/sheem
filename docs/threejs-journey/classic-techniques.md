# Three.js Journey — Chapter 02: Classic Techniques

---

## 14. Lights

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: AmbientLight, DirectionalLight, PointLight, SpotLight, HemisphereLight, RectAreaLight, 성능 비용, Light Helpers
- **Sheem 메모**: 맵 분위기 연출 (낮/밤/날씨), 오디오 존별 조명 색감 차별화, 실내/실외 공간 표현에 직접 사용. 성능 비용 고려해 조명 수 최소화 필요

### 전체 내용

**조명이 필요한 머티리얼**
- MeshLambertMaterial, MeshPhongMaterial, MeshToonMaterial, MeshStandardMaterial
- MeshBasicMaterial은 조명 불필요

**AmbientLight** — 전방향 균일 조명 (빛 바운스 시뮬레이션용)
```javascript
const ambientLight = new THREE.AmbientLight(0xffffff, 1)
// 또는
const ambientLight = new THREE.AmbientLight()
ambientLight.color = new THREE.Color(0xffffff)
ambientLight.intensity = 1
scene.add(ambientLight)

gui.add(ambientLight, 'intensity').min(0).max(3).step(0.001)
```
- 모든 면을 동일하게 밝힘 → MeshBasicMaterial과 같은 효과
- 실제 빛 바운스는 Three.js 미지원 → dim AmbientLight로 간접광 흉내

**DirectionalLight** — 태양광 (평행 광선)
```javascript
const directionalLight = new THREE.DirectionalLight(0x00fffc, 0.9)
directionalLight.position.set(1, 0.25, 0)
scene.add(directionalLight)
```
- 광원 거리는 렌더에 영향 없음 (무한 평행 광선)
- 기본값: 위에서 아래 방향

**HemisphereLight** — 하늘/땅 양방향 조명
```javascript
const hemisphereLight = new THREE.HemisphereLight(
    0xff0000,  // sky color (위쪽 면)
    0x0000ff,  // ground color (아래쪽 면)
    0.9        // intensity
)
scene.add(hemisphereLight)
```

**PointLight** — 전구 (사방으로 균일 확산)
```javascript
const pointLight = new THREE.PointLight(
    0xff9000,  // color
    1.5,       // intensity
    0,         // distance (0 = 무한)
    2          // decay (기본 2, 물리 기반)
)
pointLight.position.set(1, -0.5, 1)
scene.add(pointLight)
```
- distance: 빛이 도달하는 최대 거리 (0 = 무한)
- decay: 거리에 따른 감쇠율 (물리 기반 = 2)

**RectAreaLight** — 직사각형 조명 (스튜디오 조명 효과)
```javascript
const rectAreaLight = new THREE.RectAreaLight(
    0x4e00ff,  // color
    6,         // intensity
    1,         // width
    1          // height
)
rectAreaLight.position.set(-1.5, 0, 1.5)
rectAreaLight.lookAt(new THREE.Vector3())  // 씬 중심 바라보기
scene.add(rectAreaLight)
```
- MeshStandardMaterial, MeshPhysicalMaterial에서만 작동

**SpotLight** — 손전등 (원뿔 형태)
```javascript
const spotLight = new THREE.SpotLight(
    0x78ff00,       // color
    4.5,            // intensity
    10,             // distance
    Math.PI * 0.1, // angle (빔 폭)
    0.25,           // penumbra (경계 부드러움)
    1               // decay
)
spotLight.position.set(0, 2, 3)
scene.add(spotLight)

// target 이동 시 반드시 scene에 추가
spotLight.target.position.x = -0.75
scene.add(spotLight.target)
```
- target은 Object3D → scene에 add해야 transform matrix 업데이트됨

**성능 비용**
```
낮은 비용:    AmbientLight, HemisphereLight
중간 비용:    DirectionalLight, PointLight
높은 비용:    SpotLight, RectAreaLight
```

**Baking (라이트 베이킹)**
- 조명을 텍스처에 굽는 기법 → 런타임 조명 불필요
- 장점: 뛰어난 성능
- 단점: 조명 이동 불가, 많은 텍스처 필요
- Portal 챕터에서 직접 실습

**Light Helpers** — 조명 위치/방향 디버깅
```javascript
const hemisphereLightHelper = new THREE.HemisphereLightHelper(hemisphereLight, 0.2)
scene.add(hemisphereLightHelper)

const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 0.2)
scene.add(directionalLightHelper)

const pointLightHelper = new THREE.PointLightHelper(pointLight, 0.2)
scene.add(pointLightHelper)

const spotLightHelper = new THREE.SpotLightHelper(spotLight)
scene.add(spotLightHelper)

// RectAreaLightHelper는 별도 import 필요
import { RectAreaLightHelper } from 'three/examples/jsm/helpers/RectAreaLightHelper.js'
const rectAreaLightHelper = new RectAreaLightHelper(rectAreaLight)
scene.add(rectAreaLightHelper)
```

---

## 15. Shadows

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: Shadow Map, castShadow/receiveShadow, 그림자 최적화, Baked Shadow
- **Sheem 메모**: 맵 지형의 그림자, 캐릭터 그림자, 건물/소품 그림자. 성능 민감한 웹앱이므로 baked shadow와 조합 필수

### 전체 내용

**그림자 작동 원리**
- Three.js가 그림자를 지원하는 각 조명마다 카메라 시점으로 추가 렌더링 수행
- 이 렌더 결과를 **Shadow Map** (텍스처)으로 저장
- Shadow Map 생성 시 모든 메시에 MeshDepthMaterial 임시 적용
- 최종 렌더 시 Shadow Map을 receiveShadow 오브젝트에 투영

**그림자 지원 조명**: PointLight, DirectionalLight, SpotLight (3가지만)

**기본 설정**
```javascript
// 1. 렌더러에서 shadow map 활성화
renderer.shadowMap.enabled = true

// 2. 오브젝트별 설정
sphere.castShadow = true      // 그림자를 드리움
plane.receiveShadow = true    // 그림자를 받음

// 3. 조명에서 그림자 활성화
directionalLight.castShadow = true
```

**Shadow Map 최적화**

해상도 (2의 거듭제곱 필수):
```javascript
directionalLight.shadow.mapSize.width = 1024
directionalLight.shadow.mapSize.height = 1024
```

Near/Far 조정 (CameraHelper로 확인):
```javascript
const directionalLightCameraHelper = new THREE.CameraHelper(directionalLight.shadow.camera)
scene.add(directionalLightCameraHelper)

directionalLight.shadow.camera.near = 1
directionalLight.shadow.camera.far = 6
```

Amplitude 조정 (DirectionalLight = OrthographicCamera):
```javascript
directionalLight.shadow.camera.top = 2
directionalLight.shadow.camera.right = 2
directionalLight.shadow.camera.bottom = -2
directionalLight.shadow.camera.left = -2
```

Blur:
```javascript
directionalLight.shadow.radius = 10  // PCFSoftShadowMap에서는 미작동
```

**Shadow Map 알고리즘**
```javascript
renderer.shadowMap.type = THREE.BasicShadowMap      // 고성능, 저품질
renderer.shadowMap.type = THREE.PCFShadowMap        // 기본값, 부드러운 엣지
renderer.shadowMap.type = THREE.PCFSoftShadowMap    // 더 부드러운 엣지 (radius 미지원)
renderer.shadowMap.type = THREE.VSMShadowMap        // 예외적 결과 가능
```

**SpotLight 그림자** (내부적으로 PerspectiveCamera 사용)
```javascript
const spotLight = new THREE.SpotLight(0xffffff, 3.6, 10, Math.PI * 0.3)
spotLight.castShadow = true
spotLight.shadow.mapSize.width = 1024
spotLight.shadow.mapSize.height = 1024
spotLight.shadow.camera.near = 1
spotLight.shadow.camera.far = 6
scene.add(spotLight)
scene.add(spotLight.target)
```

**PointLight 그림자** (6방향 큐브 Shadow Map → 성능 부담 큼)
```javascript
const pointLight = new THREE.PointLight(0xffffff, 2.7)
pointLight.castShadow = true
pointLight.shadow.mapSize.width = 1024
pointLight.shadow.mapSize.height = 1024
pointLight.shadow.camera.near = 0.1
pointLight.shadow.camera.far = 5
```
- 6방향 렌더링 → 가능한 적게 사용

**Baked Shadow** (정적 장면에 적합)
```javascript
renderer.shadowMap.enabled = false  // 실시간 그림자 비활성화

const bakedShadow = textureLoader.load('/textures/bakedShadow.jpg')
bakedShadow.colorSpace = THREE.SRGBColorSpace

const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5),
    new THREE.MeshBasicMaterial({ map: bakedShadow })
)
```
- 장점: 고품질, 고성능
- 단점: 정적 (오브젝트/조명 이동 불가)

**Dynamic Fake Shadow** (움직이는 오브젝트에 적합)
```javascript
const simpleShadow = textureLoader.load('/textures/simpleShadow.jpg')

const sphereShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        alphaMap: simpleShadow
    })
)
sphereShadow.rotation.x = -Math.PI * 0.5
sphereShadow.position.y = plane.position.y + 0.01
scene.add(sphereShadow)

// tick 함수에서 오브젝트 따라 이동 + 높이에 따라 opacity 변화
const tick = () => {
    sphere.position.x = Math.cos(elapsedTime) * 1.5
    sphere.position.z = Math.sin(elapsedTime) * 1.5
    sphere.position.y = Math.abs(Math.sin(elapsedTime * 3))

    sphereShadow.position.x = sphere.position.x
    sphereShadow.position.z = sphere.position.z
    sphereShadow.material.opacity = (1 - sphere.position.y) * 0.3
}
```

**선택 기준**
- 단순 정적 장면 → Baked Shadow
- 움직이는 오브젝트 → Dynamic Fake Shadow
- 복잡하고 동적인 장면 → 실시간 Shadow Map (최적화 필수)
- 조합 사용 가능

---

## 16. Haunted House

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: 프리미티브로 씬 구성, Poly Haven 텍스처 워크플로우, ARM 텍스처, Fog, Sky, 삼각함수 오브젝트 배치, Timer 클래스
- **Sheem 메모**: Sheem 맵 제작의 직접적인 레퍼런스. 지형 텍스처 워크플로우, 오브젝트 원형 배치(sin/cos), 안개 효과, 하늘 구현이 모두 Sheem 맵에 적용 가능

### 전체 내용

**Timer 클래스** (Clock 개선 버전)
```javascript
import { Timer } from 'three/addons/misc/Timer.js'
const timer = new Timer()

const tick = () => {
    timer.update()
    const elapsedTime = timer.getElapsed()
    // ...
}
```
- Clock과 달리 탭 비활성 시 큰 시간값 방지
- 매 프레임 `timer.update()` 호출 필요

**단위 설정**
- 1 Three.js unit = 1 meter (권장)
- 건물, 캐릭터 등 실제 스케일에 맞게 설계

**씬 구성 (Group 활용)**
```javascript
// 바닥
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial()
)
floor.rotation.x = -Math.PI * 0.5
scene.add(floor)

// 집 그룹 (이동/스케일 편의)
const house = new THREE.Group()
scene.add(house)

// 벽 (BoxGeometry)
const walls = new THREE.Mesh(
    new THREE.BoxGeometry(4, 2.5, 4),
    new THREE.MeshStandardMaterial()
)
walls.position.y = 1.25  // 높이의 절반 (중심이 원점)
house.add(walls)

// 지붕 (ConeGeometry 4면 = 피라미드)
const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3.5, 1.5, 4),
    new THREE.MeshStandardMaterial()
)
roof.position.y = 2.5 + 0.75  // 벽 높이 + 지붕 높이의 절반
roof.rotation.y = Math.PI * 0.25
house.add(roof)

// 문 (PlaneGeometry)
const door = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.2, 100, 100),  // 세그먼트: displacement용
    new THREE.MeshStandardMaterial()
)
door.position.y = 1
door.position.z = 2 + 0.01  // z-fighting 방지: 벽보다 살짝 앞
house.add(door)
```

**Z-fighting 해결**
```javascript
// 두 면이 같은 위치에 있을 때 GPU가 어느 면이 앞인지 모르는 문제
door.position.z = 2 + 0.01  // 0.01만 앞으로 이동
```

**같은 Geometry/Material 재사용 (성능 최적화)**
```javascript
const bushGeometry = new THREE.SphereGeometry(1, 16, 16)
const bushMaterial = new THREE.MeshStandardMaterial()

const bush1 = new THREE.Mesh(bushGeometry, bushMaterial)
bush1.scale.set(0.5, 0.5, 0.5)
bush1.position.set(0.8, 0.2, 2.2)
bush1.rotation.x = -0.75  // 텍스처 a-hole 숨기기

// 여러 오브젝트 한 번에 추가
house.add(bush1, bush2, bush3, bush4)
```

**삼각함수로 원형 배치** (묘비, NPC, 소품 등)
```javascript
const graves = new THREE.Group()
scene.add(graves)

for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2     // 0 ~ 2π (전체 원)
    const radius = 3 + Math.random() * 4          // 3~7 사이 랜덤 반지름

    const x = Math.sin(angle) * radius
    const z = Math.cos(angle) * radius

    const grave = new THREE.Mesh(graveGeometry, graveMaterial)
    grave.position.x = x
    grave.position.y = Math.random() * 0.4        // 살짝 땅 위
    grave.position.z = z
    grave.rotation.x = (Math.random() - 0.5) * 0.4  // 기울기
    grave.rotation.y = (Math.random() - 0.5) * 0.4
    grave.rotation.z = (Math.random() - 0.5) * 0.4

    graves.add(grave)
}
```

**Poly Haven 텍스처 워크플로우**
1. polyhaven.com → Textures 섹션
2. 해상도: 1K (웹 적합), 포맷: JPG, 형식: ZIP
3. 다운로드 항목: Diffuse, AO/Rough/Metal (ARM), Normal (GL버전), Displacement
4. `/static/` 폴더에 정리

**ARM 텍스처** (AO + Roughness + Metalness 통합)
```javascript
// 하나의 텍스처를 세 가지 map에 동시 사용 → 텍스처 수 절약
material.aoMap = floorARMTexture
material.roughnessMap = floorARMTexture
material.metalnessMap = floorARMTexture
```

**텍스처 적용 패턴 (PBR 전체)**
```javascript
const textureLoader = new THREE.TextureLoader()

// Color 텍스처는 반드시 colorSpace 설정
const floorColorTexture = textureLoader.load('./floor/color.jpg')
floorColorTexture.colorSpace = THREE.SRGBColorSpace

// 반복 설정
floorColorTexture.repeat.set(8, 8)
floorColorTexture.wrapS = THREE.RepeatWrapping
floorColorTexture.wrapT = THREE.RepeatWrapping

// MeshStandardMaterial 전체 적용
new THREE.MeshStandardMaterial({
    map: floorColorTexture,
    aoMap: floorARMTexture,
    roughnessMap: floorARMTexture,
    metalnessMap: floorARMTexture,
    normalMap: floorNormalTexture,
    displacementMap: floorDisplacementTexture,
    displacementScale: 0.3,
    displacementBias: -0.2,
    alphaMap: floorAlphaTexture,
    transparent: true
})
```

**displacementBias 튜닝 (Debug UI 활용)**
```javascript
// 개발 중 실시간 조정
gui.add(floor.material, 'displacementScale').min(0).max(1).step(0.001)
gui.add(floor.material, 'displacementBias').min(-1).max(1).step(0.001)
// 값 확정 후 코드에 하드코딩
```

**color로 텍스처 색감 보정**
```javascript
const bushMaterial = new THREE.MeshStandardMaterial({
    color: '#ccffcc',  // 녹색 틴트
    map: bushColorTexture,
    // ...
})
```

**Ghost (PointLight 활용 애니메이션)**
```javascript
const ghost1 = new THREE.PointLight('#8800ff', 6)
scene.add(ghost1)

// tick 함수
const ghost1Angle = elapsedTime * 0.5
ghost1.position.x = Math.cos(ghost1Angle) * 4
ghost1.position.z = Math.sin(ghost1Angle) * 4
// 여러 sine 조합으로 불규칙한 y 움직임
ghost1.position.y = Math.sin(ghost1Angle) * Math.sin(ghost1Angle * 2.34) * Math.sin(ghost1Angle * 3.45)
```

**Shadow 설정 (씬 전체 일괄 관리)**
```javascript
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

// 조명 castShadow
directionalLight.castShadow = true
ghost1.castShadow = true

// 오브젝트
walls.castShadow = true
walls.receiveShadow = true
floor.receiveShadow = true

// Group children 일괄 처리
for (const grave of graves.children) {
    grave.castShadow = true
    grave.receiveShadow = true
}

// Shadow map 최적화
directionalLight.shadow.mapSize.width = 256
directionalLight.shadow.mapSize.height = 256
directionalLight.shadow.camera.top = 8
directionalLight.shadow.camera.right = 8
directionalLight.shadow.camera.bottom = -8
directionalLight.shadow.camera.left = -8
directionalLight.shadow.camera.near = 1
directionalLight.shadow.camera.far = 20

ghost1.shadow.mapSize.width = 256
ghost1.shadow.mapSize.height = 256
ghost1.shadow.camera.far = 10
```

**Sky 클래스**
```javascript
import { Sky } from 'three/addons/objects/Sky.js'

const sky = new Sky()
sky.scale.set(100, 100, 100)  // 너무 작으면 작은 큐브처럼 보임
scene.add(sky)

// 셰이더 uniform 업데이트 (Shaders 챕터에서 자세히 다룸)
sky.material.uniforms['turbidity'].value = 10
sky.material.uniforms['rayleigh'].value = 3
sky.material.uniforms['mieCoefficient'].value = 0.1
sky.material.uniforms['mieDirectionalG'].value = 0.95
sky.material.uniforms['sunPosition'].value.set(0.3, -0.038, -0.95)
```

**Fog**
```javascript
// Fog: near/far 직접 제어
scene.fog = new THREE.Fog('#262837', 1, 13)
// 파라미터: color, near, far

// FogExp2: 거리 기반 지수 밀도 (더 현실적)
scene.fog = new THREE.FogExp2('#262837', 0.1)
// 파라미터: color, density

// 색상은 하늘 하단부 색상과 맞추면 자연스러움
```

---

## 17. Particles

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: PointsMaterial, Points, 커스텀 파티클 지오메트리, alphaMap, depthWrite, AdditiveBlending, vertexColors, 파티클 애니메이션
- **Sheem 메모**: 비, 눈, 안개 파티클, 오디오 존 시각화 효과, 분위기 연출에 활용 가능. AdditiveBlending으로 빛나는 효과 구현

### 전체 내용

**파티클 기본 구조**
- BufferGeometry + PointsMaterial + Points (Mesh 대신)
- 각 꼭짓점 = 하나의 파티클 (항상 카메라를 향하는 평면)
- 수십만 개도 합리적인 프레임레이트 유지 가능

**기본 파티클 생성**
```javascript
// 내장 지오메트리 사용
const particlesGeometry = new THREE.SphereGeometry(1, 32, 32)

const particlesMaterial = new THREE.PointsMaterial({
    size: 0.02,
    sizeAttenuation: true  // 거리에 따른 크기 변화
})

const particles = new THREE.Points(particlesGeometry, particlesMaterial)
scene.add(particles)
```

**커스텀 파티클 지오메트리**
```javascript
const particlesGeometry = new THREE.BufferGeometry()
const count = 5000

const positions = new Float32Array(count * 3)
for (let i = 0; i < count * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 10
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

const particlesMaterial = new THREE.PointsMaterial({
    size: 0.1,
    sizeAttenuation: true
})
```

**텍스처 및 투명도 처리**
```javascript
const textureLoader = new THREE.TextureLoader()
const particleTexture = textureLoader.load('/textures/particles/2.png')

particlesMaterial.transparent = true
particlesMaterial.alphaMap = particleTexture

// 파티클 겹침 문제 해결 방법들 (상황에 맞게 선택)

// 방법 1: alphaTest (픽셀 알파가 이 값 이하면 렌더 안 함)
particlesMaterial.alphaTest = 0.001

// 방법 2: depthTest 비활성화 (다른 오브젝트와 함께 있을 때 버그 발생 가능)
particlesMaterial.depthTest = false

// 방법 3: depthWrite 비활성화 (권장)
particlesMaterial.depthWrite = false
```

**AdditiveBlending** (빛나는 효과)
```javascript
particlesMaterial.depthWrite = false
particlesMaterial.blending = THREE.AdditiveBlending
// 픽셀 색상을 더해서 합산 → 겹칠수록 밝아짐
// 성능 부담 있음, 파티클 수 줄여야 할 수 있음
```

**vertexColors** (파티클별 개별 색상)
```javascript
const positions = new Float32Array(count * 3)
const colors = new Float32Array(count * 3)

for (let i = 0; i < count * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 10
    colors[i] = Math.random()  // r, g, b 각각 0~1 랜덤
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

particlesMaterial.vertexColors = true
// particlesMaterial.color는 vertexColors에 곱해짐 (틴트 효과)
```

**파티클 애니메이션**

방법 1: Points 전체 회전 (단순, 효율적)
```javascript
const tick = () => {
    particles.rotation.y = elapsedTime * 0.2
}
```

방법 2: 개별 꼭짓점 업데이트 (유연하지만 성능 부담)
```javascript
const tick = () => {
    for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const x = particlesGeometry.attributes.position.array[i3]
        // 파티클마다 x 위치 기반으로 다른 위상의 파도 움직임
        particlesGeometry.attributes.position.array[i3 + 1] = Math.sin(elapsedTime + x)
    }
    particlesGeometry.attributes.position.needsUpdate = true  // 필수!
}
```
> ⚠️ 수백만 파티클에는 부적합 → 커스텀 셰이더 필요 (Shaders 챕터)

---

## 18. Galaxy Generator

- **Sheem 관련도**: 🟡 참고
- **핵심 개념**: 절차적 파티클 배치, 브랜치/스핀/랜덤네스, Color lerp, dispose() 메모리 관리, 파라미터 기반 생성
- **Sheem 메모**: 절차적 오브젝트 생성 패턴, dispose()를 통한 메모리 관리, Color.lerp()를 이용한 그라데이션 색상이 Sheem의 파티클 이펙트나 존 시각화에 응용 가능

### 전체 내용

**파라미터 기반 생성 패턴**
```javascript
const parameters = {
    count: 100000,
    size: 0.01,
    radius: 5,
    branches: 3,
    spin: 1,
    randomness: 0.2,
    randomnessPower: 3,
    insideColor: '#ff6030',
    outsideColor: '#1b3984'
}

// 변수를 바깥에 선언 (dispose를 위해)
let geometry = null
let material = null
let points = null

const generateGalaxy = () => {
    // 이전 갤럭시 제거 (메모리 누수 방지)
    if (points !== null) {
        geometry.dispose()
        material.dispose()
        scene.remove(points)
    }

    // 새 갤럭시 생성
    geometry = new THREE.BufferGeometry()
    // ...
    points = new THREE.Points(geometry, material)
    scene.add(points)
}

generateGalaxy()
```

**갤럭시 형태 생성 (수학)**
```javascript
const positions = new Float32Array(parameters.count * 3)
const colors = new Float32Array(parameters.count * 3)

const colorInside = new THREE.Color(parameters.insideColor)
const colorOutside = new THREE.Color(parameters.outsideColor)

for (let i = 0; i < parameters.count; i++) {
    const i3 = i * 3

    // 반지름 (중심~가장자리)
    const radius = Math.random() * parameters.radius

    // 스핀 (멀수록 더 많이 회전)
    const spinAngle = radius * parameters.spin

    // 브랜치 각도 (등간격으로 배치)
    const branchAngle = (i % parameters.branches) / parameters.branches * Math.PI * 2

    // 랜덤 분산 (Math.pow로 중심부 밀집 효과)
    const randomX = Math.pow(Math.random(), parameters.randomnessPower)
        * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius
    const randomY = Math.pow(Math.random(), parameters.randomnessPower)
        * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius
    const randomZ = Math.pow(Math.random(), parameters.randomnessPower)
        * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius

    positions[i3]     = Math.cos(branchAngle + spinAngle) * radius + randomX
    positions[i3 + 1] = randomY
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ

    // 색상 (중심~가장자리 그라데이션)
    const mixedColor = colorInside.clone()
    mixedColor.lerp(colorOutside, radius / parameters.radius)  // 0~1 보간
    colors[i3]     = mixedColor.r
    colors[i3 + 1] = mixedColor.g
    colors[i3 + 2] = mixedColor.b
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
```

**Material 설정**
```javascript
material = new THREE.PointsMaterial({
    size: parameters.size,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true
})
```

**lil-gui와 onFinishChange 연결**
```javascript
// 파라미터 변경 완료 시 새 갤럭시 생성
gui.add(parameters, 'count').min(100).max(1000000).step(100).onFinishChange(generateGalaxy)
gui.add(parameters, 'radius').min(0.01).max(20).step(0.01).onFinishChange(generateGalaxy)
gui.add(parameters, 'branches').min(2).max(20).step(1).onFinishChange(generateGalaxy)
gui.add(parameters, 'spin').min(-5).max(5).step(0.001).onFinishChange(generateGalaxy)
gui.add(parameters, 'randomness').min(0).max(2).step(0.001).onFinishChange(generateGalaxy)
gui.add(parameters, 'randomnessPower').min(1).max(10).step(0.001).onFinishChange(generateGalaxy)
gui.addColor(parameters, 'insideColor').onFinishChange(generateGalaxy)
gui.addColor(parameters, 'outsideColor').onFinishChange(generateGalaxy)
```

**핵심 패턴 요약**
- `dispose()` — geometry, material 제거로 GPU 메모리 누수 방지
- `scene.remove()` — 씬에서 오브젝트 제거
- `Color.lerp()` — 두 색상 사이 보간 (0=시작색, 1=끝색)
- `Math.pow(Math.random(), power)` — 값을 0에 가깝게 압축 (중심 밀집 효과)

---

## 19. Scroll Based Animation

- **Sheem 관련도**: 🟡 참고
- **핵심 개념**: 스크롤 기반 카메라, 시차(Parallax) 효과, Easing(lerp), 섹션 전환 감지, GSAP 트리거 애니메이션
- **Sheem 메모**: Sheem의 메인 UI/온보딩 페이지에 적용 가능. Parallax 효과와 Easing 공식은 캐릭터 카메라 추적에도 응용 가능

### 전체 내용

**기본 셋업**
```javascript
// 배경 투명 처리
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true  // clearColor 투명화
})
// CSS에서 배경색 설정
// html { background: #1e1a20; }

// scroll 비활성화 CSS 제거
// html, body { overflow: hidden; } ← 이 줄 삭제
```

**스크롤 기반 카메라 이동**
```javascript
let scrollY = window.scrollY

window.addEventListener('scroll', () => {
    scrollY = window.scrollY
})

// tick 함수
const tick = () => {
    // 스크롤 1섹션 = 카메라 objectsDistance 이동
    camera.position.y = -scrollY / sizes.height * objectsDistance
}
```

**오브젝트 수직 배치**
```javascript
const objectsDistance = 4  // 섹션 간 거리

mesh1.position.y = -objectsDistance * 0
mesh2.position.y = -objectsDistance * 1
mesh3.position.y = -objectsDistance * 2

// 수평 배치
mesh1.position.x = 2
mesh2.position.x = -2
mesh3.position.x = 2
```

**Parallax 효과 (마우스 기반)**
```javascript
const cursor = { x: 0, y: 0 }

window.addEventListener('mousemove', (event) => {
    cursor.x = event.clientX / sizes.width - 0.5   // -0.5 ~ 0.5
    cursor.y = event.clientY / sizes.height - 0.5
})

// 카메라를 Group에 넣어 스크롤과 parallax 분리
const cameraGroup = new THREE.Group()
scene.add(cameraGroup)
cameraGroup.add(camera)

// tick 함수
const tick = () => {
    camera.position.y = -scrollY / sizes.height * objectsDistance  // 카메라 직접

    const parallaxX = cursor.x * 0.5
    const parallaxY = -cursor.y * 0.5  // Y축 반전
    cameraGroup.position.x = parallaxX  // 그룹에 적용
    cameraGroup.position.y = parallaxY
}
```

**Easing (Lerp, 부드러운 이동)**
```javascript
// deltaTime으로 프레임레이트 독립적 easing
const clock = new THREE.Clock()
let previousTime = 0

const tick = () => {
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - previousTime
    previousTime = elapsedTime

    // 현재 위치에서 목표까지 매 프레임 5 * deltaTime 비율로 이동
    cameraGroup.position.x += (parallaxX - cameraGroup.position.x) * 5 * deltaTime
    cameraGroup.position.y += (parallaxY - cameraGroup.position.y) * 5 * deltaTime
}
```
> Easing 공식: `현재값 += (목표값 - 현재값) * 계수 * deltaTime`
> - 계수가 클수록 빠르게 목표에 도달
> - deltaTime으로 프레임레이트 독립적 처리

**영구 회전 + GSAP 트리거 애니메이션 조합**
```javascript
const sectionMeshes = [mesh1, mesh2, mesh3]
let currentSection = 0

window.addEventListener('scroll', () => {
    scrollY = window.scrollY
    const newSection = Math.round(scrollY / sizes.height)

    if (newSection !== currentSection) {
        currentSection = newSection

        // 섹션 진입 시 스핀 애니메이션
        gsap.to(sectionMeshes[currentSection].rotation, {
            duration: 1.5,
            ease: 'power2.inOut',
            x: '+=6',
            y: '+=3',
            z: '+=1.5'
        })
    }
})

// tick: deltaTime 기반 영구 회전 (GSAP와 충돌 방지)
const tick = () => {
    for (const mesh of sectionMeshes) {
        mesh.rotation.x += deltaTime * 0.1  // = 대신 += 사용
        mesh.rotation.y += deltaTime * 0.12
    }
}
```
> GSAP는 `+=` 상대값으로 현재 회전에 추가 → 영구 회전과 자연스럽게 조합

**MeshToonMaterial + 그라데이션 텍스처**
```javascript
const gradientTexture = textureLoader.load('textures/gradients/3.jpg')
gradientTexture.magFilter = THREE.NearestFilter  // 보간 방지 → 툰 효과

const material = new THREE.MeshToonMaterial({
    color: parameters.materialColor,
    gradientMap: gradientTexture
})

// 색상 변경 시 material 업데이트
gui.addColor(parameters, 'materialColor').onChange(() => {
    material.color.set(parameters.materialColor)
    particlesMaterial.color.set(parameters.materialColor)
})
```

**파티클 Y축 범위 계산**
```javascript
for (let i = 0; i < particlesCount; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 10
    // 전체 스크롤 범위 커버
    positions[i * 3 + 1] = objectsDistance * 0.5 - Math.random() * objectsDistance * sectionMeshes.length
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10
}
```
