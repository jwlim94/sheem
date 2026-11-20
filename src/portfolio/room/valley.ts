/**
 * Chapter 4's way in (2026-11-20): Utah Valley from the air, from BYU in
 * Provo up I-15 to Lehi, where Bridge is. A map in the room's simple style,
 * not a survey: the places where they are, roughly, and the relief
 * exaggerated (x1.4) so the Wasatch reads from altitude.
 *
 * Local to VALLEY_ORIGIN (story.ts), three.js axes: +X east, -Z north, at
 * KM units a kilometre (1 unit = 50 m), BYU's campus at the origin.
 */
export const KM = 20;
const at = (x: number, z: number): [number, number] => [x * KM, z * KM];

/** The towns, their centres and rough extent (units), for the floor map,
 *  the lights at dusk, the listings, and their labels. */
export const TOWNS = [
  { name: 'Provo', at: at(-2.2, 1.8), r: 4.2 * KM, label: true },
  { name: 'Orem', at: at(-2.8, -5.8), r: 3.8 * KM, label: true },
  { name: 'Springville', at: at(4.2, 9.5), r: 2.4 * KM, label: false },
  { name: 'Vineyard', at: at(-6.2, -4.2), r: 1.4 * KM, label: false },
  { name: 'Lindon', at: at(-4.2, -10.6), r: 1.8 * KM, label: false },
  { name: 'Pleasant Grove', at: at(-2.8, -13.4), r: 2.4 * KM, label: true },
  { name: 'American Fork', at: at(-6.8, -17.2), r: 2.6 * KM, label: true },
  { name: 'Lehi', at: at(-11.6, -23.6), r: 3.8 * KM, label: true },
  { name: 'Saratoga Springs', at: at(-18.5, -24.5), r: 2.8 * KM, label: false },
  { name: 'Highland', at: at(-1.8, -20.5), r: 2.2 * KM, label: false },
];

/** Utah Lake's shore (units), round from its south end. */
export const LAKE: [number, number][] = [
  at(-14, 12.5),
  at(-8.5, 9),
  at(-6.4, 4),
  at(-6.8, -1),
  at(-7.6, -6.5),
  at(-9.2, -11.5),
  at(-11.5, -15.5),
  at(-14.5, -18),
  at(-17.5, -21.2),
  at(-19.6, -20.5),
  at(-21.5, -15),
  at(-23.6, -9),
  at(-23.8, -2),
  at(-22.2, 5),
  at(-19, 11),
];

/** I-15, south to north (units). */
export const I15: [number, number][] = [
  at(-1.5, 14),
  at(-3.4, 6),
  at(-3.6, 0),
  at(-3.4, -6),
  at(-4.6, -11),
  at(-7.6, -16),
  at(-9.6, -21),
  at(-10.2, -26),
  at(-11.8, -31),
  at(-12.5, -38),
];

/** Ridges: lines of summits (units), their heights (units, exaggerated)
 *  and how wide they spread. The Wasatch to the east, Timpanogos its peak,
 *  bending west into the Traverse Mountains past Lehi; the Lake Mountains
 *  across the lake; West Mountain to the south. */
export const RIDGES: {
  pts: [number, number][];
  h: number[];
  w: number;
}[] = [
  {
    pts: [
      at(5.6, 16),
      at(4.9, 8),
      at(4.6, 1),
      at(5.6, -4),
      at(7.2, -10),
      at(5.8, -15.5),
      at(2.6, -21.5),
      at(-1, -26.5),
      at(-3, -29),
    ],
    h: [34, 42, 50, 44, 60, 46, 48, 34, 18],
    w: 2.4 * KM,
  },
  {
    pts: [at(-3, -29), at(-8, -30.5), at(-13.5, -31.5), at(-17, -31)],
    h: [18, 16, 13, 6],
    w: 1.6 * KM,
  },
  {
    pts: [at(-26, -26), at(-25, -19), at(-25.6, -12)],
    h: [10, 16, 9],
    w: 2.2 * KM,
  },
  {
    pts: [at(-20, 14), at(-17.5, 9.5)],
    h: [10, 13],
    w: 1.6 * KM,
  },
];

/** BYU's campus. */
export const CAMPUS = at(0, 0);

/** BYU's campus from the air (2026-11-20, the user's calls: a flat pattern
 *  read as nothing; then, every building one plain box, all alike): its
 *  buildings, roughly where its map has them, each built of a few masses
 *  as the real ones are (wings, a courtyard round a glass atrium, a tower
 *  on a podium, a skylit monitor, fly towers), and each its own skin (tan
 *  brick with strip windows or punched ones, pale precast, glass) and roof
 *  (white membrane, grey, gravel, standing-seam teal, skylights), the plant
 *  on top of it (`campusBoxes`). Floors CAMPUS_FLOOR units each, their
 *  height x1.75 so they stand up from the air. The Tanner Building, the
 *  business school, where chapter 3's classroom is, round its atrium, the
 *  Kimball Tower beside it (as in an aerial photo of the campus the user
 *  sent).
 *
 *  A part: [east of the building's centre, south of it, width east-west,
 *  depth north-south, floors, skin, roof] (units; skin and roof default to
 *  the building's). No two parts' faces share a plane where both show
 *  (they'd fight in the depth buffer and flicker): overlapping parts differ
 *  in height and their walls step back (scripts/check-campus.mjs checks).
 */
export const CAMPUS_FLOOR = 0.14;
/** A wall's skin: tan brick with strip windows, or punched ones; pale
 *  precast with strip windows; glass; the plant's louvres; and Lehi's: a
 *  dark glass curtain wall in bands (Bridge's building), silver metal
 *  panels, dark brick with tall windows, a parking garage's open decks, a
 *  house's siding. */
export type Skin =
  | 'ribbon'
  | 'punched'
  | 'precast'
  | 'glass'
  | 'plant'
  | 'curtain'
  | 'panel'
  | 'darkbrick'
  | 'garage'
  | 'siding';
/** A roof: white membrane, grey, gravel, standing-seam teal, a skylight, a
 *  unit's top; a garage's top deck, parked on; a house's shingles. */
export type Roof =
  | 'white'
  | 'grey'
  | 'gravel'
  | 'teal'
  | 'skylight'
  | 'unit'
  | 'deck'
  | 'shingle';
/** A part: [east of the building's centre, south of it, width east-west,
 *  depth north-south, floors, skin, roof, the floor it starts from] (in
 *  its building's own frame). */
export type Part = [
  number,
  number,
  number,
  number,
  number,
  Skin?,
  Roof?,
  number?,
];
export type Building = {
  name: string;
  x: number;
  z: number;
  /** Turned about the vertical (radians, as three.js turns: +x toward -z). */
  rot?: number;
  skin: Skin;
  roof: Roof;
  parts: Part[];
  /** What it is (the listings' cards go on offices). */
  use?: 'office' | 'bridge' | 'garage' | 'home';
};
export const CAMPUS_BUILDINGS: Building[] = [
  {
    name: 'Lee Library',
    x: 2,
    z: 0,
    skin: 'precast',
    roof: 'white',
    parts: [
      [0, -0.4, 3.4, 1.8, 4],
      // Its glass pavilion to the south, skylit.
      [0, 0.85, 2.6, 1.1, 1, 'glass', 'skylight'],
    ],
  },
  {
    name: 'Wilkinson Center',
    x: -2.8,
    z: -3.6,
    skin: 'ribbon',
    roof: 'grey',
    parts: [
      [0.3, -0.45, 2.4, 1.1, 3],
      [-0.8, 0.45, 1.4, 1.1, 2],
      [0.9, 0.35, 1, 0.7, 1.5, 'glass', 'skylight'],
    ],
  },
  {
    name: 'Tanner Building',
    x: -4.6,
    z: -7.4,
    skin: 'punched',
    roof: 'white',
    parts: [
      // Round its atrium: the long wings north and south, the lower ones
      // east and west set back, the atrium's glass roof below them all.
      [0, -0.75, 2.8, 0.7, 6],
      [0, 0.75, 2.8, 0.7, 6],
      [0.98, 0, 0.68, 1.1, 5],
      [-0.98, 0, 0.68, 1.1, 5],
      [0, 0, 1.4, 0.96, 4.4, 'glass', 'skylight'],
    ],
  },
  {
    name: 'Kimball Tower',
    x: -5,
    z: -5.75,
    skin: 'punched',
    roof: 'grey',
    parts: [
      [0, 0, 0.8, 0.52, 12],
      [0.1, 0.35, 1.3, 0.5, 1, 'ribbon'],
      [0, 0, 0.5, 0.3, 12.7, 'plant', 'unit'],
    ],
  },
  {
    name: 'Joseph Smith Building',
    x: 6.2,
    z: 2.6,
    skin: 'punched',
    roof: 'gravel',
    parts: [
      [0, 0, 3, 0.9, 3],
      // Its lantern over the hall.
      [0, 0, 0.7, 1.2, 3.7, 'glass', 'skylight'],
      [1, 0.6, 0.8, 0.8, 2],
    ],
  },
  {
    name: 'Eyring Science Center',
    x: 6.8,
    z: -3,
    skin: 'ribbon',
    roof: 'white',
    parts: [
      // A U round a court open to the east, a glass entry across it.
      [0, -0.75, 2.2, 0.7, 4],
      [0, 0.75, 2.2, 0.7, 4],
      [-0.72, 0, 0.62, 1.1, 3],
      [0.85, 0, 0.4, 0.9, 1, 'glass', 'grey'],
    ],
  },
  {
    name: 'Talmage Building',
    x: 3.8,
    z: -6.4,
    skin: 'precast',
    roof: 'grey',
    parts: [
      [0, 0, 1.4, 2.2, 5],
      [-0.95, 0.5, 0.7, 0.95, 2, 'ribbon', 'gravel'],
    ],
  },
  {
    name: 'Clyde Building',
    x: 8.8,
    z: -7.2,
    skin: 'ribbon',
    roof: 'white',
    parts: [
      [-0.3, 0, 1.6, 1.2, 3],
      [0.65, 0, 0.9, 1.4, 4],
    ],
  },
  {
    name: 'Crabtree Building',
    x: 10.8,
    z: -3.8,
    skin: 'glass',
    roof: 'white',
    parts: [
      [0, 0, 1.5, 1, 3],
      [0.2, 0.55, 0.9, 0.6, 2, 'ribbon', 'grey'],
    ],
  },
  {
    name: 'Benson Building',
    x: 11.2,
    z: 0.6,
    skin: 'punched',
    roof: 'white',
    parts: [
      [0, -0.3, 2, 0.7, 3],
      [0.6, 0.3, 0.7, 1.1, 4],
    ],
  },
  {
    name: 'Maeser Building',
    x: -6.2,
    z: 3,
    skin: 'precast',
    roof: 'gravel',
    parts: [
      [0, 0, 1.4, 0.8, 3],
      [0, 0.5, 0.5, 0.4, 2.5],
    ],
  },
  {
    name: 'Harris Fine Arts Center',
    x: -2.6,
    z: 5,
    skin: 'ribbon',
    roof: 'gravel',
    parts: [
      [0, 0, 3.2, 2.4, 3],
      // Its skylit concourse, and its theatres' fly towers.
      [0.1, 0, 2, 0.5, 3.5, 'glass', 'skylight'],
      [-1, -0.6, 0.8, 0.8, 5, 'punched', 'grey'],
      [1.05, 0.65, 0.7, 0.7, 4.4, 'punched', 'grey'],
    ],
  },
  {
    name: 'Museum of Art',
    x: -7.6,
    z: 7.6,
    skin: 'ribbon',
    roof: 'white',
    parts: [
      [0, 0, 2.6, 1.4, 2],
      [0, 0, 1.8, 0.3, 2.5, 'glass', 'skylight'],
      [-1.2, 0.75, 0.6, 0.5, 1.5, 'glass', 'grey'],
    ],
  },
  {
    name: 'JFSB',
    x: 4.2,
    z: 6.2,
    skin: 'punched',
    roof: 'white',
    parts: [
      // Two wings, a glass-roofed atrium between.
      [0, -0.45, 3, 0.5, 4],
      [0, 0.45, 3, 0.5, 4],
      [0, 0, 2.6, 0.6, 3.5, 'glass', 'skylight'],
    ],
  },
  {
    name: 'Smith Fieldhouse',
    x: -7,
    z: -1.6,
    skin: 'precast',
    roof: 'teal',
    parts: [
      [0, 0, 2.4, 1.6, 3],
      [0, 0.95, 1.2, 0.5, 1.5, 'glass', 'grey'],
    ],
  },
  {
    name: 'Martin Building',
    x: 8.2,
    z: 5.2,
    skin: 'punched',
    roof: 'grey',
    parts: [[0, 0, 1.4, 1, 3]],
  },
  {
    name: 'Engineering Building',
    x: 12.8,
    z: -8.6,
    skin: 'glass',
    roof: 'white',
    parts: [
      [0, -0.25, 2.6, 1, 5],
      [-0.5, 0.45, 1.4, 0.8, 3, 'punched', 'grey'],
    ],
  },
  {
    name: 'Life Sciences Building',
    x: 14.2,
    z: 3.6,
    skin: 'punched',
    roof: 'white',
    parts: [
      [-0.9, 0, 1.2, 1.6, 4],
      [0.9, 0.1, 1.2, 1.2, 4],
      [0, 0, 0.8, 0.6, 3, 'glass', 'grey'],
    ],
  },
  // Smaller ones between (the campus is denser than its landmarks).
  {
    name: 'north quad',
    x: 0.4,
    z: -6.6,
    skin: 'ribbon',
    roof: 'white',
    parts: [[0, 0, 2, 1.1, 4]],
  },
  {
    name: 'east of the Eyring',
    x: 9.2,
    z: -1.6,
    skin: 'precast',
    roof: 'grey',
    parts: [[0, 0, 1.2, 1, 3]],
  },
  {
    name: 'south of the library',
    x: 0.8,
    z: 3.8,
    skin: 'ribbon',
    roof: 'gravel',
    parts: [[0, 0, 1.6, 1, 3]],
  },
  {
    name: 'west of the Fieldhouse',
    x: -10.2,
    z: -1.6,
    skin: 'ribbon',
    roof: 'white',
    parts: [
      [0, 0, 1.8, 1.3, 3],
      [0.4, -0.75, 0.8, 0.5, 2, 'glass', 'grey'],
    ],
  },
  {
    name: 'by the Talmage',
    x: 6.2,
    z: -5.6,
    skin: 'punched',
    roof: 'gravel',
    parts: [[0, 0, 1.2, 0.8, 2]],
  },
  {
    name: 'southeast',
    x: 11,
    z: 6.4,
    skin: 'precast',
    roof: 'white',
    parts: [[0, 0, 1.8, 1, 3]],
  },
  {
    name: 'east',
    x: 15.2,
    z: -3,
    skin: 'ribbon',
    roof: 'grey',
    parts: [[0, 0, 1.6, 1.2, 3]],
  },
  {
    name: 'north of the Tanner',
    x: -1.9,
    z: -9.2,
    skin: 'precast',
    roof: 'white',
    parts: [[0, 0, 1.2, 0.9, 3]],
  },
  {
    name: 'north of the Talmage',
    x: 3.4,
    z: -9.4,
    skin: 'ribbon',
    roof: 'white',
    parts: [
      [0, 0, 1.8, 0.9, 3],
      [-0.5, 0.55, 0.6, 0.5, 2],
    ],
  },
  {
    name: 'west of the Maeser',
    x: -10.2,
    z: 3.4,
    skin: 'punched',
    roof: 'gravel',
    parts: [[0, 0, 1.6, 1.1, 3]],
  },
  {
    name: 'south of the Martin',
    x: 7.4,
    z: 8,
    skin: 'precast',
    roof: 'grey',
    parts: [[0, 0, 1.4, 1, 2]],
  },
  {
    name: 'south of the HFAC',
    x: -3.6,
    z: 8.4,
    skin: 'ribbon',
    roof: 'white',
    parts: [[0, 0, 1.8, 0.9, 3]],
  },
];

/** The campus's footprints are drawn this much larger than its map's (its
 *  heights as they are): from the air they stood too far apart. */
const CAMPUS_SPREAD = 1.15;

/** A box of a building (units, VALLEY_ORIGIN's frame): its footprint's
 *  centre, size and turn, its base and height, the ground's height round it
 *  (its floors count from there), its skin and roof, a seed for its
 *  variations, its building's index; its centre in its building's frame. */
export type Box = {
  x: number;
  z: number;
  w: number;
  d: number;
  rot: number;
  y: number;
  h: number;
  ground: number;
  skin: Skin;
  roof: Roof;
  seed: number;
  building: number;
  /** A building's own part (not the plant set on its roof). */
  part: boolean;
  lx: number;
  lz: number;
};
/** @deprecated the campus's boxes are Boxes. */
export type CampusBox = Box;

const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Every box of some buildings: each one's parts (their footprints `spread`
 *  times their own), standing on one base a little below the lowest ground
 *  under any of them, `floor` units a floor; then, on the roofs, their
 *  plant: on each building's biggest roof a plant room, and a few units on
 *  each (none on skylights, metal, decks or shingles), clear of the
 *  parapets, of each other and of the taller parts. `unit` scales the
 *  plant and its margins (the campus's 1). Worked out in each building's
 *  own frame, then turned and set in place. */
export function boxesOf(
  buildings: Building[],
  {
    floor,
    spread = 1,
    unit = 1,
  }: { floor: number; spread?: number; unit?: number }
): Box[] {
  const out: Box[] = [];
  buildings.forEach((b, bi) => {
    const rot = b.rot ?? 0,
      cos = Math.cos(rot),
      sin = Math.sin(rot);
    // From the building's frame to the valley's.
    const place = (lx: number, lz: number): [number, number] => [
      b.x + lx * cos + lz * sin,
      b.z - lx * sin + lz * cos,
    ];
    const at = b.parts.map(
      ([dx, dz, w, d, ...rest]): Part => [
        dx * spread,
        dz * spread,
        w * spread,
        d * spread,
        ...rest,
      ]
    );
    const corners = at.flatMap(([dx, dz, w, d]) =>
      [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz]) =>
        height(...place(dx + (sx * w) / 2, dz + (sz * d) / 2))
      )
    );
    const ground = height(b.x, b.z),
      y = Math.min(...corners) - 0.2;
    // Its parts and plant, in its own frame (x, z its centre's there).
    type Local = Omit<Box, 'x' | 'z' | 'lx' | 'lz' | 'rot'> & {
      x: number;
      z: number;
    };
    const parts = at.map(
      ([dx, dz, w, d, floors, skin, roof, from = 0], i): Local => ({
        x: dx,
        z: dz,
        w,
        d,
        y: from > 0 ? ground + from * floor : y,
        h: from > 0 ? (floors - from) * floor : ground - y + floors * floor,
        ground,
        skin: skin ?? b.skin,
        roof: roof ?? b.roof,
        seed: rnd(bi * 7.3 + i * 1.7),
        building: bi,
        part: true,
      })
    );
    const local: Local[] = [...parts];
    const top = (p: Local) => p.y + p.h;
    const hits = (
      a: { x: number; z: number; w: number; d: number },
      c: { x: number; z: number; w: number; d: number },
      m: number
    ) =>
      Math.abs(a.x - c.x) < (a.w + c.w) / 2 + m &&
      Math.abs(a.z - c.z) < (a.d + c.d) / 2 + m;
    const roofs = parts
      .filter(
        (p) =>
          (p.roof === 'white' || p.roof === 'grey' || p.roof === 'gravel') &&
          p.y === y &&
          p.h - (ground - y) >= 2 * floor - 1e-6
      )
      .sort((a, c) => c.w * c.d - a.w * a.d);
    roofs.forEach((p, ri) => {
      const placed: { x: number; z: number; w: number; d: number }[] = [],
        want =
          Math.min(5, Math.round((p.w * p.d * 1.6) / (unit * unit))) +
          (ri === 0 ? 1 : 0);
      for (let k = 0; k < 40 && placed.length < want; k++) {
        const s = bi * 31.7 + ri * 5.1 + k * 2.3,
          room = ri === 0 && placed.length === 0,
          w = room
            ? p.w * (0.26 + rnd(s) * 0.1)
            : (0.12 + rnd(s) * 0.22) * unit,
          d = room
            ? p.d * (0.3 + rnd(s + 1) * 0.1)
            : (0.1 + rnd(s + 1) * 0.16) * unit,
          h =
            (room ? 0.1 + rnd(s + 2) * 0.03 : 0.035 + rnd(s + 2) * 0.045) *
            unit,
          ix = p.w / 2 - w / 2 - 0.1 * unit,
          iz = p.d / 2 - d / 2 - 0.1 * unit;
        if (ix <= 0 || iz <= 0) continue;
        const u = {
          x: p.x + (rnd(s + 3) * 2 - 1) * ix,
          z: p.z + (rnd(s + 4) * 2 - 1) * iz,
          w,
          d,
        };
        if (placed.some((q) => hits(u, q, 0.06 * unit))) continue;
        if (
          parts.some(
            (q) => q !== p && top(q) > top(p) - 0.01 && hits(u, q, 0.06 * unit)
          )
        )
          continue;
        placed.push(u);
        local.push({
          ...u,
          y: top(p),
          h,
          ground,
          skin: 'plant',
          roof: room ? 'grey' : 'unit',
          seed: rnd(s + 5),
          building: bi,
          part: false,
        });
      }
    });
    for (const l of local) {
      const [x, z] = place(l.x, l.z);
      out.push({ ...l, x, z, rot, lx: l.x, lz: l.z });
    }
  });
  return out;
}

/** The campus's square (units): west edge, north edge, size. Its shadows'
 *  heights and its painted ground cover it. */
export const CAMPUS_AREA = { x: -12, z: -13, size: 32 };

/** BYU's campus's boxes. */
export const campusBoxes = () =>
  boxesOf(CAMPUS_BUILDINGS, { floor: CAMPUS_FLOOR, spread: CAMPUS_SPREAD });

/** Bridge's office in Lehi: the building Spaces has on Triumph Boulevard
 *  (the user's, 2026-11-20: its satellite view and a photo), south of SR-92
 *  a few hundred metres east of I-15; the centre of its footprint (units;
 *  the map's own Lehi, a little east of I-15). Lehi's buildings are drawn
 *  at four times their size, so they read as a place on the map, and the
 *  streets and lots round them too (lehi.ts): a floor is FLOOR_H units. */
export const BRIDGE_AT = at(-8.5, -25.4);
export const BUILDING_SCALE = 4;
export const FLOOR_H = (4 / 50) * BUILDING_SCALE;
/** Its footprint (its main glass block, its panelled stair tower and its
 *  brick end; lehi.ts) and its floors (the tower a little over five). */
export const BRIDGE_BOX = { w: 3.1, d: 4.7, floors: 5.35 };
/** His window: on its west face, the dark glass's, toward Triumph
 *  Boulevard and the low sun; on the third floor, a little south of the
 *  middle, three panes of the curtain wall wide (HIS_PANE each, as the
 *  buildings' shader lays them: 0.058 of the campus's unit; this, their
 *  middle one's centre). His office is behind it (hisOffice.ts). */
export const HIS_PANE = 0.058 * (FLOOR_H / CAMPUS_FLOOR);
export const HIS_WINDOW: [number, number, number] = [
  BRIDGE_AT[0] - 1.4,
  FLOOR_H * 2.5,
  (Math.floor((BRIDGE_AT[1] + 0.62) / HIS_PANE) + 0.5) * HIS_PANE,
];

/** The terrain's square (units): its centre and size. */
export const FLOOR = { cx: -8 * KM, cz: -12 * KM, size: 64 * KM };

/** Distance from p to the segment a-b, and how far along it (0..1). */
function seg(px: number, pz: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = dx * dx + dz * dz,
    t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l));
  return { d: Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz), t };
}

/** Smooth value noise in [-1, 1], for the slopes' roughness. */
function noise(x: number, z: number) {
  const s = (a: number, b: number) => {
    const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return (v - Math.floor(v)) * 2 - 1;
  };
  const ix = Math.floor(x),
    iz = Math.floor(z),
    fx = x - ix,
    fz = z - iz,
    ux = fx * fx * (3 - 2 * fx),
    uz = fz * fz * (3 - 2 * fz);
  const a = s(ix, iz),
    b = s(ix + 1, iz),
    c = s(ix, iz + 1),
    d = s(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/** BYU's campus sits on a level bench: under its buildings the ground is
 *  flat at FLAT.h, easing back into the hills over FLAT.ease beyond.
 *  (2026-11-20: on the Wasatch's roughened foot, the terrain's coarse
 *  triangles rose through some of its roofs, and those buildings looked to
 *  change shape as the camera moved.) */
const FLAT = { x0: -14, x1: 18, z0: -14, z1: 12, h: 0.55, ease: 12 };

/** The ground's height (units) at x, z: each ridge's nearest point's height
 *  falling away across it, roughened, over a flat valley floor; level under
 *  BYU's campus. */
export function height(x: number, z: number) {
  const out = Math.hypot(
      Math.max(FLAT.x0 - x, 0, x - FLAT.x1),
      Math.max(FLAT.z0 - z, 0, z - FLAT.z1)
    ),
    k = Math.min(1, out / FLAT.ease),
    s = k * k * (3 - 2 * k);
  return s >= 1 ? hills(x, z) : FLAT.h + (hills(x, z) - FLAT.h) * s;
}

function hills(x: number, z: number) {
  let h = 0;
  for (const r of RIDGES)
    for (let i = 0; i < r.pts.length - 1; i++) {
      const { d, t } = seg(x, z, r.pts[i], r.pts[i + 1]),
        top = r.h[i] + (r.h[i + 1] - r.h[i]) * t,
        k = d / r.w;
      if (k < 3) h = Math.max(h, top * Math.exp(-k * k));
    }
  if (h < 0.2) return 0;
  const rough =
    noise(x / 14, z / 14) * 0.18 +
    noise(x / 5, z / 5) * 0.08 +
    noise(x / 2.2, z / 2.2) * 0.03;
  return Math.max(0, h * (1 + rough) + rough * 2);
}

/** The flight (units, in VALLEY_ORIGIN's frame): from over BYU, looking
 *  straight down onto the campus, up and north over the valley along I-15,
 *  down over Lehi, west of Bridge's building, and round to its west face,
 *  to his lit window. */
export const PATH: [number, number, number][] = [
  [6, 26, 15],
  [4, 104, 24],
  [-22, 118, -40],
  [-72, 108, -190],
  [-146, 84, -350],
  [-182, 48, -446],
  [-196, 22, -484],
  [HIS_WINDOW[0] - 11, HIS_WINDOW[1] + 3.5, HIS_WINDOW[2] + 2.5],
  [HIS_WINDOW[0] - 4.2, HIS_WINDOW[1] + 0.5, HIS_WINDOW[2] + 0.4],
  [HIS_WINDOW[0] - 0.95, HIS_WINDOW[1] + 0.02, HIS_WINDOW[2]],
];

/** Where the camera looks at first, straight down from the start: BYU's
 *  campus. */
export const START_LOOK: [number, number, number] = [2, 0, -4];
