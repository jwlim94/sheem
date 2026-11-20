import { CatmullRomCurve3, Shape, Vector3 } from 'three';
import { distantIslands } from './archipelagoLayout';
import { Boat, Settlement, Windmill } from './SettlementScenery';

// Rounded, individually authored coastlines, including an open crescent lagoon.
const islandShapes = distantIslands.map((island) => {
  const curve = new CatmullRomCurve3(
    island.outline.map(([x, z]) => new Vector3(x, 0, z)),
    true,
    'centripetal'
  );
  const shape = new Shape();
  curve
    .getPoints(64)
    .forEach((point, i) =>
      i === 0
        ? shape.moveTo(point.x, -point.z)
        : shape.lineTo(point.x, -point.z)
    );
  shape.closePath();
  return shape;
});

function Rock({
  position,
  scale,
  color = '#8e9e97',
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color?: string;
}) {
  return (
    <mesh
      position={position}
      scale={scale}
      rotation={[0.12, position[0] * 0.7, 0.08]}
    >
      <dodecahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}
function Pine({ x, z, height = 4 }: { x: number; z: number; height?: number }) {
  return (
    <group position={[x, 0.45, z]}>
      <mesh position={[0, height * 0.4, 0]}>
        <cylinderGeometry args={[0.1, 0.17, height * 0.8, 6]} />
        <meshStandardMaterial color="#776d54" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, height * (0.4 + i * 0.2), 0]}>
          <coneGeometry args={[height * (0.27 - i * 0.06), height * 0.52, 9]} />
          <meshStandardMaterial
            color={['#527969', '#618774', '#77967d'][i]}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}
function Palm({ x, z, lean = 0 }: { x: number; z: number; lean?: number }) {
  return (
    <group position={[x, 0.3, z]} rotation-z={lean}>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.1, 0.19, 3, 7]} />
        <meshStandardMaterial color="#a5936e" />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i} position={[0, 3, 0]} rotation-y={(i * Math.PI) / 3}>
          <mesh
            position={[0.7, -0.13, 0]}
            rotation-z={-0.22}
            scale={[1.1, 0.16, 0.32]}
          >
            <sphereGeometry args={[1, 8, 5]} />
            <meshStandardMaterial
              color={i % 2 ? '#779665' : '#62866b'}
              roughness={1}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
function Lighthouse() {
  return (
    <group position={[0, 0.6, 0]}>
      <Rock position={[-1, 0.05, 0]} scale={[2.8, 0.8, 2.6]} />
      <mesh position={[0, 2.4, 0]}>
        <cylinderGeometry args={[0.68, 1, 4.8, 12]} />
        <meshStandardMaterial color="#e9e5d3" />
      </mesh>
      <mesh position={[0, 3.35, 0]}>
        <cylinderGeometry args={[0.77, 0.8, 0.65, 12]} />
        <meshStandardMaterial color="#b86d59" />
      </mesh>
      <mesh position={[0, 4.9, 0]}>
        <cylinderGeometry args={[1, 1, 0.2, 12]} />
        <meshStandardMaterial color="#627779" />
      </mesh>
      <mesh position={[0, 5.45, 0]}>
        <cylinderGeometry args={[0.65, 0.65, 0.9, 8]} />
        <meshStandardMaterial
          color="#ddce99"
          emissive="#d7b46f"
          emissiveIntensity={0.25}
        />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh
          key={i}
          position={[
            Math.cos((i * Math.PI) / 4) * 0.64,
            5.45,
            Math.sin((i * Math.PI) / 4) * 0.64,
          ]}
        >
          <cylinderGeometry args={[0.035, 0.035, 1, 5]} />
          <meshStandardMaterial color="#526b70" />
        </mesh>
      ))}
      <mesh position={[0, 6.15, 0]}>
        <coneGeometry args={[1, 0.7, 8]} />
        <meshStandardMaterial color="#ad725c" />
      </mesh>
      <mesh position={[0, 0.8, 1]}>
        <boxGeometry args={[0.43, 1.35, 0.08]} />
        <meshStandardMaterial color="#677b74" />
      </mesh>
    </group>
  );
}

export function Archipelago({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <group name="portfolio-archipelago">
      {distantIslands.map((island, index) => (
        <group
          key={island.id}
          name={`island-${island.id}`}
          position={[island.position[0], 0, island.position[1]]}
        >
          <mesh rotation-x={-Math.PI / 2} position={[0, -0.65, 0]}>
            <extrudeGeometry
              args={[
                islandShapes[index],
                {
                  depth: 0.75,
                  bevelEnabled: true,
                  bevelSegments: 3,
                  steps: 1,
                  bevelSize: 0.35,
                  bevelThickness: 0.15,
                  curveSegments: 24,
                },
              ]}
            />
            <meshStandardMaterial color={island.sand} roughness={1} />
          </mesh>
          <mesh
            rotation-x={-Math.PI / 2}
            position={[0, 0.12, 0]}
            scale={[0.89, 0.87, 1]}
          >
            <extrudeGeometry
              args={[
                islandShapes[index],
                {
                  depth: 0.2,
                  bevelEnabled: true,
                  bevelSegments: 2,
                  steps: 1,
                  bevelSize: 0.25,
                  bevelThickness: 0.16,
                },
              ]}
            />
            <meshStandardMaterial color={island.grass} roughness={1} />
          </mesh>
          {island.id === 'crescent' && (
            <>
              <Palm x={-5} z={-3.1} lean={-0.13} />
              <Palm x={-0.6} z={-4.4} lean={0.14} />
              <Palm x={5} z={-0.4} />
              <Rock
                position={[4, 0.4, -3.6]}
                scale={[1.4, 0.6, 0.9]}
                color="#c2b89a"
              />
            </>
          )}
          {island.id === 'pines' && (
            <>
              <Rock position={[0.5, 1.9, -0.8]} scale={[2.7, 3, 2]} />
              <Rock
                position={[-1.7, 1.1, -1.4]}
                scale={[2, 1.7, 1.8]}
                color="#a0aa9a"
              />
              {[
                [-5, 0, 3.5],
                [-3.3, -2.6, 4.3],
                [2.5, 1.8, 3.8],
                [4.8, 0.4, 3.1],
                [2.4, -2.1, 4.7],
              ].map(([x, z, h]) => (
                <Pine key={x} x={x} z={z} height={h} />
              ))}
            </>
          )}
          {island.id === 'lighthouse' && (
            <>
              <Lighthouse />
              <Settlement kind="keeper" />
            </>
          )}
          {island.id === 'pines' && <Settlement kind="camp" />}
          {(['harbor', 'village', 'farm', 'fishing'] as const).map((kind) =>
            island.id === kind ? <Settlement key={kind} kind={kind} /> : null
          )}
          {island.id === 'farm' && <Windmill reducedMotion={reducedMotion} />}
          {island.id === 'harbor' && (
            <>
              <Pine x={-5.5} z={-0.7} height={3.3} />
              <Palm x={4.7} z={-2.8} />
            </>
          )}
          {island.id === 'village' && (
            <>
              <Pine x={-5} z={-2.7} height={3.5} />
              <Pine x={4.7} z={-2.6} height={3.3} />
            </>
          )}
          {island.id === 'farm' && <Pine x={-5.4} z={1.3} height={3.2} />}
          {island.id === 'fishing' && <Pine x={-3.4} z={-2.4} height={3.2} />}
          {island.id === 'garden' && (
            <>
              <Pine x={-2} z={-0.3} height={3.4} />
              <Pine x={-0.3} z={0.8} height={2.5} />
              <Rock
                position={[2, 0.6, 0.2]}
                scale={[1.4, 1, 0.9]}
                color="#b4b79f"
              />
            </>
          )}
          {(!['harbor', 'village', 'farm', 'fishing'].includes(island.id)
            ? [
                [3.8, -2.1],
                [-3, 2.2],
              ]
            : []
          ).map(([x, z], i) => (
            <Rock
              key={i}
              position={[x, 0.1, z]}
              scale={[0.6, 0.38, 0.5]}
              color={island.sand}
            />
          ))}
        </group>
      ))}
      <Boat
        position={[-22.1, -0.45, -27.5]}
        heading={0.18}
        reducedMotion={reducedMotion}
      />
      <Boat
        position={[-34.1, -0.45, 15.4]}
        heading={-0.2}
        reducedMotion={reducedMotion}
      />
      <Boat
        position={[19, -0.45, 5]}
        heading={-0.9}
        sail
        reducedMotion={reducedMotion}
      />
      <Boat
        position={[-13, -0.45, -17]}
        heading={0.7}
        sail
        reducedMotion={reducedMotion}
      />
      <group position={[-24, 0, 20]} name="island-sea-stacks">
        <Rock position={[0, 0.8, 0]} scale={[2.3, 2, 1.6]} />
        <Rock
          position={[3.1, 0.25, 1.2]}
          scale={[1.2, 1.2, 0.9]}
          color="#a0aaa0"
        />
        <Rock position={[-2.5, -0.1, 1.1]} scale={[0.7, 0.8, 0.9]} />
      </group>
    </group>
  );
}
