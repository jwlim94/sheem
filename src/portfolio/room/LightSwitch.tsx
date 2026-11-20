import { RoundedBox } from '@react-three/drei';

// On the left wall (inner face at x -3.1, three.js axes), toward the front of
// the room near its open edge (where a door would be), at hand height for the
// 1.38x-scaled hero.
const POSITION: [number, number, number] = [-3.097, 1.65, 2.05];
const PLASTIC = { color: '#f3f0e8', roughness: 0.35 } as const;

function Screw({ y }: { y: number }) {
  return (
    <group position={[0, y, 0.0085]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0042, 0.0046, 0.0016, 20]} />
        <meshStandardMaterial color="#e4e1d8" roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.0009]}>
        <boxGeometry args={[0.0062, 0.0009, 0.0004]} />
        <meshStandardMaterial color="#8d8a84" roughness={0.6} />
      </mesh>
    </group>
  );
}

/**
 * A two-gang Decora light switch (US style): a rocker for the room light,
 * shown off (lower half pressed, as the room lights are off), and a dimmer
 * paddle for the lamp with a side slider and a column of level LEDs.
 */
export function LightSwitch() {
  return (
    // Facing into the room (+X).
    <group position={POSITION} rotation={[0, Math.PI / 2, 0]}>
      {/* Wall plate with a soft shadow line on the wall. */}
      <RoundedBox
        args={[0.16, 0.158, 0.008]}
        radius={0.003}
        smoothness={3}
        position={[0, 0, 0.004]}
        castShadow
      >
        <meshStandardMaterial {...PLASTIC} />
      </RoundedBox>
      <Screw y={0.066} />
      <Screw y={-0.066} />

      {/* Left gang: room light rocker, off (top edge tilted out). */}
      <group position={[-0.038, 0, 0.008]}>
        <RoundedBox
          args={[0.05, 0.096, 0.004]}
          radius={0.0015}
          smoothness={2}
          position={[0, 0, 0.001]}
        >
          <meshStandardMaterial color="#e6e2d8" roughness={0.5} />
        </RoundedBox>
        <RoundedBox
          args={[0.045, 0.09, 0.006]}
          radius={0.002}
          smoothness={3}
          position={[0, 0, 0.005]}
          rotation={[-0.05, 0, 0]}
        >
          <meshStandardMaterial {...PLASTIC} />
        </RoundedBox>
      </group>

      {/* Right gang: dimmer paddle, slider and level LEDs (lamp on, ~60%). */}
      <group position={[0.038, 0, 0.008]}>
        <RoundedBox
          args={[0.05, 0.096, 0.004]}
          radius={0.0015}
          smoothness={2}
          position={[0, 0, 0.001]}
        >
          <meshStandardMaterial color="#e6e2d8" roughness={0.5} />
        </RoundedBox>
        <RoundedBox
          args={[0.034, 0.09, 0.006]}
          radius={0.002}
          smoothness={3}
          position={[-0.004, 0, 0.005]}
          rotation={[0.04, 0, 0]}
        >
          <meshStandardMaterial {...PLASTIC} />
        </RoundedBox>
        {/* Slider track and knob along the right edge. */}
        <mesh position={[0.018, 0, 0.0035]}>
          <boxGeometry args={[0.003, 0.074, 0.001]} />
          <meshStandardMaterial color="#b9b5ac" roughness={0.7} />
        </mesh>
        <RoundedBox
          args={[0.007, 0.012, 0.005]}
          radius={0.0012}
          smoothness={2}
          position={[0.018, 0.008, 0.006]}
        >
          <meshStandardMaterial {...PLASTIC} />
        </RoundedBox>
        {Array.from({ length: 7 }, (_, i) => {
          const on = i < 4;
          return (
            <mesh key={i} position={[0.011, -0.033 + i * 0.011, 0.0082]}>
              <boxGeometry args={[0.0026, 0.0062, 0.0008]} />
              {/* Unlit and not tone-mapped so lit LEDs stay saturated green. */}
              <meshBasicMaterial
                color={on ? '#5cff3a' : '#8c877e'}
                toneMapped={!on}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
