# Three.js Journey — Chapter 03: Advanced Techniques

---

## 20. Physics

- **Sheem 관련도**: 🟡 참고
- **핵심 개념**: Cannon.js, World, Body, Shape, ContactMaterial, applyForce, Broadphase, Sleep, 충돌 이벤트, 오브젝트 풀 패턴
- **Sheem 메모**: 캐릭터 이동 시 충돌 감지, 물리 기반 상호작용에 응용 가능. 현재 Sheem MVP에는 불필요하지만 나중에 인터랙티브 오브젝트 추가 시 참고

### 전체 내용

**물리 엔진 개념**
- 보이지 않는 물리 세계를 Three.js 씬과 병렬로 운영
- 매 프레임 물리 세계 업데이트 → 물리 오브젝트 좌표를 Three.js 메시에 복사
- Three.js: 렌더링 담당 / Cannon.js: 물리 계산 담당

**라이브러리 선택**
- **3D**: Ammo.js (가장 인기), **Cannon.js** (학습에 적합), Oimo.js, **Rapier** (현재 유지보수)
- **2D**: Matter.js, P2.js, Planck.js, Box2D.js
- 2D로 표현 가능한 물리는 2D 라이브러리가 훨씬 성능 좋음

**설치**
```bash
npm install cannon
# 또는 유지보수 버전
npm install cannon-es
```
```javascript
import CANNON from 'cannon'
// 또는
import * as CANNON from 'cannon-es'
```

**기본 설정**
```javascript
// 물리 세계 생성
const world = new CANNON.World()
world.gravity.set(0, -9.82, 0)  // 지구 중력

// 구체 Body 생성
const sphereShape = new CANNON.Sphere(0.5)
const sphereBody = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(0, 3, 0),
    shape: sphereShape
})
world.addBody(sphereBody)

// 바닥 Body (mass=0 → 정적)
const floorShape = new CANNON.Plane()
const floorBody = new CANNON.Body()
floorBody.mass = 0
floorBody.addShape(floorShape)
// 회전 (Cannon.js는 Quaternion 사용)
floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5)
world.addBody(floorBody)
```

**tick 함수에서 업데이트**
```javascript
const clock = new THREE.Clock()
let oldElapsedTime = 0

const tick = () => {
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - oldElapsedTime
    oldElapsedTime = elapsedTime

    // 물리 세계 업데이트 (고정 타임스텝, deltaTime, 반복 횟수)
    world.step(1 / 60, deltaTime, 3)

    // Three.js 메시에 물리 좌표 복사
    sphere.position.copy(sphereBody.position)
    sphere.quaternion.copy(sphereBody.quaternion)  // 박스 등 회전 필요 시
}
```

**ContactMaterial (물리적 재질)**
```javascript
const defaultMaterial = new CANNON.Material('default')
const defaultContactMaterial = new CANNON.ContactMaterial(
    defaultMaterial,
    defaultMaterial,
    {
        friction: 0.1,      // 마찰
        restitution: 0.7    // 반발력 (탄성)
    }
)
world.addContactMaterial(defaultContactMaterial)
world.defaultContactMaterial = defaultContactMaterial  // 기본 재질로 설정
```

**힘 적용**
```javascript
// 시작 시 한 번 적용
sphereBody.applyLocalForce(new CANNON.Vec3(150, 0, 0), new CANNON.Vec3(0, 0, 0))

// 매 프레임 바람 효과
const tick = () => {
    sphereBody.applyForce(new CANNON.Vec3(-0.5, 0, 0), sphereBody.position)
    world.step(1 / 60, deltaTime, 3)
}
```

**여러 오브젝트 관리 패턴**
```javascript
const objectsToUpdate = []

// 공통 지오메트리/머티리얼 (최적화)
const sphereGeometry = new THREE.SphereGeometry(1, 20, 20)
const sphereMaterial = new THREE.MeshStandardMaterial({ metalness: 0.3, roughness: 0.4 })

const createSphere = (radius, position) => {
    // Three.js
    const mesh = new THREE.Mesh(sphereGeometry, sphereMaterial)
    mesh.castShadow = true
    mesh.scale.set(radius, radius, radius)
    mesh.position.copy(position)
    scene.add(mesh)

    // Cannon.js
    const shape = new CANNON.Sphere(radius)
    const body = new CANNON.Body({ mass: 1, shape })
    body.position.copy(position)
    body.addEventListener('collide', playHitSound)
    world.addBody(body)

    objectsToUpdate.push({ mesh, body })
}

// Box 생성 (halfExtents 주의)
const createBox = (width, height, depth, position) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), boxMaterial)
    mesh.scale.set(width, height, depth)
    // ...
    const shape = new CANNON.Box(new CANNON.Vec3(width * 0.5, height * 0.5, depth * 0.5))
    // ...
}

// tick에서 일괄 업데이트
for (const object of objectsToUpdate) {
    object.mesh.position.copy(object.body.position)
    object.mesh.quaternion.copy(object.body.quaternion)
}
```

**충돌 사운드**
```javascript
const hitSound = new Audio('/sounds/hit.mp3')

const playHitSound = (collision) => {
    const impactStrength = collision.contact.getImpactVelocityAlongNormal()
    if (impactStrength > 1.5) {
        hitSound.volume = Math.random()
        hitSound.currentTime = 0
        hitSound.play()
    }
}
body.addEventListener('collide', playHitSound)
```

**성능 최적화**
```javascript
// Broadphase (충돌 감지 알고리즘)
world.broadphase = new CANNON.SAPBroadphase(world)  // NaiveBroadphase보다 효율적

// Sleep (정지 오브젝트 연산 제외)
world.allowSleep = true
```

**오브젝트 제거**
```javascript
const reset = () => {
    for (const object of objectsToUpdate) {
        object.body.removeEventListener('collide', playHitSound)
        world.removeBody(object.body)
        scene.remove(object.mesh)
    }
    objectsToUpdate.splice(0, objectsToUpdate.length)
}
```

---

## 21. Imported Models

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: GLTF 포맷, GLTFLoader, DRACOLoader, AnimationMixer, Three.js Editor
- **Sheem 메모**: 캐릭터 에셋 임포트의 핵심. AnimationMixer로 걷기/달리기 등 애니메이션 전환 구현. Draco 압축으로 파일 크기 최적화

### 전체 내용

**GLTF 포맷 종류**
```
glTF          → .gltf (JSON) + .bin (바이너리) + 텍스처 파일 (편집 용이)
glTF-Binary   → .glb (모든 데이터 단일 파일, 가볍고 로드 빠름)
glTF-Draco    → Draco 압축 적용 (가장 가벼움, 디코더 필요)
glTF-Embedded → .gltf (JSON에 모든 데이터 포함, 편집 가능 단일 파일)
```

**선택 기준**
- 텍스처/좌표 편집 필요 → glTF default
- 단일 파일, 수정 불필요 → glTF-Binary (.glb)
- 용량 최적화 필요 → Draco 압축

**기본 로드**
```javascript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const gltfLoader = new GLTFLoader()

gltfLoader.load(
    '/models/Duck/glTF/Duck.gltf',
    (gltf) => {
        // 방법 1: 씬 전체 추가 (권장)
        scene.add(gltf.scene)

        // 방법 2: 첫 번째 자식만
        scene.add(gltf.scene.children[0])

        // 방법 3: 모든 자식 이동 (자식 배열 변화 주의)
        while (gltf.scene.children.length) {
            scene.add(gltf.scene.children[0])
        }

        // 방법 4: 배열 복사 후 추가
        const children = [...gltf.scene.children]
        for (const child of children) scene.add(child)
    }
)
```

**Draco 압축 모델 로드**
```javascript
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

// /node_modules/three/examples/jsm/libs/draco/ → /static/draco/ 복사
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/')

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)

gltfLoader.load('/models/Duck/glTF-Draco/Duck.gltf', (gltf) => {
    scene.add(gltf.scene)
})
```

> **Draco 사용 판단**: 모델 여러 개 + 큰 용량 → Draco 사용. 단순 모델 하나 → 오버헤드로 불필요

**AnimationMixer (애니메이션)**
```javascript
let mixer = null  // 로드 전 null

gltfLoader.load('/models/Fox/glTF/Fox.gltf', (gltf) => {
    gltf.scene.scale.set(0.025, 0.025, 0.025)
    scene.add(gltf.scene)

    // AnimationMixer 생성
    mixer = new THREE.AnimationMixer(gltf.scene)

    // 애니메이션 클립 추가 및 재생
    const action = mixer.clipAction(gltf.animations[0])
    action.play()
})

// tick 함수에서 업데이트
const tick = () => {
    const deltaTime = elapsedTime - oldElapsedTime

    if (mixer) {
        mixer.update(deltaTime)
    }
}
```

**LoadingManager 활용**
```javascript
const loadingManager = new THREE.LoadingManager(
    () => { console.log('모두 로드 완료') },
    () => { console.log('로딩 중') },
    () => { console.log('오류') }
)
const gltfLoader = new GLTFLoader(loadingManager)
```

---

## 22. Raycaster and Mouse Events

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: Raycaster, intersectObject/intersectObjects, 마우스 좌표 변환, hover/click 이벤트 구현
- **Sheem 메모**: 캐릭터 클릭, 오디오 존 클릭으로 직접 이동, UI 오브젝트 상호작용에 직접 사용

### 전체 내용

**Raycaster 기본**
```javascript
const raycaster = new THREE.Raycaster()

// 방향 직접 설정
const rayOrigin = new THREE.Vector3(-3, 0, 0)
const rayDirection = new THREE.Vector3(1, 0, 0)
rayDirection.normalize()  // 길이 1로 정규화 (필수)
raycaster.set(rayOrigin, rayDirection)

// 단일 오브젝트 테스트
const intersect = raycaster.intersectObject(object2)

// 여러 오브젝트 테스트
const intersects = raycaster.intersectObjects([object1, object2, object3])
```

**교차 결과 정보**
```javascript
intersects[0].distance  // 원점~충돌 지점 거리
intersects[0].face      // 충돌한 면
intersects[0].faceIndex // 면 인덱스
intersects[0].object    // 충돌한 오브젝트
intersects[0].point     // 충돌 지점 Vector3
intersects[0].uv        // UV 좌표
```
> 결과는 항상 배열 (하나의 메시도 여러 번 교차 가능, 예: 도넛)

**매 프레임 레이캐스트 (움직이는 오브젝트)**
```javascript
const tick = () => {
    // 모든 오브젝트 빨간색으로 리셋
    for (const object of objectsToTest) {
        object.material.color.set('#ff0000')
    }

    // 교차 오브젝트 파란색으로
    const intersects = raycaster.intersectObjects(objectsToTest)
    for (const intersect of intersects) {
        intersect.object.material.color.set('#0000ff')
    }
}
```

**마우스 기반 레이캐스트**
```javascript
// 마우스 좌표 정규화 (-1 ~ +1)
const mouse = new THREE.Vector2()
window.addEventListener('mousemove', (event) => {
    mouse.x = event.clientX / sizes.width * 2 - 1
    mouse.y = -(event.clientY / sizes.height) * 2 + 1
    // 좌상단: (-1, 1), 우하단: (1, -1), 중앙: (0, 0)
})

// tick 함수에서 카메라 방향으로 레이 설정
const tick = () => {
    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObjects(objectsToTest)
    // ...
}
```

**mouseenter / mouseleave 구현**
```javascript
let currentIntersect = null

const tick = () => {
    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObjects(objectsToTest)

    if (intersects.length) {
        if (!currentIntersect) {
            console.log('mouse enter')  // 진입
        }
        currentIntersect = intersects[0]
    } else {
        if (currentIntersect) {
            console.log('mouse leave')  // 이탈
        }
        currentIntersect = null
    }
}
```

**click 이벤트**
```javascript
window.addEventListener('click', () => {
    if (currentIntersect) {
        switch (currentIntersect.object) {
            case object1: console.log('click on object 1'); break
            case object2: console.log('click on object 2'); break
        }
    }
})
```

**임포트된 모델에 적용**
```javascript
let model = null
gltfLoader.load('./models/Duck/glTF-Binary/Duck.glb', (gltf) => {
    model = gltf.scene
    scene.add(model)
})

const tick = () => {
    raycaster.setFromCamera(mouse, camera)

    if (model) {
        // intersectObject (단수): 자식 재귀 검사 기본값 true
        const modelIntersects = raycaster.intersectObject(model)

        if (modelIntersects.length) {
            model.scale.set(1.2, 1.2, 1.2)
        } else {
            model.scale.set(1, 1, 1)
        }
    }
}
```
> 모델 로드 전 null 처리 필수. `intersectObject`는 Group도 받아 재귀적으로 자식 Mesh 테스트

---

## 23. Custom Models with Blender

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: Blender 인터페이스, 단축키, Edit Mode, 모디파이어, UV, GLTF 익스포트
- **Sheem 메모**: Sheem 소품 제작의 핵심. 텐트, 벤치 등 단순 소품부터 시작. 단위 스케일 설정, Apply Modifiers, +Y Up 익스포트 설정이 Three.js 연동에 중요

### 전체 내용

**Blender 기본 단축키 (3D Viewport 위에서)**

뷰 조작:
```
MIDDLE MOUSE 드래그    → 궤도 회전 (Orbit)
SHIFT + MIDDLE MOUSE   → 팬 이동 (Truck/Pedestal)
WHEEL                  → 줌 (Dolly)
NUMPAD 5               → 원근/직교 전환
NUMPAD 1/3/7           → X/Y/Z 축 뷰
NUMPAD 0               → 카메라 뷰
SHIFT + C              → 씬 전체로 뷰 리셋
```

오브젝트 조작:
```
A                      → 전체 선택/해제
X                      → 삭제
SHIFT + A              → 오브젝트 추가
G / R / S              → 이동 / 회전 / 스케일
G + X/Y/Z              → 특정 축으로 이동
SHIFT + D              → 복제
H / ALT+H              → 숨기기 / 표시
TAB                    → Edit Mode 토글
CTRL + R               → Loop Cut
O (알파벳)             → Proportional Editing
```

**단위 설정 (Three.js 연동)**
```
Scene Properties → Units → Unit System: None 또는 Metric
1 unit = 1 meter 권장
```

**모디파이어 (비파괴적 수정)**
- **Subdivision Surface**: 지오메트리를 세분화하며 부드럽게
- **Solidify**: 두께 추가 (치즈, 천 등)
- 익스포트 시 Apply Modifiers 체크 → 모디파이어 적용된 형태로 익스포트

**Shade Smooth vs Auto Smooth**
```
오브젝트 우클릭 → Shade Smooth (전체 부드럽게)
Blender 4.0+: 우클릭 → Shade Auto Smooth (날카로운 엣지는 유지)
Blender 3.x: Object Data Properties → Normals → Auto Smooth
```

**UV 언래핑**
- 익스포트 시 UVs 체크 → 나중에 텍스처 적용 가능
- Blender에서 Auto Unwrap 기능 사용 가능
- 복잡한 모델은 Blender에서 수동 UV 설정

**GLTF 익스포트 설정**
```
File → Export → glTF 2.0 (.glb/.gltf)

Format: glTF Binary (.glb) → 텍스처 없을 때 단일 파일로 가장 가벼움

중요 설정:
- Transform → +Y Up: ✅ (Three.js 좌표계 맞춤)
- Geometry → Apply Modifiers: ✅ (모디파이어 적용)
- Geometry → Normals: ✅ (조명 작동에 필수)
- Geometry → UVs: 텍스처 사용 시 ✅
- Geometry → Materials: ✅

불필요:
- Cameras: ☐
- Punctual Lights: ☐ (Three.js에서 직접 설정)
- Animation: ☐ (애니메이션 없을 때)
```

**Three.js에서 로드**
```javascript
gltfLoader.load('/models/hamburger.glb', (gltf) => {
    scene.add(gltf.scene)
})
```

**Blender 기본 학습 리소스**
- Blender 공식 유튜브: BlenderFoundation
- Blender Guru 유튜브: 도넛 튜토리얼로 유명
- CGFastTrack, Grant Abbitt 유튜브

---

## 24. Environment Map

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: CubeTexture, HDRI, RGBELoader, EXRLoader, GroundedSkybox, Real-time EnvMap, Layers
- **Sheem 메모**: Sheem 맵의 하늘과 분위기 조명의 핵심. HDR 환경맵으로 사실적인 조명 구현. Blender로 맞춤형 환경맵 제작 가능

### 전체 내용

**환경맵의 역할**
- 씬 배경 (background)
- 오브젝트 반사/굴절
- 전체 씬 조명 (environment) → 매우 사실적인 결과

**방법 1: Cube Texture (LDR)**
```javascript
const cubeTextureLoader = new THREE.CubeTextureLoader()

const environmentMap = cubeTextureLoader.load([
    '/environmentMaps/0/px.png',  // positive x
    '/environmentMaps/0/nx.png',  // negative x
    '/environmentMaps/0/py.png',  // positive y
    '/environmentMaps/0/ny.png',  // negative y
    '/environmentMaps/0/pz.png',  // positive z
    '/environmentMaps/0/nz.png'   // negative z
])

scene.background = environmentMap   // 배경
scene.environment = environmentMap  // 전체 조명/반사
```

**씬 환경맵 속성**
```javascript
scene.environmentIntensity = 1       // 환경맵 밝기
scene.backgroundBlurriness = 0       // 배경 블러 (0~1)
scene.backgroundIntensity = 1        // 배경 밝기 (조명과 별개)
scene.backgroundRotation.y = 0       // 배경 회전
scene.environmentRotation.y = 0      // 조명 환경맵 회전

// lil-gui로 실시간 조정
gui.add(scene, 'environmentIntensity').min(0).max(10).step(0.001)
gui.add(scene, 'backgroundBlurriness').min(0).max(1).step(0.001)
gui.add(scene.backgroundRotation, 'y').min(0).max(Math.PI * 2).step(0.001).name('backgroundRotationY')
```

**방법 2: HDR Equirectangular (RGBE)**
```javascript
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'

const rgbeLoader = new RGBELoader()
rgbeLoader.load('/environmentMaps/0/2k.hdr', (environmentMap) => {
    environmentMap.mapping = THREE.EquirectangularReflectionMapping
    scene.background = environmentMap
    scene.environment = environmentMap
})
```
- HDR: 높은 다이나믹 레인지 → 더 사실적인 조명
- RGBE 인코딩 = HDR 포맷
- 파일 크기 크고 렌더 부담 있음 → 저해상도로 절충

**방법 3: EXR (NVIDIA Canvas 등)**
```javascript
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'

const exrLoader = new EXRLoader()
exrLoader.load('/environmentMaps/file.exr', (environmentMap) => {
    environmentMap.mapping = THREE.EquirectangularReflectionMapping
    scene.background = environmentMap
    scene.environment = environmentMap
})
```

**방법 4: LDR Equirectangular (JPG)**
```javascript
const environmentMap = textureLoader.load('/environmentMaps/image.jpg')
environmentMap.mapping = THREE.EquirectangularReflectionMapping
environmentMap.colorSpace = THREE.SRGBColorSpace  // 필수!
scene.background = environmentMap
scene.environment = environmentMap
scene.environmentIntensity = 4  // LDR은 밝기 올려야 함
```

**Blender로 환경맵 제작**
```
Render Engine: Cycles
Sampling: 256 samples
Camera: Panoramic → Equirectangular
Resolution: 2048x1024
Export: ALT+S → Radiance HDR (.hdr)
```

**Ground Projected Skybox (오브젝트가 바닥에 붙어보이는 효과)**
```javascript
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js'

rgbeLoader.load('/environmentMaps/2/2k.hdr', (environmentMap) => {
    environmentMap.mapping = THREE.EquirectangularReflectionMapping
    scene.environment = environmentMap  // 배경 없이 조명만

    const skybox = new GroundedSkybox(environmentMap, 15, 70)  // (텍스처, 높이, 반지름)
    skybox.position.y = 15  // 구의 높이만큼 올림
    scene.add(skybox)
})
```

**Real-time Environment Map (동적 환경맵)**
```javascript
// WebGLCubeRenderTarget: 렌더 결과를 큐브 텍스처로 저장
const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
    type: THREE.HalfFloatType  // 높은 다이나믹 레인지
})
scene.environment = cubeRenderTarget.texture

// CubeCamera: 6방향 렌더 수행
const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget)
cubeCamera.layers.set(1)  // 특정 레이어만 렌더

// 동적 오브젝트
const holyDonut = new THREE.Mesh(
    new THREE.TorusGeometry(8, 0.5),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(10, 4, 2) })  // HDR 색상 범위 초과
)
holyDonut.layers.enable(1)  // cubeCamera가 볼 수 있도록
scene.add(holyDonut)

// tick에서 업데이트
const tick = () => {
    holyDonut.rotation.x = Math.sin(elapsedTime) * 2
    cubeCamera.update(renderer, scene)  // 6방향 렌더
}
```

**Layers 시스템**
```javascript
// 오브젝트 레이어 설정
object.layers.enable(1)    // 레이어 1 추가
object.layers.disable(1)   // 레이어 1 제거
object.layers.set(1)       // 레이어 1만 (나머지 제거)

// 카메라 레이어 설정 (해당 레이어 오브젝트만 렌더)
cubeCamera.layers.set(1)   // 레이어 1 오브젝트만 봄
// 기본 카메라는 레이어 0 (기본값)
```
> 주의: 조명은 레이어 영향 안 받음

---

## 25. Realistic Render

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: Tone Mapping, Antialiasing, Shadow 품질, Color Space, Shadow Acne (normalBias/bias)
- **Sheem 메모**: Sheem의 최종 비주얼 퀄리티 결정. ACESFilmic 또는 Reinhard tone mapping으로 분위기 연출. Shadow acne 해결은 캐릭터 그림자 품질에 필수

### 전체 내용

**Tone Mapping**
```javascript
// HDR → LDR 변환 알고리즘 (실제로는 LDR도 HDR처럼 보이게 함)
renderer.toneMapping = THREE.NoToneMapping        // 기본값
renderer.toneMapping = THREE.LinearToneMapping
renderer.toneMapping = THREE.ReinhardToneMapping   // 카메라 노출 과다 느낌, 현실적
renderer.toneMapping = THREE.CineonToneMapping
renderer.toneMapping = THREE.ACESFilmicToneMapping // 영화 색감, 인기

renderer.toneMappingExposure = 3  // 노출값 (밝기)

// lil-gui 드롭다운
gui.add(renderer, 'toneMapping', {
    No: THREE.NoToneMapping,
    Linear: THREE.LinearToneMapping,
    Reinhard: THREE.ReinhardToneMapping,
    Cineon: THREE.CineonToneMapping,
    ACESFilmic: THREE.ACESFilmicToneMapping
})
gui.add(renderer, 'toneMappingExposure').min(0).max(10).step(0.001)
```

**Antialiasing**
```javascript
// 렌더러 생성 시 설정 (이후 변경 불가)
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true  // MSAA 활성화
})
```
- Pixel ratio > 1인 기기는 antialiasing 거의 불필요
- 성능 비용 있음 → pixel ratio < 2인 기기에만 적용 고려

**그림자 품질 설정**
```javascript
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const directionalLight = new THREE.DirectionalLight('#ffffff', 6)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(1024, 1024)  // 높을수록 선명

// 타겟 설정 (target은 scene에 없으면 matrix 업데이트 안 됨)
directionalLight.target.position.set(0, 4, 0)
directionalLight.target.updateWorldMatrix()  // 수동 업데이트

// Shadow Camera 설정 (CameraHelper로 확인)
directionalLight.shadow.camera.far = 15

// 씬 traverse로 모든 메시에 그림자 설정
scene.traverse((child) => {
    if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
    }
})
```

**Shadow Acne 해결**
```javascript
// 모델이 자기 자신에게 그림자를 드리우는 아티팩트
directionalLight.shadow.normalBias = 0.027  // 둥근 표면에 효과적
directionalLight.shadow.bias = -0.004       // 평평한 표면에 효과적

// lil-gui로 최적값 찾기
gui.add(directionalLight.shadow, 'normalBias').min(-0.05).max(0.05).step(0.001)
gui.add(directionalLight.shadow, 'bias').min(-0.05).max(0.05).step(0.001)
```

**Color Space**
```javascript
// Color 텍스처 (사람이 보는 색상)만 SRGBColorSpace 설정
floorColorTexture.colorSpace = THREE.SRGBColorSpace
wallColorTexture.colorSpace = THREE.SRGBColorSpace

// 데이터 텍스처 (Normal, AO, Roughness, Metalness)는 설정 불필요
// GLTF 파일은 내부에 colorSpace 정보 포함 → 자동 처리
```

**환경맵 조명과 DirectionalLight 매칭**
```javascript
// 환경맵 조명 방향과 DirectionalLight 위치를 맞추면 더 사실적
directionalLight.position.set(-4, 6.5, 2.5)  // 환경맵 밝은 부분 방향

// Debug UI로 실시간 조정
gui.add(directionalLight.position, 'x').min(-10).max(10).step(0.001).name('lightX')
gui.add(directionalLight.position, 'y').min(-10).max(10).step(0.001).name('lightY')
gui.add(directionalLight.position, 'z').min(-10).max(10).step(0.001).name('lightZ')
```

---

## 26. Code Structuring for Bigger Projects

- **Sheem 관련도**: 🔴 필수
- **핵심 개념**: ES Modules, Classes, Singleton, EventEmitter, Experience 구조, Resources 로더, Dispose 메모리 관리
- **Sheem 메모**: Sheem 프로젝트가 커질수록 필수. 멀티유저 + 오디오 시스템 + 맵 + UI가 모두 분리된 클래스로 관리되어야 유지보수 가능

### 전체 내용

**ES Modules 기본**
```javascript
// 내보내기
export default 'Hello modules'
export default () => { console.log('함수') }
export default class MyClass { }

// 여러 개 내보내기
export { oneThing, anotherThing }

// 가져오기
import myModule from './myModule.js'  // 경로에 ./ 필수!
import { oneThing, anotherThing } from './module.js'
```

**Classes 기본**
```javascript
class Robot {
    constructor(name, legs) {
        this.name = name  // 인스턴스 프로퍼티
        this.legs = legs
        this.sayHi()      // 생성자에서 메서드 호출 가능
    }

    sayHi() {
        console.log(`Hello! My name is ${this.name}`)
    }
}

// 상속
class FlyingRobot extends Robot {
    constructor(name, legs) {
        super(name, legs)  // 부모 constructor 호출 필수
        this.canFly = true
    }

    takeOff() { console.log(`Have a good flight ${this.name}`) }
}

const wallE = new Robot('Wall-E', 0)
const astroBoy = new FlyingRobot('Astro Boy', 2)
```

**프로젝트 구조 (Experience 패턴)**
```
src/
  script.js              ← 진입점
  Experience/
    Experience.js         ← 메인 클래스 (Singleton)
    Camera.js
    Renderer.js
    sources.js            ← 리소스 목록
    World/
      World.js
      Floor.js
      Fox.js
      Environment.js
    Utils/
      EventEmitter.js     ← 이벤트 시스템
      Sizes.js            ← 뷰포트 크기
      Time.js             ← 애니메이션 루프
      Resources.js        ← 에셋 로더
      Debug.js            ← lil-gui 래퍼
```

**Singleton 패턴**
```javascript
let instance = null

export default class Experience {
    constructor(canvas) {
        if (instance) return instance  // 이미 있으면 기존 반환
        instance = this

        window.experience = this  // 콘솔 접근용 (선택사항)
        this.canvas = canvas
    }
}

// 어디서든 같은 인스턴스 접근
import Experience from './Experience.js'
const experience = new Experience()  // 이미 생성됐으면 기존 인스턴스 반환
```

**EventEmitter 패턴**
```javascript
// EventEmitter를 상속받은 Sizes 클래스
import EventEmitter from './EventEmitter.js'

export default class Sizes extends EventEmitter {
    constructor() {
        super()
        this.width = window.innerWidth
        this.height = window.innerHeight

        window.addEventListener('resize', () => {
            this.width = window.innerWidth
            this.height = window.innerHeight
            this.trigger('resize')  // 이벤트 발생
        })
    }
}

// Experience에서 이벤트 구독
this.sizes = new Sizes()
this.sizes.on('resize', () => {
    this.resize()
})
```

**Time 클래스 (애니메이션 루프)**
```javascript
export default class Time extends EventEmitter {
    constructor() {
        super()
        this.start = Date.now()
        this.current = this.start
        this.elapsed = 0
        this.delta = 16  // 첫 프레임 기본값 (~60fps)

        window.requestAnimationFrame(() => { this.tick() })
    }

    tick() {
        const currentTime = Date.now()
        this.delta = currentTime - this.current   // 이전 프레임 이후 경과 (ms)
        this.current = currentTime
        this.elapsed = this.current - this.start  // 시작 이후 경과 (ms)

        this.trigger('tick')  // 매 프레임 이벤트 발생

        window.requestAnimationFrame(() => { this.tick() })
    }
}
```

**Resources 클래스 (에셋 로더)**
```javascript
// sources.js
export default [
    {
        name: 'environmentMapTexture',
        type: 'cubeTexture',
        path: ['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg']
    },
    { name: 'foxModel', type: 'gltfModel', path: 'models/Fox/glTF/Fox.gltf' },
    { name: 'grassColorTexture', type: 'texture', path: 'textures/dirt/color.jpg' }
]

// Resources.js (모든 에셋 로드 완료 시 'ready' 이벤트)
export default class Resources extends EventEmitter {
    constructor(sources) {
        super()
        this.sources = sources
        this.items = {}        // 로드된 에셋 저장
        this.toLoad = sources.length
        this.loaded = 0

        this.setLoaders()
        this.startLoading()
    }

    sourceLoaded(source, file) {
        this.items[source.name] = file
        this.loaded++
        if (this.loaded === this.toLoad) {
            this.trigger('ready')  // 모두 로드 완료
        }
    }
}

// World.js에서 사용
this.resources.on('ready', () => {
    this.floor = new Floor()
    this.fox = new Fox()
    this.environment = new Environment()
})
```

**Debug 클래스 (#debug URL로 활성화)**
```javascript
import GUI from 'lil-gui'

export default class Debug {
    constructor() {
        this.active = window.location.hash === '#debug'
        if (this.active) {
            this.ui = new GUI()
        }
    }
}

// 각 클래스에서 사용
this.debug = this.experience.debug
if (this.debug.active) {
    this.debugFolder = this.debug.ui.addFolder('fox')
    this.debugFolder.add(debugObject, 'playIdle')
}
// URL에 #debug 추가 시 UI 표시
```

**AnimationMixer + crossFadeFrom (부드러운 전환)**
```javascript
this.animation = {}
this.animation.mixer = new THREE.AnimationMixer(this.model)
this.animation.actions = {
    idle: this.animation.mixer.clipAction(this.resource.animations[0]),
    walking: this.animation.mixer.clipAction(this.resource.animations[1]),
    running: this.animation.mixer.clipAction(this.resource.animations[2])
}
this.animation.actions.current = this.animation.actions.idle
this.animation.actions.current.play()

this.animation.play = (name) => {
    const newAction = this.animation.actions[name]
    const oldAction = this.animation.actions.current

    newAction.reset()
    newAction.play()
    newAction.crossFadeFrom(oldAction, 1)  // 1초 크로스페이드

    this.animation.actions.current = newAction
}

// tick에서 업데이트
update() {
    this.animation.mixer.update(this.time.delta * 0.001)  // ms → 초 변환
}
```

**Dispose (메모리 관리)**
```javascript
destroy() {
    // 이벤트 리스너 제거
    this.sizes.off('resize')
    this.time.off('tick')

    // 씬 내 모든 메시 dispose
    this.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.geometry.dispose()
            for (const key in child.material) {
                const value = child.material[key]
                if (value && typeof value.dispose === 'function') {
                    value.dispose()  // 텍스처, 머티리얼 등
                }
            }
        }
    })

    this.camera.controls.dispose()    // OrbitControls
    this.renderer.instance.dispose()  // WebGLRenderer

    if (this.debug.active) this.debug.ui.destroy()  // lil-gui
}
```

**업데이트/리사이즈 전파 패턴**
```javascript
// Experience → 각 클래스로 전파
class Experience {
    resize() {
        this.camera.resize()
        this.renderer.resize()
    }

    update() {
        this.camera.update()      // OrbitControls 업데이트
        this.world.update()       // Fox 애니메이션 등
        this.renderer.update()    // 렌더링 (항상 마지막)
    }
}
```
