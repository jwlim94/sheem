import { MathUtils } from 'three';
import type { RabbitGround } from './rabbitMovement';

export const TEST_GROUND_SIZE = [36, 40] as const;
export const TEST_GROUND_ORIGIN = [-18, -22] as const;
export const TEST_GROUND_STEP = 0.5;

// Three connected lanes: gentle ramp, steeper ramp and a lateral incline.
function vertexHeight(x: number, z: number) {
  const along =
    z >= 4 ? 0 : z > -2 ? (4 - z) / 6 : z > -6 ? 1 : z > -12 ? (z + 12) / 6 : 0;
  const middle = MathUtils.smoothstep(x, -6, -3);
  const side = MathUtils.smoothstep(x, 5, 7);
  const height = MathUtils.lerp(1.2 + middle * 1.2, 1.2 + (x - 7) * 0.25, side);
  return along * height;
}

/** Exactly the same triangles as the visible ground, including ramp crests. */
export function testGroundHeight(x: number, z: number) {
  const step = TEST_GROUND_STEP;
  const x0 =
    Math.floor((x - TEST_GROUND_ORIGIN[0]) / step) * step +
    TEST_GROUND_ORIGIN[0];
  const z0 =
    Math.floor((z - TEST_GROUND_ORIGIN[1]) / step) * step +
    TEST_GROUND_ORIGIN[1];
  const u = (x - x0) / step,
    v = (z - z0) / step;
  const a = vertexHeight(x0, z0),
    b = vertexHeight(x0 + step, z0);
  const c = vertexHeight(x0, z0 + step),
    d = vertexHeight(x0 + step, z0 + step);
  return u + v <= 1
    ? a + u * (b - a) + v * (c - a)
    : d + (1 - u) * (c - d) + (1 - v) * (b - d);
}

export const SLOPE_TEST_GROUND: RabbitGround = {
  spawn: [0, 10],
  center: [0, -2],
  radius: 17,
  height: testGroundHeight,
};

export const SLOPE_TEST_SPOTS = [
  { name: 'Flat', x: 0, z: 10, yaw: Math.PI },
  { name: 'Gentle slope', x: -10, z: 4, yaw: Math.PI },
  { name: 'Steep slope', x: 0, z: 4, yaw: Math.PI },
  { name: 'Side slope', x: 12, z: -2.5, yaw: Math.PI },
  { name: 'Crest / downhill', x: 0, z: -5, yaw: Math.PI },
] as const;
