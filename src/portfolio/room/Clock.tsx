import { useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { CLOCK_POSITION, rewindBeats } from './story';

// On the left wall (CLOCK_POSITION in story.ts: the rewind camera flies to it).
const R = 0.305; // dial radius (m)

/** A hand pointing up from the centre, rotated by its group. */
function Hand({
  length,
  width,
  tail,
  color,
  z,
}: {
  length: number;
  width: number;
  tail: number;
  color: string;
  z: number;
}) {
  return (
    <mesh position={[0, (length - tail) / 2, z]}>
      <boxGeometry args={[width, length + tail, 0.004]} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  );
}

// How far the hands run back during the rewind: three days, so the minute
// hand whirls (72 turns) while the hour hand makes six slow laps (its 72
// hour marks are the rewinding ticks in audio.ts).
const REWIND_SECONDS = 72 * 3600;

/**
 * Minimal wall clock: thin oak rim, cream dial with bar indices, charcoal
 * hour/minute hands and a stepping terracotta second hand. By default it shows
 * the viewer's real local time on the room's left wall and runs back with the
 * rewind; the lecture hall's copy is placed elsewhere and set to a morning.
 */
export function Clock({
  reduced,
  rewind,
  position = CLOCK_POSITION,
  facing = Math.PI / 2,
  hours,
}: {
  reduced: boolean;
  rewind?: RefObject<number>;
  position?: [number, number, number];
  /** Rotation about Y; π/2 faces +X. */
  facing?: number;
  /** A fixed time of day (hours, 0..24) instead of the real one; seconds still tick. */
  hours?: number;
}) {
  const hour = useRef<Group>(null),
    minute = useRef<Group>(null),
    second = useRef<Group>(null);

  useFrame(() => {
    const now = new Date(),
      // A quartz movement: the second hand steps once a second, with a tiny
      // overshoot as it lands (audio.ts plays the tick on each step). Under
      // reduced motion it just jumps.
      f = now.getMilliseconds() / 1000,
      secs = reduced
        ? now.getSeconds()
        : now.getSeconds() - Math.exp(-f * 40) * Math.cos(f * 55),
      real =
        hours === undefined
          ? now.getHours() * 3600 + now.getMinutes() * 60 + secs
          : hours * 3600 + secs,
      // Time runs back as the story rewinds to 2019.
      day = 12 * 3600,
      spin = rewind ? rewindBeats(rewind.current).spin : 0,
      t = (((real - REWIND_SECONDS * spin) % day) + day) % day,
      s = t % 60,
      m = (t / 60) % 60,
      h = t / 3600,
      turn = -Math.PI * 2;
    if (second.current) {
      second.current.rotation.z = (turn * s) / 60;
      // Far too fast to read while rewinding (it would strobe): hidden then.
      second.current.visible = spin <= 0 || spin >= 1;
    }
    if (minute.current) minute.current.rotation.z = (turn * m) / 60;
    if (hour.current) hour.current.rotation.z = (turn * h) / 12;
  });

  return (
    <group position={position} rotation={[0, facing, 0]}>
      {/* Oak rim and cream dial; the rim casts a soft lamp shadow on the wall. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.018]} castShadow>
        <cylinderGeometry args={[R + 0.025, R + 0.025, 0.036, 64]} />
        <meshStandardMaterial color="#b98a5e" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.0365]}>
        <circleGeometry args={[R, 64]} />
        <meshStandardMaterial color="#f1eadc" roughness={0.85} />
      </mesh>
      {/* Bar indices: long at 12/3/6/9. */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2,
          major = i % 3 === 0,
          len = major ? 0.05 : 0.028;
        return (
          <mesh
            key={i}
            position={[
              Math.sin(a) * (R - 0.02 - len / 2),
              Math.cos(a) * (R - 0.02 - len / 2),
              0.039,
            ]}
            rotation={[0, 0, -a]}
          >
            <boxGeometry args={[major ? 0.012 : 0.007, len, 0.003]} />
            <meshStandardMaterial color="#2f3236" roughness={0.6} />
          </mesh>
        );
      })}
      <group ref={hour}>
        <Hand
          length={0.14}
          width={0.016}
          tail={0.025}
          color="#2a2d31"
          z={0.042}
        />
      </group>
      <group ref={minute}>
        <Hand
          length={0.21}
          width={0.011}
          tail={0.03}
          color="#2a2d31"
          z={0.046}
        />
      </group>
      <group ref={second}>
        <Hand
          length={0.22}
          width={0.004}
          tail={0.05}
          color="#c4663a"
          z={0.05}
        />
      </group>
      <mesh position={[0, 0, 0.053]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.011, 0.011, 0.006, 24]} />
        <meshStandardMaterial color="#c4663a" roughness={0.4} />
      </mesh>
    </group>
  );
}
