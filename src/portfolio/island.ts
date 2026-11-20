export const ISLAND_RADIUS = 10.7;
export const SPAWN = [0, 8.6] as const;
export const places = [
  {
    id: 'workshop',
    number: '01',
    title: 'The workshop',
    subtitle: 'Selected projects',
    position: [-4.2, -2.8],
    color: '#e9aa75',
    description:
      'A home for my selected projects. This island is an environment preview for now. Project demos and the stories behind them will arrive here next.',
  },
  {
    id: 'observatory',
    number: '02',
    title: 'Little observatory',
    subtitle: 'Experiments & ideas',
    position: [4.6, -3.8],
    color: '#8caac8',
    description:
      'A lookout for small ideas and technical experiments. Interactive prototypes, graphics studies and side projects will find a home here.',
  },
  {
    id: 'garden',
    number: '03',
    title: 'The experience book',
    subtitle: 'Read my experience',
    position: [4.8, 3.4],
    color: '#a3bb80',
    description:
      'A quiet place to share who I am, what I enjoy building and how I work. My introduction, resume and contact details are coming soon.',
  },
] as const;
export type Place = (typeof places)[number];
export const trees = [
  [-7.4, -4.5, 1.15],
  [-6.6, 1.4, 0.95],
  [-2.2, -7.6, 1.1],
  [1.2, -8, 0.85],
  [7.6, -0.8, 1],
  [-6.7, 5.1, 0.85],
] as const;
export const obstacles = [
  { x: -4.2, z: -2.8, radius: 2.05 },
  { x: 4.6, z: -3.8, radius: 1.25 },
  { x: 4.8, z: 3.4, radius: 1.05 },
  ...trees.map(([x, z]) => ({ x, z, radius: 0.3 })),
];

/** Small, independent world boundary; reusable when this route leaves Sheem. */
export function constrainPosition(x: number, z: number) {
  for (const obstacle of obstacles) {
    const dx = x - obstacle.x,
      dz = z - obstacle.z;
    const distance = Math.hypot(dx, dz);
    const radius = obstacle.radius + 0.34;
    if (distance < radius) {
      x = obstacle.x + (distance ? dx / distance : 1) * radius;
      z = obstacle.z + (distance ? dz / distance : 0) * radius;
    }
  }
  const distance = Math.hypot(x, z);
  if (distance > ISLAND_RADIUS) {
    x *= ISLAND_RADIUS / distance;
    z *= ISLAND_RADIUS / distance;
  }
  return { x, z };
}
