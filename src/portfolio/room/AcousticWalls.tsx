import { useEffect, useMemo } from 'react';
import {
  CanvasTexture,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { ANGLE, BACK_X, FRONT_X, HALF_W, ROWS, rowY, wallLine } from './hall';

/**
 * The black pyramid acoustic foam that densely covers the auditorium's walls:
 * one canvas tile (a 4 × 4 block of pyramids, a panel seam on two edges) is
 * repeated across a plane on the left side wall and over the doors on the
 * back wall. Each pyramid's four faces are baked lighter on top and darker
 * below; the same tile drives a faint bump map (strong bump sparkles at a
 * distance).
 */
const CELL = 0.3; // one pyramid, metres
const TILE = 4; // pyramids per panel (and per texture tile)
const PX = 64; // texels per pyramid

function foamTile() {
  const n = TILE * PX,
    el = document.createElement('canvas');
  el.width = el.height = n;
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const faces: [string, [number, number][]][] = [
    [
      '#5a534d',
      [
        [0, 0],
        [1, 0],
        [0.5, 0.5],
      ],
    ], // top face, catching light
    [
      '#463f3a',
      [
        [0, 0],
        [0.5, 0.5],
        [0, 1],
      ],
    ], // left
    [
      '#3d3632',
      [
        [1, 0],
        [1, 1],
        [0.5, 0.5],
      ],
    ], // right
    [
      '#2a2522',
      [
        [0, 1],
        [0.5, 0.5],
        [1, 1],
      ],
    ], // bottom, in shadow
  ];
  for (let i = 0; i < TILE; i++)
    for (let j = 0; j < TILE; j++) {
      // Alternate the pyramids' orientation, like real foam.
      const flip = (i + j) % 2 === 1;
      for (const [color, pts] of faces) {
        ctx.fillStyle = color;
        ctx.beginPath();
        pts.forEach(([u, v], k) => {
          const [a, b] = flip ? [v, u] : [u, v];
          const x = (i + a) * PX,
            y = (j + b) * PX;
          if (k) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.fill();
      }
    }
  // The seam between panels.
  ctx.fillStyle = '#1b1715';
  ctx.fillRect(0, 0, n, 3);
  ctx.fillRect(0, 0, 3, n);
  const map = new CanvasTexture(el);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  map.anisotropy = 8;
  return map;
}

/** A plane of foam, w × h metres, its UVs scaled so the tile repeats. */
function foamPlane(w: number, h: number) {
  const g = new PlaneGeometry(w, h),
    uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(
      i,
      (uv.getX(i) * w) / (CELL * TILE),
      (uv.getY(i) * h) / (CELL * TILE)
    );
  return g;
}

export function AcousticWalls() {
  const parts = useMemo(() => {
    const [[fx, fz], [bx, bz]] = wallLine(),
      sideLen = Math.hypot(fx - bx, fz - bz),
      top = rowY(ROWS - 1),
      backW = 2 * HALF_W;
    return {
      map: foamTile(),
      // Left side wall: from 2 m up to the ceiling's rail (no plaster band).
      side: {
        geo: foamPlane(sideLen - 0.1, 7.25),
        pos: [
          (fx + bx) / 2 - Math.sin(ANGLE) * 0.03,
          2.05 + 3.625,
          (fz + bz) / 2 + Math.cos(ANGLE) * 0.03,
        ] as [number, number, number],
      },
      // Back wall: from just above the door casings and the booth, up to the
      // top (no plaster band left between the doors and the foam).
      back: {
        geo: foamPlane(backW, 9.4 - (top + 3.42)),
        pos: [BACK_X + 0.03, (top + 3.42 + 9.4) / 2, 0] as [
          number,
          number,
          number,
        ],
      },
    };
  }, []);
  useEffect(
    () => () => {
      parts.map.dispose();
      parts.side.geo.dispose();
      parts.back.geo.dispose();
    },
    [parts]
  );
  return (
    <>
      <mesh
        geometry={parts.side.geo}
        position={parts.side.pos}
        rotation={[0, -ANGLE, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          map={parts.map}
          bumpMap={parts.map}
          bumpScale={0.5}
          roughness={0.98}
        />
      </mesh>
      <mesh
        geometry={parts.back.geo}
        position={parts.back.pos}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          map={parts.map}
          bumpMap={parts.map}
          bumpScale={0.5}
          roughness={0.98}
        />
      </mesh>
    </>
  );
}

/** A tile of the dark acoustic ceiling: square panels with fine seams. */
function ceilingTile() {
  const n = 256,
    el = document.createElement('canvas');
  el.width = el.height = n;
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.fillStyle = '#26232a';
  ctx.fillRect(0, 0, n, n);
  // A faint speckle, like mineral-fibre panels.
  for (let i = 0; i < 1400; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1,
      y = (Math.sin(i * 78.233) * 12543.123) % 1;
    ctx.fillStyle = i % 2 ? '#2d2a31' : '#211e25';
    ctx.fillRect(Math.abs(x) * n, Math.abs(y) * n, 2, 2);
  }
  ctx.fillStyle = '#141217';
  ctx.fillRect(0, 0, n, 4);
  ctx.fillRect(0, 0, 4, n);
  const map = new CanvasTexture(el);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  map.anisotropy = 8;
  return map;
}

/**
 * The ceiling, seen only from below: dark acoustic panels (1.2 m) at the walls'
 * top, with rows of small recessed downlights, each a warm disc in a soft
 * halo. It casts no shadow, so the house light from above still reaches in.
 */
export function Ceiling() {
  const parts = useMemo(() => {
    const map = ceilingTile(),
      w = FRONT_X - BACK_X,
      d = 2 * HALF_W + 1;
    map.repeat.set(w / 1.2, d / 1.2);
    // Rows about 5 m apart, as in a real hall (a 3 m grid read as a
    // starfield of downlights).
    const lights: [number, number][] = [];
    for (let x = BACK_X + 3.0; x < FRONT_X - 1.5; x += 5.2)
      for (let z = -HALF_W + 3; z < HALF_W - 2; z += 5.0) lights.push([x, z]);
    return { map, w, d, lights };
  }, []);
  useEffect(() => () => parts.map.dispose(), [parts]);
  const y = 9.39;
  return (
    <group>
      <mesh
        position={[(FRONT_X + BACK_X) / 2, y, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[parts.w, parts.d]} />
        <meshStandardMaterial map={parts.map} roughness={0.95} />
      </mesh>
      {parts.lights.map(([x, z], i) => (
        <group
          key={i}
          position={[x, y - 0.01, z]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <mesh>
            <circleGeometry args={[0.32, 24]} />
            <meshBasicMaterial
              color="#ffcf96"
              transparent
              opacity={0.1}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 0, 0.002]}>
            <ringGeometry args={[0.1, 0.13, 24]} />
            <meshStandardMaterial
              color="#6b6460"
              roughness={0.4}
              metalness={0.6}
            />
          </mesh>
          <mesh position={[0, 0, 0.003]}>
            <circleGeometry args={[0.1, 20]} />
            <meshBasicMaterial color="#ffe6c4" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
