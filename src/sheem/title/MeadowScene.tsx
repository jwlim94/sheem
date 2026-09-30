import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  groundHeight,
  groundColorAt,
  grassDirection,
  grassDensity,
  surfaceHeight,
  mountainGeometry,
  riverGeometry,
  riverX,
  seededRandom,
  terrainGeometry,
} from './landscape';

import { grassMaterial, meadowGroundMaterial } from './vegetationMaterials';

const skyVertex = `varying vec3 vWorld; void main(){vec4 p=modelMatrix*vec4(position,1.); vWorld=p.xyz; gl_Position=projectionMatrix*viewMatrix*p;}`;
const skyFragment = `
  varying vec3 vWorld; uniform float time;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p), f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
  float fbm(vec2 p){float v=0.;float a=.5;for(int i=0;i<5;i++){v+=noise(p)*a;p=p*2.03+12.4;a*=.5;}return v;}
  void main(){
    vec3 d=normalize(vWorld-cameraPosition); float h=max(d.y,0.);
    vec3 color=mix(vec3(.64,.72,.65),vec3(.055,.25,.42),pow(h,.55));
    vec3 sun=normalize(vec3(-.28,.18,-.95)); float glow=max(dot(d,sun),0.);
    color+=vec3(1.,.68,.31)*pow(glow,18.)*.25;
    color=mix(color,vec3(1.,.94,.72),smoothstep(.9993,.9998,glow));
    vec2 p=d.xz/max(d.y+.12,.05)*2.2+vec2(time*.009,0.);
    float c=smoothstep(.48,.75,fbm(p))*smoothstep(.03,.19,h);
    color=mix(color,vec3(1.,.97,.85),c*.86);
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const waterFragment = `uniform float time; varying vec2 vUv; varying vec3 vWorld;
  void main(){float wave=sin(vUv.y*85.+time*.7+sin(vUv.x*24.+time*.4)*2.);
    float sparkle=pow(max(0.,wave),28.)*.09;
    vec3 c=mix(vec3(.035,.17,.20),vec3(.20,.39,.36),vUv.x)+sparkle;
    c=mix(c,vec3(.76,.81,.70),smoothstep(40.,270.,distance(cameraPosition,vWorld)));
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function Landscape({ reducedMotion }: { reducedMotion: boolean }) {
  const groundMaterial = useMemo(() => meadowGroundMaterial(), []);
  useEffect(() => () => groundMaterial.dispose(), [groundMaterial]);
  const terrain = useMemo(() => terrainGeometry(), []);
  const river = useMemo(() => riverGeometry(), []);
  const mountains = useMemo(
    () => [-420, -350, -280].map((z, i) => mountainGeometry(z, 13 + i * 12)),
    []
  );
  const sky = useRef<THREE.ShaderMaterial>(null);
  const water = useRef<THREE.ShaderMaterial>(null);
  const skyUniforms = useMemo(() => ({ time: { value: 0 } }), []);
  const waterUniforms = useMemo(() => ({ time: { value: 0 } }), []);
  useFrame((_, delta) => {
    if (reducedMotion) return;
    const step = Math.min(delta, 0.05);
    if (sky.current) sky.current.uniforms.time.value += step;
    if (water.current) water.current.uniforms.time.value += step;
  });
  useEffect(
    () => () => {
      terrain.dispose();
      river.dispose();
      mountains.forEach((g) => g.dispose());
    },
    [terrain, river, mountains]
  );
  return (
    <>
      <mesh>
        <sphereGeometry args={[950, 32, 16]} />
        <shaderMaterial
          ref={sky}
          vertexShader={skyVertex}
          fragmentShader={skyFragment}
          uniforms={skyUniforms}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      {mountains.map((geometry, i) => (
        <mesh key={i} geometry={geometry}>
          <meshBasicMaterial vertexColors fog={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh geometry={terrain} receiveShadow>
        <primitive object={groundMaterial} attach="material" />
      </mesh>
      <mesh geometry={river} position-y={0.05}>
        <shaderMaterial
          ref={water}
          uniforms={waterUniforms}
          vertexShader={`varying vec2 vUv; varying vec3 vWorld; void main(){vUv=uv;vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`}
          fragmentShader={waterFragment}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}

const GRASS_PATCH_CANDIDATES = 64000;
const MAX_GRASS_BLADES = GRASS_PATCH_CANDIDATES * 5;
const GRASS_COLORS = ['#4d6c29', '#688b37', '#7b9645', '#8a9f50', '#a3ae66'];

function Meadow({
  reducedMotion,
  clearing,
}: {
  reducedMotion: boolean;
  clearing?: readonly [number, number, number];
}) {
  const grass = useRef<THREE.InstancedMesh>(null);
  const flowers = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(() => grassMaterial({ value: 0 }), []);
  useEffect(() => () => material.dispose(), [material]);
  const blade = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions: number[] = [],
      indices: number[] = [];
    for (let row = 0; row < 4; row++) {
      const t = row / 4;
      const width = 0.055 * (1 - t * 0.85);
      positions.push(-width, t, 0, width, t, 0);
      if (row < 3) {
        const k = row * 2;
        indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    positions.push(0, 1, 0);
    indices.push(6, 7, 8);
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    g.setAttribute(
      'groundNormal',
      new THREE.InstancedBufferAttribute(
        new Float32Array(MAX_GRASS_BLADES * 3),
        3
      )
    );
    g.setAttribute(
      'groundColor',
      new THREE.InstancedBufferAttribute(
        new Float32Array(MAX_GRASS_BLADES * 3),
        3
      )
    );
    return g;
  }, []);
  useLayoutEffect(() => {
    if (!grass.current || !flowers.current) return;
    const random = seededRandom(121);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const groundColor = new THREE.Color();
    const normal = new THREE.Vector3();
    let count = 0,
      flowerCount = 0;
    for (let i = 0; i < GRASS_PATCH_CANDIDATES; i++) {
      const shortCover = i < 26000;
      const near = random() < 0.75;
      const x = (random() - 0.5) * (near ? 100 : 175);
      const z = 45 - random() * (near ? 95 : 205);
      const density = grassDensity(x, z);
      if (
        (clearing &&
          Math.hypot(x - clearing[0], z - clearing[1]) < clearing[2]) ||
        Math.abs(x - riverX(z)) < 6.5 + random() * 1.5 ||
        (!shortCover && random() > 0.45 + density * 0.55)
      )
        continue;
      const tall = !shortCover && random() < density * 0.55;
      const height = shortCover
        ? 0.14 + random() * 0.2
        : tall
          ? 0.7 + density * 0.65 + random() * 0.2
          : 0.3 + random() * 0.4;
      const blades = shortCover ? 3 : 3 + Math.floor(density * 2);
      const angle = grassDirection(x, z) + (random() - 0.5) * 1.1;
      // Several differently oriented blades read as a tuft instead of isolated spikes.
      for (let j = 0; j < blades; j++) {
        const bladeX = x + (random() - 0.5) * 0.65;
        const bladeZ = z + (random() - 0.5) * 0.65;
        dummy.position.set(
          bladeX,
          surfaceHeight(bladeX, bladeZ) - 0.015,
          bladeZ
        );
        dummy.rotation.set(
          (random() - 0.5) * 0.35,
          angle + (random() - 0.5) * 1.4,
          (random() - 0.5) * 0.3
        );
        dummy.scale.set(
          0.85 + random() * 0.65,
          height * (0.7 + random() * 0.5),
          1
        );
        dummy.updateMatrix();
        grass.current.setMatrixAt(count, dummy.matrix);
        color.set(GRASS_COLORS[Math.floor(random() * GRASS_COLORS.length)]);
        grass.current.setColorAt(count, color);
        normal
          .set(
            surfaceHeight(bladeX - 0.2, bladeZ) -
              surfaceHeight(bladeX + 0.2, bladeZ),
            0.4,
            surfaceHeight(bladeX, bladeZ - 0.2) -
              surfaceHeight(bladeX, bladeZ + 0.2)
          )
          .normalize();
        blade.attributes.groundNormal.setXYZ(
          count,
          normal.x,
          normal.y,
          normal.z
        );
        groundColorAt(bladeX, bladeZ, groundColor);
        blade.attributes.groundColor.setXYZ(
          count,
          groundColor.r,
          groundColor.g,
          groundColor.b
        );
        count++;
      }
      if (flowerCount < 1100 && random() > 0.95 && z > -75) {
        dummy.position.set(x, surfaceHeight(x, z) + height * 0.8, z);
        dummy.scale.setScalar(0.08 + random() * 0.08);
        dummy.rotation.x = random() * 0.5;
        dummy.updateMatrix();
        flowers.current.setMatrixAt(flowerCount, dummy.matrix);
        color.set(random() > 0.28 ? '#f2e8b5' : '#c5b9d7');
        flowers.current.setColorAt(flowerCount++, color);
      }
    }
    (grass.current.material as THREE.MeshStandardMaterial).needsUpdate = true;
    grass.current.geometry.attributes.groundNormal.needsUpdate = true;
    grass.current.geometry.attributes.groundColor.needsUpdate = true;
    grass.current.count = count;
    flowers.current.count = flowerCount;
    for (const mesh of [grass.current, flowers.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [blade, material, clearing]);
  useEffect(() => () => blade.dispose(), [blade]);
  useFrame((_, delta) => {
    if (!reducedMotion && grass.current) {
      const activeMaterial = grass.current
        .material as THREE.MeshStandardMaterial;
      activeMaterial.userData.grassTime.value += Math.min(delta, 0.05);
    }
  });
  return (
    <>
      <instancedMesh
        ref={grass}
        args={[blade, material, MAX_GRASS_BLADES]}
        receiveShadow
      />
      <instancedMesh ref={flowers} args={[undefined, undefined, 1100]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
    </>
  );
}

const treePositions = [
  [-22, -10, 1.25],
  [-37, -3, 1],
  [-49, -17, 0.85],
  [38, -20, 1.25],
  [43, -28, 0.8],
  [-23, -77, 0.85],
  [-34, -87, 0.65],
  [55, -86, 0.8],
  [64, -95, 0.75],
  [-80, -115, 1],
  [-62, -130, 0.8],
  [21, -165, 0.6],
  [-12, -190, 0.85],
  [80, -175, 0.8],
];
function Trees({ reducedMotion }: { reducedMotion: boolean }) {
  const crowns = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    if (!crowns.current || !trunks.current) return;
    const random = seededRandom(719),
      dummy = new THREE.Object3D(),
      color = new THREE.Color();
    let leaf = 0;
    treePositions.forEach(([x, z, s], i) => {
      const y = groundHeight(x, z);
      dummy.position.set(x, y + 2.6 * s, z);
      dummy.rotation.set(0, 0, 0.04);
      dummy.scale.set(0.34 * s, 5.5 * s, 0.34 * s);
      dummy.updateMatrix();
      trunks.current!.setMatrixAt(i, dummy.matrix);
      for (let n = 0; n < 18; n++) {
        const a = random() * Math.PI * 2,
          r = Math.sqrt(random()) * 4.3 * s;
        dummy.position.set(
          x + Math.cos(a) * r,
          y + 6.3 * s + random() * 2.6 * s - r * 0.26,
          z + Math.sin(a) * r
        );
        dummy.rotation.set(random(), random(), random());
        dummy.scale.set(
          (1.9 + random()) * s,
          (1.4 + random()) * s,
          (1.8 + random()) * s
        );
        dummy.updateMatrix();
        crowns.current!.setMatrixAt(leaf, dummy.matrix);
        color.setHSL(
          0.19 + random() * 0.055,
          0.3 + random() * 0.15,
          0.25 + random() * 0.14
        );
        crowns.current!.setColorAt(leaf++, color);
      }
    });
    for (const mesh of [crowns.current, trunks.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, []);
  useFrame(({ clock }) => {
    if (group.current && !reducedMotion)
      group.current.rotation.z = Math.sin(clock.elapsedTime * 0.35) * 0.0012;
  });
  return (
    <group ref={group}>
      <instancedMesh
        ref={trunks}
        args={[undefined, undefined, treePositions.length]}
        castShadow
      >
        <cylinderGeometry args={[0.65, 1, 1, 7]} />
        <meshStandardMaterial color="#625943" roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={crowns}
        args={[undefined, undefined, treePositions.length * 18]}
        castShadow
        receiveShadow
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

function DriftingSeeds({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const rand = seededRandom(8);
    return new Float32Array(
      Array.from({ length: 90 }, () => [
        (rand() - 0.5) * 75,
        4 + rand() * 15,
        25 - rand() * 80,
      ]).flat()
    );
  }, []);
  useFrame((_, delta) => {
    if (ref.current && !reducedMotion)
      ref.current.rotation.y += Math.min(delta, 0.05) * 0.007;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#fff2c7"
        size={0.07}
        transparent
        opacity={0.65}
        depthWrite={false}
      />
    </points>
  );
}

function Camera({
  entered,
  reducedMotion,
  onReady,
}: {
  entered: boolean;
  reducedMotion: boolean;
  onReady: () => void;
}) {
  const { camera } = useThree();
  const time = useRef(0);
  const target = useMemo(() => new THREE.Vector3(0, 6, -65), []);
  useEffect(() => {
    camera.position.set(-4, 19, 35);
    camera.lookAt(target);
    onReady();
  }, [camera, target, onReady]);
  useFrame((_, delta) => {
    if (entered) return;
    if (!reducedMotion) time.current += Math.min(delta, 0.05);
    const t = time.current;
    camera.position.set(
      -4 + Math.sin(t * 0.045) * 3,
      19 + Math.sin(t * 0.08) * 0.25,
      35 + Math.cos(t * 0.045) * 1.2
    );
    camera.lookAt(target);
  });
  return entered ? (
    <OrbitControls
      makeDefault
      target={target}
      enablePan={false}
      minDistance={60}
      maxDistance={105}
      minPolarAngle={0.6}
      maxPolarAngle={1.35}
      rotateSpeed={0.35}
      zoomSpeed={0.5}
      enableDamping
    />
  ) : null;
}

export function MeadowEnvironment({
  reducedMotion,
  clearing,
}: {
  reducedMotion: boolean;
  clearing?: readonly [number, number, number];
}) {
  return (
    <>
      <fog attach="fog" args={['#c5d0b7', 75, 340]} />
      <hemisphereLight args={['#d8eee5', '#767643', 1.25]} />
      <directionalLight
        position={[-70, 95, -80]}
        color="#fff0c7"
        intensity={2.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-65}
        shadow-camera-right={65}
        shadow-camera-top={70}
        shadow-camera-bottom={-60}
        shadow-camera-far={250}
        shadow-normalBias={0.2}
        shadow-bias={-0.0002}
      />
      <Landscape reducedMotion={reducedMotion} />
      <Meadow reducedMotion={reducedMotion} clearing={clearing} />
      <Trees reducedMotion={reducedMotion} />
      <DriftingSeeds reducedMotion={reducedMotion} />
    </>
  );
}

export function MeadowScene({
  entered,
  reducedMotion,
  onReady,
}: {
  entered: boolean;
  reducedMotion: boolean;
  onReady: () => void;
}) {
  return (
    <>
      <MeadowEnvironment reducedMotion={reducedMotion} />
      <Camera
        entered={entered}
        reducedMotion={reducedMotion}
        onReady={onReady}
      />
    </>
  );
}
