import { BroadleafTreeStudy } from '../wind/BroadleafTreeStudy';
import { PineTreeStudy } from '../wind/PineTreeStudy';
import type { GrassContactBody } from '../wind/grassContact';
import { WindVegetation } from '../wind/WindVegetation';
import {
  WIND_TEST_GROUND,
  WIND_TEST_SPOTS,
  WIND_TEST_CONFIG,
} from '../wind/windTestGround';
import { useWindAudio } from '../wind/useWindAudio';
import { createTerrainWind } from '../wind/terrainWind';
import { WindTerrain } from '../wind/WindTerrain';
import type { TerrainWindConfig } from '../wind/terrainWind';
import { RabbitWindProbe, WindPanel } from '../wind/WindLab';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Group, Object3D, Quaternion, Vector3 } from 'three';
import { Link, useSearchParams } from 'react-router-dom';
import { MeadowEnvironment } from '../title/MeadowScene';
import { SlopeTestEnvironment } from './SlopeTestEnvironment';
import { SLOPE_TEST_GROUND, SLOPE_TEST_SPOTS } from './slopeTestGround';
import {
  RabbitModel,
  RABBIT_WALK_SPEED,
  RABBIT_RUN_GAIT_SPEED,
} from './RabbitModel';
import type { RabbitDrive } from './RabbitModel';
import {
  createRabbitMovement,
  RABBIT_CLEARING,
  MEADOW_GROUND,
  RABBIT_SPEED,
  stepRabbit,
} from './rabbitMovement';
import {
  DuckModel,
  DUCK_MODEL_URL,
  DUCK_WALK_SPEED,
  DUCK_RUN_SPEED,
} from './DuckModel';
import {
  createRabbitCameraClearance,
  WALK_CAMERA_MAX_POLAR,
} from './rabbitCamera';
import { PreviewError } from './RabbitPreview';
import './rabbit-preview.css';
import './rabbit-walk.css';

type Input = {
  keys: Set<string>;
  touch: Set<string>;
  reset: number;
  stopped: number;
  spot: number;
  turn: number;
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

function WalkingScene({
  input,
  reducedMotion,
  duck,
  slopes,
  wind,
  windConfig,
  windSound,
  onWindReadout,
}: {
  input: RefObject<Input>;
  reducedMotion: boolean;
  duck: boolean;
  slopes: boolean;
  wind: boolean;
  windConfig: TerrainWindConfig;
  windSound: ReturnType<typeof useWindAudio>;
  onWindReadout: (text: string) => void;
}) {
  const ground = wind
    ? WIND_TEST_GROUND
    : slopes
      ? SLOPE_TEST_GROUND
      : MEADOW_GROUND;
  const startY = ground.height(...ground.spawn);
  const windField = useMemo(
    () => createTerrainWind(windConfig, WIND_TEST_GROUND.height),
    [windConfig]
  );
  const cameraClearance = useMemo(() => createRabbitCameraClearance(), []);
  const actor = useRef<Group>(null);
  const travelVelocity = useRef(new Vector3());
  const grassBodies = useRef<GrassContactBody[]>([
    {
      position: new Vector3(),
      velocity: new Vector3(),
      radius: 0.34,
      height: 0.85,
      active: false,
    },
  ]);
  const foliageBodies = useRef<GrassContactBody[]>([
    {
      position: new Vector3(),
      velocity: new Vector3(),
      radius: 0.34,
      height: duck ? 1.1 : 1.45,
      active: false,
    },
  ]);
  const orbit = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const drive = useRef<RabbitDrive>({ motion: 'Idle', timeScale: 1, reset: 0 });
  const movement = useRef(createRabbitMovement(ground));
  const consumed = useRef({ reset: 0, stopped: 0, turn: 0 });
  const turnTarget = useRef<number | null>(null);
  const scratch = useMemo(
    () => ({
      beforeMove: new Vector3(),
      target: new Vector3(),
      delta: new Vector3(),
      normal: new Vector3(),
      up: new Vector3(0, 1, 0),
      slope: new Quaternion(),
      smoothedSlope: new Quaternion(),
      yaw: new Quaternion(),
      lightTarget: new Object3D(),
    }),
    []
  );
  const light = useRef<Object3D>(null);

  useEffect(() => {
    cameraClearance.reset();
    camera.position.set(
      ground.spawn[0] + (slopes ? 0 : 2.2),
      startY + 2.5,
      ground.spawn[1] + 4.5
    );
    orbit.current?.target.set(ground.spawn[0], startY + 0.85, ground.spawn[1]);
    orbit.current?.update();
  }, [camera, ground, slopes, startY, cameraClearance]);

  useFrame((_, delta) => {
    const body = actor.current,
      controls = orbit.current;
    if (!body || !controls) return;
    cameraClearance.restore(camera, controls.target);
    const dt = Math.min(delta, 0.05);
    const state = movement.current;
    if (input.current.reset !== consumed.current.reset) {
      const fresh = createRabbitMovement(ground);
      if (slopes || wind) {
        cameraClearance.reset();
        const spot = (wind ? WIND_TEST_SPOTS : SLOPE_TEST_SPOTS)[
          input.current.spot
        ];
        fresh.position.set(spot.x, ground.height(spot.x, spot.z), spot.z);
        fresh.yaw = spot.yaw;
        controls.target.copy(fresh.position).addScaledVector(scratch.up, 0.85);
        const cameraDistance =
          'cameraDistance' in spot ? (spot.cameraDistance ?? 4.5) : 4.5;
        camera.position.set(
          spot.x - Math.sin(spot.yaw) * cameraDistance,
          fresh.position.y + Math.max(2.5, cameraDistance * 0.4),
          spot.z - Math.cos(spot.yaw) * cameraDistance
        );
        controls.update();
        scratch.smoothedSlope.identity();
      }
      turnTarget.current = null;
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
    if (wind && input.current.turn !== consumed.current.turn) {
      turnTarget.current =
        (turnTarget.current ?? state.yaw) +
        input.current.turn -
        consumed.current.turn;
      consumed.current.turn = input.current.turn;
    }
    if (horizontal || forward) turnTarget.current = null;
    if (turnTarget.current !== null) {
      const angle = Math.atan2(
        Math.sin(turnTarget.current - state.yaw),
        Math.cos(turnTarget.current - state.yaw)
      );
      state.yaw += angle * (1 - Math.exp(-8 * dt));
      if (Math.abs(angle) < 0.001) turnTarget.current = null;
    }
    // Measure resolved movement, not requested speed: boundaries, braking and
    // future ground constraints must affect felt wind. Reset/teleport above is excluded.
    scratch.beforeMove.copy(state.position);
    stepRabbit(state, horizontal, forward, azimuth, dt, sprint, ground);
    if (dt > 0)
      travelVelocity.current
        .copy(state.position)
        .sub(scratch.beforeMove)
        .divideScalar(dt);
    else travelVelocity.current.set(0, 0, 0);
    body.position.copy(state.position);
    body.position.y += 0.008;
    Object.assign(grassBodies.current[0].position, state.position);
    grassBodies.current[0].velocity = travelVelocity.current;
    grassBodies.current[0].active = true;
    Object.assign(foliageBodies.current[0].position, state.position);
    foliageBodies.current[0].velocity = travelVelocity.current;
    foliageBodies.current[0].active = true;
    // Rabbit balance stays upright; its legs adapt independently to terrain.
    const x = state.position.x,
      z = state.position.z,
      e = 0.25;
    scratch.normal
      .set(
        ground.height(x - e, z) - ground.height(x + e, z),
        2 * e,
        ground.height(x, z - e) - ground.height(x, z + e)
      )
      .normalize();
    scratch.slope.setFromUnitVectors(scratch.up, scratch.normal);
    scratch.smoothedSlope.slerp(scratch.slope, 1 - Math.exp(-12 * dt));
    scratch.yaw.setFromAxisAngle(scratch.up, state.yaw);
    // Yaw is already smoothed by movement; smooth only the terrain tilt here.
    if (duck) body.quaternion.copy(scratch.smoothedSlope).multiply(scratch.yaw);
    else body.quaternion.copy(scratch.yaw);
    const running =
      state.speed >
      RABBIT_SPEED + (drive.current.motion === 'Run' ? 0.45 : 0.6);
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
    scratch.lightTarget.position.copy(state.position);
    scratch.lightTarget.position.addScaledVector(scratch.up, 0.7);
    light.current?.position.set(x - 3, state.position.y + 6, z + 4);
  }, -2);

  // Drei updates OrbitControls at -1. Resolve clearance afterwards, once per
  // rendered frame, so damping cannot undo the terrain correction.
  useFrame((_, delta) => {
    if (orbit.current)
      cameraClearance.update(
        camera,
        orbit.current.target,
        ground.height,
        delta
      );
  });

  return (
    <>
      {wind ? (
        <>
          <WindTerrain field={windField} />
          <PineTreeStudy
            contacts={foliageBodies}
            field={windField}
            reducedMotion={reducedMotion}
          />
          <BroadleafTreeStudy
            contacts={foliageBodies}
            field={windField}
            reducedMotion={reducedMotion}
          />
          <WindVegetation
            field={windField}
            reducedMotion={reducedMotion}
            contacts={grassBodies}
            onContact={windSound.contact}
            onPatchWind={windSound.patchWind}
          />
        </>
      ) : slopes ? (
        <SlopeTestEnvironment />
      ) : (
        <MeadowEnvironment
          reducedMotion={reducedMotion}
          clearing={RABBIT_CLEARING}
          contacts={foliageBodies}
        />
      )}
      <group
        ref={actor}
        name={duck ? 'DuckPlayer' : 'RabbitPlayer'}
        position={[ground.spawn[0], startY + 0.008, ground.spawn[1]]}
      >
        {duck ? (
          <DuckModel drive={drive} />
        ) : (
          <RabbitModel drive={drive} groundHeight={ground.height} />
        )}
      </group>
      {wind && (
        <RabbitWindProbe
          actor={actor}
          velocity={travelVelocity}
          field={windField}
          sound={windSound}
          onReadout={onWindReadout}
        />
      )}
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
        maxDistance={slopes || wind ? 24 : 7}
        minPolarAngle={0.4}
        maxPolarAngle={WALK_CAMERA_MAX_POLAR}
        enableDamping
        rotateSpeed={0.6}
      />
    </>
  );
}

export function RabbitWalk({ onLeave }: { onLeave?: () => void } = {}) {
  const [params] = useSearchParams();
  const [slopes, setSlopes] = useState(
    () => params.get('terrain') === 'slopes'
  );
  const wind = params.get('terrain') === 'wind';
  const [windConfig, setWindConfig] =
    useState<TerrainWindConfig>(WIND_TEST_CONFIG);
  const windSound = useWindAudio(wind);
  const windReadout = useRef<HTMLOutputElement>(null);
  const onWindReadout = useCallback((text: string) => {
    if (windReadout.current) windReadout.current.textContent = text;
  }, []);
  const duck = !wind && !onLeave && params.get('character') === 'duck';
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
    spot: 0,
    turn: 0,
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
    <section
      className={`rabbit-preview rabbit-walk${onLeave ? ' rabbit-walk-entry' : ''}`}
      aria-label={slopes ? 'Explore the slope course' : 'Explore the meadow'}
    >
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
              key={wind ? 'wind' : slopes ? 'slopes' : 'meadow'}
              wind={wind}
              windConfig={windConfig}
              windSound={windSound}
              onWindReadout={onWindReadout}
              slopes={slopes}
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
        <h1>
          {wind
            ? 'Feel the breeze'
            : slopes
              ? 'Explore the slopes'
              : 'Explore the clearing'}
        </h1>
      </header>
      {wind && (
        <WindPanel
          config={windConfig}
          onChange={setWindConfig}
          sound={windSound}
          readout={windReadout}
          onSpot={(index) => {
            input.current.keys.clear();
            input.current.touch.clear();
            input.current.spot = index;
            input.current.reset += 1;
          }}
          onTurn={(angle) => {
            input.current.keys.clear();
            input.current.touch.clear();
            input.current.stopped += 1;
            input.current.turn += angle;
          }}
        />
      )}
      {!wind && slopes && (
        <nav className="slope-spots" aria-label="Slope course locations">
          <p>Choose a starting point</p>
          {SLOPE_TEST_SPOTS.map((spot, i) => (
            <button
              key={spot.name}
              onClick={() => {
                input.current.keys.clear();
                input.current.touch.clear();
                input.current.spot = i;
                input.current.reset += 1;
              }}
            >
              {spot.name}
            </button>
          ))}
          <small>
            Walk over the hill to descend. Drag to inspect the feet.
          </small>
        </nav>
      )}
      <footer className="rabbit-toolbar">
        <p>WASD / Arrows · Hold Shift to run · Drag to look around</p>
        <div className="rabbit-controls">
          {!wind && (
            <Link
              className="rabbit-walk-link"
              to="/playground/rabbit/walk?terrain=wind"
            >
              Try the wind
            </Link>
          )}
          {wind ? (
            <Link className="rabbit-walk-link" to="/playground/rabbit/walk">
              Back to meadow
            </Link>
          ) : (
            <button
              onClick={() => {
                input.current.keys.clear();
                input.current.touch.clear();
                input.current.spot = 0;
                input.current.stopped += 1;
                setSlopes((value) => !value);
              }}
            >
              {slopes ? 'Back to meadow' : 'Try the slopes'}
            </button>
          )}
          {onLeave ? (
            <button autoFocus onClick={onLeave}>
              ← Back to title
            </button>
          ) : (
            <Link
              className="rabbit-walk-link"
              to={`/playground/rabbit${duck ? '?character=duck' : ''}`}
            >
              Character preview
            </Link>
          )}
          <button
            onClick={() => {
              input.current.keys.clear();
              input.current.touch.clear();
              input.current.spot = 0;
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
    </section>
  );
}
