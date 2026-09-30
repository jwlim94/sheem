import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Group, Object3D, Quaternion, Vector3 } from 'three';
import { Link, useSearchParams } from 'react-router-dom';
import { MeadowEnvironment } from '../title/MeadowScene';
import { surfaceHeight } from '../title/landscape';
import {
  RabbitModel,
  RABBIT_WALK_SPEED,
  RABBIT_RUN_GAIT_SPEED,
} from './RabbitModel';
import type { RabbitDrive } from './RabbitModel';
import {
  createRabbitMovement,
  RABBIT_CLEARING,
  RABBIT_SPAWN,
  RABBIT_SPEED,
  stepRabbit,
} from './rabbitMovement';
import {
  DuckModel,
  DUCK_MODEL_URL,
  DUCK_WALK_SPEED,
  DUCK_RUN_SPEED,
} from './DuckModel';
import { PreviewError } from './RabbitPreview';
import './rabbit-preview.css';
import './rabbit-walk.css';

type Input = {
  keys: Set<string>;
  touch: Set<string>;
  reset: number;
  stopped: number;
};
const CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowLeft',
  'ArrowDown',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
]);
const START_Y = surfaceHeight(...RABBIT_SPAWN);

function WalkingScene({
  input,
  reducedMotion,
  duck,
}: {
  input: RefObject<Input>;
  reducedMotion: boolean;
  duck: boolean;
}) {
  const actor = useRef<Group>(null);
  const orbit = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const drive = useRef<RabbitDrive>({ motion: 'Idle', timeScale: 1, reset: 0 });
  const movement = useRef(createRabbitMovement());
  const consumed = useRef({ reset: 0, stopped: 0 });
  const scratch = useMemo(
    () => ({
      target: new Vector3(),
      delta: new Vector3(),
      normal: new Vector3(),
      up: new Vector3(0, 1, 0),
      slope: new Quaternion(),
      yaw: new Quaternion(),
      rotation: new Quaternion(),
      lightTarget: new Object3D(),
    }),
    []
  );
  const light = useRef<Object3D>(null);

  useEffect(() => {
    camera.position.set(
      RABBIT_SPAWN[0] + 2.2,
      START_Y + 2.5,
      RABBIT_SPAWN[1] + 4.5
    );
    orbit.current?.target.set(RABBIT_SPAWN[0], START_Y + 0.85, RABBIT_SPAWN[1]);
    orbit.current?.update();
  }, [camera]);

  useFrame((_, delta) => {
    const body = actor.current,
      controls = orbit.current;
    if (!body || !controls) return;
    const dt = Math.min(delta, 0.05);
    const state = movement.current;
    if (input.current.reset !== consumed.current.reset) {
      const fresh = createRabbitMovement();
      state.position.copy(fresh.position);
      state.velocity.set(0, 0, 0);
      state.stopping = false;
      state.yaw = fresh.yaw;
      state.speed = 0;
      drive.current.reset = (drive.current.reset ?? 0) + 1;
      consumed.current.reset = input.current.reset;
    }
    if (input.current.stopped !== consumed.current.stopped) {
      state.velocity.set(0, 0, 0);
      state.stopping = false;
      state.speed = 0;
      drive.current.reset = (drive.current.reset ?? 0) + 1;
      consumed.current.stopped = input.current.stopped;
    }
    const held = (a: string, b: string) =>
      input.current.keys.has(a) ||
      input.current.keys.has(b) ||
      input.current.touch.has(a);
    const horizontal =
      Number(held('KeyD', 'ArrowRight')) - Number(held('KeyA', 'ArrowLeft'));
    const forward =
      Number(held('KeyW', 'ArrowUp')) - Number(held('KeyS', 'ArrowDown'));
    const azimuth = Math.atan2(
      camera.position.x - controls.target.x,
      camera.position.z - controls.target.z
    );
    const sprint = held('ShiftLeft', 'ShiftRight');
    stepRabbit(state, horizontal, forward, azimuth, dt, sprint);
    body.position.copy(state.position);
    body.position.y += 0.008;
    // Align the whole avatar with the local ground plane; individual-foot IK is later work.
    const x = state.position.x,
      z = state.position.z,
      e = 0.25;
    scratch.normal
      .set(
        surfaceHeight(x - e, z) - surfaceHeight(x + e, z),
        2 * e,
        surfaceHeight(x, z - e) - surfaceHeight(x, z + e)
      )
      .normalize();
    scratch.slope.setFromUnitVectors(scratch.up, scratch.normal);
    scratch.yaw.setFromAxisAngle(scratch.up, state.yaw);
    scratch.rotation.copy(scratch.slope).multiply(scratch.yaw);
    body.quaternion.slerp(scratch.rotation, 1 - Math.exp(-12 * dt));
    const running =
      state.speed >
      RABBIT_SPEED + (drive.current.motion === 'Run' ? 0.03 : 0.12);
    drive.current.motion =
      (!horizontal && !forward) || state.speed <= 0.008
        ? 'Idle'
        : running
          ? 'Run'
          : 'Walk';
    drive.current.timeScale = Math.max(
      0.05,
      state.speed /
        (duck
          ? running
            ? DUCK_RUN_SPEED
            : DUCK_WALK_SPEED
          : running
            ? RABBIT_RUN_GAIT_SPEED
            : RABBIT_WALK_SPEED)
    );
    scratch.target.copy(state.position);
    scratch.target.addScaledVector(scratch.up, 0.85);
    scratch.delta
      .copy(scratch.target)
      .sub(controls.target)
      .multiplyScalar(1 - Math.exp(-8 * dt));
    controls.target.add(scratch.delta);
    camera.position.add(scratch.delta);
    camera.position.setY(
      Math.max(
        camera.position.y,
        surfaceHeight(camera.position.x, camera.position.z) + 0.4
      )
    );
    controls.update();
    scratch.lightTarget.position.copy(state.position);
    scratch.lightTarget.position.addScaledVector(scratch.up, 0.7);
    light.current?.position.set(x - 3, state.position.y + 6, z + 4);
  }, -1);

  return (
    <>
      <MeadowEnvironment
        reducedMotion={reducedMotion}
        clearing={RABBIT_CLEARING}
      />
      <group
        ref={actor}
        name={duck ? 'DuckPlayer' : 'RabbitPlayer'}
        position={[RABBIT_SPAWN[0], START_Y + 0.008, RABBIT_SPAWN[1]]}
      >
        {duck ? <DuckModel drive={drive} /> : <RabbitModel drive={drive} />}
      </group>
      <primitive object={scratch.lightTarget} />
      <directionalLight
        ref={light}
        target={scratch.lightTarget}
        intensity={1.4}
        color="#fff0d6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
        shadow-camera-near={0.1}
        shadow-camera-far={15}
        shadow-normalBias={0.008}
        shadow-bias={-0.0002}
      />
      <OrbitControls
        ref={orbit}
        makeDefault
        enablePan={false}
        minDistance={3}
        maxDistance={7}
        minPolarAngle={0.4}
        maxPolarAngle={Math.PI / 2 - 0.12}
        enableDamping
        rotateSpeed={0.6}
      />
    </>
  );
}

export function RabbitWalk() {
  const [params] = useSearchParams();
  const duck = params.get('character') === 'duck';
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  const input = useRef<Input>({
    keys: new Set(),
    touch: new Set(),
    reset: 0,
    stopped: 0,
  });
  useEffect(() => {
    const controls = input.current;
    const clear = () => {
      controls.keys.clear();
      controls.touch.clear();
      controls.stopped += 1;
    };
    const down = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            'input,textarea,select,[contenteditable="true"]'
          ))
      )
        return;
      if (CODES.has(event.code)) {
        if (!event.code.startsWith('Shift')) event.preventDefault();
        controls.keys.add(event.code);
      }
    };
    const up = (event: KeyboardEvent) => controls.keys.delete(event.code);
    const visibility = () => {
      if (document.hidden) clear();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clear();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  return (
    <main className="rabbit-preview rabbit-walk">
      <PreviewError modelUrl={duck ? DUCK_MODEL_URL : undefined}>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ fov: 40, near: 0.05, far: 1300 }}
        >
          <Suspense
            fallback={
              <Html center>
                <span className="rabbit-loading" role="status">
                  Getting the meadow ready…
                </span>
              </Html>
            }
          >
            <WalkingScene
              input={input}
              reducedMotion={reducedMotion}
              duck={duck}
            />
          </Suspense>
        </Canvas>
      </PreviewError>
      <header className="rabbit-heading">
        <Link to="/" className="rabbit-brand">
          sheem.
        </Link>
        <p>A little walk</p>
        <h1>Explore the clearing</h1>
      </header>
      <footer className="rabbit-toolbar">
        <p>WASD / Arrows · Hold Shift to run · Drag to look around</p>
        <div className="rabbit-controls">
          <Link
            className="rabbit-walk-link"
            to={`/playground/rabbit${duck ? '?character=duck' : ''}`}
          >
            Character preview
          </Link>
          <button
            onClick={() => {
              input.current.keys.clear();
              input.current.touch.clear();
              input.current.reset += 1;
            }}
          >
            Back to start
          </button>
        </div>
      </footer>
      <div className="rabbit-dpad" role="group" aria-label="Walk direction">
        {(
          [
            ['KeyW', '↑', 'Forward'],
            ['KeyA', '←', 'Left'],
            ['KeyS', '↓', 'Backward'],
            ['KeyD', '→', 'Right'],
            ['ShiftLeft', 'Run', 'Hold to run'],
          ] as const
        ).map(([code, label, name]) => (
          <button
            key={code}
            className={code}
            aria-label={name}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              input.current.touch.add(code);
            }}
            onPointerUp={() => input.current.touch.delete(code)}
            onPointerCancel={() => input.current.touch.delete(code)}
            onLostPointerCapture={() => input.current.touch.delete(code)}
          >
            {label}
          </button>
        ))}
      </div>
    </main>
  );
}
