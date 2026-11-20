/* eslint-disable react-hooks/immutability -- Owned Three.js props change in the frame loop. */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import type { RefObject } from 'react';
import { experiences } from './experience';
import { BOOK_LAP, ease } from './reading';
import { notebookTransform } from './bookChoreography';
import type { ReadingState } from './reading';

function pageTexture(page: number, index: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = index ? '#e7e9d8' : '#faf7ee';
  ctx.fillRect(0, 0, 768, 1024);
  const gutter = ctx.createLinearGradient(
    index ? 710 : 0,
    0,
    index ? 768 : 58,
    0
  );
  gutter.addColorStop(0, index ? '#0000' : '#76664525');
  gutter.addColorStop(1, index ? '#76664525' : '#0000');
  ctx.fillStyle = gutter;
  ctx.fillRect(0, 0, 768, 1024);
  ctx.fillStyle = '#273e3b';
  const wrap = (text: string, y: number, size: number, width = 642) => {
    ctx.font = `${size}px Georgia`;
    let line = '';
    for (const word of text.split(' ')) {
      if (ctx.measureText(line + word).width > width) {
        ctx.fillText(line, 64, y);
        y += size * 1.55;
        line = '';
      }
      line += word + ' ';
    }
    ctx.fillText(line, 64, y);
    return y + size * 1.55;
  };
  ctx.font = '16px sans-serif';
  ctx.fillText(
    index ? 'THE EXPERIENCE BOOK' : `CHAPTER 0${page + 1} / EXPERIENCE`,
    64,
    82
  );
  if (index) {
    wrap('Work, in chapters.', 160, 54);
    ctx.font = '24px sans-serif';
    ctx.fillText('Jongwoo Lim', 64, 310);
    ctx.font = '18px sans-serif';
    ctx.fillText('Full-Stack Software Engineer', 64, 346);
    experiences.forEach((entry, i) => {
      const y = 430 + i * 100;
      if (i === page) {
        ctx.fillStyle = '#faf7ee';
        ctx.fillRect(44, y - 36, 680, 80);
      }
      ctx.fillStyle = '#273e3b';
      ctx.font = '22px Georgia';
      ctx.fillText(`0${i + 1}    ${entry.company}`, 64, y);
      ctx.font = '15px sans-serif';
      ctx.fillText(entry.period ?? '', 117, y + 27);
    });
  } else {
    const c = experiences[page];
    let y = wrap(c.company, 160, 45);
    ctx.font = '22px sans-serif';
    ctx.fillText(c.role, 64, y + 18);
    ctx.font = '17px sans-serif';
    ctx.fillText(
      [c.period, c.location].filter(Boolean).join(' · '),
      64,
      y + 55
    );
    y = wrap(c.theme, y + 119, 27) + 20;
    ctx.font = '16px sans-serif';
    ctx.fillText('MY CONTRIBUTION', 64, y);
    y += 43;
    for (const text of c.contributions) y = wrap(text, y, 21) + 24;
  }
  ctx.font = '17px Georgia';
  ctx.fillText(
    index ? 'J. L.' : `${page + 1} / ${experiences.length}`,
    64,
    978
  );
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
export function Notebook({
  reading,
  onRead,
  reducedMotion,
}: {
  reading: RefObject<ReadingState>;
  onRead: () => void;
  reducedMotion: boolean;
}) {
  const root = useRef<Group>(null),
    left = useRef<Group>(null),
    leaf = useRef<Mesh>(null);
  const textures = useMemo(
    () =>
      experiences.map((_, i) => [pageTexture(i, true), pageTexture(i, false)]),
    []
  );
  const geometry = useMemo(
    () => new PlaneGeometry(0.43, 0.58, 20, 1).translate(0.215, 0, 0),
    []
  );
  const leftMaterial = useRef<Mesh>(null),
    rightMaterial = useRef<Mesh>(null);
  const lastPage = useRef(-1);
  useEffect(
    () => () => {
      textures.flat().forEach((t) => t.dispose());
      geometry.dispose();
    },
    [textures, geometry]
  );
  useFrame((_, dt) => {
    if (!root.current || !left.current) return;
    const s = reading.current;
    root.current.userData.unpackProgress = s.book;
    const pose = notebookTransform(s.book);
    // Independent world-space prop stays on the bench until it is picked up.
    root.current.position.set(pose.x, pose.y, pose.z);
    root.current.rotation.set(pose.pitch, pose.yaw, 0, 'YXZ');
    if (s.bookAttached) {
      root.current.position.fromArray(s.heldBookPosition);
      root.current.quaternion.fromArray(s.heldBookQuaternion);
    }
    root.current.userData.contactError = s.contactError;
    root.current.userData.seatContactError = s.seatContactError;
    root.current.userData.armReachError = s.armReachError;
    root.current.scale.setScalar(BOOK_LAP.scale);
    left.current.rotation.y = Math.PI * (1 - pose.open);
    if (lastPage.current !== s.page) {
      lastPage.current = s.page;
      s.pageTurn = 0;
      for (const [mesh, texture] of [
        [leftMaterial.current, textures[s.page][0]],
        [rightMaterial.current, textures[s.page][1]],
      ] as const) {
        if (mesh && mesh.material instanceof MeshStandardMaterial) {
          mesh.material.map = texture;
          mesh.material.needsUpdate = true;
        }
      }
    }
    s.pageTurn = Math.min(1, s.pageTurn + dt / (reducedMotion ? 0.001 : 0.65));
    if (leaf.current) {
      const t = s.pageTurn;
      leaf.current.visible = t > 0 && t < 1;
      leaf.current.rotation.y = -Math.PI * ease(t);
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        position.setZ(
          i,
          Math.sin((x / 0.43) * Math.PI) * Math.sin(t * Math.PI) * 0.1 + 0.012
        );
      }
      position.needsUpdate = true;
      geometry.computeVertexNormals();
    }
  });
  return (
    <group
      ref={root}
      name="reading-notebook"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (reading.current.phase === 'idle') reading.current.command = 'sit';
        else if (reading.current.phase === 'seated') onRead();
      }}
    >
      <group ref={left}>
        <mesh position={[-0.221, 0, -0.018]} castShadow>
          <boxGeometry args={[0.452, 0.61, 0.025]} />
          <meshStandardMaterial color="#3e655d" roughness={0.8} />
        </mesh>
        <mesh position={[-0.215, 0, -0.002]}>
          <boxGeometry args={[0.43, 0.58, 0.016]} />
          <meshStandardMaterial color="#ded6bd" />
        </mesh>
        <mesh ref={leftMaterial} position={[-0.215, 0, 0.008]}>
          <planeGeometry args={[0.43, 0.58]} />
          <meshStandardMaterial
            map={textures[0][0]}
            roughness={1}
            side={DoubleSide}
          />
        </mesh>
      </group>
      <mesh position={[0.221, 0, -0.018]} castShadow>
        <boxGeometry args={[0.452, 0.61, 0.025]} />
        <meshStandardMaterial color="#3e655d" roughness={0.8} />
      </mesh>
      <mesh position={[0.215, 0, -0.002]}>
        <boxGeometry args={[0.43, 0.58, 0.016]} />
        <meshStandardMaterial color="#ded6bd" />
      </mesh>
      <mesh ref={rightMaterial} position={[0.215, 0, 0.008]}>
        <planeGeometry args={[0.43, 0.58]} />
        <meshStandardMaterial
          map={textures[0][1]}
          roughness={1}
          side={DoubleSide}
        />
      </mesh>
      <mesh ref={leaf} geometry={geometry} castShadow>
        <meshStandardMaterial color="#f5f0e3" side={DoubleSide} roughness={1} />
      </mesh>
      <mesh position={[0.06, -0.315, -0.006]}>
        <boxGeometry args={[0.025, 0.09, 0.003]} />
        <meshStandardMaterial color="#b27854" />
      </mesh>
    </group>
  );
}
