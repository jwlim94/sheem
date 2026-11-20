import { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  AdditiveBlending,
  BackSide,
  Color,
  Group,
  MathUtils,
  ShaderMaterial,
  Vector3,
} from 'three';
import { experiences } from '../experience';

export type FlightInput = { x: number; y: number; zoom: number };
const signals = [
  { position: [1.8, 4.6, -5], color: '#eac798' },
  { position: [11.8, 5.2, -9], color: '#a8cce7' },
  { position: [15, -2.1, -8], color: '#c4afe6' },
  { position: [6.6, -5.2, -3], color: '#e5b193' },
  { position: [-0.7, -1.7, -4], color: '#a8c9d4' },
] as const;
const noise = `
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*noise3(p);p=p*2.03+vec3(9.7,3.2,6.1);a*=.5;}return s;}
`;
const planeVertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const nebulaFragment = `varying vec2 vUv;uniform float uTime;${noise}
void main(){vec2 p=(vUv-.5)*vec2(2.1,1.);vec3 q=vec3(p*4.,.13+uTime*.004);
float n=fbm(q+fbm(q*1.7)*1.8);float stream=exp(-pow((p.y+p.x*.33+.01+(n-.5)*.55)*3.5,2.));
float dust=pow(n,2.3)*stream;float veins=fbm(q*3.1+2.7);
vec3 color=vec3(.007,.011,.026);
color+=vec3(.12,.105,.27)*dust*.65;
color+=vec3(.25,.105,.065)*pow(dust,1.2)*smoothstep(-.1,.9,p.x)*1.8;
color+=vec3(.028,.13,.21)*pow(veins,2.)*stream*.6;
color*=.75+.25*(1.-smoothstep(.05,.85,length(p)));gl_FragColor=vec4(color,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
const planetVertex = `varying vec3 vNormal;varying vec3 vPosition;varying vec3 vWorld;void main(){vPosition=position;vNormal=normalize(mat3(modelMatrix)*normal);vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const planetFragment = `varying vec3 vNormal;varying vec3 vPosition;varying vec3 vWorld;uniform float uTime;${noise}
void main(){vec3 N=normalize(vNormal),V=normalize(cameraPosition-vWorld),L=normalize(vec3(-.9,.45,.15));
float diffuse=max(dot(N,L),0.);float edge=pow(1.-max(dot(N,V),0.),3.5);
vec3 p=vPosition*.7;float field=fbm(p+vec3(0,uTime*.008,0));float bands=fbm(vec3(p.x*.9,p.y*3.+field*2.,p.z));
vec3 surface=mix(vec3(.021,.028,.045),vec3(.24,.16,.115),smoothstep(.28,.8,bands));
vec3 color=surface*(.045+pow(diffuse,1.7)*.85);
color+=vec3(.78,.43,.19)*edge*pow(max(dot(N,L)*.5+.5,0.),3.)*.8;
color+=vec3(.04,.10,.18)*edge*.13;gl_FragColor=vec4(color,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
const atmosphereFragment = `varying vec3 vNormal;varying vec3 vWorld;void main(){vec3 N=normalize(vNormal),V=normalize(cameraPosition-vWorld);float rim=pow(1.-abs(dot(N,V)),5.);float light=max(dot(N,normalize(vec3(-.9,.45,.15))),0.);gl_FragColor=vec4(mix(vec3(.12,.28,.5),vec3(.95,.59,.31),light),rim*(.08+light*.7));}`;
const starVertex = `attribute float aSize;attribute vec3 aColor;varying vec3 vColor;uniform float uTime;uniform float uPixel;void main(){vColor=aColor;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*(220./-mv.z),.65,3.2)*uPixel;gl_Position=projectionMatrix*mv;}`;
const starFragment = `varying vec3 vColor;void main(){float r=length(gl_PointCoord-.5);float a=exp(-r*r*18.);gl_FragColor=vec4(vColor,a);}`;
function Starfield() {
  const data = useMemo(() => {
    let seed = 4721;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const positions = new Float32Array(7200 * 3),
      colors = new Float32Array(7200 * 3),
      sizes = new Float32Array(7200);
    for (let i = 0; i < 7200; i++) {
      positions.set(
        [(random() - 0.5) * 260, (random() - 0.5) * 150, -random() * 180 - 8],
        i * 3
      );
      const tint = new Color().setHSL(
        0.08 + random() * 0.58,
        0.12 + random() * 0.25,
        0.42 + random() * 0.48
      );
      colors.set([tint.r, tint.g, tint.b], i * 3);
      sizes[i] = 0.3 + Math.pow(random(), 5) * 1.1;
    }
    return { positions, colors, sizes };
  }, []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixel: { value: Math.min(window.devicePixelRatio, 1.5) },
    }),
    []
  );
  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[data.positions, 3]}
        />
        <bufferAttribute attach="attributes-aColor" args={[data.colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[data.sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={starVertex}
        fragmentShader={starFragment}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
function World({
  selected,
  onSelect,
  reduced,
}: {
  selected: number | null;
  onSelect: (index: number) => void;
  reduced: boolean;
}) {
  const planet = useRef<Group>(null),
    nebula = useRef<ShaderMaterial>(null),
    surface = useRef<ShaderMaterial>(null);
  const nebulaUniforms = useMemo(() => ({ uTime: { value: 0 } }), []),
    surfaceUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((_, dt) => {
    if (reduced) return;
    if (nebula.current)
      nebula.current.uniforms.uTime.value += Math.min(dt, 0.05);
    if (surface.current)
      surface.current.uniforms.uTime.value += Math.min(dt, 0.05);
    if (planet.current) planet.current.rotation.y += Math.min(dt, 0.05) * 0.014;
  });
  return (
    <>
      <mesh position={[0, 0, -140]}>
        <planeGeometry args={[450, 270]} />
        <shaderMaterial
          ref={nebula}
          uniforms={nebulaUniforms}
          vertexShader={planeVertex}
          fragmentShader={nebulaFragment}
          depthWrite={false}
        />
      </mesh>
      <Starfield />
      <group ref={planet} position={[8, 0.1, -14]} rotation={[0.15, 0, -0.25]}>
        <mesh>
          <sphereGeometry args={[5.5, 96, 64]} />
          <shaderMaterial
            ref={surface}
            uniforms={surfaceUniforms}
            vertexShader={planetVertex}
            fragmentShader={planetFragment}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[5.59, 64, 48]} />
          <shaderMaterial
            vertexShader={planetVertex}
            fragmentShader={atmosphereFragment}
            transparent
            blending={AdditiveBlending}
            side={BackSide}
            depthWrite={false}
          />
        </mesh>
      </group>
      <mesh position={[8, 0.1, -14]} rotation={[1.08, 0.2, 0.25]}>
        <torusGeometry args={[9.5, 0.009, 3, 240]} />
        <meshBasicMaterial color="#9a8a79" transparent opacity={0.16} />
      </mesh>
      <mesh position={[8, 0.1, -14]} rotation={[0.82, 0.3, -0.13]}>
        <torusGeometry args={[12.2, 0.007, 3, 240]} />
        <meshBasicMaterial color="#799ca6" transparent opacity={0.1} />
      </mesh>
      {signals.map((signal, index) => (
        <group key={index} position={[...signal.position]}>
          <mesh>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshBasicMaterial color={signal.color} />
          </mesh>
          <Html center zIndexRange={[12, 1]}>
            <button
              className={`universe-signal ${selected === index ? 'is-active' : ''}`}
              onClick={() => onSelect(index)}
              aria-label={`Explore ${experiences[index].company}`}
              aria-pressed={selected === index}
              style={{ '--signal-color': signal.color } as React.CSSProperties}
            >
              <span className="signal-reticle">
                <i />
              </span>
              <span className="signal-copy">
                <small>0{index + 1} / EXPERIENCE</small>
                <strong>
                  {experiences[index].company.replace(' Digital Media', '')}
                </strong>
              </span>
            </button>
          </Html>
        </group>
      ))}
    </>
  );
}
export function UniverseScene({
  selected,
  onSelect,
  input,
  reduced,
  onReady,
}: {
  selected: number | null;
  onSelect: (i: number) => void;
  input: RefObject<FlightInput>;
  reduced: boolean;
  onReady: () => void;
}) {
  const flight = useRef({ elapsed: 0, ready: false }),
    target = useMemo(() => new Vector3(), []),
    destination = useMemo(() => new Vector3(), []),
    look = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }, dt) => {
    const s = flight.current;
    s.elapsed += Math.min(dt, 0.05);
    if (!s.ready) {
      s.ready = true;
      onReady();
    }
    const intro = reduced ? 1 : MathUtils.smoothstep(s.elapsed, 0, 3.3);
    if (selected === null) {
      target.set(size.width < 700 ? 6 : 0, 0, 0);
      destination.set(
        target.x + (reduced ? 0 : input.current.x * 1.6),
        reduced ? 0 : input.current.y * 0.9,
        43 - 17 * intro + input.current.zoom * 5
      );
    } else {
      const p = signals[selected].position;
      target.set(p[0] - (size.width < 700 ? 0 : 5.4), p[1], p[2]);
      destination.set(
        target.x + (reduced ? 0 : input.current.x * 0.5),
        target.y + (reduced ? 0 : input.current.y * 0.3),
        target.z + 23
      );
    }
    const alpha = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 2.2);
    camera.position.lerp(destination, alpha);
    look.lerp(target, alpha);
    camera.lookAt(look);
  });
  return <World selected={selected} onSelect={onSelect} reduced={reduced} />;
}
