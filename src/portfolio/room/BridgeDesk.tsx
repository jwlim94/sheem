import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import {
  BoxGeometry,
  CanvasTexture,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
} from 'three';
import { chairZ, DESK, KEYS, LAPTOP, MONITOR, PLACES } from './bridge';
import {
  CODE_LEN,
  drawFinancials,
  drawInbox,
  drawMarket,
  drawValuationCode,
  LAPTOP_H,
  LAPTOP_W,
  LISTING_COUNT,
  MARKET_H,
  MARKET_W,
} from './bridgeScreen';
import {
  CAPS,
  DECK_Y,
  drawMacLegends,
  KB_D,
  KB_V0,
  KB_W,
  LEGENDS,
  PAD,
} from './macKeys';
import { drawDeskKeys, KEYS_H, KEYS_W } from './renterScreen';
import type { Desk } from './Screen';
import { shown } from './shown';

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

// The laptop on its stand, built for a viewer at +z (bridge.ts LAPTOP turns
// it to him): the stand lifts its back (the base tilted toward him), the
// lid up, leaning back a little. (As build_bridge.py's.)
const TILT = 0.32,
  LEAN = 0.18,
  LAP = { w: 0.43, d: 0.3, lid: 0.29 },
  BASE_Y = DESK.top + 0.09,
  HINGE_Y = BASE_Y + Math.sin(TILT) * (LAP.d / 2) + 0.008,
  HINGE_Z = -Math.cos(TILT) * (LAP.d / 2),
  LID_Y = HINGE_Y + Math.cos(LEAN) * (LAP.lid / 2),
  LID_Z = HINGE_Z - Math.sin(LEAN) * (LAP.lid / 2);

/** A MacBook's deck, on its base's top (macKeys.ts): black keys standing a
 *  hair out of the silver, their legends, the trackpad. */
function MacDeck() {
  const deck = useMemo(() => {
    const legends = canvasTexture(LEGENDS.cw, LEGENDS.ch);
    drawMacLegends(legends.ctx);
    legends.texture.needsUpdate = true;
    const geo = new BoxGeometry(1, 1, 1),
      mat = new MeshStandardMaterial({ color: '#17181b', roughness: 0.55 }),
      keys = new InstancedMesh(geo, mat, CAPS.length),
      m = new Matrix4();
    CAPS.forEach((c, i) =>
      keys.setMatrixAt(
        i,
        m.makeScale(c.w, 0.0016, c.d).setPosition(c.x, DECK_Y + 0.0004, c.v)
      )
    );
    keys.receiveShadow = true;
    // The trackpad's outline, its corners rounded.
    const r = 0.0035,
      hw = PAD.w / 2,
      hd = PAD.d / 2,
      outline = new Shape()
        .moveTo(-hw + r, -hd)
        .lineTo(hw - r, -hd)
        .quadraticCurveTo(hw, -hd, hw, -hd + r)
        .lineTo(hw, hd - r)
        .quadraticCurveTo(hw, hd, hw - r, hd)
        .lineTo(-hw + r, hd)
        .quadraticCurveTo(-hw, hd, -hw, hd - r)
        .lineTo(-hw, -hd + r)
        .quadraticCurveTo(-hw, -hd, -hw + r, -hd),
      pad = new ShapeGeometry(outline, 4);
    return { legends, geo, mat, keys, pad };
  }, []);
  useEffect(
    () => () => {
      deck.legends.texture.dispose();
      deck.geo.dispose();
      deck.mat.dispose();
      deck.pad.dispose();
    },
    [deck]
  );
  return (
    <>
      <primitive object={deck.keys} />
      <mesh
        position={[0, DECK_Y + 0.0013, KB_V0 + KB_D / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[KB_W, KB_D]} />
        <meshStandardMaterial
          map={deck.legends.texture}
          transparent
          depthWrite={false}
          roughness={0.55}
        />
      </mesh>
      <mesh
        geometry={deck.pad}
        position={[0, DECK_Y + 0.0002, PAD.v]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          color="#b6b9be"
          metalness={0.35}
          roughness={0.2}
        />
      </mesh>
    </>
  );
}

/** A laptop on its aluminium stand on a desk (bridge-local x, z), its
 *  screen a canvas, turned by `yaw` (at 0 its screen faces +z): a MacBook,
 *  its keyboard and trackpad (MacDeck), its screen in a black glass
 *  bezel. */
export function LaptopOnStand({
  map,
  at,
  yaw,
}: {
  map: CanvasTexture;
  at: [number, number];
  yaw: number;
}) {
  const top = DESK.top;
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, yaw, 0]}>
      <mesh position={[0, top + 0.075, 0]} rotation={[TILT, 0, 0]} castShadow>
        <boxGeometry args={[0.3, 0.012, 0.27]} />
        <meshStandardMaterial
          color="#b8bcc1"
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>
      {/* Its back support, under the base (it had shown through the
          deck behind the function row). */}
      <mesh position={[0, top + 0.059, -0.12]} castShadow>
        <boxGeometry args={[0.26, 0.118, 0.014]} />
        <meshStandardMaterial
          color="#b8bcc1"
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>
      <group position={[0, BASE_Y, 0]} rotation={[TILT, 0, 0]}>
        <RoundedBox
          args={[LAP.w, 0.016, LAP.d]}
          radius={0.004}
          smoothness={2}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color="#c5c7ca"
            metalness={0.55}
            roughness={0.32}
          />
        </RoundedBox>
        <MacDeck />
      </group>
      <RoundedBox
        args={[LAP.w, LAP.lid, 0.008]}
        radius={0.003}
        smoothness={2}
        position={[0, LID_Y, LID_Z]}
        rotation={[-LEAN, 0, 0]}
        castShadow
      >
        <meshStandardMaterial
          color="#c5c7ca"
          metalness={0.55}
          roughness={0.32}
        />
      </RoundedBox>
      {/* The black glass round the screen. */}
      <mesh
        position={[
          0,
          LID_Y + Math.sin(LEAN) * 0.0045,
          LID_Z + Math.cos(LEAN) * 0.0045,
        ]}
        rotation={[-LEAN, 0, 0]}
      >
        <planeGeometry args={[LAP.w - 0.008, LAP.lid - 0.008]} />
        <meshStandardMaterial color="#0c0d0f" roughness={0.15} />
      </mesh>
      <mesh
        position={[
          0,
          LID_Y + Math.sin(LEAN) * 0.0055,
          LID_Z + Math.cos(LEAN) * 0.0055,
        ]}
        rotation={[-LEAN, 0, 0]}
      >
        <planeGeometry args={[LAP.w - 0.03, LAP.lid - 0.035]} />
        <meshBasicMaterial map={map} color="#e6e6e6" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The CEO's and the COO's laptops (only laptops, no monitors: the user's
 *  description), each on its stand ahead of them: the CEO's mail, the
 *  COO's financial statements, drawn once. */
export function TeamLaptops() {
  const tex = useMemo(
    () =>
      (['ceo', 'coo'] as const).map((who) => {
        const c = canvasTexture(LAPTOP_W, LAPTOP_H);
        (who === 'ceo' ? drawInbox : drawFinancials)(c.ctx);
        c.texture.needsUpdate = true;
        const place = PLACES.find((p) => p.who === who)!;
        return {
          ...c,
          // Ahead of them on the desk, its screen toward them.
          at: [place.x, chairZ(place) + place.face * 1.15] as [number, number],
          yaw: place.face > 0 ? Math.PI : 0,
        };
      }),
    []
  );
  useEffect(() => () => tex.forEach((t) => t.texture.dispose()), [tex]);
  return (
    <>
      {tex.map((t, i) => (
        <LaptopOnStand key={i} map={t.texture} at={t.at} yaw={t.yaw} />
      ))}
    </>
  );
}

/**
 * His desk at Bridge (bridge-local; bridge.ts): his monitor ahead, the
 * marketplace he built on it; his laptop on its stand at its right, turned
 * to him, the valuation pipeline's code on it; the keyboard and trackpad
 * he works at (the room's), his blue tumbler at his left (Neighbor's). His
 * hands drive them (`work`): typing, the code goes on; on the trackpad, a
 * listing is hovered, its pin lit on the map.
 */
export function BridgeDesk({
  work,
  reduced,
}: {
  work: RefObject<Desk>;
  reduced: boolean;
}) {
  const tex = useMemo(() => {
    const screen = canvasTexture(MARKET_W, MARKET_H),
      laptop = canvasTexture(LAPTOP_W, LAPTOP_H),
      keys = canvasTexture(KEYS_W, KEYS_H);
    drawDeskKeys(keys.ctx);
    keys.texture.needsUpdate = true;
    drawMarket(screen.ctx, 0);
    screen.texture.needsUpdate = true;
    return { screen, laptop, keys };
  }, []);
  useEffect(
    () => () => {
      tex.screen.texture.dispose();
      tex.laptop.texture.dispose();
      tex.keys.texture.dispose();
    },
    [tex]
  );
  const live = useRef(tex),
    group = useRef<Group>(null),
    view = useRef({
      market: -1,
      code: '',
      typed: 0,
      hover: 0,
      wasMouse: false,
      onPad: 0,
    });
  useFrame(({ clock }, dt) => {
    if (!shown(group.current)) return;
    const v = view.current,
      w = work.current,
      step = Math.min(dt, 0.05);
    // The map only once his hand has stayed on the trackpad a moment.
    v.onPad = !reduced && w?.mouse ? v.onPad + step : 0;
    const mouse = v.onPad > 0.35;
    if (mouse && !v.wasMouse) v.hover = (v.hover + 1) % LISTING_COUNT;
    v.wasMouse = mouse;
    const hover = mouse
      ? (v.hover + Math.floor(clock.elapsedTime / 1.6)) % LISTING_COUNT
      : v.hover;
    if (reduced) v.typed = CODE_LEN;
    else if (!mouse && (w?.active ?? 0) > 0)
      v.typed = (v.typed + step * 22) % (CODE_LEN + 60);
    const typed = Math.min(CODE_LEN, Math.floor(v.typed)),
      caret = Math.floor(clock.elapsedTime * 2) % 2 === 0,
      code = `${typed}${caret}`;
    if (hover !== v.market) {
      v.market = hover;
      drawMarket(live.current.screen.ctx, hover);
      live.current.screen.texture.needsUpdate = true;
    }
    if (code !== v.code) {
      v.code = code;
      drawValuationCode(live.current.laptop.ctx, typed, caret);
      live.current.laptop.texture.needsUpdate = true;
    }
  });

  const [mx, my, mz] = MONITOR.at,
    [kx, , kz] = KEYS,
    top = DESK.top;
  return (
    <group ref={group}>
      {/* The monitor, its screen toward him (-z; he faces the wall, +z). */}
      <RoundedBox
        args={[MONITOR.w + 0.028, MONITOR.h + 0.028, 0.03]}
        radius={0.008}
        smoothness={3}
        position={[mx, my, mz + 0.008]}
        castShadow
      >
        <meshStandardMaterial color="#1b1d21" roughness={0.45} />
      </RoundedBox>
      <mesh position={[mx, my, mz - 0.0085]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[MONITOR.w, MONITOR.h]} />
        <meshBasicMaterial
          map={tex.screen.texture}
          color="#ececec"
          toneMapped={false}
        />
      </mesh>
      <mesh position={[mx, top + 0.11, mz + 0.045]} castShadow>
        <boxGeometry args={[0.07, 0.22, 0.035]} />
        <meshStandardMaterial
          color="#c3c6cb"
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>
      <RoundedBox
        args={[0.24, 0.012, 0.17]}
        radius={0.005}
        smoothness={2}
        position={[mx, top + 0.006, mz + 0.04]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#c3c6cb"
          metalness={0.6}
          roughness={0.35}
        />
      </RoundedBox>
      {/* The laptop on its stand, turned to him. */}
      <LaptopOnStand
        map={tex.laptop.texture}
        at={[LAPTOP.at[0], LAPTOP.at[1]]}
        yaw={LAPTOP.yaw}
      />
      {/* The keyboard (the room's: silver, white keys), its function row
          toward the monitor, and a white trackpad at his right. */}
      <RoundedBox
        args={[0.6, 0.008, 0.247]}
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
      {/* Its keys' face, the function row toward the monitor (+z). */}
      <group position={[kx, top + 0.0095, kz]} rotation={[0, Math.PI, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[0.588, 0.235]} />
          <meshStandardMaterial map={tex.keys.texture} roughness={0.45} />
        </mesh>
      </group>
      <RoundedBox
        args={[0.2, 0.01, 0.24]}
        radius={0.004}
        smoothness={3}
        // Where his right palm lands in the Typing clip (as at Neighbor).
        // (His right is -x.)
        position={[kx - 0.45, top + 0.005, kz - 0.02]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#ecebe7" roughness={0.32} />
      </RoundedBox>
      {/* His tumbler, at his left. */}
      <group position={[kx + 0.5, top, kz + 0.18]}>
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
