# Chapter 06: Portal Scene

---

## 49. Creating a scene in Blender ⚪스킵 (Blender 기초)
**시간:** 2:04:52 | **난이도:** Hard

**Sheem 관련성:** Sheem 환경 에셋 제작 워크플로우 참고

### 핵심 개념: Baking

**Baking이란?** Ray Tracing 렌더 결과를 텍스처에 저장 → Three.js에서 실시간으로 사용.

**장점:**
- Ray Tracing 품질의 조명/그림자를 WebGL에서 표현
- 성능 매우 좋음 (텍스처 하나만 표시)

**단점:**
- Blender 작업 시간이 김
- 조명이 동적으로 변하지 않음 (다시 베이크 필요)
- 복잡한 씬은 텍스처 용량 큼

**Sheem에 적합한 경우:** 정적 배경 오브젝트 (텐트, 벤치, 나무 등), 지형 텍스처

### Blender 씬 제작 핵심 워크플로우

**1. 씬 생성**
- 바닥(PlaneGeometry), 울타리, 나무, 바위 등 모델링
- Shift+A: 오브젝트 생성
- Tab: Edit Mode 토글
- Ctrl+R: 루프 컷
- Shift+D: 복제 / Alt+D: 링크 복제 (연결된 복제 - 하나 수정하면 모두 변경)

**2. 컬렉션으로 정리**
- Blender의 컬렉션 = 폴더 (Three.js 그룹과 다름 - 변환 적용 안됨)
- 씬 그래프를 최대한 평평하게 유지 (parent 시스템 최소화)

**3. 머티리얼 설정**
- Principled BSDF: PBR 재질 (Base Color, Roughness)
- Emission: 발광 재질 (포탈, 램프 등)
- Cycles 렌더 엔진 사용 (Eevee보다 품질 좋음)

**4. 조명**
- Area Light: 부드러운 확산광 (Strength ~240)
- Sampling: 128~1024 (높을수록 좋지만 느림)
- Denoise 체크 (노이즈 제거)

### Sheem 메모
> Sheem의 정적 배경 (텐트, 캠프파이어 주변, 나무) 제작 시 이 워크플로우 활용. 발광 오브젝트(포탈 → 비 파티클 이펙트)는 별도 컬렉션으로 분리.

---

## 50. Baking and Exporting the Scene ⚪스킵 (Blender 작업)
**시간:** 2:11:58 | **난이도:** Very Hard

**Sheem 관련성:** Sheem 에셋 베이킹 파이프라인 참고

### 핵심 개념

**베이킹 파이프라인:**
최적화 → UV 언래핑 → 베이킹 → 이미지 내보내기 → 모델 내보내기

### 최적화 단계

**숨겨진 면 제거:**
- 바닥에 붙은 면 (나무 밑부분 등)
- 다른 오브젝트에 가려진 면 (계단 뒷면 등)
- Edit Mode → Face Select → X로 삭제

**링크 해제 (Unlink Duplicates):**
```
Object Mode → A (전체 선택) → F3 → Make Single User
→ Object & Data
```
UV 언래핑 시 겹치지 않도록 필요.

**법선 방향 수정:**
- Overlay → Face Orientation: 파란색 = 정상, 빨간색 = 뒤집힘
- Edit Mode → 뒤집힌 면 선택 → F3 → Flip Normals

**스케일 정규화:**
```
Object Mode → A → Ctrl+A → Scale
```
UV 언래핑 비율 일관성 확보.

### UV 언래핑

**핵심 원칙:** 3D 오브젝트를 2D 정사각형으로 펼치기 → 텍스처 좌표 생성.

**Seam(솔기) 추가:**
- Edge Select → 자를 엣지 선택 → U → Mark Seam
- Seam이 빨간색으로 표시됨

**언래핑 방법:**
```
Edit Mode → A → U → Unwrap (수동 seam 기반)
                   → Smart UV Project (자동, 바위 등에 적합)
```

**발광 오브젝트 분리 (emissions 컬렉션):**
- 균일한 색상이므로 베이킹 불필요 → 텍스처 공간 절약
- 컬렉션을 선택 불가 상태로 설정 → 베이킹에서 제외

### 베이킹 설정

**텍스처 생성:**
- UV Editor → New Image
- Name: `baked`
- 4096×4096, 32-bit Float 체크, Alpha 해제

**텍스처 저장 (HDR):**
```
UV Editor → Image → Save As → Radiance HDR (baked.hdr)
```
32-bit Float = HDR 텍스처 (색상 데이터 보존).

**머티리얼에 텍스처 노드 추가:**
- Shader Editor → Shift+A → Texture → Image Texture
- baked 텍스처 선택 → 노드 활성화 (선택됨 상태)
- 링크 불필요 (존재만 하면 됨)

**베이킹 실행:**
```
Render Properties → Bake
- Bake Type: Combined
- View From: Active Camera
- Margin: 16px, Type: Extend
- Clear Image: 체크 해제 (순차적 베이킹)
- Sampling: 128
```

### 이미지 내보내기 (Compositor)

**문제점:** 베이킹 결과는 Filmic/AgX 색상 관리가 적용 안 됨 → 색상이 이상함.

**해결책: Blender Compositor 사용**
```
Compositor 영역 → Use Nodes 체크
→ Image 노드 생성 (baked.hdr 선택)
→ Denoise 노드 연결
→ Composite 노드에 연결
→ Render Layers 노드 M으로 뮤트
→ Output: 4096×4096, F12로 렌더
→ ALT+S → JPEG 75% 저장 (baked.jpg)
```

### 모델 내보내기 (glTF 2.0)

```
File → Export → glTF 2.0
- 형식: .glb (가벼움)
- Selected Objects만
- +Y Up 체크
- Geometry: UVs만 체크
- Draco 압축 활성화
- Animation 비활성화
```

### Sheem 메모
> Sheem 환경 제작 시 필요. 단일 텍스처에 전체 씬 베이킹 → draw call 최소화. 발광 오브젝트(비 파티클 구름 등)는 별도 ShaderMaterial로 Three.js에서 처리.

---

## 51. Importing and Optimizing the Scene 🔴필수
**시간:** 46:55 | **난이도:** Hard

**Sheem 관련성:** Blender 에셋을 Three.js로 가져오는 핵심 코드 패턴

### 핵심 코드

### 텍스처 로드 + 색상 수정
```js
// 텍스처 로드
const bakedTexture = textureLoader.load('baked.jpg')
bakedTexture.flipY = false // Y축 반전 수정 (필수!)
bakedTexture.colorSpace = THREE.SRGBColorSpace // 색상 공간 수정 (필수!)

// MeshBasicMaterial 적용 (라이트 불필요)
const bakedMaterial = new THREE.MeshBasicMaterial({ map: bakedTexture })
```

### 모델 로드 + 머티리얼 적용
```js
gltfLoader.load('portal.glb', (gltf) => {
    scene.add(gltf.scene)

    // 이름으로 특정 메시 찾기
    const bakedMesh = gltf.scene.children.find(child => child.name === 'baked')
    const portalLightMesh = gltf.scene.children.find(child => child.name === 'portalLight')
    const poleLightAMesh = gltf.scene.children.find(child => child.name === 'poleLightA')
    const poleLightBMesh = gltf.scene.children.find(child => child.name === 'poleLightB')

    // 머티리얼 적용
    bakedMesh.material = bakedMaterial
    portalLightMesh.material = portalLightMaterial
    poleLightAMesh.material = poleLightMaterial
    poleLightBMesh.material = poleLightMaterial
})
```

### 발광 머티리얼 (Emission)
```js
// 램프 (따뜻한 흰색)
const poleLightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffe5 })

// 포탈 (ShaderMaterial로 교체 예정)
const portalLightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })
```

### Blender에서 오브젝트 이름 설정

Three.js에서 `find(child => child.name === 'poleLightA')` 로 찾으려면 Blender에서 미리 이름 지정 필요:
- Outliner에서 각 오브젝트 이름 변경: `poleLightA`, `poleLightB`, `portalLight`, `baked`

### 성능 최적화: 지오메트리 병합

**문제:** 베이킹된 오브젝트가 여러 개 → draw call 증가.

**해결:** Blender에서 병합 후 export.

```
Blender에서:
1. 발광 오브젝트 컬렉션 선택 불가 설정
2. 나머지 오브젝트 모두 선택 → Shift+D로 복제
3. M → 새 컬렉션 "merged"로 이동
4. Ctrl+J (병합) → 오브젝트 하나로 합치기
5. 이름 "baked"로 변경
6. 발광 컬렉션과 함께 export
```

**결과:** 4개의 draw call만 발생 (baked 1개 + 발광 3개)

### traverse로 전체 적용 (병합 전 방법)
```js
gltf.scene.traverse((child) => {
    child.material = bakedMaterial
})
// 이후 개별 오브젝트에 다른 머티리얼 적용
```

### 주요 버그 수정
| 문제 | 원인 | 해결 |
|------|------|------|
| 텍스처 뒤집힘 | Three.js/Blender Y축 불일치 | `flipY = false` |
| 색상 바랜 느낌 | sRGB 인코딩 미설정 | `colorSpace = THREE.SRGBColorSpace` |
| 조명 없으면 안 보임 | MeshStandardMaterial은 조명 필요 | MeshBasicMaterial 사용 |

### Sheem 메모
> Blender에서 만든 텐트, 나무, 돌 등을 Three.js로 가져올 때 동일한 패턴 사용. flipY, colorSpace 설정은 항상 필요. 발광 오브젝트(파티클 소스 등)는 ShaderMaterial로 별도 처리.

---

## 52. Adding Details to the Scene 🔴필수
**시간:** 1:34:51 | **난이도:** Hard

**Sheem 관련성:** Sheem의 핵심 시각 효과 - 파티클과 셰이더 애니메이션

### 1. 배경색 제어
```js
const debugObject = {}
debugObject.clearColor = '#201919'
renderer.setClearColor(debugObject.clearColor)

gui.addColor(debugObject, 'clearColor').onChange(() => {
    renderer.setClearColor(debugObject.clearColor)
})
```

### 2. Fireflies (반딧불이 파티클)

#### 지오메트리 생성
```js
const firefliesGeometry = new THREE.BufferGeometry()
const firefliesCount = 30

const positionArray = new Float32Array(firefliesCount * 3)
const scaleArray = new Float32Array(firefliesCount)

for(let i = 0; i < firefliesCount; i++) {
    positionArray[i * 3 + 0] = (Math.random() - 0.5) * 4 // x
    positionArray[i * 3 + 1] = Math.random() * 1.5        // y (위로만)
    positionArray[i * 3 + 2] = (Math.random() - 0.5) * 4 // z
    scaleArray[i] = Math.random()
}

firefliesGeometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3))
firefliesGeometry.setAttribute('aScale', new THREE.BufferAttribute(scaleArray, 1))
```

#### ShaderMaterial
```js
const firefliesMaterial = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending, // 빛처럼 보임
    depthWrite: false,                // 파티클 간 클리핑 방지
    uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uSize: { value: 100 }
    },
    vertexShader: firefliesVertexShader,
    fragmentShader: firefliesFragmentShader
})

// resize 시 픽셀 비율 업데이트
window.addEventListener('resize', () => {
    firefliesMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2)
})
```

#### Vertex Shader (fireflies/vertex.glsl)
```glsl
uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;

attribute float aScale;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);

    // 둥실둥실 부유 애니메이션
    modelPosition.y += sin(uTime + modelPosition.x * 100.0) * aScale * 0.2;

    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectionPosition = projectionMatrix * viewPosition;
    gl_Position = projectionPosition;

    // 크기 (픽셀 비율 + 원근 + 스케일)
    gl_PointSize = uSize * aScale * uPixelRatio;
    gl_PointSize *= (1.0 / - viewPosition.z); // 원근 효과
}
```

#### Fragment Shader (fireflies/fragment.glsl)
```glsl
void main() {
    // 빛나는 점 패턴
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float strength = 0.05 / distanceToCenter - 0.1; // 엣지에서 0으로

    gl_FragColor = vec4(1.0, 1.0, 1.0, strength);
}
```

### 3. Portal Shader (포탈 애니메이션)

#### 포탈 머티리얼
```js
debugObject.portalColorStart = '#000000'
debugObject.portalColorEnd = '#ffffff'

const portalLightMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uColorStart: { value: new THREE.Color(debugObject.portalColorStart) },
        uColorEnd: { value: new THREE.Color(debugObject.portalColorEnd) }
    },
    vertexShader: portalVertexShader,
    fragmentShader: portalFragmentShader
})

gui.addColor(debugObject, 'portalColorStart').onChange(() => {
    portalLightMaterial.uniforms.uColorStart.value.set(debugObject.portalColorStart)
})
```

#### Vertex Shader (portal/vertex.glsl)
```glsl
varying vec2 vUv;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectionPosition = projectionMatrix * viewPosition;
    gl_Position = projectionPosition;

    vUv = uv;
}
```

#### Fragment Shader (portal/fragment.glsl) - 3D Perlin Noise 포함
```glsl
uniform float uTime;
uniform vec3 uColorStart;
uniform vec3 uColorEnd;

varying vec2 vUv;

// Stefan Gustavson Classic Perlin 3D Noise (생략 - 레슨 29 참고)
float cnoise(vec3 P) { /* ... */ }

void main() {
    // UV 왜곡 (더 유기적인 느낌)
    vec2 displacedUv = vUv + cnoise(vec3(vUv * 5.0, uTime * 0.1));

    // Perlin 강도
    float strength = cnoise(vec3(displacedUv * 5.0, uTime * 0.2));

    // 외부 발광 (엣지를 하얗게)
    float outerGlow = distance(vUv, vec2(0.5)) * 5.0 - 1.4;
    strength += outerGlow;

    // 날카로운 효과 추가
    strength += step(-0.2, strength) * 0.8;

    // 클램핑 (색상 보간 오류 방지)
    strength = clamp(strength, 0.0, 1.0);

    // 색상 혼합
    vec3 color = mix(uColorStart, uColorEnd, strength);

    gl_FragColor = vec4(color, 1.0);
}
```

### tick에서 업데이트
```js
const tick = () => {
    const elapsedTime = clock.getElapsedTime()

    firefliesMaterial.uniforms.uTime.value = elapsedTime
    portalLightMaterial.uniforms.uTime.value = elapsedTime

    controls.update()
    renderer.render(scene, camera)
    requestAnimationFrame(tick)
}
```

### 포탈 UV 수정 (Blender)
포탈이 UV 그라디언트를 제대로 보여주지 않으면:
```
Blender → portalLight 선택 → Edit Mode → A → U → Unwrap
(원형 디스크가 전체 UV 맵을 채우도록)
```

### Sheem 메모
> **Fireflies** → 비 속 반딧불이, 눈 파티클, 반짝이는 빛 파티클로 활용. **Portal Shader** → 오디오 존 인디케이터 (비 구역 = 파란 소용돌이, 숲 구역 = 초록 에너지 등) 시각화에 완벽하게 적용 가능. uColorStart/uColorEnd를 오디오 종류에 따라 변경.
