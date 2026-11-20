import { MathUtils } from 'three';
import { archipelagoShallowsGLSL, distantIslands } from './archipelagoLayout';

// These broad swells stay visible in the overview; only tiny ripples use screen LOD.
export const waves = /* glsl */ `
  float smoothIslandDistance(float a, float b, float k) {
    float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
    return mix(b, a, h) - k * h * (1. - h);
  }
  float islandDistance(vec2 p) {
    float d = length(p) - 12.15;
    ${archipelagoShallowsGLSL}
    return d;
  }
  float shoreDamping(vec2 p) {
    return mix(.18, 1., smoothstep(-.35, 6.85, islandDistance(p)));
  }
  float swell(vec2 p, float t) {
    float a = dot(p, vec2(.48, .22)) - t * .72 + sin(p.y * .13) * .5;
    float b = dot(p, vec2(-.19, .66)) - t * .91 + sin(p.x * .17) * .4;
    float c = dot(p, vec2(.81, -.37)) + t * 1.02;
    return (sin(a) * .38 + sin(b) * .19 + sin(c) * .075) * shoreDamping(p);
  }
`;

/** CPU counterpart of the shader surface, used by the little boats. */
export function oceanHeightAt(x: number, z: number, time: number) {
  let distance = Math.hypot(x, z) - 12.15;
  for (const island of distantIslands) {
    const [rx, rz] = island.radius;
    const next =
      (Math.hypot(
        (x - island.position[0]) / rx,
        (z - island.position[1]) / rz
      ) -
        1) *
      Math.min(rx, rz);
    const blend = MathUtils.clamp(0.5 + (0.5 * (next - distance)) / 3, 0, 1);
    distance = next * (1 - blend) + distance * blend - 3 * blend * (1 - blend);
  }
  const damping = 0.18 + 0.82 * MathUtils.smoothstep(distance, -0.35, 6.85);
  const y = -z;
  const a = x * 0.48 + y * 0.22 - time * 0.72 + Math.sin(y * 0.13) * 0.5;
  const b = x * -0.19 + y * 0.66 - time * 0.91 + Math.sin(x * 0.17) * 0.4;
  const c = x * 0.81 + y * -0.37 + time * 1.02;
  return (
    -0.62 +
    (Math.sin(a) * 0.38 + Math.sin(b) * 0.19 + Math.sin(c) * 0.075) * damping
  );
}
