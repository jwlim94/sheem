import { Color, MathUtils, Vector3 } from 'three';

/**
 * A day passing (0..1) over Neighbor's office on the way to his desk
 * (deskBeats' `day`), as seen from its east windows (office-local axes: +x
 * east, toward the Wasatch; -x west; -z south): the afternoon sun high in
 * the west (0), setting there (0.18) as the east goes pink over the earth's
 * shadow and the peaks catch the last light; dusk; the night (the moon,
 * opposite the sun, risen over the mountains, the stars and the Milky Way);
 * dawn behind the ridge, the sun up over it (0.82), and the morning (1).
 * Past 1 it goes on into the next day (leaving Neighbor, gradBeats' `day`):
 * the morning on through midday to the afternoon (1 to 1 + BRIDGE), then the
 * same day again from 0 (the afternoon, the sunset, the night).
 */

/** Past the morning (1), on to the next afternoon (0 again). */
export const BRIDGE = 0.2;
/** Where p falls in a day: the day's own p, or (on the bridge from the
 *  morning to the next afternoon) how far across it, as -1 - t. */
function cycle(p: number) {
  if (p <= 1) return p;
  if (p <= 1 + BRIDGE) return -1 - (p - 1) / BRIDGE;
  return Math.min(1, p - 1 - BRIDGE);
}

// The sun's hour angle (radians) through the day: from the afternoon, down
// through the western horizon, under the earth, up over the eastern. It
// lingers near both horizons, so sunset's and dawn's colours have time.
const HOURS: [number, number][] = [
  [0, 0.85],
  [0.12, 0.16],
  [0.26, -0.16],
  [0.36, -0.6],
  [0.6, -Math.PI + 0.6],
  [0.7, -Math.PI + 0.16],
  [0.84, -Math.PI - 0.16],
  [1, -Math.PI - 0.55],
];

function hourAt(p: number): number {
  const q = cycle(p);
  if (q < 0) {
    const t = -1 - q;
    return hourAt(1) + (hourAt(0) - 2 * Math.PI - hourAt(1)) * t;
  }
  if (p > 1) return hourAt(q) - 2 * Math.PI;
  let i = 0;
  while (i < HOURS.length - 2 && p > HOURS[i + 1][0]) i++;
  const [t0, a0] = HOURS[i],
    [t1, a1] = HOURS[i + 1];
  return a0 + (a1 - a0) * MathUtils.clamp((p - t0) / (t1 - t0), 0, 1);
}

/** Where the sun is (unit, office-local) at this point of the day. */
export function sunAt(p: number, out = new Vector3()) {
  const a = hourAt(p);
  return out.set(-Math.cos(a), Math.sin(a), -0.35).normalize();
}

/** Where the moon is: near full, it rises in the east-south-east over the
 *  peaks as the sun sets and climbs slowly through the night, staying low
 *  enough to be seen through the east windows (whose tops are only some
 *  25° up from beside them). */
export function moonAt(p: number, out = new Vector3()): Vector3 {
  const q = cycle(p);
  if (q < 0 || p > 1) {
    // (On the bridge, from the morning's moon to the afternoon's.)
    if (q >= 0) return moonAt(q, out);
    const t = -1 - q;
    return moonAt(1, out).lerp(moonAt(0, tmpMoon), t).normalize();
  }
  const e = -0.06 + 0.42 * MathUtils.smootherstep(p, 0.18, 0.78),
    az = 0.32 + 0.22 * p; // toward the south as it climbs
  return out.set(
    Math.cos(e) * Math.cos(az),
    Math.sin(e),
    -Math.cos(e) * Math.sin(az)
  );
}

/** How much daylight there is (1 by day, 0 at night), from the sun's height. */
export function daylight(p: number) {
  return MathUtils.smoothstep(sunAt(p, tmp).y, -0.16, 0.22);
}
/** How near the sun is to the horizon (1 at sunset and sunrise). */
export function twilight(p: number) {
  const y = sunAt(p, tmp).y;
  return Math.exp(-((y + 0.03) * (y + 0.03)) / 0.03);
}
const tmp = new Vector3(),
  tmpMoon = new Vector3();

// The light on the land through the day (a multiplier on its daytime
// colours): afternoon, the last light, dusk, night, dawn, morning.
const TINTS: [number, string][] = [
  [0, '#ffffff'],
  [0.12, '#ffdcb8'],
  [0.2, '#f0a78e'],
  [0.27, '#9c7590'],
  [0.36, '#3a4066'],
  [0.44, '#171c33'],
  [0.62, '#171c33'],
  [0.7, '#4f4466'],
  [0.77, '#c98a7c'],
  [0.85, '#ffc79a'],
  [1, '#fff4e8'],
].map(([t, c]) => [t as number, c as string]);
const TINT_COLORS = TINTS.map(([, c]) => new Color(c));

/** The light on the land (its daytime colours times this). */
export function landTint(p: number, out = new Color()): Color {
  const q = cycle(p);
  if (q < 0) return landTint(1, out).lerp(TINT_COLORS[0], -1 - q);
  if (p > 1) return landTint(q, out);
  let i = 0;
  while (i < TINTS.length - 2 && p > TINTS[i + 1][0]) i++;
  const k = MathUtils.clamp(
    (p - TINTS[i][0]) / (TINTS[i + 1][0] - TINTS[i][0]),
    0,
    1
  );
  return out.copy(TINT_COLORS[i]).lerp(TINT_COLORS[i + 1], k);
}
