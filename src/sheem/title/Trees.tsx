import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { groundHeight, seededRandom } from './landscape';
import type { WindField } from '../wind/windField';
const treePositions = [
  [-22, -10, 1.25],
  [-37, -3, 1],
  [-49, -17, 0.85],
  [38, -20, 1.25],
  [43, -28, 0.8],
  [-23, -77, 0.85],
  [-34, -87, 0.65],
  [55, -86, 0.8],
  [64, -95, 0.75],
  [-80, -115, 1],
  [-62, -130, 0.8],
  [21, -165, 0.6],
  [-12, -190, 0.85],
  [80, -175, 0.8],
];
export function Trees({
  reducedMotion,
  positions = treePositions,
  height = groundHeight,
  wind,
}: {
  reducedMotion: boolean;
  positions?: readonly (readonly number[])[];
  height?: (x: number, z: number) => number;
  wind?: WindField;
}) {
  const crowns = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const rest = useRef<{
    trunks: THREE.Matrix4[];
    crowns: THREE.Matrix4[];
    roots: THREE.Vector3[];
  }>({ trunks: [], crowns: [], roots: [] });
  const runtime = useMemo(
    () => ({
      sample: { velocity: { x: 0, y: 0, z: 0 }, speed: 0 },
      point: new THREE.Vector3(),
      bend: new THREE.Matrix4(),
      offset: new THREE.Matrix4(),
      result: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      axis: new THREE.Vector3(),
      velocities: positions.map(() => new THREE.Vector3()),
    }),
    [positions]
  );
  useLayoutEffect(() => {
    if (!crowns.current || !trunks.current) return;
    const random = seededRandom(719),
      dummy = new THREE.Object3D(),
      color = new THREE.Color();
    rest.current = { trunks: [], crowns: [], roots: [] };
    let leaf = 0;
    positions.forEach(([x, z, s], i) => {
      const y = height(x, z);
      rest.current.roots.push(new THREE.Vector3(x, y, z));
      dummy.position.set(x, y + 2.6 * s, z);
      dummy.rotation.set(0, 0, 0.04);
      dummy.scale.set(0.34 * s, 5.5 * s, 0.34 * s);
      dummy.updateMatrix();
      trunks.current!.setMatrixAt(i, dummy.matrix);
      rest.current.trunks.push(dummy.matrix.clone());
      for (let n = 0; n < 18; n++) {
        const a = random() * Math.PI * 2,
          r = Math.sqrt(random()) * 4.3 * s;
        dummy.position.set(
          x + Math.cos(a) * r,
          y + 6.3 * s + random() * 2.6 * s - r * 0.26,
          z + Math.sin(a) * r
        );
        dummy.rotation.set(random(), random(), random());
        dummy.scale.set(
          (1.9 + random()) * s,
          (1.4 + random()) * s,
          (1.8 + random()) * s
        );
        dummy.updateMatrix();
        crowns.current!.setMatrixAt(leaf, dummy.matrix);
        rest.current.crowns.push(dummy.matrix.clone());
        color.setHSL(
          0.19 + random() * 0.055,
          0.3 + random() * 0.15,
          0.25 + random() * 0.14
        );
        crowns.current!.setColorAt(leaf++, color);
      }
    });
    for (const mesh of [crowns.current, trunks.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [positions, height]);
  useFrame(({ clock }, delta) => {
    if (wind && trunks.current && crowns.current) {
      const r = runtime,
        blend = 1 - Math.exp(-Math.min(delta, 0.05) * 5);
      positions.forEach(([x, z, s], i) => {
        const root = rest.current.roots[i];
        if (!root) return;
        r.point.set(x, root.y + 6.3 * s, z);
        wind.sample(r.point, clock.elapsedTime, r.sample);
        const v = r.velocities[i];
        v.x += (r.sample.velocity.x - v.x) * blend;
        v.z += (r.sample.velocity.z - v.z) * blend;
        const speed = Math.hypot(v.x, v.z);
        const angle = reducedMotion ? 0 : Math.min(0.14, speed * 0.012);
        r.axis.set(v.z, 0, -v.x).normalize();
        r.q.setFromAxisAngle(r.axis, angle);
        r.bend
          .makeTranslation(root.x, root.y, root.z)
          .multiply(r.offset.makeRotationFromQuaternion(r.q))
          .multiply(r.offset.makeTranslation(-root.x, -root.y, -root.z));
        r.result.multiplyMatrices(r.bend, rest.current.trunks[i]);
        trunks.current!.setMatrixAt(i, r.result);
        for (let j = 0; j < 18; j++) {
          const index = i * 18 + j;
          r.result.multiplyMatrices(r.bend, rest.current.crowns[index]);
          const flutter = reducedMotion
            ? 0
            : Math.sin(clock.elapsedTime * 1.7 + j * 2.4 + i) *
              Math.min(speed, 12) *
              0.004 *
              s;
          r.result.elements[12] += (v.x / (speed || 1)) * flutter;
          r.result.elements[14] += (v.z / (speed || 1)) * flutter;
          crowns.current!.setMatrixAt(index, r.result);
        }
      });
      trunks.current.instanceMatrix.needsUpdate = true;
      crowns.current.instanceMatrix.needsUpdate = true;
      return;
    }
    if (group.current && !reducedMotion)
      group.current.rotation.z = Math.sin(clock.elapsedTime * 0.35) * 0.0012;
  });
  return (
    <group ref={group} name="MeadowTrees">
      <instancedMesh
        ref={trunks}
        frustumCulled={!wind}
        args={[undefined, undefined, positions.length]}
        castShadow
      >
        <cylinderGeometry args={[0.65, 1, 1, 7]} />
        <meshStandardMaterial color="#625943" roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={crowns}
        frustumCulled={!wind}
        args={[undefined, undefined, positions.length * 18]}
        castShadow
        receiveShadow
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}
