import { useEffect, useRef } from 'react';
import { Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { Mesh, Object3D } from 'three';
import { HERO_ROW, HERO_Z, seats } from './hall';

/**
 * The auditorium's ~280 seats: one seat and its folded tablet arm come from
 * school.glb at the origin ('SeatTemplate', 'SeatTablet') and are instanced
 * across every row and section (hall.ts; the side sections turned toward the
 * stage), one draw call per material. His seat
 * gets no folded tablet: his is raised, holding the laptop (in the GLB).
 */
function seatMatrices(skipHero: boolean) {
  const up = new Vector3(0, 1, 0),
    one = new Vector3(1, 1, 1);
  return seats()
    .filter(
      (s) =>
        !(
          skipHero &&
          s.section === 0 &&
          s.row === HERO_ROW &&
          Math.abs(s.z - HERO_Z) < 1e-6
        )
    )
    .map((s) =>
      new Matrix4().compose(
        new Vector3(s.x, s.y, s.z),
        new Quaternion().setFromAxisAngle(up, s.yaw),
        one
      )
    );
}

/**
 * The template's meshes, placed at each seat. Their transform relative to the
 * hall's root is kept: the template's origin is not at the seat's floor
 * point (Blender keeps the joined parts' first origin, the cushion), so
 * dropping it would sink every seat 0.3 m into the floor.
 */
function instance(template: Object3D, root: Object3D, places: Matrix4[]) {
  root.updateMatrixWorld(true);
  const toLocal = root.matrixWorld.clone().invert(),
    meshes: InstancedMesh[] = [];
  template.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const local = toLocal.clone().multiply(m.matrixWorld);
    const inst = new InstancedMesh(m.geometry, m.material, places.length);
    places.forEach((p, i) => inst.setMatrixAt(i, p.clone().multiply(local)));
    inst.castShadow = inst.receiveShadow = true;
    meshes.push(inst);
  });
  template.visible = false;
  return meshes;
}

export function Seats({ hall }: { hall: Object3D }) {
  const group = useRef<Group>(null);
  useEffect(() => {
    const g = group.current,
      seat = hall.getObjectByName('SeatTemplate'),
      tablet = hall.getObjectByName('SeatTablet');
    if (!g || !seat || !tablet) return;
    const meshes = [
      ...instance(seat, hall, seatMatrices(false)),
      ...instance(tablet, hall, seatMatrices(true)),
    ];
    g.add(...meshes);
    return () => {
      g.remove(...meshes);
      for (const m of meshes) m.dispose();
      seat.visible = tablet.visible = true;
    };
  }, [hall]);
  return <group ref={group} />;
}
