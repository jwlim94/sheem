import { BRIDGE_AT, boxesOf, CAMPUS_FLOOR, FLOOR_H, height } from './valley';
import type { Box, Building } from './valley';

/**
 * Where Bridge was, in Lehi (2026-11-20, after the user's satellite view and
 * photo): the building Spaces has on Triumph Boulevard, south of SR-92, a
 * few hundred metres east of I-15, and round it what the satellite shows:
 * SR-92 across the north with its frontage roads and the Murdock Canal
 * Trail beside it; Triumph Boulevard curving down past its west face; 3400
 * North and Innovation Way; the hotel with its pool across the lot north
 * of it; its parking garage to the east; the big offices with their
 * garages east along Innovation Way; the Lehi Rail Trail running
 * south-east; townhouses to the south-east; lots everywhere, and the bare
 * dirt between. Roughly, not a survey; drawn at BUILDING_SCALE (four times
 * its size), as the buildings are, so it reads as a place from the air.
 *
 * In units, from Bridge's building's centre (BRIDGE_AT): +x east, +z south.
 */
export const LEHI_UNIT = FLOOR_H / CAMPUS_FLOOR;
const L = (x: number, z: number) => ({
  x: BRIDGE_AT[0] + x,
  z: BRIDGE_AT[1] + z,
});

// The rail trail's way and the turn of the buildings along it.
const ALONG_TRAIL = -0.728;
// Townhouses in rows of four, each its own gable to the street, every
// other one set back a little and a little taller.
const townhouses: Building[] = [7, 9.4, 12.2, 14.6].flatMap((z) =>
  [12.6, 16.4, 20.2, 24].map(
    (x): Building => ({
      name: 'townhouses',
      ...L(x, z),
      skin: 'siding',
      roof: 'shingle',
      use: 'home',
      parts: [0, 1, 2, 3].map((k) => [
        -1.245 + k * 0.83,
        (k % 2) * 0.08 - 0.04,
        0.83,
        0.95,
        2.2 + (k % 2) * 0.25,
      ]),
    })
  )
);

/** Its buildings. Parts as valley.ts's (no two faces in one plane where
 *  both show: scripts/check-campus.mjs checks these too). */
export const LEHI_BUILDINGS: Building[] = [
  {
    // Spaces: Bridge's office, his window on its west face.
    name: 'Spaces (Bridge)',
    ...L(0, 0),
    skin: 'curtain',
    roof: 'white',
    use: 'bridge',
    parts: [
      // Its main block, dark glass in bands up four floors over a glass
      // ground floor.
      [0, 0.525, 2.8, 3.65, 5],
      // Its stair tower in silver panels, standing proud of the glass and
      // a little over it.
      [-0.2, -1.45, 2.7, 0.5, 5.35, 'panel', 'grey'],
      // Its north end in dark brick, tall windows.
      [0, -1.95, 2.5, 0.8, 5, 'darkbrick'],
      // The white canopy over its entrance.
      [-1.585, 0.9, 0.47, 2.2, 1.12, 'panel', 'grey', 0.96],
    ],
  },
  {
    name: 'its garage',
    ...L(4, 1.2),
    skin: 'garage',
    roof: 'deck',
    use: 'garage',
    parts: [
      [0, 0, 3.3, 7, 3],
      [1.25, -3.3, 0.6, 0.6, 3.6, 'panel', 'grey'],
    ],
  },
  {
    name: 'the hotel',
    ...L(-0.5, -6.6),
    skin: 'precast',
    roof: 'white',
    use: 'office',
    parts: [
      [0, -0.55, 5.8, 1.2, 4],
      [2.2, 0.45, 1.2, 1.6, 3],
    ],
  },
  {
    name: 'north of 3400 N',
    ...L(0.6, -12.5),
    skin: 'glass',
    roof: 'white',
    use: 'office',
    parts: [
      [0, 0, 3.4, 2.5, 3],
      [-1.95, 0.3, 0.6, 1.2, 1.5, 'glass', 'grey'],
    ],
  },
  {
    name: 'by the rail trail',
    ...L(-12.4, -11.27),
    rot: ALONG_TRAIL,
    skin: 'precast',
    roof: 'white',
    use: 'office',
    parts: [
      [0, 0, 5, 2.6, 3],
      [1.8, -1.55, 1, 0.6, 2, 'glass', 'grey'],
    ],
  },
  {
    name: 'on Ridge Drive',
    ...L(-7.5, 12.9),
    rot: -0.94,
    skin: 'glass',
    roof: 'grey',
    use: 'office',
    parts: [[0, 0, 5, 2, 2]],
  },
  {
    name: 'the inn',
    ...L(-19.5, 0.5),
    rot: -0.73,
    skin: 'punched',
    roof: 'white',
    use: 'office',
    parts: [
      [0, 0, 4.4, 1.5, 4],
      [0, 1, 1.2, 0.8, 1.5, 'glass', 'grey'],
    ],
  },
  {
    name: 'Innovation Pointe west',
    ...L(18.9, -11.2),
    skin: 'glass',
    roof: 'white',
    use: 'office',
    parts: [[0, 0, 5.1, 2, 5]],
  },
  {
    name: 'Innovation Pointe east',
    ...L(24.5, -11.7),
    skin: 'precast',
    roof: 'white',
    use: 'office',
    parts: [[0, 0, 5, 2.5, 5]],
  },
  {
    name: 'Innovation Pointe garage west',
    ...L(18.9, -7.9),
    skin: 'garage',
    roof: 'deck',
    use: 'garage',
    parts: [[0, 0, 4.8, 4.2, 3]],
  },
  {
    name: 'Innovation Pointe garage east',
    ...L(24.3, -7.9),
    skin: 'garage',
    roof: 'deck',
    use: 'garage',
    parts: [[0, 0, 5, 4.2, 3]],
  },
  {
    name: 'the strip north of SR-92',
    ...L(0.8, -21.6),
    skin: 'precast',
    roof: 'white',
    use: 'office',
    parts: [[0, 0, 7.2, 1.1, 1]],
  },
  {
    name: 'the hotel north of SR-92',
    ...L(-11.7, -22.4),
    skin: 'precast',
    roof: 'white',
    use: 'office',
    parts: [[0, 0, 4.6, 2.6, 4]],
  },
  {
    name: 'north-east of SR-92',
    ...L(14, -23),
    skin: 'glass',
    roof: 'grey',
    use: 'office',
    parts: [[0, 0, 3.1, 2.6, 2]],
  },
  {
    name: 'south-east',
    ...L(12.5, 2),
    skin: 'ribbon',
    roof: 'gravel',
    use: 'office',
    parts: [[0, 0, 3.2, 2, 2]],
  },
  ...townhouses,
];

export const lehiBoxes = () =>
  boxesOf(LEHI_BUILDINGS, { floor: FLOOR_H, unit: LEHI_UNIT });

/** Its ground's square (units, VALLEY_ORIGIN's frame): west edge, north
 *  edge, size. Its shadows' heights and its painted ground cover it; the
 *  same painting, sharper, covers LEHI_NEAR, the ground the camera comes
 *  down over to his window. */
export const LEHI_AREA = {
  x: BRIDGE_AT[0] - 32,
  z: BRIDGE_AT[1] - 32,
  size: 64,
};
export const LEHI_NEAR = {
  x: BRIDGE_AT[0] - 14,
  z: BRIDGE_AT[1] - 9,
  size: 18,
};

/** Its roads, from its centre (units): their ways and widths. SR-92, from
 *  I-15 east past Bridge's office (drawn in full here; SR92_WAY, in the
 *  valley's frame, on to the east, the terrain's). */
export const SR92: [number, number][] = [
  [-36, -16.6],
  [36, -20.6],
];
export const SR92_WAY: [number, number][] = [...SR92, [70, -23.5]].map(
  ([x, z]) => [BRIDGE_AT[0] + x, BRIDGE_AT[1] + z]
);
export const ROADS: { pts: [number, number][]; w: number; median?: number }[] =
  [
    // Triumph Boulevard, a planted median down it.
    {
      pts: [
        [-6.2, -34],
        [-6.2, -9.5],
        [-5, -6.2],
        [-3.3, -3.6],
        [-2.5, -0.6],
        [-2.35, 4],
        [-2, 34],
      ],
      w: 1.1,
      median: 0.24,
    },
    // 3400 North.
    {
      pts: [
        [-6.2, -9.2],
        [1.6, -8.9],
        [5.3, -7.6],
        [8.1, -6],
        [10.5, -3.6],
      ],
      w: 0.62,
    },
    // Innovation Way.
    {
      pts: [
        [6.9, -7.3],
        [9.2, -11],
        [11.2, -13.9],
        [16, -14.7],
        [22, -15.2],
        [36, -16.4],
      ],
      w: 0.56,
    },
    // Ridge Drive.
    {
      pts: [
        [-27, -3.5],
        [-19, 7.6],
        [-12.5, 16.7],
        [-9, 34],
      ],
      w: 0.5,
    },
    // The townhouses' streets.
    {
      pts: [
        [10.3, 8.2],
        [26.4, 8.2],
      ],
      w: 0.44,
    },
    {
      pts: [
        [10.3, 13.4],
        [26.4, 13.4],
      ],
      w: 0.44,
    },
    {
      pts: [
        [10.3, 5.4],
        [10.3, 16.4],
      ],
      w: 0.44,
    },
    {
      pts: [
        [26.4, 5.4],
        [26.4, 16.4],
      ],
      w: 0.44,
    },
    {
      pts: [
        [10.5, -3.6],
        [9.5, 1],
        [10.3, 5.4],
      ],
      w: 0.5,
    },
    // Bridge's drive, between it and its garage.
    {
      pts: [
        [1.85, -5],
        [1.85, 5],
      ],
      w: 0.6,
    },
  ];
/** The trails: the Lehi Rail Trail south-east, the Murdock Canal Trail
 *  beside SR-92. */
export const TRAILS: [number, number][][] = [
  [
    [-30, -23.75],
    [-20.3, -15.1],
    [2.8, 5.5],
    [7.5, 11],
    [10, 20],
    [12, 34],
  ],
  [
    [-36, -14.45],
    [36, -18.45],
  ],
];
/** The lots: centre, size along and across, turn (as a building's). */
export const LOTS: [number, number, number, number, number?][] = [
  [0.2, -4.1, 5.4, 2.2],
  [-3.1, -12.5, 2.2, 4],
  [4.5, -12.5, 2.8, 4],
  [0.6, -15.25, 6.4, 1.3],
  [-10.47, -13.43, 5.6, 2.2, ALONG_TRAIL],
  [-7, -5.25, 3.4, 1.8, ALONG_TRAIL],
  [14.2, -10.5, 3.6, 6],
  [29, -10, 3.2, 6],
  [-9.1, 14.1, 5, 1.6, -0.94],
  [-5.9, 11.7, 4.4, 1.4, -0.94],
  [-18.2, -0.9, 4.4, 1.8, -0.73],
  [12.5, 4.1, 3.6, 1.3],
  [-11.7, -25.3, 4.6, 1.8],
  [0.8, -23.4, 7, 2.2],
];
/** The hotel's pool. */
export const POOL = { x: -1.4, z: -5.95, w: 1.4, d: 0.6 };

/** A stall (2.7 by 5.5 m) and a car (4.6 by 1.85 by 1.45 m), at its scale;
 *  the aisle between a lot's rows. */
export const STALL = { w: 0.216, d: 0.44, aisle: 0.56 };
export const CAR = { w: 0.148, l: 0.37, h: 0.116 };
const rnd = (n: number) => {
  const x = Math.sin((n * 1.913 + 7.7) * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const imod = (a: number, n: number) => ((a % n) + n) % n;

/** Every lot's stalls, in rows back to back with aisles between (in the
 *  lot's frame: u along it from its centre, v across; a stall's corner),
 *  whether a car is in it (most are), and its car's colour (0..1). */
export function lotStalls() {
  const out: {
    lot: number;
    u: number;
    v: number;
    front: boolean;
    car: boolean;
    colour: number;
  }[] = [];
  LOTS.forEach(([, , w, d], lot) => {
    let n = lot * 977;
    for (
      let v = -d / 2 + STALL.aisle;
      v + 2 * STALL.d <= d / 2 + 1e-6;
      v += 2 * STALL.d + STALL.aisle
    )
      for (const [row, front] of [
        [v, true],
        [v + STALL.d, false],
      ] as const)
        for (let u = -w / 2 + 0.3; u + STALL.w <= w / 2 - 0.3; u += STALL.w) {
          n++;
          out.push({
            lot,
            u,
            v: row,
            front,
            car: rnd(n) < 0.68,
            colour: rnd(n + 0.5),
          });
        }
  });
  return out;
}

/** Whether a garage's top-deck stall (its index along the row, its row
 *  across the deck, the garage's seed) has a car in it. Whole numbers only,
 *  so the deck's shader, which draws their shadows, says the same
 *  (valleyBuildings.ts deckCar). */
export const deckTaken = (k: number, j: number, seed: number) =>
  imod(k * k * 3 + k * 11 + j * 17 + Math.floor(Math.fround(seed) * 23), 23) <
  16;

/** The parked cars, in the valley's frame: in the lots, and on the
 *  garages' top decks (laid out as the deck's shader lays out its stalls:
 *  rows across the deck, its stripes along it). Each: where, its turn
 *  (its length along its own z, its front toward +z), its colour. */
export function lehiCars(boxes: Box[], unit = LEHI_UNIT) {
  const cars: {
    x: number;
    y: number;
    z: number;
    rot: number;
    colour: number;
  }[] = [];
  const stalls = lotStalls();
  for (const s of stalls) {
    if (!s.car) continue;
    const [x, z, , , rot = 0] = LOTS[s.lot],
      lx = s.u + STALL.w / 2,
      lz = s.v + STALL.d / 2,
      cx = BRIDGE_AT[0] + x + lx * Math.cos(rot) + lz * Math.sin(rot),
      cz = BRIDGE_AT[1] + z - lx * Math.sin(rot) + lz * Math.cos(rot);
    cars.push({
      x: cx,
      y: height(cx, cz),
      z: cz,
      // Nose to the aisle.
      rot: rot + (s.front ? Math.PI : 0),
      colour: s.colour,
    });
  }
  let n = 0;
  for (const b of boxes) {
    if (!b.part || b.roof !== 'deck') continue;
    const along = b.w >= b.d,
      ha = (along ? b.w : b.d) / 2,
      hc = (along ? b.d : b.w) / 2,
      sw = 0.094 * unit,
      sd = 0.19 * unit,
      per = 2 * sd + 0.25 * unit;
    for (let m = 0; ; m++) {
      const y0 = -hc + 0.12 * unit + m * per;
      if (y0 + 2 * sd > hc - 0.05) break;
      for (
        let k = Math.ceil((-ha + 0.1) / sw);
        k <= Math.floor((ha - 0.1) / sw) - 1;
        k++
      )
        for (const r of [0, 1]) {
          if (!deckTaken(k, m * 2 + r, b.seed)) continue;
          const qx = (k + 0.5) * sw,
            qy = y0 + r * sd + sd / 2,
            lx = along ? qx : qy,
            lz = along ? qy : qx,
            cos = Math.cos(b.rot),
            sin = Math.sin(b.rot);
          cars.push({
            x: b.x + lx * cos + lz * sin,
            y: b.y + b.h,
            z: b.z - lx * sin + lz * cos,
            rot: b.rot + (along ? 0 : Math.PI / 2) + (r ? 0 : Math.PI),
            colour: rnd(++n * 3.3 + b.seed * 100),
          });
        }
    }
  }
  return cars;
}
