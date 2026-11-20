export const sectors = [
  {
    x: 3,
    y: 7,
    color: '#efbf83',
    name: 'The exchange',
    type: 'FINANCIAL SYSTEMS',
    radius: 2.1,
  },
  {
    x: -13,
    y: 0,
    color: '#8fd4bf',
    name: 'The lost archive',
    type: 'FIELD RESEARCH',
    radius: 1.6,
  },
  {
    x: -10,
    y: -9,
    color: '#b6a0f3',
    name: 'The commons',
    type: 'MOBILE EXPERIENCES',
    radius: 1.8,
  },
  {
    x: 13,
    y: -7,
    color: '#88bfe9',
    name: 'The neighborhood',
    type: 'MARKETPLACES',
    radius: 2.4,
  },
  {
    x: 21,
    y: 7,
    color: '#ed9b89',
    name: 'The relay',
    type: 'DIGITAL MEDIA',
    radius: 1.4,
  },
];
export type Pilot = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  destination: number | null;
  near: number | null;
  keys: Set<string>;
  paused: boolean;
};
export function advancePilot(p: Pilot, dt: number) {
  if (p.paused) return;
  const dx =
    Number(p.keys.has('d') || p.keys.has('arrowright')) -
    Number(p.keys.has('a') || p.keys.has('arrowleft'));
  const dy =
    Number(p.keys.has('w') || p.keys.has('arrowup')) -
    Number(p.keys.has('s') || p.keys.has('arrowdown'));
  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    p.targetX = p.x + (dx / length) * 3;
    p.targetY = p.y + (dy / length) * 3;
    p.destination = null;
  }
  const x = p.targetX - p.x,
    y = p.targetY - p.y,
    distance = Math.hypot(x, y);
  const step = Math.min(
    distance,
    Math.min(dt, 0.05) * Math.min(10, distance * 3)
  );
  if (distance > 0.01) {
    p.x += (x / distance) * step;
    p.y += (y / distance) * step;
  }
  p.x = Math.max(-27, Math.min(27, p.x));
  p.y = Math.max(-14, Math.min(14, p.y));
  p.near = sectors.findIndex(
    (s) => Math.hypot(p.x - s.x, p.y - (s.y - s.radius - 1.8)) < 1.8
  );
  if (p.near === -1) p.near = null;
}
export function setCourse(p: Pilot, index: number) {
  const s = sectors[index];
  p.destination = index;
  p.targetX = s.x;
  p.targetY = s.y - s.radius - 1.8;
}

export function steerTo(p: Pilot, x: number, y: number) {
  p.targetX = Math.max(-27, Math.min(27, x));
  p.targetY = Math.max(-14, Math.min(14, y));
  p.destination = null;
}
