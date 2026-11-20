/* eslint-disable react-hooks/immutability -- R3F frame callbacks intentionally mutate the owned input ref and Three.js camera, outside React render state. */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group, OrthographicCamera, Vector3 } from 'three';
import {
  RabbitModel,
  RABBIT_WALK_SPEED,
  RABBIT_RUN_GAIT_SPEED,
} from '../sheem/characters/RabbitModel';
import type { RabbitDrive } from '../sheem/characters/RabbitModel';
import { constrainPosition, places, SPAWN, trees } from './island';
import type { Place } from './island';
import { Ocean } from './Ocean';
import { Archipelago } from './IslandArchipelago';
import {
  BENCH_APPROACH,
  BENCH_SEAT,
  BENCH_SEAT_TOP,
  BOOK_LAP,
  SEATED_ROOT_HEIGHT,
  benchPath,
  ease,
  seatLift,
} from './reading';
import type { ReadingState, ReadingPhase } from './reading';
import { createReadingPose } from './ReadingRabbit';
import { Notebook } from './Notebook';
import { prepareReadingRabbit } from './bookChoreography';

export type IslandInput = {
  keys: Set<string>;
  target: [number, number] | null;
  paused: boolean;
  reset: number;
};

function Box({
  position,
  size,
  color,
  rotation = 0,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  rotation?: number;
}) {
  return (
    <mesh position={position} rotation-y={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

function Tree({ x, z, scale }: { x: number; z: number; scale: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.24, 2, 7]} />
        <meshStandardMaterial color="#947453" />
      </mesh>
      {[
        [0, 2.7, 0, 1.2],
        [-0.6, 2.25, 0.1, 0.9],
        [0.6, 2.3, 0.2, 0.85],
      ].map(([a, b, c, r], i) => (
        <mesh key={i} position={[a, b, c]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial
            color={i === 0 ? '#729b72' : '#8eae78'}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}

function Workshop() {
  return (
    <group position={[-4.2, 0, -2.8]} rotation-y={0.12}>
      <Box position={[0, 0.16, 0]} size={[3.7, 0.32, 3.1]} color="#b4a386" />
      <Box position={[0, 1.3, 0]} size={[3.2, 2.3, 2.6]} color="#f1dec0" />
      <mesh position={[0, 2.75, 0]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[2.7, 1.5, 4]} />
        <meshStandardMaterial color="#bd795b" roughness={1} />
      </mesh>
      <Box
        position={[0.62, 0.97, 1.32]}
        size={[0.8, 1.65, 0.08]}
        color="#779795"
      />
      <Box
        position={[-0.75, 1.42, 1.34]}
        size={[0.92, 0.85, 0.08]}
        color="#637e80"
      />
      <Box
        position={[-0.75, 1.42, 1.4]}
        size={[0.05, 0.85, 0.06]}
        color="#f1dec0"
      />
      <Box
        position={[-0.75, 1.42, 1.4]}
        size={[0.92, 0.05, 0.06]}
        color="#f1dec0"
      />
      <Box
        position={[1.05, 3, -0.55]}
        size={[0.45, 1.3, 0.5]}
        color="#d8c3a7"
      />
      <Box
        position={[0.6, 0.16, 1.7]}
        size={[1.3, 0.22, 0.55]}
        color="#b4a386"
      />
    </group>
  );
}
function Observatory() {
  return (
    <group position={[4.6, 0, -3.8]}>
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <cylinderGeometry args={[1.5, 1.6, 0.3, 12]} />
        <meshStandardMaterial color="#c7c2af" />
      </mesh>
      {[0, 2.1, 4.2].map((angle) => (
        <mesh
          key={angle}
          position={[Math.cos(angle) * 0.4, 0.9, Math.sin(angle) * 0.4]}
          rotation={[Math.sin(angle) * 0.3, 0, -Math.cos(angle) * 0.3]}
          castShadow
        >
          <cylinderGeometry args={[0.06, 0.06, 1.5, 6]} />
          <meshStandardMaterial color="#6e7f80" />
        </mesh>
      ))}
      <group position={[0, 1.75, 0]} rotation={[0.6, 0, -0.7]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.31, 0.25, 1.6, 12]} />
          <meshStandardMaterial color="#e3c794" />
        </mesh>
        <mesh position={[0, 0.81, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.08, 12]} />
          <meshStandardMaterial
            color="#405e70"
            metalness={0.25}
            roughness={0.3}
          />
        </mesh>
      </group>
    </group>
  );
}
function Garden({ onSit }: { onSit: () => void }) {
  return (
    <group
      position={[4.8, 0, 3.4]}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onSit();
      }}
    >
      <Box
        position={[0, BENCH_SEAT_TOP - 0.09, 0]}
        size={[2.1, 0.18, 0.7]}
        color="#b79265"
      />
      <Box
        position={[0, 1.12, -0.28]}
        size={[2.1, 0.62, 0.12]}
        color="#c8a778"
      />
      {[-0.8, 0.8].map((x) => (
        <Box
          key={x}
          position={[x, 0.3, 0]}
          size={[0.14, 0.6, 0.55]}
          color="#718576"
        />
      ))}
    </group>
  );
}
function Player({
  input,
  onNear,
  onReady,
  playerPosition,
  reading,
  onReadingPhase,
  onRead,
  reducedMotion,
}: {
  input: RefObject<IslandInput>;
  onNear: (place: Place | null) => void;
  onReady: () => void;
  playerPosition: RefObject<Vector3>;
  reading: RefObject<ReadingState>;
  onReadingPhase: (phase: ReadingPhase) => void;
  onRead: () => void;
  reducedMotion: boolean;
}) {
  const actor = useRef<Group>(null);
  const reduced = useRef(reducedMotion);
  useEffect(() => {
    reduced.current = reducedMotion;
  }, [reducedMotion]);
  const groundHeight = useMemo(
    () => () => seatLift(reading.current.seat),
    [reading]
  );
  const readingPose = useMemo(
    () => createReadingPose(reading.current, () => reduced.current),
    [reading]
  );
  const announced = useRef<ReadingPhase>('idle');
  const drive = useRef<RabbitDrive>({ motion: 'Idle', timeScale: 1 });
  const state = useRef({
    x: 0 as number,
    z: SPAWN[1] as number,
    yaw: Math.PI,
    reset: 0,
    near: '',
  });
  useEffect(onReady, [onReady]);
  useFrame((_, delta) => {
    if (!actor.current) return;
    const s = state.current,
      controls = input.current,
      keys = controls.keys;
    const dt = Math.min(delta, 0.04);
    const r = reading.current;
    const setPhase = (phase: ReadingPhase) => {
      r.phase = phase;
    };
    if (r.command === 'sit' && r.phase === 'idle') {
      r.path = benchPath(s.x, s.z);
      if (r.path.length) {
        setPhase('walking');
        controls.paused = true;
        controls.keys.clear();
        controls.target = null;
      }
    } else if (r.command === 'read' && r.phase === 'seated')
      setPhase('zooming');
    else if (
      r.command === 'back' &&
      (r.phase === 'reading' || r.phase === 'zooming')
    )
      setPhase('returning');
    else if (r.command === 'leave' && r.phase !== 'idle') {
      if (r.phase === 'walking') setPhase('releasing');
      else setPhase(r.book > 0 ? 'packing' : 'standing');
    }
    r.command = '';
    if (r.labView) {
      s.yaw = 0;
      controls.paused = true;
    }
    const cinematicDt = reducedMotion ? 10 : dt;
    if (r.phase === 'turning') {
      r.turn = Math.min(1, r.turn + cinematicDt / 0.75);
      s.yaw =
        r.startYaw +
        Math.atan2(Math.sin(-r.startYaw), Math.cos(-r.startYaw)) * ease(r.turn);
      if (r.turn === 1) setPhase('sitting');
    }
    if (r.phase === 'sitting') {
      r.seat = Math.min(1, r.seat + cinematicDt / 1.4);
      if (r.seat === 1) setPhase('unpacking');
    }
    if (r.phase === 'unpacking') {
      r.book = Math.min(1, r.book + cinematicDt / 5.2);
      if (r.book === 1) setPhase('seated');
    }
    if (r.phase === 'zooming') {
      r.zoom = Math.min(1, r.zoom + cinematicDt / 1.5);
      if (r.zoom === 1) setPhase('reading');
    }
    if (r.phase === 'returning') {
      r.zoom = Math.max(0, r.zoom - cinematicDt / 1.15);
      if (r.zoom === 0) setPhase('seated');
    }
    if (r.phase === 'packing') {
      r.zoom = Math.max(0, r.zoom - cinematicDt / 1.15);
      if (r.zoom === 0) r.book = Math.max(0, r.book - cinematicDt / 4.6);
      if (r.book === 0 && r.zoom === 0) setPhase('standing');
    }
    if (r.phase === 'standing') {
      r.seat = Math.max(0, r.seat - cinematicDt / 1.35);
      if (r.seat === 0) setPhase('releasing');
    }
    const closeCamera = !['idle', 'walking', 'releasing'].includes(r.phase);
    r.camera = Math.max(
      0,
      Math.min(1, r.camera + ((closeCamera ? 1 : -1) * cinematicDt) / 1.8)
    );
    if (r.phase === 'releasing' && r.camera === 0) {
      setPhase('idle');
      controls.paused = false;
      controls.target = null;
    }
    if (r.phase !== announced.current) {
      announced.current = r.phase;
      onReadingPhase(r.phase);
    }
    if (!['idle', 'walking', 'releasing'].includes(r.phase)) {
      const seat = ease(r.seat);
      s.x = BENCH_APPROACH[0];
      s.z = BENCH_APPROACH[1] + (BENCH_SEAT[1] - BENCH_APPROACH[1]) * seat;
      actor.current.position.set(s.x, seatLift(r.seat), s.z);
      if (r.phase !== 'turning') s.yaw = 0;
      actor.current.rotation.y = s.yaw;
      playerPosition.current.copy(actor.current.position);
      drive.current.motion = 'Idle';
      drive.current.timeScale = 1;
      return;
    }

    if (s.reset !== controls.reset) {
      s.x = SPAWN[0];
      s.z = SPAWN[1];
      s.reset = controls.reset;
      controls.target = null;
    }
    let dx = 0,
      dz = 0;
    if (r.phase === 'walking') {
      const next = r.path[0];
      if (next) {
        dx = next[0] - s.x;
        dz = next[1] - s.z;
        if (Math.hypot(dx, dz) < 0.06) {
          r.path.shift();
          dx = 0;
          dz = 0;
        }
      } else {
        r.startYaw = s.yaw;
        r.turn = 0;
        setPhase('turning');
      }
    } else if (!controls.paused) {
      const x =
        Number(keys.has('KeyD') || keys.has('ArrowRight')) -
        Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const z =
        Number(keys.has('KeyS') || keys.has('ArrowDown')) -
        Number(keys.has('KeyW') || keys.has('ArrowUp'));
      const yaw = Math.atan2(15, 24);
      dx = x * Math.cos(yaw) + z * Math.sin(yaw);
      dz = -x * Math.sin(yaw) + z * Math.cos(yaw);
      if (x || z) controls.target = null;
      else if (controls.target) {
        dx = controls.target[0] - s.x;
        dz = controls.target[1] - s.z;
        if (Math.hypot(dx, dz) < 0.12) {
          dx = 0;
          dz = 0;
          controls.target = null;
        }
      }
    }
    const length = Math.hypot(dx, dz);
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = running ? 3 : 1.8;
    let actualSpeed = 0;
    if (length) {
      const step = Math.min(
        speed * dt,
        controls.target || r.phase === 'walking' ? length : Infinity
      );
      const next = constrainPosition(
        s.x + (dx / length) * step,
        s.z + (dz / length) * step
      );
      actualSpeed =
        Math.hypot(next.x - s.x, next.z - s.z) / Math.max(dt, 0.001);
      s.x = next.x;
      s.z = next.z;
      const targetYaw = Math.atan2(dx, dz);
      s.yaw +=
        Math.atan2(Math.sin(targetYaw - s.yaw), Math.cos(targetYaw - s.yaw)) *
        (1 - Math.exp(-12 * dt));
      if (actualSpeed < 0.05) controls.target = null;
    }
    actor.current.position.set(s.x, 0, s.z);
    playerPosition.current.copy(actor.current.position);
    actor.current.rotation.y = s.yaw;
    drive.current.motion =
      actualSpeed > 0.08 ? (running ? 'Run' : 'Walk') : 'Idle';
    drive.current.timeScale =
      actualSpeed / (running ? RABBIT_RUN_GAIT_SPEED : RABBIT_WALK_SPEED);
    const near =
      places.find(
        (place) =>
          Math.hypot(place.position[0] - s.x, place.position[1] - s.z) < 3.5
      ) ?? null;
    if ((near?.id ?? '') !== s.near) {
      s.near = near?.id ?? '';
      onNear(near);
    }
  }, -2);
  return (
    <>
      <group name="portfolio-rabbit" ref={actor} position={[0, 0, SPAWN[1]]}>
        <RabbitModel
          modelUrl="/models/rabbit/portfolio-reading-rig.glb"
          drive={drive}
          groundHeight={groundHeight}
          pose={readingPose}
          prepare={prepareReadingRabbit}
        />
      </group>
      <Notebook
        reading={reading}
        onRead={onRead}
        reducedMotion={reducedMotion}
      />
    </>
  );
}
function Camera({
  playerPosition,
  ready,
  reducedMotion,
  onArrived,
  onLandmarksChange,
  reading,
}: {
  playerPosition: RefObject<Vector3>;
  ready: boolean;
  reducedMotion: boolean;
  onArrived: () => void;
  onLandmarksChange: (visible: boolean) => void;
  reading: RefObject<ReadingState>;
}) {
  const { camera, size } = useThree();
  const flight = useRef({ elapsed: 0, announced: false, labels: false });
  const target = useRef(new Vector3());
  const desired = useRef(new Vector3());
  const readingLook = useRef(new Vector3());
  const readingCamera = useRef(new Vector3());
  useFrame((_, delta) => {
    if (!(camera instanceof OrthographicCamera)) return;
    const state = flight.current;
    const dt = Math.min(delta, 0.05);
    if (ready) state.elapsed += dt;
    // Establish the archipelago, then travel into the home island in one continuous shot.
    const progress =
      state.announced || (ready && reducedMotion)
        ? 1
        : Math.min(1, Math.max(0, (state.elapsed - 1.3) / 5.6));
    const blend =
      progress * progress * progress * (progress * (progress * 6 - 15) + 10);
    desired.current.copy(playerPosition.current);
    desired.current.y += 0.7;
    if (reducedMotion) target.current.copy(desired.current);
    else target.current.lerp(desired.current, 1 - Math.exp(-5 * dt));
    const x =
      -3 * (1 - blend) +
      target.current.x * blend +
      Math.sin(Math.PI * blend) * 3;
    const y = target.current.y * blend;
    const z = -7 * (1 - blend) + target.current.z * blend;
    camera.position.set(
      x + 60 - blend * 15,
      y + 88 - blend * 54,
      z + 96 - blend * 24
    );
    camera.lookAt(x, y, z);
    const overviewZoom = Math.min(
      size.width / (size.width < 700 ? 96 : 87),
      size.height / 75
    );
    const playZoom = Math.min(size.width / 10, size.height / 10);
    camera.zoom = Math.exp(
      Math.log(overviewZoom) +
        (Math.log(playZoom) - Math.log(overviewZoom)) * blend
    );
    const r = reading.current,
      intimacy = ease(r.camera),
      zoom = ease(r.zoom);
    if (intimacy > 0) {
      // Front three-quarter portrait gives way to the rabbit's notebook, then
      // a near-normal page view. All positions share the same continuous blend.
      const look = readingLook.current.set(
        4.8,
        SEATED_ROOT_HEIGHT + 0.72 + (BOOK_LAP.height - 0.72) * zoom,
        3.9 + (BENCH_SEAT[1] + BOOK_LAP.forward - 3.9) * zoom
      );
      const position = readingCamera.current.set(
        2.75 + (4.8 - 2.75) * zoom,
        SEATED_ROOT_HEIGHT +
          2.27 +
          (BOOK_LAP.height + Math.sin(-BOOK_LAP.pitch) * 4 - 2.27) * zoom,
        7.1 +
          (BENCH_SEAT[1] +
            BOOK_LAP.forward +
            Math.cos(BOOK_LAP.pitch) * 4 -
            7.1) *
            zoom
      );
      camera.position.lerp(position, intimacy);
      camera.lookAt(
        x + (look.x - x) * intimacy,
        y + (look.y - y) * intimacy,
        z + (look.z - z) * intimacy
      );
      const portraitZoom = Math.min(
        size.width / (size.width < 700 ? 2.55 : 3.2),
        size.height / 2.9
      );
      const bookZoom = Math.min(
        size.width / (BOOK_LAP.scale * 1.26),
        size.height / (BOOK_LAP.scale * 0.923)
      );
      const desiredZoom = Math.exp(
        Math.log(portraitZoom) * (1 - zoom) + Math.log(bookZoom) * zoom
      );
      camera.zoom = Math.exp(
        Math.log(camera.zoom) * (1 - intimacy) +
          Math.log(desiredZoom) * intimacy
      );
    }
    if (reading.current.labView && reading.current.zoom === 0) {
      const view = reading.current.labView;
      camera.position.set(
        BENCH_SEAT[0] + (view === 'side' ? 3 : view === 'front' ? 0 : 2),
        1.8,
        BENCH_SEAT[1] + (view === 'side' ? 0 : 3)
      );
      camera.lookAt(BENCH_SEAT[0], 1.25, BENCH_SEAT[1] + 0.1);
      camera.zoom = Math.min(size.width / 2.8, size.height / 2.4);
    }
    camera.updateProjectionMatrix();
    const showLabels = Math.min(size.width, size.height) / camera.zoom < 34;
    if (state.labels !== showLabels) {
      state.labels = showLabels;
      onLandmarksChange(showLabels);
    }
    if (progress === 1 && !state.announced) {
      state.announced = true;
      onArrived();
    }
  }, -1);
  return null;
}
export function IslandScene({
  input,
  onNear,
  onReady,
  onOpen,
  reducedMotion,
  ready,
  onArrived,
  reading,
  onReadingPhase,
  onRead,
}: {
  input: RefObject<IslandInput>;
  onNear: (place: Place | null) => void;
  onReady: () => void;
  onOpen: (place: Place) => void;
  reducedMotion: boolean;
  ready: boolean;
  onArrived: () => void;
  reading: RefObject<ReadingState>;
  onReadingPhase: (phase: ReadingPhase) => void;
  onRead: () => void;
}) {
  const playerPosition = useRef(new Vector3(0, 0, SPAWN[1]));
  const [showLandmarks, setShowLandmarks] = useState(false);
  return (
    <>
      <Camera
        playerPosition={playerPosition}
        ready={ready}
        reducedMotion={reducedMotion}
        onArrived={onArrived}
        onLandmarksChange={setShowLandmarks}
        reading={reading}
      />
      <color attach="background" args={['#689da5']} />
      <hemisphereLight args={['#fff4dc', '#648d8b', 2.2]} />
      <directionalLight
        position={[-8, 18, 8]}
        intensity={3}
        color="#fff1d4"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-17}
        shadow-camera-right={17}
        shadow-camera-top={17}
        shadow-camera-bottom={-17}
        shadow-normalBias={0.04}
      />
      <Ocean reducedMotion={reducedMotion} />
      <Archipelago reducedMotion={reducedMotion} />
      <mesh position={[0, -0.42, 0]} receiveShadow>
        <cylinderGeometry args={[11.5, 12.3, 0.5, 64]} />
        <meshStandardMaterial color="#ead3a2" roughness={1} />
      </mesh>
      <mesh
        position={[0, -0.1, 0]}
        receiveShadow
        onPointerDown={(event) => {
          if (event.button !== 0 || input.current.paused) return;
          event.stopPropagation();
          input.current.target = [event.point.x, event.point.z];
        }}
      >
        <cylinderGeometry args={[10.95, 11.5, 0.2, 64]} />
        <meshStandardMaterial color="#b1be83" roughness={1} />
      </mesh>
      {Array.from({ length: 13 }, (_, i) => (
        <Box
          key={i}
          position={[0, -0.07, 10 + i * 0.3]}
          size={[1.85, 0.17, 0.26]}
          color={i % 2 ? '#ae8d66' : '#c3a17a'}
        />
      ))}
      {[-0.85, 0.85].flatMap((x) =>
        [10.1, 13.3].map((z) => (
          <Box
            key={`${x}-${z}`}
            position={[x, -0.1, z]}
            size={[0.16, 1.1, 0.16]}
            color="#8c765b"
          />
        ))
      )}
      <Workshop />
      <Observatory />
      <Garden onSit={() => onOpen(places[2])} />
      {trees.map(([x, z, scale]) => (
        <Tree key={`${x}-${z}`} x={x} z={z} scale={scale} />
      ))}
      {Array.from({ length: 17 }, (_, i) => {
        const angle = i * 2.399,
          radius = 8.4 + Math.sin(i * 13) * 0.8;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius,
              0.12,
              Math.sin(angle) * radius,
            ]}
            scale={[0.42, 0.26, 0.35]}
            rotation-y={i}
            castShadow
          >
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={i % 2 ? '#b9b9a2' : '#d1c7ab'} />
          </mesh>
        );
      })}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh
          key={i}
          position={[-0.6 + Math.sin(i * 0.8) * 0.5, 0.015, 7.7 - i * 0.85]}
          rotation-x={-Math.PI / 2}
          rotation-z={i}
          receiveShadow
        >
          <circleGeometry args={[0.32, 7]} />
          <meshStandardMaterial color="#ded2ae" />
        </mesh>
      ))}
      {!showLandmarks && (
        <Html position={[0, 7, 0]} center zIndexRange={[20, 0]}>
          <div className="island-destination">
            <small>YOUR DESTINATION</small>Little Island
          </div>
        </Html>
      )}
      {showLandmarks &&
        reading.current.phase === 'idle' &&
        places.map((place) => (
          <Html
            key={place.id}
            position={[
              place.position[0],
              place.id === 'workshop' ? 4 : 2.8,
              place.position[1],
            ]}
            center
            zIndexRange={[20, 0]}
          >
            <button
              className="island-label"
              onClick={() => onOpen(place)}
              aria-label={`Open ${place.title}`}
            >
              <span>{place.number}</span>
              {place.title}
            </button>
          </Html>
        ))}
      <Suspense
        fallback={
          <Html center>
            <div className="island-loading" role="status">
              Your rabbit is arriving…
            </div>
          </Html>
        }
      >
        <Player
          input={input}
          onNear={onNear}
          onReady={onReady}
          playerPosition={playerPosition}
          reading={reading}
          onReadingPhase={onReadingPhase}
          onRead={onRead}
          reducedMotion={reducedMotion}
        />
      </Suspense>
    </>
  );
}
