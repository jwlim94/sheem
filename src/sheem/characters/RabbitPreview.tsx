import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Object3D } from 'three';
import { Link } from 'react-router-dom';
import { MeadowEnvironment } from '../title/MeadowScene';
import { surfaceHeight } from '../title/landscape';
import { RabbitModel, RABBIT_MODEL_URL } from './RabbitModel';
import type { RabbitMotion } from './RabbitModel';
import './rabbit-preview.css';
import './rabbit-walk.css';

const SPAWN_X = 10;
const SPAWN_Z = -6;
const CLEARING = [SPAWN_X, SPAWN_Z, 8] as const;
const GROUND = surfaceHeight(SPAWN_X, SPAWN_Z);
const VIEWS = {
  Portrait: [2.2, 1.7, 4.4],
  Front: [0, 1.3, 4.8],
  Side: [4.8, 1.3, 0],
  Back: [0, 1.3, -4.8],
} as const;
type View = keyof typeof VIEWS;

export class PreviewError extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="rabbit-error" role="alert">
          <p>The preview couldn’t load.</p>
          <button onClick={() => window.location.reload()}>Try again</button>
          <a href={RABBIT_MODEL_URL} download>
            Download the model
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}

function Camera({ view, meadow }: { view: View; meadow: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const narrow = useThree((state) => state.size.width < 640);
  const x = meadow ? SPAWN_X : 0;
  const y = meadow ? GROUND : 0;
  const z = meadow ? SPAWN_Z : 0;
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const offset = VIEWS[view];
    const distance = narrow ? 1.16 : 1;
    orbit.target.set(x, y + 0.87, z);
    orbit.object.position.set(
      x + offset[0] * distance,
      y + 0.87 + (offset[1] - 0.87) * distance,
      z + offset[2] * distance
    );
    orbit.update();
  }, [view, x, y, z, narrow]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      minDistance={2.2}
      maxDistance={7}
      minPolarAngle={0.2}
      maxPolarAngle={Math.PI / 2 + 0.06}
      enableDamping
      rotateSpeed={0.6}
    />
  );
}

function Scene({
  meadow,
  playing,
  motion,
  view,
}: {
  meadow: boolean;
  playing: boolean;
  motion: RabbitMotion;
  view: View;
}) {
  const x = meadow ? SPAWN_X : 0;
  const y = meadow ? GROUND : 0;
  const z = meadow ? SPAWN_Z : 0;
  const lightTarget = useMemo(() => {
    const object = new Object3D();
    object.position.set(x, y + 0.7, z);
    return object;
  }, [x, y, z]);
  return (
    <>
      {meadow ? (
        <MeadowEnvironment reducedMotion={!playing} clearing={CLEARING} />
      ) : (
        <>
          <color attach="background" args={['#e5e6d8']} />
          <fog attach="fog" args={['#e5e6d8', 12, 35]} />
          <hemisphereLight args={['#f6f2df', '#9ca387', 1.8]} />
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.003, 0]}
            receiveShadow
          >
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#c7ccb6" roughness={1} />
          </mesh>
        </>
      )}
      <group position={[x, y, z]}>
        <RabbitModel playing={playing} motion={motion} />
      </group>
      {/* A small shadow camera resolves the rabbit's contact at human scale. */}
      <primitive object={lightTarget} />
      <directionalLight
        target={lightTarget}
        position={[x - 3, y + 6, z + 4]}
        intensity={meadow ? 0.8 : 2.5}
        color="#fff0d6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={2.5}
        shadow-camera-bottom={-2.5}
        shadow-camera-near={0.1}
        shadow-camera-far={15}
        shadow-normalBias={0.015}
        shadow-bias={-0.0002}
      />
      <Camera view={view} meadow={meadow} />
    </>
  );
}

export function RabbitPreview() {
  const [meadow, setMeadow] = useState(false);
  const [motion, setMotion] = useState<RabbitMotion>('Idle');
  const [view, setView] = useState<View>('Portrait');
  const [playing, setPlaying] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setPlaying(!query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  return (
    <main className="rabbit-preview">
      <PreviewError>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [2.2, 1.7, 4.4], fov: 30, near: 0.05, far: 1300 }}
        >
          <Suspense
            fallback={
              <Html center>
                <span className="rabbit-loading" role="status">
                  Meeting your little companion…
                </span>
              </Html>
            }
          >
            <Scene
              meadow={meadow}
              playing={playing}
              motion={motion}
              view={view}
            />
          </Suspense>
        </Canvas>
      </PreviewError>
      <header className="rabbit-heading">
        <Link to="/" className="rabbit-brand">
          sheem.
        </Link>
        <p>A little companion</p>
        <h1>The meadow rabbit</h1>
      </header>
      <aside className="rabbit-materials" aria-label="Character palette">
        <span style={{ background: '#e2caaa' }} title="Oatmeal" />
        <span style={{ background: '#8c9b72' }} title="Sage" />
        <span style={{ background: '#cb926c' }} title="Apricot" />
      </aside>
      <footer className="rabbit-toolbar">
        <p>
          {motion !== 'Idle'
            ? `${motion === 'Run' ? 'Running' : 'Walking'} in place · Drag to look around`
            : 'Drag to look around · Scroll to zoom'}
        </p>
        <div className="rabbit-controls">
          <Link className="rabbit-walk-link" to="/playground/rabbit/walk">
            Walk in the meadow
          </Link>
          <div role="group" aria-label="View direction">
            {(Object.keys(VIEWS) as View[]).map((name) => (
              <button
                key={name}
                aria-pressed={view === name}
                onClick={() => setView(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Background">
            <button aria-pressed={meadow} onClick={() => setMeadow(true)}>
              Meadow
            </button>
            <button aria-pressed={!meadow} onClick={() => setMeadow(false)}>
              Studio
            </button>
          </div>
          <div role="group" aria-label="Animation">
            {(['Idle', 'Walk', 'Run'] as const).map((name) => (
              <button
                key={name}
                aria-pressed={motion === name}
                onClick={() => setMotion(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <button aria-pressed={playing} onClick={() => setPlaying(!playing)}>
            {playing ? 'Pause' : 'Play'}
          </button>
        </div>
        <a className="rabbit-download" href={RABBIT_MODEL_URL} download>
          Download 3D model
        </a>
      </footer>
    </main>
  );
}
