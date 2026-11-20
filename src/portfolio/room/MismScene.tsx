import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { CanvasTexture, MathUtils, SRGBColorSpace } from 'three';
import type { Mesh, MeshStandardMaterial } from 'three';
import { Classmates } from './Classmates';
import type { Room } from './Classmates';
import { mismBeats } from './story';
import {
  DESK_IN,
  DESK_TOP,
  FRONT_X,
  HALF_W,
  HERO_ROW,
  HERO_YAW,
  LENSES,
  LID_ANGLE,
  MISM_KEYS,
  MISM_LAPTOP,
  MISM_LID,
  PROFESSOR,
  SCREEN_X,
  SCREENS,
  seats,
} from './mism';
import { drawCase, drawNotes, drawQuestion, NOTES_LENGTH } from './mismSlides';
import { drawMismBoard, MISM_BOARD } from './mismBoard';
import { loadKalam } from './officeDesk';
import { DeskThings } from './DeskThings';
import { ProjectorBeam } from './ProjectorBeam';
import type { Beam } from './ProjectorBeam';
import { drawKeyboard } from './schoolLaptop';
import type { RoomAudio } from './audio';
import { Soundbar } from './Soundbar';
import { barOffWall } from './soundbarLayout';

// The classroom's soundbar: small and out of the way, high on the right
// side wall near the front, over its maple rail and short of its acoustic
// panels (build_class.py: they stop 2 m behind the front floor), facing
// across the room; glimpsed in the establishing shot's far right corner
// (the user's call, 2026-11-20, as Neighbor's: over the whiteboard, front
// and centre at 2.6x, it was too plain). The classroom's one speaker light
// (SpeakerViz).
const CLASS_BAR = 1.4;
const CLASS_BAR_AT: [number, number, number] = [
  2.2,
  3.15,
  HALF_W - barOffWall(CLASS_BAR),
];

// The projectors' light: in the bright room the beams themselves aren't
// seen (drawn at a quarter of the hall's, they cost 0.5 ms a frame for a
// haze no one saw), only the dust glinting in them (2026-11-20).
const BEAMS: Beam[] = SCREENS.map((s, i) => ({
  lens: LENSES[i],
  slide: { x: SCREEN_X, y: s.y, z: s.z, w: s.w, h: s.h },
  strength: 0,
  motes: 260,
  glint: 0.55,
}));

const CLASS = '/models/portfolio-mism/class.glb';
/** Marks a canvas texture redrawn (outside the component: its textures are
 *  memoised). */
function redrawn(t: { texture: CanvasTexture }) {
  t.texture.needsUpdate = true;
}
const DRACO = '/draco/';

function canvas(w: number, h: number) {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const texture = new CanvasTexture(el);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return { ctx, texture };
}

// The class (chapter 1's silhouettes): every seat but his, the two beside
// him and those right behind him (the camera comes in over his shoulder);
// they're there from the start (a class under way), the professor in the
// horseshoe's middle, facing the room, his hand toward the screens.
const hero = seats().find((s) => s.row === HERO_ROW && s.yaw === HERO_YAW)!;
/** A seat's angle round the horseshoe (seats(): -SPAN at the left wing). */
const around = (s: { x: number; z: number }) => Math.atan2(s.z, -s.x);
const ROOM: Room = {
  seats: seats(),
  free: (s) =>
    (s.row === HERO_ROW && Math.hypot(s.x - hero.x, s.z - hero.z) < 1.2) ||
    (s.row === HERO_ROW + 1 && Math.hypot(s.x - hero.x, s.z - hero.z) < 2.3) ||
    // The back of the left wing, under the establishing shot's lens (one
    // left there): close by, the class's heads massed over its corner
    // (2026-11-20).
    (s.row === 3 && around(s) < -0.4 && Math.abs(around(s) + 0.66) > 0.05) ||
    (s.row === 2 && around(s) < -0.75),
  professor: { at: PROFESSOR, yaw: Math.PI, pose: 'standing' },
  arrive: [-0.06, 0.05],
  // In the bright room: a cool slate, denser (pale ones vanished into it).
  tint: { color: '#56617a', rim: '#dfe6f7', body: 0.2, edge: 0.45 },
  // Their laptops are on their desks (DeskThings), not on their laps.
  reach: 0.14,
  // As the class's answers go up on the right screen (behind his left), the
  // professor holds his hand out to it, and lowers it once all are up.
  gesture: (m) => {
    const a = mismBeats(m).answer;
    return (
      MathUtils.smoothstep(a, 0, 0.12) * (1 - MathUtils.smoothstep(a, 0.9, 1))
    );
  },
};

/**
 * Chapter 3's classroom (the MISM's security course, 2024): the room from
 * Blender, plus what is live: the case on the left screen, the question and
 * then the controls on the right, his notes typed on his laptop, its keys,
 * and the class. The hero, the lights and the camera stay in RoomScene.
 */
export function MismScene({
  reduced,
  mism,
  audio,
  notes,
}: {
  reduced: boolean;
  /** 0..1 through the chapter. */
  mism: RefObject<number>;
  /** The sound, for the soundbar's LED spectrum. */
  audio: RefObject<RoomAudio | null>;
  /** How much of his notes are typed (characters; RoomScene types them, in
   *  step with his hands). */
  notes: RefObject<{ typed: number }>;
}) {
  const room = useGLTF(CLASS, DRACO);
  const tex = useMemo(() => {
    const left = canvas(1600, 1000),
      right = canvas(1600, 1000),
      laptop = canvas(1024, 660),
      keys = canvas(2048, 1414),
      board = canvas(MISM_BOARD.cw, MISM_BOARD.ch);
    drawMismBoard(board.ctx);
    drawCase(left.ctx, 1600, 1000);
    drawQuestion(right.ctx, 1600, 1000, 0, 0);
    drawNotes(laptop.ctx, 1024, 660, 0, true);
    keys.ctx.scale(2, 2);
    drawKeyboard(keys.ctx, 1024, 707);
    return { left, right, laptop, keys, board };
  }, []);
  // The board's marker hand once its font is in.
  useEffect(() => {
    let alive = true;
    loadKalam().then(() => {
      if (!alive) return;
      drawMismBoard(tex.board.ctx);
      redrawn(tex.board);
    });
    return () => {
      alive = false;
    };
  }, [tex]);
  useEffect(
    () => () => {
      for (const t of Object.values(tex)) t.texture.dispose();
    },
    [tex]
  );
  useEffect(() => {
    room.scene.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = m.receiveShadow = true;
      const mat = m.material as MeshStandardMaterial;
      // The white ceiling, lit from below only by the room's bounce, read
      // brown-grey: its tiles glow a little (by their own texture).
      if (mat.name === 'Ceiling' && mat.map) {
        mat.emissiveMap = mat.map;
        mat.emissive.set('#ffffff');
        mat.emissiveIntensity = 0.55;
      }
      // The ceiling's LED panels cast no shadow; the backpack's contact
      // decal neither.
      if (mat.name === 'LED panel' || mat.name.startsWith('Contact shadow'))
        m.castShadow = false;
    });
  }, [room.scene]);

  // The screens and his notes follow the scroll; redrawn only on change.
  const last = useRef({ q: '', n: '' });
  useFrame(({ clock }) => {
    const mb = mismBeats(mism.current ?? 0),
      q = `${Math.round(mb.question * 40)}|${Math.round(mb.answer * 75)}`;
    if (q !== last.current.q) {
      last.current.q = q;
      drawQuestion(tex.right.ctx, 1600, 1000, mb.question, mb.answer);
      redrawn(tex.right);
    }
    const typed = reduced ? NOTES_LENGTH : (notes.current?.typed ?? 0),
      caret = typed >= NOTES_LENGTH ? (clock.elapsedTime * 2) % 2 < 1 : true,
      n = `${Math.floor(typed)}|${caret}`;
    if (n !== last.current.n) {
      last.current.n = n;
      drawNotes(tex.laptop.ctx, 1024, 660, typed, caret);
      redrawn(tex.laptop);
    }
  });

  return (
    <group>
      <primitive object={room.scene} />
      {SCREENS.map((s, i) => (
        <mesh
          key={i}
          position={[SCREEN_X, s.y, s.z]}
          rotation={[0, -Math.PI / 2, 0]}
        >
          <planeGeometry args={[s.w, s.h]} />
          {/* Projected light on the fabric: bright, a touch cool. */}
          <meshBasicMaterial
            map={(i === 0 ? tex.left : tex.right).texture}
            color="#eef0ff"
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* The whiteboard's writing, just off its face (6 mm). */}
      <mesh
        position={[FRONT_X - 0.035 - 0.006, 1.85, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[MISM_BOARD.w, MISM_BOARD.h]} />
        <meshStandardMaterial
          map={tex.board.texture}
          roughness={0.25}
          metalness={0}
        />
      </mesh>
      {BEAMS.map((b, i) => (
        <ProjectorBeam key={i} reduced={reduced} beam={b} />
      ))}
      <DeskThings room={ROOM} top={DESK_TOP} edge={DESK_IN} />
      {/* His laptop's screen on the lid's inner face (the lid leans back from
          the hinge, away from him), and its keyboard deck. */}
      <group position={MISM_LID} rotation={[0, HERO_YAW, 0]}>
        <group rotation={[0, 0, -LID_ANGLE]}>
          <mesh position={[-0.0072, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry
              args={[MISM_LAPTOP.w - 0.01, MISM_LAPTOP.lidH - 0.012]}
            />
            <meshBasicMaterial map={tex.laptop.texture} toneMapped={false} />
          </mesh>
        </group>
      </group>
      <group
        position={[MISM_KEYS[0], MISM_KEYS[1] + 0.0005, MISM_KEYS[2]]}
        rotation={[0, HERO_YAW - Math.PI / 2, 0]}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[MISM_LAPTOP.w, MISM_LAPTOP.d]} />
          <meshStandardMaterial
            map={tex.keys.texture}
            emissiveMap={tex.keys.texture}
            emissive="#ffffff"
            emissiveIntensity={0.12}
            roughness={0.45}
            metalness={0.2}
          />
        </mesh>
      </group>
      <Soundbar
        audio={audio}
        reduced={reduced}
        position={CLASS_BAR_AT}
        rotation={Math.PI}
        scale={CLASS_BAR}
        mount="wall"
      />
      <Classmates school={mism} reduced={reduced} room={ROOM} />
    </group>
  );
}

useGLTF.preload(CLASS, DRACO);
