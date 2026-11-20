import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Room } from './Classmates';

/** Deterministic pseudo-random in [0, 1) (Classmates' own). */
function rand(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Who sits where: each taken seat, its sitter's pose (0 typing, 1 leaning
 *  back, 2 chin on hand, 3 arms crossed), their place (the seat turned a
 *  little, their size), when they arrive, and their number (for the dice).
 *  DeskThings reads it too, to put each one's things on their desk. */
export function occupants(room: Room) {
  const out: {
    seat: Room['seats'][number];
    pose: number;
    yaw: number;
    m: Matrix4;
    t: number;
    n: number;
  }[] = [];
  let n = 0;
  for (const seat of room.seats) {
    const { row, z } = seat;
    // Him and the seats around him stay free; a few scattered gaps too.
    if (room.free(seat)) continue;
    if (rand(row * 97 + z * 13.1) < 0.07) continue;
    n++;
    const r = rand(n * 5.17),
      pose = r < 0.4 ? 0 : r < 0.62 ? 1 : r < 0.82 ? 2 : 3,
      yaw = seat.yaw + (rand(n * 3.1) - 0.5) * 0.14,
      s = 0.95 + rand(n * 7.7) * 0.1,
      m = new Matrix4().compose(
        new Vector3(seat.x, seat.y, z),
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw),
        new Vector3(s, s, s)
      ),
      t = room.arrive[0] + room.arrive[1] * rand(n * 13.37); // their arrival
    out.push({ seat, pose, yaw, m, t, n });
  }
  return out;
}
