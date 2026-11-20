import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { DESK } from './office';
import { gradBeats } from './story';
import type { Desk } from './Screen';
import {
  CODE_LEN,
  drawCode,
  drawDeskKeys,
  drawMarketplace,
  KEYS_H,
  KEYS_W,
  LISTING_COUNT,
  MARKET_H,
  MARKET_W,
} from './renterScreen';

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

// The monitor's screen (its glass; the bezel is the body around it).
const SCREEN = { w: 0.72, h: 0.42 };

/**
 * His desk at Neighbor (office-local; office.ts DESK): a monitor facing him
 * across the keyboard, its screen a storage marketplace's search (results
 * and map, one result hovered at a time, its pin lit), the keyboard and
 * trackpad he works at (the room's), and his blue tumbler (the one from his room).
 */
export function RenterDesk({
  desk,
  work,
  leave,
  reduced,
}: {
  /** 0..1 through the way to his desk. */
  desk: RefObject<number>;
  /** His hands: on the keys he codes (the editor), on the trackpad he works
   *  the map (the marketplace, a result hovered, its pin lit). */
  work: RefObject<Desk>;
  /** 0..1 through his leaving: his monitor sleeps. */
  leave: RefObject<number>;
  reduced: boolean;
}) {
  const tex = useMemo(() => {
    const screen = canvasTexture(MARKET_W, MARKET_H),
      keys = canvasTexture(KEYS_W, KEYS_H);
    drawDeskKeys(keys.ctx);
    keys.texture.needsUpdate = true;
    return { screen, keys };
  }, []);
  useEffect(
    () => () => {
      tex.screen.texture.dispose();
      tex.keys.texture.dispose();
    },
    [tex]
  );
  // Drawn into each frame (through a ref: the hook's value stays as given).
  const live = useRef(tex),
    view = useRef({ key: '', typed: 0, hover: 0, wasMouse: false, onPad: 0 });
  useFrame(({ clock }, dt) => {
    if ((desk.current ?? 0) <= 0 && view.current.key) return;
    const v = view.current,
      w = work.current;
    // The map only once his hand has stayed on the trackpad a moment (a
    // brief lift between keystrokes flashed it).
    v.onPad = !reduced && w?.mouse ? v.onPad + Math.min(dt, 0.05) : 0;
    const mouse = v.onPad > 0.35;
    // A new result hovered each time his hand comes to the trackpad, and
    // every couple of seconds while it's there.
    if (mouse && !v.wasMouse) v.hover = (v.hover + 1) % LISTING_COUNT;
    v.wasMouse = mouse;
    const hover = mouse
      ? (v.hover + Math.floor(clock.elapsedTime / 1.6)) % LISTING_COUNT
      : 0;
    if (reduced) v.typed = CODE_LEN;
    else if (!mouse && (w?.active ?? 0) > 0)
      v.typed = (v.typed + Math.min(dt, 0.05) * 22) % (CODE_LEN + 40);
    const typed = Math.min(CODE_LEN, Math.floor(v.typed)),
      caret = Math.floor(clock.elapsedTime * 2) % 2 === 0,
      key = mouse ? `m${hover}` : `c${typed}${caret}`;
    // Leaving, it sleeps.
    const lb = gradBeats(leave.current ?? 0),
      asleep = lb.rise > 0.3;
    if ((asleep ? 'off' : key) === v.key) return;
    v.key = asleep ? 'off' : key;
    const c = live.current.screen.ctx;
    if (asleep) {
      c.fillStyle = '#050608';
      c.fillRect(0, 0, MARKET_W, MARKET_H);
      live.current.screen.texture.needsUpdate = true;
      return;
    }
    if (mouse) drawMarketplace(c, hover);
    else drawCode(c, typed, caret);
    live.current.screen.texture.needsUpdate = true;
  });

  const [mx, my, mz] = DESK.monitor,
    [kx, , kz] = DESK.keys,
    top = DESK.top;
  return (
    <group>
      {/* The monitor, its screen toward him (-x). */}
      <RoundedBox
        args={[0.03, SCREEN.h + 0.028, SCREEN.w + 0.028]}
        radius={0.008}
        smoothness={3}
        position={[mx + 0.008, my, mz]}
        castShadow
      >
        <meshStandardMaterial color="#1b1d21" roughness={0.45} />
      </RoundedBox>
      <mesh position={[mx - 0.0085, my, mz]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[SCREEN.w, SCREEN.h]} />
        <meshBasicMaterial
          map={tex.screen.texture}
          color="#ececec"
          toneMapped={false}
        />
      </mesh>
      <mesh position={[mx + 0.045, top + 0.11, mz]} castShadow>
        <boxGeometry args={[0.035, 0.22, 0.07]} />
        <meshStandardMaterial
          color="#c3c6cb"
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>
      <RoundedBox
        args={[0.17, 0.012, 0.24]}
        radius={0.005}
        smoothness={2}
        position={[mx + 0.04, top + 0.006, mz]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#c3c6cb"
          metalness={0.6}
          roughness={0.35}
        />
      </RoundedBox>
      {/* The keyboard (the room's: silver, white keys) and, to his
          right, a white trackpad. */}
      <RoundedBox
        args={[0.247, 0.008, 0.6]}
        radius={0.003}
        smoothness={2}
        position={[kx, top + 0.004, kz]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#c7c9cc"
          roughness={0.35}
          metalness={0.3}
        />
      </RoundedBox>
      <group position={[kx, top + 0.0095, kz]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[0.588, 0.235]} />
          <meshStandardMaterial map={tex.keys.texture} roughness={0.45} />
        </mesh>
      </group>
      <RoundedBox
        args={[0.24, 0.01, 0.2]}
        radius={0.004}
        smoothness={3}
        // Where his right palm lands in the Typing clip (measured).
        position={[kx - 0.02, top + 0.005, kz + 0.45]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#ecebe7" roughness={0.32} />
      </RoundedBox>
      {/* His tumbler, to his left. */}
      <group position={[kx + 0.12, top, kz - 0.42]}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.042, 0.038, 0.24, 24]} />
          <meshStandardMaterial
            color="#2c4a7e"
            roughness={0.35}
            metalness={0.3}
          />
        </mesh>
        <mesh position={[0, 0.255, 0]} castShadow>
          <cylinderGeometry args={[0.036, 0.042, 0.03, 24]} />
          <meshStandardMaterial color="#1c1e22" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}
