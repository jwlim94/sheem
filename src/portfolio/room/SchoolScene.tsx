import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { CanvasTexture, MathUtils, SRGBColorSpace } from 'three';
import type { Mesh, MeshStandardMaterial } from 'three';
import { Clock } from './Clock';
import { ProjectorBeam } from './ProjectorBeam';
import { Classmates } from './Classmates';
import { HallSpeaker } from './HallSpeaker';
import type { RoomAudio } from './audio';
import { mailBeats, SCHOOL_ORIGIN, schoolBeats } from './story';
import {
  SCHOOL_CLOCK,
  LAPTOP,
  SCHOOL_DESK_Y,
  SCHOOL_HINGE_X,
  SCHOOL_LID,
  SIGN,
  SLIDE,
} from './hall';
import { Seats } from './Seats';
import {
  CODE_LENGTH,
  drawKeyboard,
  drawMail,
  drawScreen,
} from './schoolLaptop';
import { AcousticWalls, Ceiling } from './AcousticWalls';

const SCHOOL = '/models/portfolio-school/school.glb';

// From art/portfolio-school/build_school.py (local axes: +X to the front wall).
// Just in front of the frame (its face is at x 5.36).

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

const FONT = "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Helvetica Neue', Arial";
const MONO = "Menlo, Consolas, 'Courier New', monospace";

/** Day one of CS 142 on the projector (no logos, just the course). */
function drawSlide(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#f7f5f0';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1f2d4d';
  ctx.fillRect(0, 0, w, 96);
  ctx.fillStyle = '#f7f5f0';
  ctx.font = `600 40px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('CS 142 · Introduction to Computer Programming', 60, 48);
  ctx.textAlign = 'right';
  ctx.fillText('Fall 2019', w - 60, 48);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#b5642f';
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText('LECTURE 1', 90, 200);
  ctx.fillStyle = '#1f2433';
  ctx.font = `800 120px ${FONT}`;
  ctx.fillText('Hello, World!', 84, 300);
  // A code card.
  const cx = 90,
    cy = 400,
    cw = w - 180,
    ch = 380;
  ctx.fillStyle = '#272c36';
  ctx.beginPath();
  ctx.roundRect(cx, cy, cw, ch, 22);
  ctx.fill();
  const lines: [string, string][][] = [
    [
      ['#c678dd', '#include '],
      ['#98c379', '<iostream>'],
    ],
    [],
    [
      ['#c678dd', 'int '],
      ['#61afef', 'main'],
      ['#abb2bf', '() {'],
    ],
    [
      ['#abb2bf', '    std::cout << '],
      ['#98c379', '"Hello, World!"'],
      ['#abb2bf', ' << std::endl;'],
    ],
    [
      ['#c678dd', '    return '],
      ['#d19a66', '0'],
      ['#abb2bf', ';'],
    ],
    [['#abb2bf', '}']],
  ];
  ctx.font = `44px ${MONO}`;
  lines.forEach((line, i) => {
    let x = cx + 50;
    for (const [color, text] of line) {
      ctx.fillStyle = color;
      ctx.fillText(text, x, cy + 62 + i * 54);
      x += ctx.measureText(text).width;
    }
  });
  // The output, in a terminal strip under the code.
  const oy = cy + ch + 40;
  ctx.fillStyle = '#11141a';
  ctx.beginPath();
  ctx.roundRect(cx, oy, cw, h - oy - 70, 22);
  ctx.fill();
  ctx.font = `40px ${MONO}`;
  ctx.fillStyle = '#7f848e';
  ctx.fillText('$ g++ hello.cpp -o hello && ./hello', cx + 50, oy + 70);
  ctx.fillStyle = '#98c379';
  ctx.fillText('Hello, World!', cx + 50, oy + 130);
  // Footer.
  ctx.fillStyle = '#9aa0ab';
  ctx.font = `600 30px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('1 / 24', w - 60, h - 30);
  ctx.textAlign = 'left';
}

/** The sign above the boards, as in the real auditorium. */
function drawSign(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#1d1e22';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f2f1ec';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Fit each line inside the plate with a margin.
  const line = (text: string, y: number) => {
    let size = 40;
    do ctx.font = `700 ${size--}px ${FONT}`;
    while (ctx.measureText(text).width > w * 0.88 && size > 12);
    ctx.fillText(text, w / 2, y);
  };
  line('NO FOOD OR DRINK ALLOWED', h * 0.34);
  line('IN AUDITORIUM', h * 0.7);
}

/**
 * Chapter 1's lecture hall (2019, CS 142): the big, dim auditorium from Blender
 * (its ~280 seats instanced by Seats) plus what is live: the slide projected on the whiteboard, the projector's beam
 * with dust, the sign, his laptop's terminal, the wall clock at a quarter past
 * nine, and the classmates filling the seats as the scroll goes on. The hero,
 * the lights and the camera stay in RoomScene.
 */
export function SchoolScene({
  reduced,
  school,
  mail,
  audio,
}: {
  reduced: boolean;
  /** 0..1 through the chapter (classmates arrive as it goes). */
  school: RefObject<number>;
  /** 0..1 through the mail into chapter 2 (on the laptop's screen). */
  mail: RefObject<number>;
  audio: RefObject<RoomAudio | null>;
}) {
  const hall = useGLTF(SCHOOL);

  const tex = useMemo(() => {
    const slide = canvas(1600, 1149),
      laptop = canvas(1024, 660),
      keys = canvas(2048, 1414), // twice over, so the legends stay sharp up close
      sign = canvas(512, 132);
    drawSlide(slide.ctx, 1600, 1149);
    drawScreen(laptop.ctx, 1024, 660, 0, 0, true);
    keys.ctx.scale(2, 2);
    drawKeyboard(keys.ctx, 1024, 707);
    drawSign(sign.ctx, 512, 132);
    return { slide, laptop, sign, keys };
  }, []);
  useEffect(
    () => () => {
      tex.slide.texture.dispose();
      tex.laptop.texture.dispose();
      tex.sign.texture.dispose();
      tex.keys.texture.dispose();
    },
    [tex]
  );
  useEffect(() => {
    hall.scene.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = m.receiveShadow = true;
      // The booth's window is tinted glass: the monitors glow through it.
      const mat = m.material as MeshStandardMaterial;
      if (mat.name === 'Booth glass') {
        mat.transparent = true;
        mat.opacity = 0.35;
        mat.depthWrite = false;
        m.castShadow = false;
      }
      // His cream backpack is toned down in the dark hall (it drew the eye
      // before he did). Set, not scaled, so a StrictMode re-run is the same.
      if (mat.name === 'Backpack fabric') {
        mat.color.setScalar(0.78);
        mat.emissiveIntensity = 0.4;
      }
      // The backpack's contact-shadow decal would cast a dark square.
      if (mat.name.startsWith('Contact shadow')) m.castShadow = false;
    });
  }, [hall.scene]);

  // He types the program out (about 14 characters a second), then it is
  // compiled and run in the terminal for a few seconds, and typed again.
  // As the camera comes in over his shoulder (the push), the scroll takes
  // over: he types it from the top while the screen is still far, finishes
  // as it fills the frame, and it runs, ending on "Hello, Jongwoo!", which
  // stays up (the chapter's last shot).
  const typing = useRef({ t: 0, key: '' }),
    laptop = useRef(tex.laptop);
  useFrame(({ clock }, dt) => {
    const st = typing.current,
      typeFor = CODE_LENGTH / 14,
      cycle = typeFor + 5;
    if (!reduced) st.t = (st.t + Math.min(dt, 0.05)) % cycle;
    // Into chapter 2: the invitation arrives and opens over the output.
    const ml = mail.current ?? 0;
    if (ml > 0) {
      const mb = mailBeats(ml),
        key = `mail|${Math.round(mb.notify * 80)}|${Math.round(mb.open * 80)}`;
      if (key === st.key) return;
      st.key = key;
      const l = laptop.current;
      drawMail(l.ctx, 1024, 660, mb.notify, mb.open);
      l.texture.needsUpdate = true;
      return;
    }
    const t = reduced ? typeFor + 4 : st.t,
      push = schoolBeats(school.current).push,
      typed =
        push > 0.001
          ? CODE_LENGTH * MathUtils.smoothstep(push, 0.05, 0.72)
          : Math.min(CODE_LENGTH, t * 14),
      run =
        push > 0.001
          ? MathUtils.smoothstep(push, 0.78, 0.97)
          : t > typeFor + 0.6
            ? (t - typeFor - 0.6) / 3
            : 0,
      caret = run > 0 || t < typeFor ? true : (clock.elapsedTime * 2) % 2 < 1,
      key = `${Math.floor(typed)}|${Math.round(run * 40)}|${caret}`;
    if (key === st.key) return;
    st.key = key;
    const l = laptop.current;
    drawScreen(l.ctx, 1024, 660, typed, Math.min(1, run), caret);
    l.texture.needsUpdate = true;
  });

  const [lx, ly, lz] = SCHOOL_LID;
  return (
    <group position={SCHOOL_ORIGIN}>
      <primitive object={hall.scene} />
      <Seats hall={hall.scene} />
      <AcousticWalls />
      <Ceiling />
      <mesh
        position={[SLIDE.x, SLIDE.y, SLIDE.z]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <planeGeometry args={[SLIDE.w, SLIDE.h]} />
        {/* Projected light on the board: bright, a little cool. */}
        <meshBasicMaterial
          map={tex.slide.texture}
          color="#eceeff"
          toneMapped={false}
        />
      </mesh>
      <mesh position={[SIGN.x, SIGN.y, SIGN.z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[SIGN.w, SIGN.h]} />
        <meshStandardMaterial map={tex.sign.texture} roughness={0.6} />
      </mesh>
      {/* Laptop screen on the lid's inner face (the lid leans 14° back): the
          glass fills the lid, the bezel is drawn in the texture. */}
      <group position={[lx, ly, lz]} rotation={[0, 0, -0.244]}>
        <mesh position={[-0.0078, 0.0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[LAPTOP.w - 0.01, LAPTOP.lidH - 0.012]} />
          <meshBasicMaterial map={tex.laptop.texture} toneMapped={false} />
        </mesh>
      </group>
      {/* The keyboard deck on the base, keys toward the lid; a little
          self-lit so the keys read in the dim hall. */}
      <group
        position={[
          SCHOOL_HINGE_X - LAPTOP.d / 2,
          SCHOOL_DESK_Y + LAPTOP.base + 0.0005,
          lz,
        ]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[LAPTOP.w, LAPTOP.d]} />
          <meshStandardMaterial
            map={tex.keys.texture}
            emissiveMap={tex.keys.texture}
            emissive="#ffffff"
            emissiveIntensity={0.22}
            roughness={0.45}
            metalness={0.2}
          />
        </mesh>
      </group>
      <ProjectorBeam reduced={reduced} />
      <Classmates school={school} reduced={reduced} />
      <HallSpeaker audio={audio} reduced={reduced} />
      <Clock
        reduced={reduced}
        position={SCHOOL_CLOCK}
        facing={-Math.PI / 2}
        hours={9.27}
      />
    </group>
  );
}
