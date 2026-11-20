import { obstacles, ISLAND_RADIUS } from './island';

export type ReadingPhase =
  | 'idle'
  | 'walking'
  | 'turning'
  | 'sitting'
  | 'unpacking'
  | 'seated'
  | 'zooming'
  | 'reading'
  | 'returning'
  | 'packing'
  | 'standing'
  | 'releasing';
export type ReadingState = ReturnType<typeof createReadingState>;
export const BENCH_APPROACH = [4.8, 5.05] as const;
export const BENCH_SEAT = [4.8, 3.61] as const;
export const BENCH_SEAT_TOP = 0.74;
export const BOOK_LAP = {
  height: 0.47,
  forward: 0.39,
  pitch: -1.15,
  scale: 0.6,
} as const;
// V65 posed body bottom is ~0.169 above its actor origin. Allow a small
// contact margin across the idle breath and book-reach poses.
export const SEATED_ROOT_HEIGHT = BENCH_SEAT_TOP - 0.16;
export const ease = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
/** A small backward hop clears the seat before a soft landing. */
export const seatLift = (progress: number) =>
  SEATED_ROOT_HEIGHT * ease(progress) +
  Math.sin(Math.PI * progress) ** 2 * 0.22;
export function createReadingState() {
  return {
    phase: 'idle' as ReadingPhase,
    labView: '' as '' | 'front' | 'side' | 'three-quarter',
    heldBookPosition: [0, 0, 0] as [number, number, number],
    heldBookQuaternion: [0, 0, 0, 1] as [number, number, number, number],
    bookAttached: false,
    contactError: 0,
    seatContactError: 0,
    armReachError: 0,
    command: '' as '' | 'sit' | 'read' | 'back' | 'leave',
    seat: 0,
    book: 0,
    zoom: 0,
    camera: 0,
    turn: 0,
    startYaw: 0,
    path: [] as [number, number][],
    page: 0,
    pageTurn: 1,
    elapsed: 0,
  };
}

// A small visibility-smoothed A* route on the existing authored collision map.
// Never move the rabbit through the workshop, trees or the back of the bench.
export function benchPath(x: number, z: number): [number, number][] {
  const spacing = 0.35,
    size = 63,
    half = 31;
  const point = (id: number): [number, number] => [
    ((id % size) - half) * spacing,
    (Math.floor(id / size) - half) * spacing,
  ];
  const idAt = (a: number, b: number) =>
    (Math.round(b / spacing) + half) * size + Math.round(a / spacing) + half;
  const free = (a: number, b: number) =>
    Math.hypot(a, b) <= ISLAND_RADIUS &&
    obstacles.every((o) => Math.hypot(a - o.x, b - o.z) > o.radius + 0.37);
  const line = (a: readonly number[], b: readonly number[]) => {
    const count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.08);
    for (let i = 1; i <= count; i++)
      if (
        !free(
          a[0] + ((b[0] - a[0]) * i) / count,
          a[1] + ((b[1] - a[1]) * i) / count
        )
      )
        return false;
    return true;
  };
  const end = [...BENCH_APPROACH] as [number, number];
  if (line([x, z], end)) return [end];
  let start = idAt(x, z);
  if (!free(...point(start))) {
    let best = Infinity;
    for (let i = 0; i < size * size; i++) {
      const p = point(i),
        d = Math.hypot(p[0] - x, p[1] - z);
      if (d < best && free(...p) && line([x, z], p)) {
        best = d;
        start = i;
      }
    }
    if (!Number.isFinite(best)) return [];
  }
  const goal = idAt(...end),
    open = new Set([start]),
    costs = new Map([[start, 0]]),
    previous = new Map<number, number>();
  while (open.size) {
    let current = -1,
      best = Infinity;
    for (const id of open) {
      const p = point(id),
        score = costs.get(id)! + Math.hypot(p[0] - end[0], p[1] - end[1]);
      if (score < best) {
        best = score;
        current = id;
      }
    }
    if (current === goal) {
      const route: [number, number][] = [end];
      let node = current;
      while (node !== start) {
        route.unshift(point(node));
        node = previous.get(node)!;
      }
      const result: [number, number][] = [];
      let from: readonly number[] = [x, z];
      while (route.length) {
        let i = route.length - 1;
        while (i > 0 && !line(from, route[i])) i--;
        from = route[i];
        result.push(route[i]);
        route.splice(0, i + 1);
      }
      return result;
    }
    open.delete(current);
    for (const dx of [-1, 0, 1])
      for (const dz of [-1, 0, 1]) {
        if (!dx && !dz) continue;
        const a = (current % size) + dx,
          b = Math.floor(current / size) + dz;
        if (a < 0 || a >= size || b < 0 || b >= size) continue;
        const next = b * size + a,
          p = point(next);
        if (!free(...p) || !line(point(current), p)) continue;
        const cost = costs.get(current)! + Math.hypot(dx, dz) * spacing;
        if (cost < (costs.get(next) ?? Infinity)) {
          costs.set(next, cost);
          previous.set(next, current);
          open.add(next);
        }
      }
  }
  return [];
}
