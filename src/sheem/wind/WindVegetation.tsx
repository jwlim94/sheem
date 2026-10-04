import { grassRustleStrength } from './grassRustle';
import type { GrassRustleContact } from './grassRustle';
import type { RefObject } from 'react';
import { stepGrassContact } from './grassContact';
import type { GrassContactBody } from './grassContact';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Trees } from '../title/Trees';
import { createGrassBlade } from '../title/vegetationGeometry';
import { grassMaterial } from '../title/vegetationMaterials';
import { seededRandom } from '../title/landscape';
import type { WindField } from './windField';
import { windTestHeight } from './windTestGround';

// Same meadow assets, placed beside the course so feet and comparison points remain visible.
const PATCHES = [
  [-8, -11],
  [8, -11],
  [0, -17],
  [10, 4],
  [0, 3],
] as const;
const TREES = [
  [-10, -16, 0.32],
  [10, -16, 0.32],
  [3, -15, 0.32],
  [13, 3, 0.4],
] as const;
const COLORS = ['#4d6c29', '#688b37', '#7b9645', '#8a9f50', '#a3ae66'];
const COUNT = PATCHES.length * 300 * 3;
export function WindVegetation({
  field,
  reducedMotion,
  contacts,
  onContact,
  onPatchWind,
}: {
  onPatchWind: (position: THREE.Vector3, speed: number) => void;
  contacts: RefObject<GrassContactBody[]>;
  onContact: (contacts: readonly GrassRustleContact[]) => void;
  field: WindField;
  reducedMotion: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const assets = useMemo(() => {
    const geometry = createGrassBlade(COUNT),
      material = grassMaterial({ value: 0 }, true);
    const bend = new THREE.InstancedBufferAttribute(
      new Float32Array(COUNT * 2),
      2
    );
    bend.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('windBend', bend);
    const contact = new THREE.InstancedBufferAttribute(
      new Float32Array(COUNT * 2),
      2
    );
    contact.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('contactBend', contact);
    const random = seededRandom(121),
      dummy = new THREE.Object3D(),
      normal = new THREE.Vector3();
    const matrices: THREE.Matrix4[] = [],
      colors: THREE.Color[] = [],
      heights: number[] = [],
      cellIndices: number[] = [];
    const cells: {
        point: THREE.Vector3;
        target: THREE.Vector2;
        value: THREE.Vector2;
      }[] = [],
      index = new Map<string, number>();
    for (const [cx, cz] of PATCHES)
      for (let tuft = 0; tuft < 300; tuft++) {
        const x = cx + (random() - 0.5) * 3,
          z = cz + (random() - 0.5) * 2.4,
          h = 0.28 + random() * 0.4;
        const key = `${Math.floor(x)}:${Math.floor(z)}`;
        let cell = index.get(key);
        if (cell === undefined) {
          cell = cells.length;
          index.set(key, cell);
          const px = Math.floor(x) + 0.5,
            pz = Math.floor(z) + 0.5;
          cells.push({
            point: new THREE.Vector3(px, windTestHeight(px, pz) + 0.3, pz),
            target: new THREE.Vector2(),
            value: new THREE.Vector2(),
          });
        }
        for (let j = 0; j < 3; j++) {
          const bx = x + (random() - 0.5) * 0.22,
            bz = z + (random() - 0.5) * 0.22,
            height = h * (0.7 + random() * 0.5),
            i = matrices.length;
          dummy.position.set(bx, windTestHeight(bx, bz) - 0.015, bz);
          dummy.rotation.set(
            (random() - 0.5) * 0.25,
            random() * Math.PI * 2,
            (random() - 0.5) * 0.2
          );
          dummy.scale.set(0.85 + random() * 0.65, height, 1);
          dummy.updateMatrix();
          matrices.push(dummy.matrix.clone());
          colors.push(
            new THREE.Color(COLORS[Math.floor(random() * COLORS.length)])
          );
          heights.push(height);
          cellIndices.push(cell);
          normal
            .set(
              windTestHeight(bx - 0.2, bz) - windTestHeight(bx + 0.2, bz),
              0.4,
              windTestHeight(bx, bz - 0.2) - windTestHeight(bx, bz + 0.2)
            )
            .normalize();
          geometry.attributes.groundNormal.setXYZ(
            i,
            normal.x,
            normal.y,
            normal.z
          );
          geometry.attributes.groundColor.setXYZ(i, 0.64, 0.7, 0.55);
        }
      }
    return {
      roots: matrices.map((m) => ({
        x: m.elements[12],
        y: m.elements[13],
        z: m.elements[14],
      })),
      responses: matrices.map(() => ({ x: 0, z: 0, intensity: 0 })),
      contact,
      geometry,
      material,
      bend,
      matrices,
      colors,
      heights,
      cellIndices,
      cells,
    };
  }, []);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    assets.matrices.forEach((m, i) => {
      mesh.current!.setMatrixAt(i, m);
      mesh.current!.setColorAt(i, assets.colors[i]);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor)
      mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
    if (mesh.current.boundingSphere) mesh.current.boundingSphere.radius += 1;
  }, [assets]);
  useEffect(
    () => () => {
      assets.geometry.dispose();
      assets.material.dispose();
    },
    [assets]
  );
  const regions = useRef(
    Array.from({ length: 4 }, () => ({
      position: { x: 0, y: 0, z: 0 },
      strength: 0,
    }))
  );
  // The existing Flat start patch; sample at blade height, independent of contact.
  const audiblePatch = useMemo(
    () =>
      new THREE.Vector3(
        PATCHES[4][0],
        windTestHeight(...PATCHES[4]) + 0.3,
        PATCHES[4][1]
      ),
    []
  );
  const timer = useRef(1);
  const sample = useMemo(
    () => ({ velocity: { x: 0, y: 0, z: 0 }, speed: 0 }),
    []
  );
  useFrame(({ clock }, delta) => {
    timer.current += delta;
    if (timer.current >= 0.1) {
      timer.current = 0;
      field.sample(audiblePatch, clock.elapsedTime, sample);
      onPatchWind(audiblePatch, sample.speed);
      for (const cell of assets.cells) {
        field.sample(cell.point, clock.elapsedTime, sample);
        const limit = sample.speed > 12 ? 12 / sample.speed : 1;
        cell.target.set(sample.velocity.x * limit, sample.velocity.z * limit);
      }
    }
    const blend = 1 - Math.exp(-Math.min(delta, 0.05) * 8);
    for (const cell of assets.cells) cell.value.lerp(cell.target, blend);
    for (const region of regions.current) region.strength = 0;
    const body = contacts.current[0];
    const speed = body?.active
      ? Math.hypot(body.velocity.x, body.velocity.z)
      : 0;
    for (let i = 0; i < COUNT; i++) {
      const v = assets.cells[assets.cellIndices[i]].value,
        gain = reducedMotion ? 0 : 0.06 * assets.heights[i];
      assets.bend.setXY(i, v.x * gain, v.y * gain);
      const response = assets.responses[i];
      stepGrassContact(
        assets.roots[i],
        assets.heights[i],
        contacts.current,
        delta,
        response,
        v.x * gain,
        v.y * gain
      );
      assets.contact.setXY(i, response.x, response.z);
      if (body && speed > 0.08 && response.intensity > 0) {
        const root = assets.roots[i];
        const region =
          regions.current[
            (root.x >= body.position.x ? 1 : 0) +
              (root.z >= body.position.z ? 2 : 0)
          ];
        const strength = grassRustleStrength(response.intensity, speed);
        if (strength > region.strength) {
          region.strength = strength;
          region.position.x = root.x;
          region.position.y = root.y + assets.heights[i] * 0.5;
          region.position.z = root.z;
        }
      }
    }
    onContact(regions.current);
    if (mesh.current) {
      mesh.current.geometry.attributes.windBend.needsUpdate = true;
      mesh.current.geometry.attributes.contactBend.needsUpdate = true;
      (
        mesh.current.material as THREE.MeshStandardMaterial
      ).userData.grassTime.value = reducedMotion ? 0 : clock.elapsedTime;
    }
  });
  return (
    <group name="WindVegetation">
      <instancedMesh
        name="WindGrass"
        ref={mesh}
        args={[assets.geometry, assets.material, COUNT]}
        receiveShadow
      />
      <Trees
        positions={TREES}
        height={windTestHeight}
        wind={field}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}
