import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls, useAnimations, useGLTF } from '@react-three/drei';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Mesh, SkinnedMesh } from 'three';
import type { Group } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { PreviewError } from '../../sheem/characters/RabbitPreview';
import './student-preview.css';

const MODELS = {
  Student: '/models/happy-hustle/happy-student-rigged.glb',
  Refined: '/models/happy-hustle/happy-hustle-refined.glb',
  Original: '/models/happy-hustle/happy-hustle-original.glb',
};
type Variant = keyof typeof MODELS;
const VIEWS = {
  Portrait: [3.3, 2.8, 6.5],
  Front: [0, 1.65, 7],
  Side: [7, 1.65, 0],
  Back: [0, 1.65, -7],
} as const;
type View = keyof typeof VIEWS;
type Motion = 'Idle' | 'Walk' | 'Wave';

function GroundingShadow() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0.06]}>
      <planeGeometry args={[1.45, 0.95]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        vertexShader={`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`varying vec2 vUv; void main() { vec2 p = (vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - dot(p, p)), 3.0) * 0.22; gl_FragColor = vec4(0.18, 0.23, 0.18, a); }`}
      />
    </mesh>
  );
}

function AnimatedStudent({
  motion,
  playing,
}: {
  motion: Motion;
  playing: boolean;
}) {
  const gltf = useGLTF(MODELS.Student);
  const root = useRef<Group>(null);
  const scene = useMemo(() => {
    const copy = clone(gltf.scene);
    copy.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.frustumCulled = false;
      }
    });
    return copy;
  }, [gltf.scene]);
  const { actions, mixer } = useAnimations(gltf.animations, root);
  useEffect(() => {
    const action = actions[motion];
    action?.reset().fadeIn(0.3).play();
    return () => {
      action?.fadeOut(0.3);
    };
  }, [actions, motion]);
  useEffect(() => {
    // Three's mixer owns mutable animation time outside React rendering.
    // eslint-disable-next-line react-hooks/immutability
    mixer.timeScale = playing ? 1 : 0;
  }, [mixer, playing]);
  useEffect(
    () => () => {
      const skeletons = new Set<SkinnedMesh['skeleton']>();
      scene.traverse((object) => {
        if (object instanceof SkinnedMesh) skeletons.add(object.skeleton);
      });
      skeletons.forEach((skeleton) => skeleton.dispose());
    },
    [scene]
  );
  return (
    <group ref={root} dispose={null}>
      <primitive object={scene} />
    </group>
  );
}
function Student({ variant }: { variant: Variant }) {
  const gltf = useGLTF(MODELS[variant]);
  const scene = useMemo(() => {
    const copy = clone(gltf.scene);
    copy.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return copy;
  }, [gltf.scene]);
  return <primitive object={scene} dispose={null} />;
}

function Camera({ view }: { view: View }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const narrow = useThree((state) => state.size.width < 700);
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const targetHeight = narrow ? 0.95 : 1.25;
    orbit.target.set(0, targetHeight, 0);
    const [x, y, z] = VIEWS[view];
    const distance = narrow ? 1.28 : 1;
    orbit.object.position.set(
      x * distance,
      targetHeight + (y - 1.25) * distance,
      z * distance
    );
    orbit.update();
  }, [view, narrow]);
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
  const [variant, setVariant] = useState<Variant>('Student');
  const [motion, setMotion] = useState<Motion>('Idle');
  const [playing, setPlaying] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [view, setView] = useState<View>('Portrait');
  useEffect(() => {
    const old = document.title;
    document.title = 'Happy Hustle Boy — Character study';
    return () => {
      document.title = old;
    };
  }, []);
  return (
    <main className="student-preview">
      <header className="student-heading">
        <a href="/portfolio/4">← The story</a>
        <span>CHARACTER STUDY · 03</span>
        <h1>Ready for the day.</h1>
        <p>
          A curious mind. A backpack full of ideas,
          <br />
          and a whole world ahead.
        </p>
      </header>
      <section
        className="student-stage"
        aria-label="Interactive 3D student character"
      >
        <PreviewError modelUrl={MODELS[variant]}>
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
            <Suspense
              fallback={
                <Html center>
                  <span className="student-loading">Loading character…</span>
                </Html>
              }
            >
              {variant === 'Student' ? (
                <AnimatedStudent motion={motion} playing={playing} />
              ) : (
                <Student variant={variant} />
              )}
              <GroundingShadow />
            </Suspense>
            <Camera view={view} />
          </Canvas>
        </PreviewError>
      </section>
      <aside className="student-caption">
        <span>HAPPY HUSTLE BOY / CHARACTER STUDY</span>
        <p>
          Small steps.
          <br />
          Big questions.
        </p>
      </aside>
      <footer className="student-controls">
        <div
          className="student-buttons"
          role="group"
          aria-label="Model version"
        >
          {(['Student', 'Refined', 'Original'] as const).map((item) => (
            <button
              key={item}
              aria-pressed={variant === item}
              onClick={() => setVariant(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {variant === 'Student' && (
          <div className="student-buttons" role="group" aria-label="Animation">
            {(['Idle', 'Walk', 'Wave'] as const).map((item) => (
              <button
                key={item}
                aria-pressed={motion === item}
                onClick={() => {
                  setMotion(item);
                  setPlaying(true);
                }}
              >
                {item}
              </button>
            ))}
            <button
              aria-pressed={!playing}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
          </div>
        )}
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
          <a href={MODELS[variant]} download>
            Download GLB ↗
          </a>
        </p>
        <p className="student-credit">
          “Happy Hustle Boy” by{' '}
          <a
            href="https://sketchfab.com/3d-models/happy-hustle-boy-bdc75c61891d42058fc414d0560f0a48"
            target="_blank"
            rel="noreferrer"
          >
            Golden Bean
          </a>{' '}
          ·{' '}
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
            target="_blank"
            rel="noreferrer"
          >
            CC BY-NC-SA 4.0
          </a>
          <br />
          {variant === 'Student'
            ? 'Adapted student: rebuilt body, humanoid rig & animation. Original face and backpack retained.'
            : 'Original running pose; Refined adds a frame tint and laptop badge.'}
        </p>
      </footer>
    </main>
  );
}
