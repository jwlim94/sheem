import { validateWindConfig } from './windField';
import type { Point3, WindConfig, WindField, WindSample } from './windField';

export type WindZone = {
  id: string;
  enabled: boolean;
  x: number;
  z: number;
  radius: number;
  transition: number;
  multiplier: number;
};
export type GustSettings = {
  enabled: boolean;
  strength: number;
  period: number;
  travelSpeed: number;
};
export type ShelterSettings = {
  enabled: boolean;
  distance: number;
  minimum: number;
};
export type TerrainWindConfig = WindConfig & {
  zones: WindZone[];
  gust: GustSettings;
  shelter: ShelterSettings;
};
export type TerrainWindSample = WindSample & {
  exposure: number;
  gust: number;
  zone: number;
};
export type TerrainWindField = WindField & {
  sample(
    position: Readonly<Point3>,
    seconds: number,
    out: WindSample | TerrainWindSample
  ): void;
};
const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};
/** Serializable settings, independently validated from any renderer or character. */
export function validateTerrainWind(
  config: TerrainWindConfig
): TerrainWindConfig {
  const base = validateWindConfig(config);
  const valid = (n: number, lo: number, hi: number) =>
    Number.isFinite(n) && n >= lo && n <= hi;
  if (
    !Array.isArray(config.zones) ||
    config.zones.length > 32 ||
    !config.gust ||
    typeof config.gust.enabled !== 'boolean' ||
    !valid(config.gust.strength, 0, 1) ||
    !valid(config.gust.period, 4, 120) ||
    !valid(config.gust.travelSpeed, 0.5, 30) ||
    !config.shelter ||
    typeof config.shelter.enabled !== 'boolean' ||
    !valid(config.shelter.distance, 2, 40) ||
    !valid(config.shelter.minimum, 0, 1)
  )
    throw new Error('Invalid terrain wind settings');
  const ids = new Set<string>();
  for (const z of config.zones) {
    if (
      !z.id ||
      ids.has(z.id) ||
      typeof z.enabled !== 'boolean' ||
      !Number.isFinite(z.x) ||
      !Number.isFinite(z.z) ||
      !valid(z.radius, 0.5, 500) ||
      !valid(z.transition, 0.1, z.radius) ||
      !valid(z.multiplier, 0, 2)
    )
      throw new Error('Invalid wind zone');
    ids.add(z.id);
  }
  return {
    ...base,
    zones: config.zones.map((z) => ({ ...z })),
    gust: { ...config.gust },
    shelter: { ...config.shelter },
  };
}
/** Height-field shelter approximation, not CFD: no deflection, vortices or mesh walls.
 * The terrain provider is map-owned and uses the same world units as movement. */
export function createTerrainWind(
  config: TerrainWindConfig,
  height: (x: number, z: number) => number
): TerrainWindField {
  const c = validateTerrainWind(config),
    angle = (c.directionDegrees * Math.PI) / 180;
  const dx = Math.sin(angle),
    dz = Math.cos(angle);
  // Sample a narrow upstream fan; averaging reduces abrupt shelter changes on turns.
  const rays = [-0.22, 0, 0.22].map((offset) => ({
    x: Math.sin(angle + offset),
    z: Math.cos(angle + offset),
  }));
  const steps = Math.ceil(c.shelter.distance);
  return {
    sample(p, seconds, out) {
      let weighted = 0,
        totalWeight = 0;
      for (const z of c.zones)
        if (z.enabled) {
          const w = smooth(
            (z.radius - Math.hypot(p.x - z.x, p.z - z.z)) / z.transition
          );
          weighted += (z.multiplier - 1) * w;
          totalWeight += w;
        }
      // Order-independent blending; overlapping zones cannot multiply to extreme gains.
      const zone = 1 + weighted / Math.max(1, totalWeight);
      const phase =
        (seconds - (p.x * dx + p.z * dz) / c.gust.travelSpeed) / c.gust.period;
      const pulse = Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * phase), 3);
      const gust = c.gust.enabled ? 1 + c.gust.strength * pulse : 1;
      let blocked = 0;
      if (c.shelter.enabled) {
        for (const ray of rays) {
          let horizon = 0;
          for (let i = 1; i <= steps; i++) {
            const distance = (i * c.shelter.distance) / steps;
            const excess =
              height(p.x - ray.x * distance, p.z - ray.z * distance) -
              p.y -
              0.03 * distance;
            // Recover continuously with distance from the blocking ridge.
            const reach = 1 - smooth(distance / c.shelter.distance);
            horizon = Math.max(horizon, excess * reach);
          }
          blocked += smooth(horizon / 1.5) / rays.length;
        }
      }
      const exposure = 1 - (1 - c.shelter.minimum) * blocked;
      const speed = c.speed * zone * gust * exposure;
      out.velocity.x = dx * speed;
      out.velocity.y = 0;
      out.velocity.z = dz * speed;
      out.speed = speed;
      if ('exposure' in out) {
        out.exposure = exposure;
        out.gust = gust;
        out.zone = zone;
      }
    },
  };
}
