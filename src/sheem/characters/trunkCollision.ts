import type { Vector3 } from 'three';

export type TrunkCollider = Readonly<{ x: number; z: number; radius: number }>;
export const CHARACTER_BODY_RADIUS = 0.34;

/** Ground-plane body collision. Small steps prevent crossing a narrow trunk;
 * projecting out of its circle preserves tangential movement around its side. */
export function moveAroundTrunks(
  position: Vector3,
  dx: number,
  dz: number,
  trunks: readonly TrunkCollider[],
  bodyRadius = CHARACTER_BODY_RADIUS
) {
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(dx, dz) / (bodyRadius * 0.25))
  );
  let blocked = false;
  for (let step = 0; step < steps; step++) {
    position.x += dx / steps;
    position.z += dz / steps;
    for (const trunk of trunks) {
      const x = position.x - trunk.x,
        z = position.z - trunk.z;
      const distance = Math.hypot(x, z);
      const clearance = trunk.radius + bodyRadius;
      if (distance >= clearance) continue;
      // Also recover deterministically if a spawn is inside a trunk.
      const nx = distance > 1e-8 ? x / distance : 1;
      const nz = distance > 1e-8 ? z / distance : 0;
      position.x = trunk.x + nx * clearance;
      position.z = trunk.z + nz * clearance;
      blocked = true;
    }
  }
  return blocked;
}
