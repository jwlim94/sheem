import { useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import { BoxGeometry, Group, Mesh } from 'three';
import type { RoomAudio } from './audio';
import { BAR, BAR_BRACKET, BAR_FOOT } from './soundbarLayout';
import { SpeakerViz } from './SpeakerViz';

/**
 * The soundbar on his bookcase (build_room.py: 0.56 × 0.13 × 0.13 m, a
 * charcoal body, a dark grille, the LED spectrum drawn live by SpeakerViz),
 * as a piece to place in the other chapters' rooms: wherever the music is
 * heard, the bar it comes from is there, dancing to it (the user's call,
 * 2026-11-19). Front +Z before `rotation`; at `position` (its centre) and
 * `scale` (soundbarLayout.ts places it). It stands on little feet on a surface
 * (`mount` 'feet'), or hangs on a slim wall bracket behind it ('wall': no
 * light pool below it).
 */
export function Soundbar({
  audio,
  reduced,
  position,
  rotation = 0,
  scale = 1,
  mount = 'feet',
  light = true,
  color = '#26282c',
  glow = 0,
  roughness = 0.55,
}: {
  audio: RefObject<RoomAudio | null>;
  reduced: boolean;
  position: [number, number, number];
  /** About Y: 0 faces +Z. */
  rotation?: number;
  scale?: number;
  mount?: 'feet' | 'wall';
  /** SpeakerViz's point light (one per place: see SpeakerViz). */
  light?: boolean;
  /** The body's colour, and how much it lights itself (in a dark room). */
  color?: string;
  glow?: number;
  roughness?: number;
}) {
  const { w: W, h: H, d: D } = BAR;
  // The bar at the origin, front to +Z, for SpeakerViz to measure (never
  // added to the scene, so its frame stays this local one).
  const parts = useMemo(() => {
    const body = new BoxGeometry(W, H, D),
      grille = new BoxGeometry(W - 0.03, H - 0.03, 0.004),
      template = new Group(),
      b = new Mesh(body),
      g = new Mesh(grille);
    b.name = 'Speaker';
    g.name = 'Speaker_grille';
    g.position.z = D / 2 + 0.0015;
    template.add(b, g);
    template.updateMatrixWorld(true);
    return { body, grille, template };
  }, [W, H, D]);
  useEffect(
    () => () => {
      parts.body.dispose();
      parts.grille.dispose();
    },
    [parts]
  );
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh geometry={parts.body} castShadow receiveShadow>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={glow}
          roughness={roughness}
        />
      </mesh>
      <mesh geometry={parts.grille} position={[0, 0, D / 2 + 0.0015]}>
        <meshStandardMaterial color="#1e2023" roughness={0.95} />
      </mesh>
      {mount === 'feet'
        ? [-1, 1].map((s) => (
            <mesh
              key={s}
              position={[s * (W / 2 - 0.05), -H / 2 - BAR_FOOT / 2, 0]}
            >
              <boxGeometry args={[0.03, BAR_FOOT, 0.07]} />
              <meshStandardMaterial color="#1d1d1f" roughness={0.8} />
            </mesh>
          ))
        : (
            <mesh position={[0, 0, -D / 2 - BAR_BRACKET / 2]}>
              <boxGeometry args={[W * 0.45, H * 0.5, BAR_BRACKET]} />
              <meshStandardMaterial color="#1d1d1f" roughness={0.7} />
            </mesh>
          )}
      <SpeakerViz
        room={parts.template}
        audio={audio}
        reduced={reduced}
        pool={mount === 'feet'}
        light={light}
      />
    </group>
  );
}
