import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  CanvasTexture,
  Group,
  MathUtils,
  MeshBasicMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type { Material, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { gradBeats, officeBeats } from './story';
import { BOARD, OFFICE_ORIGIN, ROOM } from './office';
import { BOARD_H, BOARD_W, CODE_CHARS, drawBoard } from './officeBoard';
import { Interviewers } from './Interviewers';
import { OfficeOutside } from './OfficeOutside';
import { InterviewDesk } from './InterviewDesk';
import { RenterDesk } from './RenterDesk';
import type { Desk } from './Screen';
import { loadKalam } from './officeDesk';
import type { RoomAudio } from './audio';
import { Soundbar } from './Soundbar';
import { barOffWall } from './soundbarLayout';
import { trackLoads } from './loadProgress';

const OFFICE = '/models/portfolio-office/office.glb';
// Draco-compressed; its decoder is served from public/draco/.
const DRACO = '/draco/';
const ORIGIN = new Vector3(...OFFICE_ORIGIN);

// The office's soundbars, small and out of the way on walls, there to be
// glimpsed as the camera turns rather than shown (the user's call,
// 2026-11-19: over the whiteboard and on his desk they were too plain).
// - The meeting room's: on the interviewers' side, the TV wall, high up near
//   the glass front, facing the board; it comes into the right edge of the
//   frame as the camera turns to the window corner for the offer. No light
//   of its own (SpeakerViz: one per place).
// - The open office's: on the south wall, to his left as he sits at his
//   desk, in its corner by the east windows (build_office.py: the windows'
//   wall at x 37.47, the south wall's face at z -3.5), facing the floor; far
//   off at the left of the shot over his shoulder. The office's one light.
const MEETING_BAR = 1.0,
  OPEN_BAR = 1.2;
const MEETING_BAR_AT: [number, number, number] = [
    -ROOM.hx + barOffWall(MEETING_BAR),
    2.65,
    2.4,
  ],
  OPEN_BAR_AT: [number, number, number] = [
    36.6,
    2.7,
    -ROOM.hz + barOffWall(OPEN_BAR),
  ];

/** Rolls his chair back along x (from where it was built). */
function roll(chair: Object3D, dx: number) {
  chair.position.x = dx;
}

/** Swings the meeting room's door leaf on its hinge (radians, out into the
 *  corridor). */
function swing(door: Object3D, angle: number) {
  door.rotation.y = angle;
}

/** Where the marker is on the board while he writes (world), for his hand. */
export type BoardTip = { on: boolean; at: Vector3 };

/**
 * Chapter 2: the meeting room at Neighbor's Lehi office (2022), where he had
 * his first onsite interview. From Blender (build_office.py) plus what is
 * live: the whiteboard (the problem, his thinking, his pseudo-code), the two
 * engineers, and the view (OfficeOutside). The hero, the lights and the
 * camera stay in RoomScene, which reads the marker's place (tip) for his
 * writing hand and gives his head's place (head) to the engineers' eyes.
 */
export function OfficeScene({
  office,
  desk,
  work,
  leave,
  reduced,
  onTip,
  head,
  audio,
}: {
  /** 0..1 through the chapter. */
  office: RefObject<number>;
  /** 0..1 through the way to his desk, hired. */
  desk: RefObject<number>;
  /** What his hands are doing at his desk (keys or trackpad). */
  work: RefObject<Desk>;
  /** 0..1 through his leaving Neighbor: his chair rolls back, his monitor
   *  sleeps. */
  leave: RefObject<number>;
  reduced: boolean;
  /** Each frame: whether he is writing, and where the marker is (world). */
  onTip: (on: boolean, at: Vector3) => void;
  /** His head (office-local). */
  head: RefObject<Vector3>;
  /** The sound, for the soundbars' LED spectrum. */
  audio: RefObject<RoomAudio | null>;
}) {
  const room = useGLTF(OFFICE, DRACO);
  const board = useMemo(() => {
    const el = document.createElement('canvas');
    el.width = BOARD_W;
    el.height = BOARD_H;
    const ctx = el.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    const texture = new CanvasTexture(el);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    return { ctx, texture };
  }, []);
  useEffect(() => () => board.texture.dispose(), [board]);
  // Drawn into each frame (through a ref: the hook's value stays as given).
  const live = useRef(board);
  const state = useRef({
      key: '',
      fonts: false,
      tip: null as { x: number; y: number } | null,
    }),
    nod = useRef(0);
  useEffect(() => {
    let alive = true;
    loadKalam().then(() => {
      if (!alive) return;
      state.current.fonts = true;
      state.current.key = ''; // redraw in the handwriting
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // The frosted film's alpha (green): even and faint, its top edge (v 1,
    // the canvas's top row) a touch stronger.
    const el = document.createElement('canvas');
    el.width = 4;
    el.height = 128;
    const ctx = el.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(0, 0, 4, 128);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 4, 2);
    }
    const film = new CanvasTexture(el);
    const flats: MeshBasicMaterial[] = [];
    room.scene.traverse((o) => {
      // His chair is a group of meshes (one per material): the node itself.
      // (Looked for among the meshes, it was never found and never rolled.)
      if (/^His[ _]chair$/.test(o.name)) chair.current ??= o;
      const m = o as Mesh;
      if (!m.isMesh) return;
      if (
        /^Office[ _]door/.test(o.name) ||
        /^Office[ _]door/.test(o.parent?.name ?? '')
      )
        door.current ??= /^Office[ _]door/.test(o.parent?.name ?? '')
          ? (o.parent as Object3D)
          : o;
      const glassy = o.name === 'Office glass';
      m.castShadow = !glassy;
      m.receiveShadow = !glassy;
      const mats = (
        Array.isArray(m.material) ? m.material : [m.material]
      ) as Material[];
      for (const mat of mats) {
        const s = mat as MeshStandardMaterial;
        // Clear glass: barely there, a faint cool sheen. The frosted strip:
        // milky.
        if (mat.name === 'Glass') {
          s.transparent = true;
          s.opacity = 0.08;
          s.depthWrite = false;
          s.roughness = 0.05;
        } else if (mat.name === 'Frosted glass') {
          // Frosted film over the glass's lower half (2026-10-13: before, a
          // band at eye level: solid it cut the view of the open office in
          // two; faint it tinted the floor seen through it; then pinstripes).
          s.transparent = true;
          s.opacity = 0.3;
          s.alphaMap = film;
          s.depthWrite = false;
          s.needsUpdate = true;
        }
      }
      if (glassy) m.renderOrder = 2;
      // The open office's carpet, evenly lit (by its ceiling, not the sun:
      // the sun's shadow only reaches round the meeting room, and past it
      // the sun lit the floor, a diagonal edge across the corridor).
      const flat = (mat: Material) => {
        if (mat.name !== 'Office carpet') return mat;
        const f = new MeshBasicMaterial({
          name: 'Office carpet',
          map: (mat as MeshStandardMaterial).map,
          color: '#a8aeb9',
        });
        flats.push(f);
        return f;
      };
      m.material = Array.isArray(m.material)
        ? m.material.map(flat)
        : flat(m.material);
    });
    return () => {
      film.dispose();
      for (const f of flats) f.dispose();
    };
  }, [room.scene]);

  // (Its shaders were compiled here once it was in. That compiled them for
  // the lights shown at the time, not the office's. RoomScene's warm-up now
  // draws every place once behind the loader instead.)
  const root = useRef<Group>(null);

  // His desk chair (its own object): it rolls back as he gets up to leave.
  const chair = useRef<Object3D | null>(null);
  // The meeting room's door leaf (its origin on its hinge): it swings open
  // out into the corridor as the camera leaves through it.
  const door = useRef<Object3D | null>(null);
  const at = useMemo(() => new Vector3(), []);
  useFrame(() => {
    if (chair.current) {
      const gb = gradBeats(leave.current ?? 0);
      roll(chair.current, -gb.chair);
    }
    if (door.current)
      swing(
        door.current,
        reduced
          ? 0
          : 2.15 * MathUtils.smoothstep(desk.current ?? 0, 0.012, 0.075)
      );
    const ob = officeBeats(office.current ?? 0),
      st = state.current;
    nod.current = Math.max(ob.talk, ob.done);
    const reach = reduced ? 1 : ob.reach,
      write = reduced ? 1 : ob.write,
      key = `${Math.round(reach * 300)}|${Math.round(write * CODE_CHARS * 6)}|${st.fonts}`;
    if (key !== st.key) {
      st.key = key;
      const b = live.current;
      st.tip = drawBoard(b.ctx, { reach, write });
      b.texture.needsUpdate = true;
    }
    if (st.tip)
      // Canvas pixels to the board in the world (x from its left end, +z).
      at.set(
        BOARD.x + BOARD.nx * 0.004,
        BOARD.y1 - (st.tip.y / BOARD_H) * (BOARD.y1 - BOARD.y0),
        BOARD.left + (st.tip.x / BOARD_W) * (BOARD.right - BOARD.left)
      ).add(ORIGIN);
    onTip(!!st.tip, at);
  });

  return (
    <group ref={root} position={OFFICE_ORIGIN}>
      <primitive object={room.scene} />
      <mesh
        position={[
          BOARD.x + BOARD.nx * 0.003,
          (BOARD.y0 + BOARD.y1) / 2,
          (BOARD.z0 + BOARD.z1) / 2,
        ]}
        // Facing into the room; its canvas's left end at BOARD.left.
        rotation={[0, (BOARD.nx * Math.PI) / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[BOARD.z1 - BOARD.z0, BOARD.y1 - BOARD.y0]} />
        {/* A glossy white surface, so the window's light glances off it. */}
        <meshStandardMaterial
          map={board.texture}
          roughness={0.28}
          metalness={0}
        />
      </mesh>
      <InterviewDesk office={office} reduced={reduced} />
      <Soundbar
        audio={audio}
        reduced={reduced}
        position={MEETING_BAR_AT}
        rotation={Math.PI / 2}
        scale={MEETING_BAR}
        mount="wall"
        light={false}
      />
      <Soundbar
        audio={audio}
        reduced={reduced}
        position={OPEN_BAR_AT}
        scale={OPEN_BAR}
        mount="wall"
      />
      <RenterDesk desk={desk} work={work} leave={leave} reduced={reduced} />
      <Interviewers hero={head} nod={nod} reduced={reduced} />
      <OfficeOutside reduced={reduced} desk={desk} leave={leave} />
    </group>
  );
}

useGLTF.preload(OFFICE, DRACO, true, trackLoads);
