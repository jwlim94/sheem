import { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  Group,
  ShaderMaterial,
  Vector3,
} from 'three';
import { cameraChapter, story } from './story';
const vertex = `varying vec3 vNormal;varying vec3 vWorld;varying vec3 vPosition;void main(){vNormal=normalize(mat3(modelMatrix)*normal);vWorld=(modelMatrix*vec4(position,1.)).xyz;vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragment = `varying vec3 vNormal;varying vec3 vWorld;varying vec3 vPosition;uniform vec3 uTint;void main(){vec3 N=normalize(vNormal),V=normalize(cameraPosition-vWorld);float rim=pow(1.-abs(dot(N,V)),2.4);float a=dot(N,normalize(vec3(-.6,1.,.8)));float soft=pow(max(a,0.),2.);float strip=pow(max(0.,1.-abs(dot(N,normalize(vec3(.8,.2,1.))))),18.);vec3 c=mix(vec3(.018,.027,.032),uTint*.65,soft)+uTint*rim*.28+vec3(.9,.94,1.)*strip*.75;float distanceToCamera=length(cameraPosition-vWorld);if(distanceToCamera>48.)discard;c=mix(c,vec3(.0024,.004,.006),smoothstep(27.,48.,distanceToCamera));gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
function Metal({ color }: { color: string }) {
  const uniforms = useMemo(
    () => ({ uTint: { value: new Color(color) } }),
    [color]
  );
  return (
    <shaderMaterial
      vertexShader={vertex}
      fragmentShader={fragment}
      uniforms={uniforms}
    />
  );
}
function Dust() {
  const p = useMemo(() => {
    const data = [];
    for (let i = 0; i < 1700; i++) {
      const r = (n: number) => {
        const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
        return v - Math.floor(v);
      };
      data.push(
        (r(i * 3) - 0.5) * 65,
        (r(i * 3 + 1) - 0.5) * 38,
        20 - r(i * 3 + 2) * 310
      );
    }
    return new Float32Array(data);
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[p, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#a7b7c4"
        blending={AdditiveBlending}
        fog={false}
        size={0.035}
        transparent
        opacity={0.48}
        depthWrite={false}
      />
    </points>
  );
}
function Sculpture({ index, reduced }: { index: number; reduced: boolean }) {
  const group = useRef<Group>(null);
  const world = useRef<Group>(null);
  const tint = story[index].color;
  useFrame(({ clock, camera }) => {
    if (world.current)
      world.current.visible =
        camera.position.z + index * 42 < 48 &&
        camera.position.z + index * 42 > -10;
    if (group.current && !reduced) {
      group.current.rotation.y =
        Math.sin(clock.elapsedTime * 0.12 + index) * 0.12;
      group.current.position.y =
        Math.sin(clock.elapsedTime * 0.2 + index) * 0.16;
    }
  });
  return (
    <group ref={world} position={[4.5, 0, -index * 42]}>
      <group ref={group}>
        {index === 0 && (
          <group rotation={[0.3, 0.3, -0.4]}>
            <mesh>
              <torusKnotGeometry args={[3.5, 0.63, 240, 24, 2, 3]} />
              <Metal color={tint} />
            </mesh>
            <mesh rotation={[1.2, 0.3, 0.2]}>
              <torusGeometry args={[5.7, 0.018, 8, 200]} />
              <meshBasicMaterial color={tint} transparent opacity={0.4} />
            </mesh>
          </group>
        )}
        {index === 1 && (
          <group rotation={[0.2, -0.4, 0.3]}>
            {Array.from({ length: 17 }, (_, i) => (
              <mesh
                key={i}
                position={[0, 0, (i - 8) * 0.35]}
                scale={[1, 1 + Math.sin(i * 0.6) * 0.18, 1]}
              >
                <torusGeometry
                  args={[2.5 + Math.sin(i * 0.4) * 0.7, 0.07, 8, 128]}
                />
                <Metal color={tint} />
              </mesh>
            ))}
            <mesh>
              <sphereGeometry args={[0.65, 32, 32]} />
              <meshBasicMaterial color="#ffe2b7" />
            </mesh>
          </group>
        )}
        {index === 2 && (
          <group rotation={[0.35, -0.45, 0.12]}>
            {Array.from({ length: 42 }, (_, i) => {
              const x = i % 7,
                y = Math.floor(i / 7),
                h = 0.7 + Math.sin(i * 7.13) ** 2 * 4;
              return (
                <mesh
                  key={i}
                  position={[(x - 3) * 1.15, h / 2 - 2, (y - 2.5) * 1.15]}
                >
                  <boxGeometry args={[0.75, h, 0.75]} />
                  <Metal color={tint} />
                </mesh>
              );
            })}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
              <ringGeometry args={[4.9, 4.92, 128]} />
              <meshBasicMaterial color={tint} side={2} />
            </mesh>
          </group>
        )}
        {index === 3 && (
          <group rotation={[0.06, -0.45, -0.13]}>
            {[-1, 0, 1].map((n) => (
              <group
                key={n}
                position={[n * 2.65, n * 0.55, -Math.abs(n) * 1.5]}
                rotation={[0, n * -0.22, 0]}
              >
                <mesh>
                  <boxGeometry args={[2.35, 4.4, 0.2]} />
                  <Metal color={tint} />
                </mesh>
                <mesh position={[0, 0.2, 0.12]}>
                  <planeGeometry args={[2, 3.5]} />
                  <meshBasicMaterial color="#162031" />
                </mesh>
                {Array.from({ length: 4 }, (_, i) => (
                  <mesh key={i} position={[-0.1, 1.4 - i * 0.7, 0.14]}>
                    <planeGeometry args={[1.65, 0.4]} />
                    <meshBasicMaterial
                      color={i === 0 ? tint : '#425367'}
                      transparent
                      opacity={0.65}
                    />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        )}
        {index === 4 && (
          <group rotation={[-0.8, 0, 0.2]}>
            {Array.from({ length: 22 }, (_, i) => (
              <mesh key={i} position={[0, 0, -i * 0.16]} scale={[1, 0.65, 1]}>
                <torusGeometry args={[0.7 + i * 0.22, 0.028, 6, 160]} />
                <Metal color={tint} />
              </mesh>
            ))}
            <mesh position={[0, 0, 0.5]} rotation={[0.3, 0.4, 0.1]}>
              <icosahedronGeometry args={[1.3, 0]} />
              <Metal color={tint} />
            </mesh>
          </group>
        )}
        {index === 5 && (
          <group rotation={[0.1, -0.5, 0.15]}>
            {[-1, 1].map((n) => (
              <group key={n} position={[n * 1.9, 0, 0]}>
                <mesh>
                  <torusGeometry args={[2.7, 0.25, 16, 128, Math.PI]} />
                  <Metal color={tint} />
                </mesh>
                <mesh position={[-2.7, -1.8, 0]}>
                  <boxGeometry args={[0.5, 3.6, 0.5]} />
                  <Metal color={tint} />
                </mesh>
                <mesh position={[2.7, -1.8, 0]}>
                  <boxGeometry args={[0.5, 3.6, 0.5]} />
                  <Metal color={tint} />
                </mesh>
              </group>
            ))}
            {Array.from({ length: 13 }, (_, i) => (
              <mesh
                key={i}
                position={[(i - 6) * 0.7, -0.3, 1.2]}
                rotation={[0, 0, Math.PI / 4]}
              >
                <boxGeometry args={[0.12, 0.12, 0.12]} />
                <meshBasicMaterial color="#f9d8a1" />
              </mesh>
            ))}
          </group>
        )}
        {index === 6 && (
          <group rotation={[0.2, -0.4, 0]}>
            <mesh>
              <torusGeometry args={[4.3, 0.18, 24, 180]} />
              <Metal color={tint} />
            </mesh>
            <mesh>
              <sphereGeometry args={[3.95, 64, 48]} />
              <Metal color="#171f26" />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}
export function FilmScene({
  progress,
  pointer,
  reduced,
}: {
  progress: RefObject<number>;
  pointer: RefObject<{ x: number; y: number }>;
  reduced: boolean;
}) {
  const look = useMemo(() => new Vector3(), []),
    position = useMemo(() => new Vector3(), []);
  const backdrop = useRef<ShaderMaterial>(null);
  const thread = useMemo(
    () =>
      new CatmullRomCurve3(
        Array.from(
          { length: 43 },
          (_, i) =>
            new Vector3(
              4.5 + Math.sin(i * 0.8) * 5,
              Math.cos(i * 0.5) * 3,
              8 - i * 6.4
            )
        )
      ),
    []
  );
  const nextColor = useMemo(() => new Color(), []);
  const bgUniforms = useMemo(
    () => ({ uColor: { value: new Color(story[0].color) } }),
    []
  );
  useFrame(({ camera, size }, dt) => {
    const p = reduced
      ? Math.min(6, Math.floor(progress.current + 0.18))
      : cameraChapter(progress.current);
    const chapter = Math.min(6, Math.floor(p));
    const mix = p - chapter;
    const mobile = size.width < 700;
    position.set(
      (mobile ? 3 : 0) + (reduced ? 0 : pointer.current.x * 0.4),
      reduced ? 0 : pointer.current.y * 0.25,
      22 - p * 42
    );
    camera.position.lerp(
      position,
      reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 8)
    );
    look.set(mobile ? 3 : 0, 0, camera.position.z - 24);
    camera.lookAt(look);
    if (backdrop.current)
      backdrop.current.uniforms.uColor.value
        .set(story[chapter].color)
        .lerp(nextColor.set(story[Math.min(chapter + 1, 6)].color), mix);
  });
  return (
    <>
      <color attach="background" args={['#080d12']} />
      <fog attach="fog" args={['#080d12', 32, 65]} />
      <Dust />
      <mesh>
        <tubeGeometry args={[thread, 640, 0.012, 5, false]} />
        <meshBasicMaterial color="#c5aa88" transparent opacity={0.25} />
      </mesh>
      {story.map((_, i) => (
        <Sculpture key={i} index={i} reduced={reduced} />
      ))}
      <mesh position={[0, 0, -290]}>
        <planeGeometry args={[1000, 700]} />
        <shaderMaterial
          ref={backdrop}
          uniforms={bgUniforms}
          depthWrite={false}
          vertexShader={`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
          fragmentShader={`varying vec2 vUv;uniform vec3 uColor;void main(){float g=exp(-length((vUv-.5)*vec2(2.,1.))*8.);gl_FragColor=vec4(vec3(.007,.011,.018)+uColor*g*.075,1.);\n#include <colorspace_fragment>\n}`}
        />
      </mesh>
    </>
  );
}
