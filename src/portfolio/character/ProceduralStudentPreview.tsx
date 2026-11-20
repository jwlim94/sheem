import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls, useAnimations, useGLTF } from '@react-three/drei';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Mesh, SkinnedMesh } from 'three';
import type { Group } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { PreviewError } from '../../sheem/characters/RabbitPreview';
import './student-preview.css';

const MODEL = '/models/boy/jongwoo-student-v1.glb';
const VIEWS = {
  Portrait: [3.3, 2.8, 6.5],
  Front: [0, 1.65, 7],
  Side: [7, 1.65, 0],
  Back: [0, 1.65, -7],
} as const;
type View = keyof typeof VIEWS;
type Motion = 'Idle' | 'Walk';

function Student({ motion, playing }: { motion: Motion; playing: boolean }) {
  const gltf = useGLTF(MODEL);
  const root = useRef<Group>(null);
  const scene = useMemo(() => {
    const copy = clone(gltf.scene);
    copy.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        // Animated bounds vary with the pose; this is a single studio subject.
        object.frustumCulled = false;
      }
    });
    return copy;
  }, [gltf.scene]);
  const { actions, mixer } = useAnimations(gltf.animations, root);
  useEffect(() => {
    const action = actions[motion];
    action?.reset().fadeIn(0.35).play();
    return () => {
      action?.fadeOut(0.35);
    };
  }, [actions, motion]);
  useEffect(() => {
    // Three's mixer owns mutable animation time outside React rendering.
    // eslint-disable-next-line react-hooks/immutability
    mixer.timeScale = playing ? 1 : 0;
  }, [mixer, playing]);
  useEffect(
    () => () => {
      scene.traverse((object) => {
        if (object instanceof SkinnedMesh) object.skeleton.dispose();
      });
    },
    [scene]
  );
  return (
    <group ref={root} dispose={null}>
      <primitive object={scene} />
    </group>
  );
}

function Camera({ view }: { view: View }) {
  const controls = useRef<OrbitControlsImpl>(null);
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    orbit.target.set(0, 1.25, 0);
    const [x, y, z] = VIEWS[view];
    orbit.object.position.set(x, y, z);
    orbit.update();
  }, [view]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      minDistance={3.6}
      maxDistance={10}
      maxPolarAngle={Math.PI / 2}
      enableDamping
      rotateSpeed={0.65}
    />
  );
}

export default function StudentPreview() {
  const [motion, setMotion] = useState<Motion>('Idle');
  const [playing, setPlaying] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [view, setView] = useState<View>('Portrait');
  useEffect(() => {
    const old = document.title;
    document.title = 'Jongwoo — Character study';
    return () => {
      document.title = old;
    };
  }, []);
  return (
    <main className="student-preview">
      <header className="student-heading">
        <a href="/portfolio/4">← The story</a>
        <span>CHARACTER STUDY · 01</span>
        <h1>A curious beginning.</h1>
        <p>
          Meet Jongwoo. A notebook full of ideas,
          <br />
          and a whole world to figure out.
        </p>
      </header>
      <section
        className="student-stage"
        aria-label="Interactive 3D student character"
      >
        <PreviewError modelUrl={MODEL}>
          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{ position: [3.3, 2.8, 6.5], fov: 30 }}
          >
            <color attach="background" args={['#e4e7db']} />
            <fog attach="fog" args={['#e4e7db', 12, 28]} />
            <hemisphereLight args={['#fffaec', '#7d8e77', 2]} />
            <directionalLight
              position={[-3, 6, 4]}
              intensity={3.2}
              color="#fff0d9"
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-3}
              shadow-camera-right={3}
              shadow-camera-top={4}
              shadow-camera-bottom={-2}
              shadow-normalBias={0.025}
            />
            <directionalLight
              position={[3, 3, -3]}
              intensity={2}
              color="#e3eeff"
            />
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
              position={[0, 0.015, 0]}
            >
              <planeGeometry args={[200, 200]} />
              <meshStandardMaterial color="#e4e7db" roughness={1} />
            </mesh>
            <Suspense
              fallback={
                <Html center>
                  <span className="student-loading">Meeting Jongwoo…</span>
                </Html>
              }
            >
              <Student motion={motion} playing={playing} />
            </Suspense>
            <Camera view={view} />
          </Canvas>
        </PreviewError>
      </section>
      <aside className="student-caption">
        <span>JONGWOO / STUDENT</span>
        <p>
          Small steps.
          <br />
          Big questions.
        </p>
      </aside>
      <footer className="student-controls">
        <div className="student-buttons" role="group" aria-label="Animation">
          {(['Idle', 'Walk'] as const).map((item) => (
            <button
              key={item}
              aria-pressed={motion === item}
              onClick={() => setMotion(item)}
            >
              {item === 'Idle' ? 'Breathe' : 'Walk'}
            </button>
          ))}
          <button aria-pressed={!playing} onClick={() => setPlaying(!playing)}>
            {playing ? 'Pause' : 'Play'}
          </button>
        </div>
        <div className="student-buttons" role="group" aria-label="Camera view">
          {(Object.keys(VIEWS) as View[]).map((item) => (
            <button
              key={item}
              aria-pressed={view === item}
              onClick={() => setView(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <p>
          Drag to look around · Scroll to zoom{' '}
          <a href={MODEL} download>
            Download GLB ↗
          </a>
        </p>
      </footer>
    </main>
  );
}
