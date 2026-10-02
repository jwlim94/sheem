/** Serializable map settings. Directions describe travel TO, clockwise from +Z.
 * +Y is up, +X east, -Z north; speed is metres per second. */
export type WindConfig = {
  version: 1;
  directionDegrees: number;
  speed: number;
};
export type Point3 = { x: number; y: number; z: number };
export type WindSample = { velocity: Point3; speed: number };
export type WindField = {
  sample(position: Readonly<Point3>, seconds: number, out: WindSample): void;
};
export const DEFAULT_WIND: WindConfig = {
  version: 1,
  directionDegrees: 90,
  speed: 4,
};
export function validateWindConfig(config: WindConfig): WindConfig {
  if (
    config.version !== 1 ||
    !Number.isFinite(config.directionDegrees) ||
    !Number.isFinite(config.speed) ||
    config.speed < 0 ||
    config.speed > 12
  )
    throw new Error('Invalid wind settings (speed must be 0–12 m/s)');
  return {
    version: 1,
    directionDegrees: ((config.directionDegrees % 360) + 360) % 360,
    speed: config.speed,
  };
}
export function createUniformWind(config: WindConfig): WindField {
  const settings = validateWindConfig(config);
  const angle = (settings.directionDegrees * Math.PI) / 180;
  const x = Math.sin(angle) * settings.speed,
    z = Math.cos(angle) * settings.speed;
  return {
    sample(_position, _seconds, out) {
      out.velocity.x = x;
      out.velocity.y = 0;
      out.velocity.z = z;
      out.speed = settings.speed;
    },
  };
}
/** Relative arrival, not travel direction. Local +Z forward, -X right. */
export function windExposure(
  sample: WindSample,
  forward: Point3,
  right: Point3
) {
  if (sample.speed === 0) return { front: 0, side: 0, strength: 0 };
  const v = sample.velocity,
    n = sample.speed;
  return {
    front: -(v.x * forward.x + v.y * forward.y + v.z * forward.z) / n,
    side: -(v.x * right.x + v.y * right.y + v.z * right.z) / n,
    strength: Math.min(1, n / 12),
  };
}

/** Air velocity relative to a moving listener, in world metres per second.
 * Leaves the map sample intact so vegetation and diffuse ambience still use it. */
export function relativeWind(
  ambient: WindSample,
  listenerVelocity: Readonly<Point3>,
  out: WindSample
): void {
  out.velocity.x = ambient.velocity.x - listenerVelocity.x;
  out.velocity.y = ambient.velocity.y - listenerVelocity.y;
  out.velocity.z = ambient.velocity.z - listenerVelocity.z;
  out.speed = Math.hypot(out.velocity.x, out.velocity.y, out.velocity.z);
  if (out.speed < 1e-6) {
    out.velocity.x = out.velocity.y = out.velocity.z = out.speed = 0;
  }
}
