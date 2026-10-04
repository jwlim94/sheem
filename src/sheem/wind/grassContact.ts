import type { Point3 } from './windField';

/** World-space upright contact volume. Character adapters supply resolved motion.
 * This lightweight vegetation response is not a rigid-body collision solver. */
export type GrassContactBody = {
  position: Point3;
  velocity: Point3;
  radius: number;
  height: number;
  active: boolean;
};
export type GrassResponse = { x: number; z: number; intensity: number };
export function stepGrassContact(
  root: Readonly<Point3>,
  height: number,
  bodies: readonly GrassContactBody[],
  delta: number,
  state: GrassResponse,
  windX = 0,
  windZ = 0
) {
  let tx = 0,
    tz = 0,
    intensity = 0;
  for (const body of bodies) {
    if (
      !body.active ||
      body.radius <= 0 ||
      body.height <= 0 ||
      root.y + height < body.position.y ||
      root.y > body.position.y + body.height
    )
      continue;
    const dx = root.x + windX * 0.65 - body.position.x,
      dz = root.z + windZ * 0.65 - body.position.z;
    const distance = Math.hypot(dx, dz),
      radius = body.radius + 0.12;
    if (distance >= radius) continue;
    const t = 1 - distance / radius,
      depth = t * t * (3 - 2 * t);
    const speed = Math.hypot(body.velocity.x, body.velocity.z),
      motion = Math.min(1, speed / 3);
    const vx = speed > 1e-6 ? body.velocity.x / speed : 1,
      vz = speed > 1e-6 ? body.velocity.z / speed : 0;
    const nx = distance > 1e-6 ? dx / distance : vx,
      nz = distance > 1e-6 ? dz / distance : vz;
    const bx = nx + 0.35 * motion * vx,
      bz = nz + 0.35 * motion * vz,
      len = Math.hypot(bx, bz);
    const amount = height * 0.85 * depth * (0.75 + 0.25 * motion);
    tx += (bx / len) * amount;
    tz += (bz / len) * amount;
    intensity = Math.max(intensity, depth);
  }
  const length = Math.hypot(tx, tz),
    limit = height * 0.85;
  if (length > limit) {
    tx *= limit / length;
    tz *= limit / length;
  }
  const dt = Math.max(0, Math.min(delta, 0.05));
  const blend = 1 - Math.exp(-dt / (intensity > 0 ? 0.065 : 0.4));
  state.x += (tx - state.x) * blend;
  state.z += (tz - state.z) * blend;
  state.intensity = intensity;
}
