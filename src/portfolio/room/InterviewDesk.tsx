import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { CHAIRS, TABLE } from './office';
import { LAPTOP } from './hall';
import { drawKeyboard } from './schoolLaptop';
import {
  drawNotebook,
  drawProfile,
  loadKalam,
  notebookStage,
  NOTES_CHARS,
  notesTyped,
  SCREEN_H,
  SCREEN_W,
  SPREAD_H,
  SPREAD_W,
} from './officeDesk';

const AVATAR = '/models/portfolio-office/avatar.webp';
// The laptop: the hall's, its lid leaning back 18°, set before the engineer
// at the laptop (his hands on its keys), squared to him; the notebook open
// before the other, a pen on its right page.
const LID_TILT = (18 * Math.PI) / 180;
const LAP = CHAIRS[0],
  LAP_AT: [number, number, number] = [-0.72, TABLE.h, LAP.z + 0.08];
const BOOK = CHAIRS[1],
  BOOK_AT: [number, number, number] = [-0.66, TABLE.h, BOOK.z - 0.04];

function canvasTexture(w: number, h: number) {
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

/**
 * Chapter 2's table (2026-10-13, after the user's notes: everything else
 * cleared off): the engineer at the laptop has his profile up (his photo,
 * school, last role, skills) and types notes into it as the interview goes;
 * the other has his notebook open, notes added as he goes, a pen on it.
 * Office-local.
 */
export function InterviewDesk({
  office,
  reduced,
}: {
  /** 0..1 through the chapter. */
  office: RefObject<number>;
  reduced: boolean;
}) {
  const tex = useMemo(() => {
    const screen = canvasTexture(SCREEN_W, SCREEN_H),
      keys = canvasTexture(1024, 707),
      book = canvasTexture(SPREAD_W, SPREAD_H);
    drawKeyboard(keys.ctx, 1024, 707);
    keys.texture.needsUpdate = true;
    return { screen, keys, book };
  }, []);
  useEffect(
    () => () => {
      tex.screen.texture.dispose();
      tex.keys.texture.dispose();
      tex.book.texture.dispose();
    },
    [tex]
  );
  // Drawn into each frame (through a ref: the hook's value stays as given).
  const live = useRef(tex);
  const state = useRef({
    screenKey: '',
    bookKey: '',
    avatar: null as HTMLImageElement | null,
    fonts: false,
  });
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      state.current.avatar = img;
      state.current.screenKey = '';
    };
    img.src = AVATAR;
    loadKalam().then(() => {
      if (!alive) return;
      state.current.fonts = true;
      state.current.bookKey = '';
    });
    return () => {
      alive = false;
      img.onload = null;
    };
  }, []);

  useFrame(({ clock }) => {
    const o = reduced ? 1 : (office.current ?? 0),
      st = state.current,
      t = live.current;
    const typed = notesTyped(o),
      caret = reduced || Math.floor(clock.elapsedTime * 1.8) % 2 === 0,
      screenKey = `${typed}|${caret}|${!!st.avatar}`;
    if (screenKey !== st.screenKey) {
      st.screenKey = screenKey;
      drawProfile(
        t.screen.ctx,
        typed,
        caret && typed < NOTES_CHARS + 1,
        st.avatar
      );
      t.screen.texture.needsUpdate = true;
    }
    const stage = notebookStage(o),
      bookKey = `${stage}|${st.fonts}`;
    if (bookKey !== st.bookKey) {
      st.bookKey = bookKey;
      drawNotebook(t.book.ctx, stage);
      t.book.texture.needsUpdate = true;
    }
  });

  const { w, d, lidH, base } = LAPTOP;
  return (
    <>
      {/* The laptop, its hinge on the board's side, open toward him. */}
      <group position={LAP_AT} rotation={[0, LAP.yaw, 0]}>
        <RoundedBox
          args={[d, base, w]}
          radius={0.006}
          smoothness={3}
          position={[0, base / 2, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color="#b9bcc1"
            metalness={0.6}
            roughness={0.35}
          />
        </RoundedBox>
        {/* The keyboard deck: keys toward the lid, the trackpad toward him. */}
        <group position={[0, base + 0.0006, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[w - 0.004, d - 0.004]} />
            <meshStandardMaterial
              map={tex.keys.texture}
              roughness={0.45}
              metalness={0.2}
            />
          </mesh>
        </group>
        <group position={[d / 2, base, 0]} rotation={[0, 0, -LID_TILT]}>
          <RoundedBox
            args={[0.008, lidH, w]}
            radius={0.003}
            smoothness={3}
            position={[0.004, lidH / 2, 0]}
            castShadow
          >
            <meshStandardMaterial
              color="#b9bcc1"
              metalness={0.6}
              roughness={0.35}
            />
          </RoundedBox>
          {/* The screen, on the lid's inner face (the bezel is drawn in). */}
          <mesh
            position={[-0.0006, lidH / 2, 0]}
            rotation={[0, -Math.PI / 2, 0]}
          >
            <planeGeometry args={[w - 0.008, lidH - 0.008]} />
            <meshBasicMaterial
              map={tex.screen.texture}
              color="#f2f2f2"
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>

      {/* The notebook: a navy hardcover, the open pages a little raised
          either side of the spine, the spread readable from his side; a
          pen across the right page. */}
      <group
        position={BOOK_AT}
        rotation={[0, -Math.PI / 2 + BOOK.yaw - 0.05, 0]}
      >
        <RoundedBox
          args={[0.416, 0.008, 0.296]}
          radius={0.003}
          smoothness={2}
          position={[0, 0.004, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#26324f" roughness={0.7} />
        </RoundedBox>
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[s * 0.1, 0.0115, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.198, 0.007, 0.282]} />
            <meshStandardMaterial color="#f1eee6" roughness={0.9} />
          </mesh>
        ))}
        <mesh
          position={[0, 0.0152, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[0.398, 0.282]} />
          <meshStandardMaterial map={tex.book.texture} roughness={0.9} />
        </mesh>
        <group position={[0.11, 0.0215, 0.02]} rotation={[0, 0.55, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.0055, 0.0055, 0.13, 14]} />
            <meshStandardMaterial
              color="#1f2a44"
              roughness={0.35}
              metalness={0.2}
            />
          </mesh>
          <mesh position={[-0.073, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.0055, 0.016, 14]} />
            <meshStandardMaterial
              color="#c9ccd1"
              roughness={0.3}
              metalness={0.7}
            />
          </mesh>
          <mesh position={[0.045, 0.0062, 0]}>
            <boxGeometry args={[0.04, 0.0018, 0.0035]} />
            <meshStandardMaterial
              color="#c9ccd1"
              roughness={0.3}
              metalness={0.7}
            />
          </mesh>
        </group>
      </group>
    </>
  );
}
