import { BROADLEAF_TRUNKS } from './broadleafTreeLayout';
import { PINE_TREE_LAYOUT } from './pineTreeLayout';
import type { RabbitGround } from '../characters/rabbitMovement';
import type { TerrainWindConfig } from './terrainWind';

/** Keep the original flat spawn; extend northward into a compact, gentle hill. */
export function windTestHeight(x: number, z: number) {
  const r = Math.hypot(x / 9, (z + 14) / 8);
  return r >= 1 ? 0 : 3.2 * Math.pow(0.5 + 0.5 * Math.cos(Math.PI * r), 1.25);
}
export const WIND_TEST_GROUND: RabbitGround = {
  trunks: [...PINE_TREE_LAYOUT, ...BROADLEAF_TRUNKS],
  spawn: [0, 0],
  center: [0, -8],
  radius: 22,
  height: windTestHeight,
};
export const WIND_TEST_SPOTS = [
  { name: 'Flat start', x: 0, z: 0, yaw: Math.PI },
  { name: 'Broadleaf tree', x: -3, z: -1, yaw: Math.PI, cameraDistance: 6 },
  { name: 'West side', x: -8, z: -14, yaw: Math.PI / 2 },
  { name: 'Hilltop', x: 0, z: -14, yaw: Math.PI / 2 },
  { name: 'East side', x: 8, z: -14, yaw: -Math.PI / 2 },
  { name: 'Quiet patch', x: 10, z: 2, yaw: Math.PI },
];
export const WIND_TEST_CONFIG: TerrainWindConfig = {
  version: 1,
  directionDegrees: 90,
  speed: 4,
  zones: [
    {
      id: 'quiet-patch',
      enabled: true,
      x: 10,
      z: 2,
      radius: 6,
      transition: 3,
      multiplier: 0.4,
    },
  ],
  gust: { enabled: true, strength: 0.6, period: 14, travelSpeed: 6 },
  shelter: { enabled: true, distance: 24, minimum: 0.22 },
};
