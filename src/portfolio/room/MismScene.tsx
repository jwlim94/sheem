import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Mesh, MeshStandardMaterial } from 'three';
import { Classmates } from './Classmates';
import type { Room } from './Classmates';
import { mismBeats } from './story';
import {
  FRONT_X,
  HERO_ROW,
  HERO_YAW,
  LID_ANGLE,
  MISM_KEYS,
  MISM_LAPTOP,
  MISM_LID,
  PROFESSOR,
  SCREEN_X,
  SCREENS,
  seats,
  WHITEBOARD,
} from './mism';
import { drawCase, drawNotes, drawQuestion, NOTES_LENGTH } from './mismSlides';
import { drawKeyboard } from './schoolLaptop';
import type { RoomAudio } from './audio';
import { Soundbar } from './Soundbar';
import { BAR, barOffWall } from './soundbarLayout';

// The classroom's soundbar: hung on the front wall over the whiteboard,
// between the two screens, facing the tiers (as the hall's faces its stage),
// 2.6x the bookcase's (a 1.46 m bar) so it reads from the back row; its
// bottom 0.17 m over the board, clear of the professor's head from the
// seats. The classroom's one speaker light (SpeakerViz).
const CLASS_BAR = 2.6;
const CLASS_BAR_AT: [number, number, number] = [
  FRONT_X - barOffWall(CLASS_BAR),
  WHITEBOARD.top + 0.17 + (BAR.h / 2) * CLASS_BAR,
  WHITEBOARD.z,
];

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
const ROOM: Room = {
  seats: seats(),
  free: (s) =>
    (s.row === HERO_ROW && Math.hypot(s.x - hero.x, s.z - hero.z) < 1.2) ||
    (s.row === HERO_ROW + 1 && Math.hypot(s.x - hero.x, s.z - hero.z) < 2.3),
  professor: { at: PROFESSOR, yaw: Math.PI, pose: 'standing' },
  arrive: [-0.06, 0.05],
  // On the desk in front of them, not on their laps.
  glow: [0.62, 0.86],
  // In the bright room: a cool slate, denser (pale ones vanished into it).
  tint: { color: '#56617a', rim: '#dfe6f7', body: 0.2, edge: 0.45 },
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
      keys = canvas(2048, 1414);
    drawCase(left.ctx, 1600, 1000);
    drawQuestion(right.ctx, 1600, 1000, 0, 0);
    drawNotes(laptop.ctx, 1024, 660, 0, true);
    keys.ctx.scale(2, 2);
    drawKeyboard(keys.ctx, 1024, 707);
    return { left, right, laptop, keys };
  }, []);
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
        rotation={-Math.PI / 2}
        scale={CLASS_BAR}
        mount="wall"
      />
      <Classmates school={mism} reduced={reduced} room={ROOM} />
    </group>
  );
}

useGLTF.preload(CLASS, DRACO);
