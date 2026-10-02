import { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Group, Quaternion, Vector3 } from 'three';
import type { Object3D } from 'three';
import { RABBIT_MODEL_URL } from '../characters/RabbitModel';
import { createUniformWind, relativeWind, windExposure } from './windField';
import type { WindConfig, WindSample } from './windField';
import type { useWindAudio } from './useWindAudio';
import './wind-lab.css';

export function WindTestEnvironment() {
  return (
    <>
      <color attach="background" args={['#e3e7db']} />
      <hemisphereLight args={['#fff8e5', '#657653', 2]} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[10, 64]} />
        <meshStandardMaterial color="#a7b391" roughness={1} />
      </mesh>
      <gridHelper args={[20, 20, '#809172', '#9eac8a']} position-y={0.005} />
    </>
  );
}
/** Character-specific adapter. The field/audio engine knows nothing about rigs. */
export function RabbitWindProbe({
  actor,
  velocity,
  config,
  sound,
  onReadout,
}: {
  actor: RefObject<Group | null>;
  velocity: RefObject<Vector3>;
  config: WindConfig;
  sound: ReturnType<typeof useWindAudio>;
  onReadout: (text: string) => void;
}) {
  const { scene } = useGLTF(RABBIT_MODEL_URL);
  const field = useMemo(() => createUniformWind(config), [config]);
  const restInverse = useMemo(() => {
    scene.updateWorldMatrix(true, true);
    return (scene.getObjectByName('Head') ?? scene)
      .getWorldQuaternion(new Quaternion())
      .invert();
  }, [scene]);
  const scratch = useMemo(
    () => ({
      position: new Vector3(),
      left: new Vector3(),
      right: new Vector3(),
      orientation: new Quaternion(),
      forward: new Vector3(),
      side: new Vector3(),
      apparent: { velocity: { x: 0, y: 0, z: 0 }, speed: 0 } as WindSample,
      sample: { velocity: { x: 0, y: 0, z: 0 }, speed: 0 } as WindSample,
    }),
    []
  );
  const bones = useRef<{
    head: Object3D;
    left: Object3D;
    right: Object3D;
  } | null>(null);
  const arrow = useRef<Group>(null);
  const elapsed = useRef(0);
  // Mounted after RabbitModel: sample its animated pose at priority 0.
  useFrame(({ clock }, dt) => {
    const body = actor.current;
    if (!body) return;
    if (!bones.current) {
      const head = body.getObjectByName('Head'),
        left = body.getObjectByName('EarL'),
        right = body.getObjectByName('EarR');
      if (!head || !left || !right) return;
      bones.current = { head, left, right };
    }
    body.updateWorldMatrix(true, true);
    bones.current.left.getWorldPosition(scratch.left);
    bones.current.right.getWorldPosition(scratch.right);
    scratch.position.copy(scratch.left).add(scratch.right).multiplyScalar(0.5);
    bones.current.head
      .getWorldQuaternion(scratch.orientation)
      .multiply(restInverse);
    field.sample(scratch.position, clock.elapsedTime, scratch.sample);
    sound.update(
      scratch.sample,
      velocity.current,
      scratch.position,
      scratch.orientation
    );
    if (arrow.current) {
      arrow.current.position.set(body.position.x, 0.025, body.position.z);
      arrow.current.rotation.y = Math.atan2(
        scratch.sample.velocity.x,
        scratch.sample.velocity.z
      );
      arrow.current.visible = scratch.sample.speed > 0;
    }
    elapsed.current += dt;
    if (elapsed.current >= 0.1) {
      elapsed.current = 0;
      scratch.forward.set(0, 0, 1).applyQuaternion(scratch.orientation);
      scratch.side.set(-1, 0, 0).applyQuaternion(scratch.orientation);
      relativeWind(scratch.sample, velocity.current, scratch.apparent);
      const e = windExposure(scratch.apparent, scratch.forward, scratch.side);
      const direction =
        scratch.apparent.speed < 0.05
          ? 'Calm'
          : Math.abs(e.side) > 0.7
            ? e.side > 0
              ? 'From your right'
              : 'From your left'
            : e.front > 0
              ? 'From ahead'
              : 'From behind';
      onReadout(
        `${direction} · Felt ${scratch.apparent.speed.toFixed(1)} m/s · Moving ${velocity.current.length().toFixed(1)} m/s`
      );
    }
  });
  return (
    <group ref={arrow} name="WindTravelArrow">
      <mesh position={[1.5, 0.03, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.045, 0.045, 1.2, 8]} />
        <meshBasicMaterial color="#526b55" />
      </mesh>
      <mesh position={[1.5, 0.03, 0.8]} rotation-x={Math.PI / 2}>
        <coneGeometry args={[0.18, 0.4, 12]} />
        <meshBasicMaterial color="#526b55" />
      </mesh>
    </group>
  );
}
export function WindPanel({
  config,
  onChange,
  onTurn,
  sound,
  readout,
}: {
  config: WindConfig;
  onChange: (config: WindConfig) => void;
  onTurn: (angle: number) => void;
  sound: ReturnType<typeof useWindAudio>;
  readout: RefObject<HTMLOutputElement | null>;
}) {
  return (
    <aside className="wind-panel" aria-label="Wind test controls">
      <strong>Listen to the wind</strong>
      <p>
        Walk or hold Shift to run and feel the difference. Orbiting the camera
        keeps your listening direction.
      </p>
      <label>
        Wind travels toward: {config.directionDegrees}°
        <input
          aria-label="Wind direction"
          type="range"
          min="0"
          max="360"
          step="15"
          value={config.directionDegrees}
          onChange={(e) =>
            onChange({ ...config, directionDegrees: Number(e.target.value) })
          }
        />
      </label>
      <small>0° South · 90° East · 180° North · 270° West</small>
      <label>
        Speed: {config.speed} m/s
        <input
          aria-label="Wind speed"
          type="range"
          min="0"
          max="12"
          step=".5"
          value={config.speed}
          onChange={(e) =>
            onChange({ ...config, speed: Number(e.target.value) })
          }
        />
      </label>
      <div>
        <button onClick={() => onTurn(Math.PI / 2)}>Turn left</button>
        <button onClick={() => onTurn(-Math.PI / 2)}>Turn right</button>
      </div>
      <output ref={readout} />
      <button aria-pressed={sound.enabled} onClick={() => void sound.toggle()}>
        {sound.enabled ? 'Mute wind' : 'Enable wind'}
      </button>
      {sound.error && (
        <p role="status">Sound unavailable. Try enabling it again.</p>
      )}
      <small>Uniform wind test · No shelter effects yet</small>
    </aside>
  );
}
