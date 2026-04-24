# Chapter 07: React Three Fiber

---

## 53. What are React and React Three Fiber ⚪스킵
**시간:** 25:50 | **난이도:** Easy

**핵심 요약:**
- React = UI 라이브러리, JSX → DOM, 데이터 바인딩
- R3F = React renderer for Three.js, JSX → Three.js scene
- PMNDRS(Poimandres) 오픈소스 생태계, Paul Henschel(0xca0a) 제작
- 설치: `npm install three@0.174 @react-three/fiber@9.1`

---

## 54. First React Application 🔴필수
**시간:** 4:23:01 | **난이도:** Hard

**Sheem 관련성:** Next.js 기반 앱 개발에 필수

### JSX 핵심 규칙
```jsx
// 하나의 루트 요소만 허용 (또는 Fragment)
root.render(
    <>
        <h1>Hello</h1>
        <p>Content</p>
    </>
)

// class → className, for → htmlFor
<h1 className="title">Hello</h1>

// JS 삽입
<p>Count: { count + 1 }</p>

// 이벤트
<button onClick={ handleClick }>Click</button>
```

### 핵심 Hooks

**useState** - 반응형 데이터
```jsx
const [ count, setCount ] = useState(0)
setCount(count + 1)
setCount(prev => prev + 1) // 비동기 안전
```

**useEffect** - 사이드 이펙트
```jsx
// 마운트 시 1회
useEffect(() => {
    // 초기화
    return () => { /* cleanup */ }
}, [])

// 의존성 변경 시
useEffect(() => {
    localStorage.setItem('count', count)
}, [ count ])
```

**useMemo** - 값 캐싱
```jsx
const colors = useMemo(() => {
    return [...Array(count)].map(() => `hsl(${Math.random() * 360}deg, 100%, 75%)`)
}, [ count ])
```

**useRef** - DOM/오브젝트 참조
```jsx
const buttonRef = useRef()
useEffect(() => {
    buttonRef.current.style.backgroundColor = 'papayawhip'
}, [])
// <button ref={ buttonRef }>
```

### Props
```jsx
// 부모 → 자식 데이터 전달
function Clicker({ keyName, color, increment }) {
    return <div style={{ color }}>
        <button onClick={() => increment()}>Click</button>
    </div>
}

// children prop
function App({ children }) {
    return <>{ children }</>
}
```

### 이벤트 패턴
```jsx
// 클릭
<button onClick={ () => console.log('clicked') }>

// 조건부 렌더링
{ isVisible && <Component /> }
{ count > 0 ? <ShowCount count={count} /> : <Empty /> }

// 루프 (key 필수)
{ items.map((item, index) => <Item key={item.id} {...item} /> ) }
```

### 데이터 끌어올리기 (Lifting State Up)
```jsx
// 부모에서 상태 관리, 함수를 자식에 전달
function App() {
    const [ totalCount, setTotalCount ] = useState(0)
    const increment = () => setTotalCount(c => c + 1)
    return <Clicker increment={ increment } />
}
```

### API 호출 패턴
```jsx
const getPeople = async () => {
    const response = await fetch('https://api.example.com/users')
    const result = await response.json()
    setPeople(result)
}
useEffect(() => { getPeople() }, [])
```

### Virtual DOM
- 상태 변경 시 Virtual DOM 비교 → 실제 변경된 부분만 re-render
- 성능 최적화: `useMemo`, `useCallback` 활용

### Sheem 메모
> 학습 탭의 AI Study Partner UI 구조에 직접 적용. useState로 대화 히스토리 관리, useEffect로 Supabase 데이터 로딩.

---

## 55. First R3F Application 🔴필수
**시간:** 2:05:24 | **난이도:** Hard

**Sheem 관련성:** Sheem 3D 씬의 기본 구조

### Canvas 설정
```jsx
import { Canvas } from '@react-three/fiber'

root.render(
    <Canvas
        camera={{ fov: 45, near: 0.1, far: 200, position: [3, 2, 6] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        dpr={[1, 2]}
        shadows
        flat    // NoToneMapping
        linear  // LinearSRGBColorSpace
    >
        <Experience />
    </Canvas>
)
```

### CSS (Canvas 전체화면)
```css
html, body, #root {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    overflow: hidden;
}
```

### R3F 기본 문법
```jsx
// Three.js 클래스 → camelCase JSX
// new THREE.Mesh() → <mesh>
// new THREE.BoxGeometry() → <boxGeometry>

<mesh position={[1, 2, 3]} rotation-x={0.5} scale={1.5}>
    <boxGeometry args={[1, 2, 1]} />  {/* args = 생성자 파라미터 */}
    <meshStandardMaterial color="red" wireframe />
</mesh>

{/* geometry → attach="geometry" 자동 */}
{/* material → attach="material" 자동 */}
```

### useFrame (매 프레임 호출)
```jsx
import { useFrame } from '@react-three/fiber'

const cubeRef = useRef()
useFrame((state, delta) => {
    cubeRef.current.rotation.y += delta // 프레임레이트 독립적
})
// state.camera, state.gl, state.clock, state.clock.getElapsedTime()
```

### useThree (씬 접근)
```jsx
import { useThree } from '@react-three/fiber'
const { camera, gl, scene, clock } = useThree()
```

### OrbitControls (수동 구현)
```jsx
import { extend, useThree } from '@react-three/fiber'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

extend({ OrbitControls })

const { camera, gl } = useThree()
return <orbitControls args={[camera, gl.domElement]} />
// → Drei로 대체하면 훨씬 간단
```

### 커스텀 지오메트리
```jsx
import { useMemo } from 'react'

function CustomObject() {
    const verticesCount = 10 * 3
    const positions = useMemo(() => {
        const arr = new Float32Array(verticesCount * 3)
        for(let i = 0; i < verticesCount * 3; i++)
            arr[i] = (Math.random() - 0.5) * 3
        return arr
    }, [])

    const geometryRef = useRef()
    useEffect(() => {
        geometryRef.current.computeVertexNormals()
    }, [positions])

    return <mesh>
        <bufferGeometry ref={geometryRef}>
            <bufferAttribute
                attach="attributes-position"
                count={verticesCount}
                itemSize={3}
                array={positions}
            />
        </bufferGeometry>
        <meshStandardMaterial side={THREE.DoubleSide} />
    </mesh>
}
```

### Canvas 카메라 애니메이션
```jsx
useFrame((state, delta) => {
    const angle = state.clock.elapsedTime
    state.camera.position.x = Math.sin(angle) * 8
    state.camera.position.z = Math.cos(angle) * 8
    state.camera.lookAt(0, 0, 0)
})
```

### Sheem 메모
> `<Canvas>`가 scene, camera, renderer 자동 생성. `useFrame`으로 오디오 분석 데이터를 매 프레임 시각화 가능.

---

## 56. Drei 🔴필수
**시간:** 1:14:15 | **난이도:** Medium

**설치:** `npm install @react-three/drei@10.0`

### OrbitControls
```jsx
import { OrbitControls } from '@react-three/drei'
<OrbitControls makeDefault enableDamping />
// makeDefault: 다른 Controls과 충돌 방지
```

### TransformControls
```jsx
import { TransformControls } from '@react-three/drei'
const cube = useRef()

<mesh ref={cube} position-x={2}>...</mesh>
<TransformControls object={cube} mode="translate" />
// mode: "translate" | "rotate" | "scale"
```

### PivotControls
```jsx
<PivotControls
    anchor={[0, 0, 0]}    // 오브젝트 상대 위치
    depthTest={false}      // 항상 최상단
    lineWidth={4}
    scale={100}
    fixed={true}           // 화면 픽셀 크기 고정
>
    <mesh>...</mesh>
</PivotControls>
```

### Html (3D 위치에 DOM 요소)
```jsx
import { Html } from '@react-three/drei'

<mesh position-x={-2}>
    <sphereGeometry />
    <Html
        position={[1, 1, 0]}
        wrapperClass="label"
        center
        distanceFactor={8}
        occlude={[sphere, cube]}  // 오클루전
    >
        라벨 텍스트
    </Html>
</mesh>
```
```css
.label > div {
    background: #00000088;
    color: white;
    padding: 15px;
    border-radius: 30px;
}
```

### Text (SDF 폰트)
```jsx
import { Text } from '@react-three/drei'

<Text
    font="./bangers-v20-latin-regular.woff"
    fontSize={1}
    color="salmon"
    maxWidth={2}
    textAlign="center"
    position-y={2}
>
    I LOVE R3F
    <meshNormalMaterial />  {/* 커스텀 머티리얼 */}
</Text>
```

### Float (부유 효과)
```jsx
import { Float } from '@react-three/drei'
<Float speed={5} floatIntensity={2} rotationIntensity={0.4}>
    <mesh>...</mesh>
</Float>
```

### MeshReflectorMaterial (반사 재질)
```jsx
import { MeshReflectorMaterial } from '@react-three/drei'
<mesh rotation-x={-Math.PI * 0.5}>
    <planeGeometry />
    <MeshReflectorMaterial
        resolution={512}
        blur={[1000, 1000]}
        mixBlur={1}
        mirror={0.5}
        color="greenyellow"
    />
</mesh>
```

### Center (중앙 정렬)
```jsx
import { Center } from '@react-three/drei'
<Center><Text3D>...</Text3D></Center>
```

### Sheem 메모
> `<Html>`로 오디오 존 라벨 UI, `<Text>`로 존 이름 표시, `<Float>`으로 오브젝트 부유 효과. `<OrbitControls makeDefault>`는 항상 사용.

---

## 57. Debug 🟡참고
**시간:** 51:44 | **난이도:** Medium

### StrictMode
```jsx
import { StrictMode } from 'react'
root.render(
    <StrictMode>
        <Canvas>...</Canvas>
    </StrictMode>
)
// 잠재적 오류 경고 (프로덕션 무시됨)
```

### Leva (Debug UI)
**설치:** `npm install leva@0.10`

```jsx
import { useControls, button } from 'leva'

const { position, color, visible } = useControls('sphere', {
    position: { value: { x: -2, y: 0 }, step: 0.01, joystick: 'invertY' },
    color: 'orange',
    visible: true,
    scale: { value: 1.5, min: 0, max: 5, step: 0.01 },
    myInterval: { min: 0, max: 10, value: [4, 5] },
    clickMe: button(() => { console.log('clicked') }),
    choice: { options: ['a', 'b', 'c'] }
})
```

```jsx
// index.jsx (Canvas 밖)
import { Leva } from 'leva'
root.render(
    <>
        <Leva collapsed />
        <Canvas>...</Canvas>
    </>
)
```

### r3f-perf (성능 모니터)
**설치:** `npm install r3f-perf@7.2`

```jsx
import { Perf } from 'r3f-perf'

// Canvas 내부에서
<Perf position="top-left" />

// Leva로 토글
const { perfVisible } = useControls({ perfVisible: true })
{ perfVisible && <Perf position="top-left" /> }
```

---

## 58. Environment and Staging 🔴필수
**시간:** 2:02:06 | **난이도:** Medium

### 배경색
```jsx
// JSX 방식 (권장)
<color args={['#201919']} attach="background" />
```

### 조명 헬퍼
```jsx
import { useHelper } from '@react-three/drei'
import * as THREE from 'three'

const directionalLight = useRef()
useHelper(directionalLight, THREE.DirectionalLightHelper, 1)

<directionalLight ref={directionalLight} position={[1, 2, 3]} intensity={4.5} />
```

### 그림자
```jsx
// Canvas에서 활성화
<Canvas shadows>

// 오브젝트에서
<directionalLight castShadow
    shadow-mapSize={[1024, 1024]}
    shadow-camera-near={1}
    shadow-camera-far={10}
    shadow-camera-top={5}
    shadow-camera-right={5}
    shadow-camera-bottom={-5}
    shadow-camera-left={-5}
/>
<mesh castShadow>...</mesh>
<mesh receiveShadow>...</mesh>
```

### SoftShadows (부드러운 그림자)
```jsx
import { SoftShadows } from '@react-three/drei'
<SoftShadows size={25} samples={10} focus={0} />
```

### AccumulativeShadows (누적 그림자)
```jsx
import { AccumulativeShadows, RandomizedLight } from '@react-three/drei'
<AccumulativeShadows
    position={[0, -0.99, 0]}
    scale={10}
    color="#316d39"
    opacity={0.8}
    frames={Infinity}
    temporal
    blend={100}
>
    <RandomizedLight
        amount={8}
        radius={1}
        ambient={0.5}
        intensity={3}
        position={[1, 2, 3]}
        bias={0.001}
    />
</AccumulativeShadows>
```

### ContactShadows (접촉 그림자, 라이트 불필요)
```jsx
import { ContactShadows } from '@react-three/drei'
<ContactShadows
    position={[0, -0.99, 0]}
    scale={10}
    resolution={512}
    far={5}
    color="#1d8f75"
    opacity={0.4}
    blur={2.8}
    frames={1}  // 정적 베이크
/>
```

### Sky
```jsx
import { Sky } from '@react-three/drei'
const { sunPosition } = useControls('sky', { sunPosition: { value: [1, 2, 3] } })
<Sky sunPosition={sunPosition} />
<directionalLight position={sunPosition} />
```

### Environment Map
```jsx
import { Environment, Lightformer } from '@react-three/drei'

// HDRI 프리셋
<Environment preset="sunset" background />

// 커스텀
<Environment background resolution={32}>
    <color args={['#000000']} attach="background" />
    <Lightformer position-z={-5} scale={5} color="red" intensity={10} form="ring" />
</Environment>

// Ground (지면 투영)
<Environment preset="sunset" ground={{ height: 7, radius: 28, scale: 100 }} />
```

### environmentIntensity 제어
```jsx
import { useThree } from '@react-three/fiber'

const scene = useThree(state => state.scene)
useEffect(() => {
    scene.environmentIntensity = envMapIntensity
}, [envMapIntensity])
```

### Stage (올인원 스테이징)
```jsx
import { Stage } from '@react-three/drei'
<Stage
    shadows={{ type: 'contact', opacity: 0.2, blur: 3 }}
    environment="sunset"
    preset="portrait"
    intensity={envMapIntensity}
>
    <mesh>...</mesh>
</Stage>
```

### Sheem 메모
> `<Environment preset="sunset">` + `<ContactShadows>`로 빠른 환경 설정. 오디오 존별 배경색 변경 시 `<color attach="background">` 활용.

---

## 59. Load Models 🔴필수
**시간:** 1:29:57 | **난이도:** Medium

### useGLTF (Drei 권장)
```jsx
import { useGLTF } from '@react-three/drei'

// DRACO 자동 처리
const model = useGLTF('./hamburger.glb')
return <primitive object={model.scene} scale={0.35} />

// 프리로딩 (컴포넌트 바깥)
useGLTF.preload('./hamburger.glb')
```

### useLoader (수동)
```jsx
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

const model = useLoader(GLTFLoader, './model.glb', (loader) => {
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('./draco/')
    loader.setDRACOLoader(dracoLoader)
})
```

### Lazy Loading (Suspense)
```jsx
import { Suspense } from 'react'

// Model.jsx (별도 컴포넌트)
function Model() {
    const model = useGLTF('./model.glb')
    return <primitive object={model.scene} scale={5} position-y={-1} />
}

// Experience.jsx
<Suspense fallback={<Placeholder position-y={0.5} scale={[2, 3, 2]} />}>
    <Model />
</Suspense>

// Placeholder.jsx
function Placeholder(props) {
    return <mesh {...props}>
        <boxGeometry args={[1, 1, 1, 2, 2, 2]} />
        <meshBasicMaterial wireframe color="red" />
    </mesh>
}
```

### useTexture
```jsx
import { useTexture } from '@react-three/drei'
const bakedTexture = useTexture('./model/baked.jpg')
bakedTexture.flipY = false
```

### Clone (다중 인스턴스)
```jsx
import { Clone } from '@react-three/drei'
const model = useGLTF('./hamburger.glb')
return <>
    <Clone object={model.scene} scale={0.35} position-x={-4} />
    <Clone object={model.scene} scale={0.35} position-x={0} />
    <Clone object={model.scene} scale={0.35} position-x={4} />
</>
```

### GLTF → React 컴포넌트 변환
**온라인 툴:** https://gltf.pmnd.rs/
```jsx
// 변환 후 생성된 컴포넌트 예시
export default function Hamburger(props) {
    const { nodes, materials } = useGLTF('./hamburger.glb')
    return (
        <group {...props} dispose={null}>
            <mesh castShadow receiveShadow
                geometry={nodes.bottomBun.geometry}
                material={materials.BunMaterial}
            />
        </group>
    )
}
useGLTF.preload('./hamburger.glb')
```

### 애니메이션 (useAnimations)
```jsx
import { useAnimations } from '@react-three/drei'

function Fox() {
    const fox = useGLTF('./Fox/glTF/Fox.gltf')
    const animations = useAnimations(fox.animations, fox.scene)
    const { animationName } = useControls({
        animationName: { options: animations.names }
    })

    useEffect(() => {
        const action = animations.actions[animationName]
        action.reset().fadeIn(0.5).play()

        return () => {
            action.fadeOut(0.5) // cleanup
        }
    }, [animationName])

    return <primitive object={fox.scene} scale={0.02} />
}
```

### shadow-normalBias (그림자 아크네 수정)
```jsx
<directionalLight castShadow shadow-normalBias={0.04} />
```

### Sheem 메모
> `useGLTF`로 환경 에셋 로딩, `<Suspense>`로 로딩 화면. 애니메이션 Fox 패턴을 Sheem 캐릭터에 적용.

---

## 60. 3D Text 🟡참고
**시간:** 59:13 | **난이도:** Hard

### Text3D (Drei)
```jsx
import { Text3D, Center, useMatcapTexture } from '@react-three/drei'

const [matcapTexture] = useMatcapTexture('7B5254_E9DCC7_B19986_C8AC91', 256)

<Center>
    <Text3D
        font="./fonts/helvetiker_regular.typeface.json"
        size={0.75}
        height={0.2}
        curveSegments={12}
        bevelEnabled
        bevelThickness={0.02}
        bevelSize={0.02}
        bevelSegments={5}
    >
        HELLO R3F
        <meshMatcapMaterial matcap={matcapTexture} />
    </Text3D>
</Center>
```

### 지오메트리/머티리얼 공유 최적화
```jsx
// 컴포넌트 밖에서 생성 (한 번만)
const torusGeometry = new THREE.TorusGeometry(1, 0.6, 16, 32)
const material = new THREE.MeshMatcapMaterial()

// 사용 시
useEffect(() => {
    matcapTexture.colorSpace = THREE.SRGBColorSpace
    matcapTexture.needsUpdate = true
    material.matcap = matcapTexture
    material.needsUpdate = true
}, [])

// 메시에 적용
<mesh geometry={torusGeometry} material={material} />
```

### 루프로 여러 오브젝트 생성
```jsx
// ref 배열로 여러 오브젝트 참조
const donuts = useRef([])

{ [...Array(100)].map((_, index) =>
    <mesh
        key={index}
        ref={(element) => donuts.current[index] = element}
        geometry={torusGeometry}
        material={material}
        position={[(Math.random()-0.5)*10, (Math.random()-0.5)*10, (Math.random()-0.5)*10]}
        scale={0.2 + Math.random() * 0.2}
        rotation={[Math.random()*Math.PI, Math.random()*Math.PI, 0]}
    />
)}

// useFrame에서 업데이트
useFrame((state, delta) => {
    for(const donut of donuts.current)
        donut.rotation.y += delta * 0.2
})
```

---

## 61. Portal Scene 🔴필수
**시간:** 41:54 | **난이도:** Medium

**Sheem 관련성:** 오디오 존 셰이더 시각화 패턴

### shaderMaterial (Drei)
```jsx
import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'

const PortalMaterial = shaderMaterial(
    // uniforms (value 없이)
    {
        uTime: 0,
        uColorStart: new THREE.Color('#ffffff'),
        uColorEnd: new THREE.Color('#000000')
    },
    portalVertexShader,
    portalFragmentShader
)
extend({ PortalMaterial })

// 사용
const portalMaterial = useRef()
useFrame((state, delta) => {
    portalMaterial.current.uTime += delta
})
return <mesh>
    <portalMaterial ref={portalMaterial} />
</mesh>
// uniform 접근: portalMaterial.current.uTime (value 없이)
```

### 베이크드 씬 임포트
```jsx
const { nodes } = useGLTF('./model/portal.glb')
const bakedTexture = useTexture('./model/baked.jpg')
bakedTexture.flipY = false

<Center>
    <mesh geometry={nodes.baked.geometry}>
        <meshBasicMaterial map={bakedTexture} />
    </mesh>
    <mesh geometry={nodes.poleLightA.geometry} position={nodes.poleLightA.position}>
        <meshBasicMaterial color="#ffffe5" />
    </mesh>
    <Sparkles size={6} scale={[4, 2, 4]} position-y={1} speed={0.2} count={40} />
</Center>
```

### flat (ToneMapping 비활성화)
```jsx
<Canvas flat> {/* 베이크드 씬에서 색상 보정 방지 */}
```

### Sparkles (반딧불이 대체)
```jsx
import { Sparkles } from '@react-three/drei'
<Sparkles size={6} scale={[4, 2, 4]} position-y={1} speed={0.2} count={40} />
```

---

## 62. Mouse Events 🔴필수
**시간:** 47:15 | **난이도:** Medium

**Sheem 관련성:** 오디오 존 클릭/호버 인터랙션

### 이벤트 리스닝
```jsx
<mesh onClick={(event) => {
    console.log(event.distance)    // 카메라~히트 거리
    console.log(event.point)       // 히트 좌표
    console.log(event.uv)          // UV 좌표
    console.log(event.object)      // 이벤트 발생 오브젝트
    console.log(event.x, event.y)  // 2D 화면 좌표
    event.stopPropagation()        // 전파 중단
}}>
```

### 주요 이벤트들
```jsx
<mesh
    onClick={handler}
    onContextMenu={handler}    // 우클릭
    onDoubleClick={handler}
    onPointerUp={handler}
    onPointerDown={handler}
    onPointerEnter={handler}   // 진입
    onPointerLeave={handler}   // 이탈
    onPointerMove={handler}    // 이동
/>

// Canvas에서
<Canvas onPointerMissed={() => console.log('missed!')} />
```

### 오클루전 처리
```jsx
// 앞에 있는 오브젝트가 뒤 오브젝트 이벤트 차단
<mesh onClick={(e) => e.stopPropagation()}
      onPointerEnter={(e) => e.stopPropagation()}>
```

### 커서 변경
```jsx
<mesh
    onPointerEnter={() => document.body.style.cursor = 'pointer'}
    onPointerLeave={() => document.body.style.cursor = 'default'}
>
```

### 성능 최적화

**meshBounds** (단순 구형 감지)
```jsx
import { meshBounds } from '@react-three/drei'
<mesh raycast={meshBounds} onClick={handler}>
```

**BVH** (복잡한 지오메트리 가속)
```jsx
import { Bvh } from '@react-three/drei'
// index.jsx에서
<Bvh><Experience /></Bvh>
```

### 성능 주의사항
- `onPointerMove`, `onPointerOver` 등은 매 프레임 테스트 → 성능 부담
- 이벤트 리스닝 오브젝트 수 최소화

---

## 63. Post-processing 🟡참고
**시간:** 1:54:13 | **난이도:** Very Hard

**설치:** `npm install @react-three/postprocessing@3.0 postprocessing@6.37`

### 기본 설정
```jsx
import { EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode, BlendFunction } from 'postprocessing'

<EffectComposer multisampling={8}>
    {/* 효과들 */}
    <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />  {/* 항상 마지막 */}
</EffectComposer>
```

### 내장 효과들
```jsx
import { Vignette, Glitch, Noise, Bloom, DepthOfField } from '@react-three/postprocessing'
import { GlitchMode, BlendFunction } from 'postprocessing'

<Vignette offset={0.3} darkness={0.9} blendFunction={BlendFunction.NORMAL} />

<Glitch
    delay={[0.5, 1]}
    duration={[0.1, 0.3]}
    strength={[0.2, 0.4]}
    mode={GlitchMode.CONSTANT_MILD}
/>

<Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} />

<Bloom
    mipmapBlur
    intensity={0.5}
    luminanceThreshold={1.1}
/>

<DepthOfField
    focusDistance={0.025}
    focalLength={0.025}
    bokehScale={6}
/>
```

### Bloom 발광 머티리얼
```jsx
// 방법 1: 채널값 1 초과
<meshStandardMaterial color={[1.5, 1, 4]} />

// 방법 2: emissive
<meshStandardMaterial
    color="orange"
    emissive="orange"
    emissiveIntensity={2}
/>
```

### 배경색 버그 수정
```jsx
// 포스트 프로세싱 사용 시 배경이 투명해짐 → 직접 설정
<color args={['#ffffff']} attach="background" />
```

### 커스텀 효과 (DrunkEffect 예시)
```js
// DrunkEffect.jsx
import { Effect, BlendFunction } from 'postprocessing'
import { Uniform } from 'three'

const fragmentShader = /* glsl */`
    uniform float frequency;
    uniform float amplitude;
    uniform float time;

    void mainUv(inout vec2 uv) {
        uv.y += sin(uv.x * frequency + time) * amplitude;
    }

    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        outputColor = vec4(0.8, 1.0, 0.5, inputColor.a);
    }
`

export default class DrunkEffect extends Effect {
    constructor({ frequency, amplitude, blendFunction = BlendFunction.DARKEN }) {
        super('DrunkEffect', fragmentShader, {
            blendFunction,
            uniforms: new Map([
                ['frequency', new Uniform(frequency)],
                ['amplitude', new Uniform(amplitude)],
                ['time', new Uniform(0)]
            ])
        })
    }

    update(renderer, inputBuffer, deltaTime) {
        this.uniforms.get('time').value += deltaTime
    }
}
```

```jsx
// Drunk.jsx (React 래퍼)
export default function Drunk(props) {
    const effect = new DrunkEffect(props)
    return <primitive ref={props.ref} object={effect} />
}

// 사용
extend({ DrunkEffect })
<Drunk frequency={2} amplitude={0.1} blendFunction={BlendFunction.DARKEN} />
```

---

## 64. Fun and Simple Portfolio 🟡참고
**시간:** 51:20 | **난이도:** Medium

### PresentationControls (드래그 제어)
```jsx
import { PresentationControls } from '@react-three/drei'

// index.jsx - touch-action 설정
<Canvas className="r3f">
// style.css - .r3f { touch-action: none; }

<PresentationControls
    global
    rotation={[0.13, 0.1, 0]}
    polar={[-0.4, 0.2]}
    azimuth={[-1, 0.75]}
    config={{ mass: 2, tension: 400 }}
    snap={{ mass: 4, tension: 400 }}
>
    <Float rotationIntensity={0.4}>
        <primitive object={computer.scene} position-y={-1.2} />
    </Float>
</PresentationControls>
```

### iframe (HTML 웹사이트 임베드)
```jsx
import { Html } from '@react-three/drei'

<primitive object={computer.scene} position-y={-1.2} rotation-x={0.13}>
    <Html
        transform
        wrapperClass="htmlScreen"
        distanceFactor={1.17}
        position={[0, 1.56, -1.4]}
        rotation-x={-0.256}
    >
        <iframe src="https://yourportfolio.com" />
    </Html>
</primitive>
```
```css
.htmlScreen iframe {
    width: 1024px;
    height: 670px;
    border: none;
    border-radius: 20px;
    background: #000000;
}
```

### RectAreaLight (스크린 반사광)
```jsx
<rectAreaLight
    width={2.5}
    height={1.65}
    intensity={65}
    color="#ff6900"
    rotation={[-0.1, Math.PI, 0]}
    position={[0, 0.55, -1.15]}
/>
```

---

## 65. Physics 🔴필수
**시간:** 2:11:34 | **난이도:** Hard

**설치:** `npm install @react-three/rapier@2.0`

**Sheem 관련성:** 인터랙티브 물리 효과 (물체 던지기, 충돌)

### 기본 설정
```jsx
import { Physics, RigidBody } from '@react-three/rapier'

<Physics debug gravity={[0, -9.81, 0]}>
    <RigidBody colliders="ball" restitution={0.2} friction={1}>
        <mesh><sphereGeometry /></mesh>
    </RigidBody>
    <RigidBody type="fixed">
        <mesh><boxGeometry /></mesh>
    </RigidBody>
</Physics>
```

### Collider 타입
```jsx
// 자동 생성
colliders="cuboid"  // 기본값 (박스)
colliders="ball"    // 구
colliders="hull"    // 볼록 껍질 (홀 무시)
colliders="trimesh" // 정확한 메시 (동적 오브젝트에 주의)
colliders={false}   // 수동 설정

// 수동 Collider
import { CuboidCollider, BallCollider, CylinderCollider } from '@react-three/rapier'
<RigidBody colliders={false}>
    <CuboidCollider args={[1.5, 1.5, 0.5]} />
    <BallCollider args={[1.5]} />
    <CylinderCollider args={[0.5, 1.25]} />  {/* [halfHeight, radius] */}
</RigidBody>
```

### RigidBody 속성
```jsx
<RigidBody
    type="fixed"           // fixed | kinematicPosition | kinematicVelocity
    restitution={0.2}      // 탄성 (0~1+)
    friction={0.7}         // 마찰
    gravityScale={1}       // 중력 배율 (음수 가능)
    linearDamping={0.5}    // 선형 감쇠
    angularDamping={0.5}   // 각형 감쇠
    canSleep={false}       // 슬립 방지
    colliders="ball"
>
```

### 힘 적용
```jsx
const body = useRef()

// 점프
body.current.applyImpulse({ x: 0, y: 5, z: 0 })
body.current.applyTorqueImpulse({ x: Math.random()-0.5, y: Math.random()-0.5, z: Math.random()-0.5 })

// 위치/속도 리셋
body.current.setTranslation({ x: 0, y: 1, z: 0 })
body.current.setLinvel({ x: 0, y: 0, z: 0 })
body.current.setAngvel({ x: 0, y: 0, z: 0 })

// 질량 조회
const mass = body.current.mass()
```

### KinematicPosition (직접 제어)
```jsx
import * as THREE from 'three'

const twister = useRef()
useFrame((state) => {
    const time = state.clock.getElapsedTime()

    // 회전
    const euler = new THREE.Euler(0, time * 3, 0)
    const quat = new THREE.Quaternion().setFromEuler(euler)
    twister.current.setNextKinematicRotation(quat)

    // 이동
    const x = Math.cos(time * 0.5) * 2
    const z = Math.sin(time * 0.5) * 2
    twister.current.setNextKinematicTranslation({ x, y: -0.8, z })
})

<RigidBody ref={twister} type="kinematicPosition" friction={0}>
    <mesh scale={[0.4, 0.4, 3]}><boxGeometry /></mesh>
</RigidBody>
```

### Raycasting (바닥 감지)
```jsx
import { useRapier } from '@react-three/rapier'

const { rapier, world } = useRapier()

const jump = () => {
    const origin = body.current.translation()
    origin.y -= 0.31
    const direction = { x: 0, y: -1, z: 0 }
    const ray = new rapier.Ray(origin, direction)
    const hit = world.castRay(ray, 10, true)  // max=10, solid=true

    if(hit.timeOfImpact < 0.15)
        body.current.applyImpulse({ x: 0, y: 0.5, z: 0 })
}
```

### 이벤트
```jsx
<RigidBody
    onCollisionEnter={() => {
        hitSound.currentTime = 0
        hitSound.volume = Math.random()
        hitSound.play()
    }}
    onCollisionExit={() => console.log('exit')}
    onSleep={() => console.log('sleeping')}
    onWake={() => console.log('waking')}
>
```

### InstancedMesh + 물리
```jsx
import { InstancedRigidBodies } from '@react-three/rapier'

const cubesCount = 100
const instances = useMemo(() => {
    return [...Array(cubesCount)].map((_, i) => ({
        key: `instance_${i}`,
        position: [(Math.random()-0.5)*8, 6 + i*0.2, (Math.random()-0.5)*8],
        rotation: [Math.random(), Math.random(), Math.random()]
    }))
}, [])

<InstancedRigidBodies instances={instances}>
    <instancedMesh castShadow args={[null, null, cubesCount]}>
        <boxGeometry />
        <meshStandardMaterial color="tomato" />
    </instancedMesh>
</InstancedRigidBodies>
```

### Sheem 메모
> 물 파티클 충돌, 오브젝트 투척 효과. `canSleep={false}`로 플레이어 오브젝트 항상 활성화. `useRapier` Raycasting으로 지면 감지.

---

## 66. Create a Game 🔴필수
**시간:** 4:01:51 | **난이도:** Hard

**Sheem 관련성:** 게임 루프, 전역 상태, 키보드 컨트롤 패턴

### KeyboardControls
```jsx
// index.jsx
import { KeyboardControls } from '@react-three/drei'

root.render(
    <KeyboardControls map={[
        { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
        { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
        { name: 'leftward', keys: ['ArrowLeft', 'KeyA'] },
        { name: 'rightward', keys: ['ArrowRight', 'KeyD'] },
        { name: 'jump', keys: ['Space'] }
    ]}>
        <Canvas>...</Canvas>
        <Interface />
    </KeyboardControls>
)
```

```jsx
// Player.jsx에서 사용
import { useKeyboardControls } from '@react-three/drei'

const [subscribeKeys, getKeys] = useKeyboardControls()

// 매 프레임 키 상태 체크
useFrame((state, delta) => {
    const { forward, backward, leftward, rightward } = getKeys()
    const impulse = { x: 0, y: 0, z: 0 }
    const torque = { x: 0, y: 0, z: 0 }
    const impulseStrength = 0.6 * delta
    const torqueStrength = 0.2 * delta

    if(forward) { impulse.z -= impulseStrength; torque.x -= torqueStrength }
    if(backward) { impulse.z += impulseStrength; torque.x += torqueStrength }
    if(rightward) { impulse.x += impulseStrength; torque.z -= torqueStrength }
    if(leftward) { impulse.x -= impulseStrength; torque.z += torqueStrength }

    body.current.applyImpulse(impulse)
    body.current.applyTorqueImpulse(torque)
})

// 특정 키 구독 (점프)
useEffect(() => {
    const unsubJump = subscribeKeys(
        (state) => state.jump,
        (value) => { if(value) jump() }
    )
    const unsubAny = subscribeKeys(() => { start() }) // 아무 키나

    return () => {
        unsubJump()
        unsubAny()
    }
}, [])

// Interface.jsx에서 (반응형)
const forward = useKeyboardControls((state) => state.forward)
```

### Zustand (전역 상태)
**설치:** `npm install zustand@5.0`

```jsx
// stores/useGame.jsx
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export default create(subscribeWithSelector((set) => ({
    blocksCount: 10,
    blocksSeed: 0,

    // Phases
    phase: 'ready',  // 'ready' | 'playing' | 'ended'
    startTime: 0,
    endTime: 0,

    start: () => set((state) => {
        if(state.phase === 'ready')
            return { phase: 'playing', startTime: Date.now() }
        return {}
    }),

    end: () => set((state) => {
        if(state.phase === 'playing')
            return { phase: 'ended', endTime: Date.now() }
        return {}
    }),

    restart: () => set((state) => {
        if(state.phase === 'playing' || state.phase === 'ended')
            return { phase: 'ready', blocksSeed: Math.random() }
        return {}
    })
})))
```

```jsx
// 사용 (선택적 구독 - 필요한 것만)
const start = useGame((state) => state.start)
const blocksCount = useGame((state) => state.blocksCount)

// 상태 변경 구독
useGame.subscribe(
    (state) => state.phase,
    (value) => {
        if(value === 'ready') reset()
    }
)

// 직접 상태 조회 (반응 없이)
const state = useGame.getState()
```

### addEffect (Canvas 밖에서 프레임 루프)
```jsx
import { addEffect } from '@react-three/fiber'

useEffect(() => {
    const unsubscribe = addEffect(() => {
        const state = useGame.getState()
        let elapsedTime = 0
        if(state.phase === 'playing')
            elapsedTime = (Date.now() - state.startTime) / 1000
        else if(state.phase === 'ended')
            elapsedTime = (state.endTime - state.startTime) / 1000

        if(time.current)
            time.current.textContent = elapsedTime.toFixed(2)
    })
    return () => unsubscribe()
}, [])
```

### 카메라 스무딩
```jsx
const [smoothedCameraPosition] = useState(() => new THREE.Vector3(10, 10, 10))
const [smoothedCameraTarget] = useState(() => new THREE.Vector3())

useFrame((state, delta) => {
    const bodyPosition = body.current.translation()

    const cameraPosition = new THREE.Vector3()
    cameraPosition.copy(bodyPosition)
    cameraPosition.z += 2.25
    cameraPosition.y += 0.65

    const cameraTarget = new THREE.Vector3()
    cameraTarget.copy(bodyPosition)
    cameraTarget.y += 0.25

    smoothedCameraPosition.lerp(cameraPosition, 5 * delta)
    smoothedCameraTarget.lerp(cameraTarget, 5 * delta)

    state.camera.position.copy(smoothedCameraPosition)
    state.camera.lookAt(smoothedCameraTarget)
})
```

### 라이트 따라다니기
```jsx
// Lights.jsx
const light = useRef()
useFrame((state) => {
    light.current.position.z = state.camera.position.z + 1 - 4
    light.current.target.position.z = state.camera.position.z - 4
    light.current.target.updateMatrixWorld()
})
```

### 블록 구조 패턴
```jsx
// Level.jsx - 블록 컴포넌트들
export function BlockSpinner({ position = [0, 0, 0] }) {
    const obstacle = useRef()
    const [speed] = useState(() => (Math.random() + 0.2) * (Math.random() < 0.5 ? -1 : 1))

    useFrame((state) => {
        const time = state.clock.getElapsedTime()
        const quat = new THREE.Quaternion()
        quat.setFromEuler(new THREE.Euler(0, time * speed, 0))
        obstacle.current.setNextKinematicRotation(quat)
    })

    return <group position={position}>
        <mesh geometry={boxGeometry} material={floor2Material}
            position={[0, -0.1, 0]} scale={[4, 0.2, 4]} receiveShadow />
        <RigidBody ref={obstacle} type="kinematicPosition"
            position={[0, 0.3, 0]} restitution={0.2} friction={0}>
            <mesh geometry={boxGeometry} material={obstacleMaterial}
                scale={[3.5, 0.3, 0.3]} castShadow receiveShadow />
        </RigidBody>
    </group>
}

// useMemo로 랜덤 블록 배열
const blocks = useMemo(() => {
    return [...Array(count)].map(() =>
        types[Math.floor(Math.random() * types.length)]
    )
}, [count, types, seed])

return <>
    <BlockStart position={[0, 0, 0]} />
    { blocks.map((Block, index) =>
        <Block key={index} position={[0, 0, -(index + 1) * 4]} />
    )}
    <BlockEnd position={[0, 0, -(count + 1) * 4]} />
    <Bounds length={count + 2} />
</>
```

---

## 67. The End ⚪
**시간:** 3:50 | **난이도:** Easy

> "You now have a great understanding of Three.js and enough experience to venture on your own."
>
> 완주 🎉 — 계속 실험하고, 영감받은 것을 WebGL로 재현하고, 커뮤니티에 공유하자.
> Twitter: `@bruno_simon`, `#threejsJourney`

---

## R3F 핵심 패턴 요약

### 설치
```bash
npm install three@0.174 @react-three/fiber@9.1 @react-three/drei@10.0
npm install @react-three/rapier@2.0
npm install @react-three/postprocessing@3.0 postprocessing@6.37
npm install zustand@5.0 leva@0.10 r3f-perf@7.2
```

### 기본 구조
```jsx
// index.jsx
root.render(
    <KeyboardControls map={[...]}>
        <Canvas shadows camera={{...}} dpr={[1, 2]}>
            <Experience />
        </Canvas>
        <Interface />
    </KeyboardControls>
)

// Experience.jsx
<Physics>
    <Lights />
    <Level />
    <Player />
</Physics>
```

### 자주 쓰는 패턴
| 작업 | 방법 |
|------|------|
| 모델 로딩 | `useGLTF('./model.glb')` |
| 텍스처 로딩 | `useTexture('./texture.jpg')` |
| 매 프레임 | `useFrame((state, delta) => {})` |
| 씬 접근 | `useThree((state) => state.camera)` |
| 물리 | `<RigidBody>` + `body.current.applyImpulse()` |
| 전역 상태 | `zustand` store |
| 디버그 UI | `leva` useControls |
| 성능 모니터 | `<Perf position="top-left" />` |
