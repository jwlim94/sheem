import { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Group, Quaternion, Vector3 } from 'three';
import type { Object3D } from 'three';
import { RABBIT_MODEL_URL } from '../characters/RabbitModel';
import { relativeWind, windExposure } from './windField';
import type { WindSample } from './windField';
import type {
  TerrainWindConfig,
  TerrainWindField,
  TerrainWindSample,
} from './terrainWind';
import { WIND_TEST_SPOTS, windTestHeight } from './windTestGround';
import type { useWindAudio } from './useWindAudio';
import './wind-lab.css';

/** Character-specific adapter. The field/audio engine knows nothing about rigs. */
export function RabbitWindProbe({
  actor,
  velocity,
  field,
  sound,
  onReadout,
}: {
  actor: RefObject<Group | null>;
  velocity: RefObject<Vector3>;
  field: TerrainWindField;
  sound: ReturnType<typeof useWindAudio>;
  onReadout: (text: string) => void;
}) {
  const { scene } = useGLTF(RABBIT_MODEL_URL);
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
      sample: {
        velocity: { x: 0, y: 0, z: 0 },
        speed: 0,
        exposure: 1,
        gust: 1,
        zone: 1,
      } as TerrainWindSample,
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
      const angle = Math.atan2(
        scratch.sample.velocity.x,
        scratch.sample.velocity.z
      );
      const x = body.position.x + Math.cos(angle) * 1.6;
      const z = body.position.z - Math.sin(angle) * 1.6;
      arrow.current.position.set(x, windTestHeight(x, z) + 0.4, z);
      arrow.current.rotation.y = angle;
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
        `${direction} · Felt ${scratch.apparent.speed.toFixed(1)} m/s · Moving ${velocity.current.length().toFixed(1)} m/s\nLocal wind ${scratch.sample.speed.toFixed(1)} m/s · Shelter ${Math.round((1 - scratch.sample.exposure) * 100)}% · Gust ×${scratch.sample.gust.toFixed(2)}`
      );
    }
  });
  return (
    <group ref={arrow} name="WindTravelArrow" scale={0.65}>
      <mesh position={[0, 0.03, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.045, 0.045, 1.2, 8]} />
        <meshBasicMaterial color="#526b55" />
      </mesh>
      <mesh position={[0, 0.03, 0.8]} rotation-x={Math.PI / 2}>
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
  onSpot,
  sound,
  readout,
}: {
  config: TerrainWindConfig;
  onChange: (config: TerrainWindConfig) => void;
  onTurn: (angle: number) => void;
  onSpot: (index: number) => void;
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
      <output ref={readout} />
      <button aria-pressed={sound.enabled} onClick={() => void sound.toggle()}>
        {sound.enabled ? 'Mute wind' : 'Enable wind'}
      </button>
      {sound.error && (
        <p role="status">Sound unavailable. Try enabling it again.</p>
      )}
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
      <button
        onClick={() =>
          onChange({
            ...config,
            directionDegrees: (config.directionDegrees + 180) % 360,
          })
        }
      >
        Reverse wind
      </button>
      <details className="wind-options">
        <summary>Wind layers</summary>
        <label>
          <input
            type="checkbox"
            checked={config.zones.some((z) => z.enabled)}
            onChange={(e) =>
              onChange({
                ...config,
                zones: config.zones.map((z) => ({
                  ...z,
                  enabled: e.target.checked,
                })),
              })
            }
          />{' '}
          Position variation
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.gust.enabled}
            onChange={(e) =>
              onChange({
                ...config,
                gust: { ...config.gust, enabled: e.target.checked },
              })
            }
          />{' '}
          Traveling gusts
        </label>
        <label>
          Gust strength: {Math.round(config.gust.strength * 100)}%
          <input
            aria-label="Gust strength"
            type="range"
            min="0"
            max="1"
            step=".1"
            value={config.gust.strength}
            onChange={(e) =>
              onChange({
                ...config,
                gust: { ...config.gust, strength: Number(e.target.value) },
              })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.shelter.enabled}
            onChange={(e) =>
              onChange({
                ...config,
                shelter: { ...config.shelter, enabled: e.target.checked },
              })
            }
          />{' '}
          Hill shelter
        </label>
      </details>
      <details>
        <summary>Compare locations</summary>
        <div className="wind-spots">
          {WIND_TEST_SPOTS.map((p, i) => (
            <button key={p.name} onClick={() => onSpot(i)}>
              {p.name}
            </button>
          ))}
        </div>
      </details>
      <div>
        <button onClick={() => onTurn(Math.PI / 2)}>Turn left</button>
        <button onClick={() => onTurn(-Math.PI / 2)}>Turn right</button>
      </div>
      <small>
        Arrow length shows local wind. Reverse the wind to swap the sheltered
        side. Turn layers off for the uniform baseline.
      </small>
    </aside>
  );
}
