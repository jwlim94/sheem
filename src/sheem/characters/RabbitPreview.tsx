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
import { Link, useSearchParams } from 'react-router-dom';
import { RabbitModel, RABBIT_MODEL_URL } from './RabbitModel';
import { DuckModel, DUCK_MODEL_URL } from './DuckModel';
import type { RabbitMotion } from './RabbitModel';
import './rabbit-preview.css';
import './rabbit-walk.css';

const VIEWS = {
  Portrait: [2.2, 1.7, 4.4],
  Front: [0, 1.3, 4.8],
  Side: [4.8, 1.3, 0],
  Back: [0, 1.3, -4.8],
} as const;
type View = keyof typeof VIEWS;
type Character = 'Rabbit' | 'Duck';

export class PreviewError extends Component<
  { children: ReactNode; modelUrl?: string },
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
          <a href={this.props.modelUrl ?? RABBIT_MODEL_URL} download>
            Download the model
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}

function Camera({ view }: { view: View }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const narrow = useThree((state) => state.size.width < 640);
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const offset = VIEWS[view];
    const distance = narrow ? 1.16 : 1;
    orbit.target.set(0, 0.87, 0);
    orbit.object.position.set(
      offset[0] * distance,
      0.87 + (offset[1] - 0.87) * distance,
      offset[2] * distance
    );
    orbit.update();
  }, [view, narrow]);
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
  character,
  playing,
  motion,
  view,
}: {
  playing: boolean;
  motion: RabbitMotion;
  view: View;
  character: Character;
}) {
  const lightTarget = useMemo(() => {
    const object = new Object3D();
    object.position.set(0, 0.7, 0);
    return object;
  }, []);
  return (
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
      <group>
        {character === 'Rabbit' ? (
          <RabbitModel playing={playing} motion={motion} />
        ) : (
          <DuckModel playing={playing} motion={motion} />
        )}
      </group>
      {/* A small shadow camera resolves the rabbit's contact at human scale. */}
      <primitive object={lightTarget} />
      <directionalLight
        target={lightTarget}
        position={[-3, 6, 4]}
        intensity={2.5}
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
      <Camera view={view} />
    </>
  );
}

export function RabbitPreview() {
  const [params, setParams] = useSearchParams();
  const character: Character =
    params.get('character') === 'duck' ? 'Duck' : 'Rabbit';
  const setCharacter = (name: Character) =>
    setParams(name === 'Duck' ? { character: 'duck' } : {}, { replace: true });
  const modelUrl = character === 'Rabbit' ? RABBIT_MODEL_URL : DUCK_MODEL_URL;
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
      <PreviewError modelUrl={modelUrl}>
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
              character={character}
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
        <h1>{character === 'Rabbit' ? 'The meadow rabbit' : 'Little duck'}</h1>
      </header>
      <aside className="rabbit-materials" aria-label="Character palette">
        {(character === 'Rabbit'
          ? [
              ['#e2caaa', 'Oatmeal'],
              ['#8c9b72', 'Sage'],
              ['#cb926c', 'Apricot'],
            ]
          : [
              ['#f0eee1', 'Cream'],
              ['#47b7c5', 'Turquoise'],
              ['#dfb849', 'Gold'],
            ]
        ).map(([color, name]) => (
          <span key={name} style={{ background: color }} title={name} />
        ))}
      </aside>
      <footer className="rabbit-toolbar">
        <p>
          {motion !== 'Idle'
            ? `${motion === 'Run' ? 'Running' : 'Walking'} in place · Drag to look around`
            : 'Drag to look around · Scroll to zoom'}
        </p>
        <div className="rabbit-controls">
          <div role="group" aria-label="Character">
            {(['Rabbit', 'Duck'] as const).map((name) => (
              <button
                key={name}
                aria-pressed={character === name}
                onClick={() => setCharacter(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <Link
            className="rabbit-walk-link"
            to={`/playground/rabbit/walk${character === 'Duck' ? '?character=duck' : ''}`}
          >
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
          <>
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
          </>
        </div>
        <a className="rabbit-download" href={modelUrl} download>
          Download 3D model
        </a>
        {character === 'Duck' && (
          <p className="duck-credit">
            Animated adaptation ·{' '}
            <a
              href="https://sketchfab.com/3d-models/little-duck-cf819cf6c3e5481c95d05cbc48c0437f"
              target="_blank"
              rel="noreferrer"
            >
              Little duck by dannzjs
            </a>{' '}
            · CC Attribution
          </p>
        )}
      </footer>
    </main>
  );
}
