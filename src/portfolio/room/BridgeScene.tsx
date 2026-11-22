import { useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import { useGLTF } from '@react-three/drei';
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Material, Mesh, MeshStandardMaterial } from 'three';
import { BOARD } from './bridge';
import { BRIDGE_BOARD, drawBridgeBoard } from './bridgeBoard';
import { BridgeDesk, TeamLaptops } from './BridgeDesk';
import { Coworkers } from './Coworkers';
import { loadKalam } from './officeDesk';
import type { Desk } from './Screen';

const BRIDGE = '/models/portfolio-bridge/bridge.glb';
const DRACO = '/draco/';

/**
 * Chapter 4's office, Bridge's (bridge.ts): the room from Blender
 * (art/portfolio-bridge/build_bridge.py), plus what is live: the whiteboard
 * (bridgeBoard.ts), his desk (his monitor, his laptop on its stand, the
 * keyboard and trackpad: BridgeDesk) and the people at their desks
 * (Coworkers). The hero, the lights and the camera stay in RoomScene.
 * Bridge-local (RoomScene places it at BRIDGE_ORIGIN).
 */
export function BridgeScene({
  work,
  reduced,
}: {
  /** What his hands are doing (keys or trackpad). */
  work: RefObject<Desk>;
  reduced: boolean;
}) {
  const room = useGLTF(BRIDGE, DRACO);
  const board = useMemo(() => {
    const el = document.createElement('canvas');
    el.width = BRIDGE_BOARD.cw;
    el.height = BRIDGE_BOARD.ch;
    const ctx = el.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    drawBridgeBoard(ctx);
    const texture = new CanvasTexture(el);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    return { ctx, texture };
  }, []);
  useEffect(() => {
    let alive = true;
    loadKalam().then(() => {
      if (!alive) return;
      drawBridgeBoard(board.ctx);
      board.texture.needsUpdate = true;
    });
    return () => {
      alive = false;
      board.texture.dispose();
    };
  }, [board]);

  useEffect(() => {
    room.scene.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const glassy = /^Bridge[ _](door[ _])?(glass|frosted)$/.test(o.name);
      m.castShadow = !glassy;
      m.receiveShadow = !glassy;
      if (glassy) m.renderOrder = 2;
      const mats = (
        Array.isArray(m.material) ? m.material : [m.material]
      ) as Material[];
      for (const mat of mats) {
        const s = mat as MeshStandardMaterial;
        // Clear glass: barely there, a faint cool sheen. The frosted band
        // at eye height (so the glass reads) and the office across the
        // corridor's frosted front: milky.
        if (mat.name === 'Glass') {
          s.transparent = true;
          s.opacity = 0.08;
          s.depthWrite = false;
          s.roughness = 0.05;
        } else if (mat.name === 'Frosted glass') {
          s.transparent = true;
          s.opacity = 0.55;
          s.depthWrite = false;
        }
      }
    });
  }, [room.scene]);

  return (
    <group>
      <primitive object={room.scene} />
      <mesh
        position={[BOARD.x - 0.003, (BOARD.y0 + BOARD.y1) / 2, 0]}
        // Facing into the room (-x); its canvas's left end at z0.
        rotation={[0, -Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[BOARD.z1 - BOARD.z0, BOARD.y1 - BOARD.y0]} />
        <meshStandardMaterial
          map={board.texture}
          roughness={0.28}
          metalness={0}
        />
      </mesh>
      <BridgeDesk work={work} reduced={reduced} />
      <TeamLaptops />
      <Coworkers reduced={reduced} />
    </group>
  );
}

useGLTF.preload(BRIDGE, DRACO);
