import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CanvasTexture,
  MathUtils,
  MeshBasicMaterial,
  SRGBColorSpace,
} from 'three';
import type { Vector3 } from 'three';
import type { RoomAudio } from './audio';

/** What the hero's hands are doing at the desk, written by RoomScene each frame. */
export type Desk = {
  /** 0..1: how much the Typing clip is playing (0 once the chair rolls back). */
  active: number;
  /** The right hand is on the mouse rather than the keyboard. */
  mouse: boolean;
  /** Right palm in world space, to drive the on-screen pointer. */
  hand: Vector3;
  /** Where the keys he types on are (the room's keyboard or the school laptop). */
  keys: Vector3;
};

// The monitor's glass (three.js axes), from the flat-panel monitor in
// art/portfolio-room/build_room.py; the code sits just in front of it.
const CENTRE: [number, number, number] = [-0.9, 1.35, -2.243];
const SIZE: [number, number] = [0.8, 0.5];
const W = 1024,
  H = 640;

// One Dark-style palette.
const C = {
  bg: '#1e2127',
  line: '#2c313a',
  bar: '#16181d',
  gutter: '#4b5263',
  text: '#abb2bf',
  kw: '#c678dd',
  str: '#98c379',
  fn: '#61afef',
  type: '#e5c07b',
  num: '#d19a66',
  com: '#7f848e',
  cursor: '#528bff',
};

// Facts from docs/Resume.pdf only (Fitzza is left out: its dates conflict).
const SOURCE = `// portfolio.ts — the story starts here
import { Engineer, Chapter } from './jongwoo';

const me = new Engineer({
  name: 'Jongwoo Lim',
  role: 'Full-Stack Software Engineer',
  stack: ['React', 'TypeScript', 'Python', 'GCP'],
});

const chapters: Chapter[] = [
  { at: 'BYU', title: 'Computer Science', year: 2019 },
  { at: 'BYU Broadcasting', title: 'Software Engineer', year: 2021 },
  { at: 'Neighbor', title: 'Full-Stack Engineer', year: 2022 },
  { at: 'BYU', title: 'Information Systems', year: 2024 },
  { at: 'Bridge', title: 'Full-Stack Engineer', year: 2025 },
];

export async function nextChapter(index: number) {
  const chapter = chapters[index];
  if (!chapter) return me.say('Still building...');
  await me.learn(chapter.title);
  return me.ship(chapter);
}

function render(story: Chapter[]) {
  for (const chapter of story) {
    scene.add(chapter.at, { scroll: true });
  }
}

render(chapters);
me.say('Welcome!');
`;

const KEYWORDS =
  'import|from|const|let|new|export|async|function|await|return|if|for|of|true|false';
const TOKEN = new RegExp(
  `(//.*$)|('[^']*')|\\b(${KEYWORDS})\\b|\\b(\\d+)\\b|\\b([A-Z][A-Za-z]*)\\b|\\b([a-z][A-Za-z]*)(?=\\()`,
  'g'
);

type Seg = [string, string];
/** Splits a line into coloured segments. */
function highlight(line: string): Seg[] {
  const out: Seg[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    if (m.index > last) out.push([line.slice(last, m.index), C.text]);
    const col = m[1]
      ? C.com
      : m[2]
        ? C.str
        : m[3]
          ? C.kw
          : m[4]
            ? C.num
            : m[5]
              ? C.type
              : C.fn;
    out.push([m[0], col]);
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push([line.slice(last), C.text]);
  return out;
}

const RAW = SOURCE.split('\n');
const LINES = RAW.map(highlight);
const STARTS: number[] = [];
let TOTAL = 0;
for (const line of RAW) {
  STARTS.push(TOTAL);
  TOTAL += line.length + 1; // + newline
}
const CPS = 18; // characters per second while the hands are on the keys
const VIEW = 15; // visible lines; older ones scroll off the top
const LH = 31,
  TOP = 82,
  LEFT = 70,
  CODE_FONT = '22px Menlo, Consolas, monospace';
const RUN = { x: 900, y: 9, w: 104, h: 30 }; // ▶ Run button in the title bar
const TERM_H = 190; // terminal panel height when open
const BUILD_LOG: [number, string, string][] = [
  [0, '$ npm run build', C.text],
  [0.45, 'vite v6.4.1 building for production...', '#9da5b4'],
  [1.0, 'transforming modules...', '#9da5b4'],
  [1.6, '✓ 812 modules transformed.', C.str],
  [2.1, '✓ built in 4.8s', C.str],
];
// Words worth selecting, in order of preference.
const WORDS = ['chapter', 'chapters', 'Engineer', 'Chapter', 'story', 'me'];

const smooth = (t: number) => {
  const x = MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

type Line = { abs: number; i: number; y: number };
/** Which absolute line (counting across repeats) is being typed, and what shows. */
function layout(typed: number) {
  const n = Math.floor(typed),
    cycle = Math.floor(n / TOTAL),
    local = n % TOTAL;
  let cur = LINES.length - 1;
  while (cur > 0 && STARTS[cur] > local) cur--;
  const curAbs = cycle * LINES.length + cur,
    curChars = local - STARTS[cur],
    first = Math.max(0, curAbs - VIEW + 1),
    lines: Line[] = [];
  for (let abs = first; abs <= curAbs; abs++)
    lines.push({ abs, i: abs % LINES.length, y: TOP + (abs - first) * LH });
  return { curAbs, curChars, lines };
}

type Word = { abs: number; y: number; x0: number; x1: number; text: string };
/** A word on a finished, visible line (bottom-most preferred) to select. */
function pickWord(ctx: CanvasRenderingContext2D, typed: number): Word | null {
  const { curAbs, lines } = layout(typed);
  ctx.font = CODE_FONT;
  for (const word of WORDS) {
    for (const line of [...lines].reverse()) {
      if (line.abs === curAbs || line.y > H - 40 - TERM_H) continue;
      const m = new RegExp(`\\b${word}\\b`).exec(RAW[line.i]);
      if (!m) continue;
      const x0 = LEFT + ctx.measureText(RAW[line.i].slice(0, m.index)).width;
      return {
        abs: line.abs,
        y: line.y,
        x0,
        x1: x0 + ctx.measureText(word).width,
        text: word,
      };
    }
  }
  return null;
}

function arrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  down: boolean
) {
  const k = down ? 0.88 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 26);
  ctx.lineTo(7, 20);
  ctx.lineTo(12, 31);
  ctx.lineTo(17, 29);
  ctx.lineTo(12, 18);
  ctx.lineTo(20, 18);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#111317';
  ctx.stroke();
  ctx.restore();
}

type View = {
  typed: number;
  caret: boolean;
  px: number;
  py: number;
  down: boolean;
  ripple: number; // 0..1 click ripple, 0 = none
  runLit: boolean;
  term: number; // 0..1 terminal openness
  termTime: number; // seconds since Run was clicked
  sel: {
    abs: number;
    x0: number;
    x: number;
    text: string;
    done: boolean;
  } | null;
};

function draw(ctx: CanvasRenderingContext2D, v: View) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const { curAbs, curChars, lines } = layout(v.typed);

  ctx.font = CODE_FONT;
  let caretX = LEFT,
    caretY = TOP;
  for (const { abs, i, y } of lines) {
    if (abs === curAbs) {
      ctx.fillStyle = C.line;
      ctx.fillRect(56, y - 23, W - 56, LH);
    }
    // Selection, then every other occurrence of the selected word.
    if (v.sel?.abs === abs) {
      ctx.fillStyle = '#3e4f73';
      ctx.fillRect(
        Math.min(v.sel.x0, v.sel.x),
        y - 23,
        Math.abs(v.sel.x - v.sel.x0),
        LH
      );
    }
    if (v.sel?.done) {
      const re = new RegExp(`\\b${v.sel.text}\\b`, 'g');
      const text = abs === curAbs ? RAW[i].slice(0, curChars) : RAW[i];
      for (const m of text.matchAll(re)) {
        const x = LEFT + ctx.measureText(text.slice(0, m.index)).width;
        if (abs === v.sel.abs && Math.abs(x - v.sel.x0) < 2) continue;
        ctx.strokeStyle = '#5c6a8a';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 1, y - 22, ctx.measureText(m[0]).width + 2, LH - 2);
      }
    }
    ctx.fillStyle = abs === curAbs ? C.text : C.gutter;
    ctx.textAlign = 'right';
    ctx.fillText(String(abs + 1), 44, y);
    ctx.textAlign = 'left';
    let x = LEFT,
      budget = abs === curAbs ? curChars : Infinity;
    for (const [t, col] of LINES[i]) {
      if (budget <= 0) break;
      const part = t.slice(0, budget);
      ctx.fillStyle = col;
      ctx.fillText(part, x, y);
      x += ctx.measureText(part).width;
      budget -= part.length;
    }
    if (abs === curAbs) {
      caretX = x;
      caretY = y;
    }
  }
  if (v.caret) {
    ctx.fillStyle = C.cursor;
    ctx.fillRect(caretX + 1, caretY - 22, 3, 28);
  }

  // Terminal panel sliding up from the status bar.
  if (v.term > 0.001) {
    const h = TERM_H * smooth(v.term),
      top = H - 30 - h;
    ctx.fillStyle = '#181a1f';
    ctx.fillRect(0, top, W, h);
    ctx.fillStyle = '#2c313a';
    ctx.fillRect(0, top, W, 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, W, h);
    ctx.clip();
    ctx.font = '500 15px Menlo, Consolas, monospace';
    ctx.fillStyle = '#9da5b4';
    ctx.fillText('TERMINAL', 18, top + 26);
    ctx.font = '19px Menlo, Consolas, monospace';
    BUILD_LOG.forEach(([at, text, col], k) => {
      if (v.termTime < at) return;
      ctx.fillStyle = col;
      ctx.fillText(text, 18, top + 60 + k * 27);
    });
    ctx.restore();
  }

  // Title bar with window dots, a tab and the Run button.
  ctx.fillStyle = C.bar;
  ctx.fillRect(0, 0, W, 46);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(26 + i * 24, 23, 7, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = C.bg;
  ctx.fillRect(110, 8, 190, 38);
  ctx.font = '500 18px Menlo, Consolas, monospace';
  ctx.fillStyle = C.text;
  ctx.fillText('portfolio.ts', 132, 33);
  ctx.fillStyle = v.runLit ? '#2f6f3e' : '#2c313a';
  ctx.beginPath();
  ctx.roundRect(RUN.x, RUN.y, RUN.w, RUN.h, 6);
  ctx.fill();
  ctx.fillStyle = v.runLit ? '#c9f7d4' : C.str;
  ctx.fillText('▶ Run', RUN.x + 20, RUN.y + 21);

  // Status bar.
  ctx.fillStyle = '#21252b';
  ctx.fillRect(0, H - 30, W, 30);
  ctx.font = '16px Menlo, Consolas, monospace';
  ctx.fillStyle = '#9da5b4';
  ctx.fillText(
    `Ln ${curAbs + 1}, Col ${curChars + 1}   TypeScript   UTF-8   main`,
    18,
    H - 10
  );

  if (v.ripple > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - v.ripple)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(v.px, v.py, 6 + 20 * v.ripple, 0, Math.PI * 2);
    ctx.stroke();
  }
  arrow(ctx, v.px, v.py, v.down);
}

type Action = {
  kind: 'run' | 'select';
  t0: number;
  from: [number, number];
  to: [number, number];
  word: Word | null;
  clicked: boolean;
};

const MOVE = 0.55, // pointer travel to the target
  CLICK = 0.62, // press
  DRAG = 0.5; // select: drag across the word

/**
 * Dark code editor on the monitor, timed by the hero's real hands: text is
 * typed only while the right hand is on the keyboard, and each time it takes
 * the mouse the pointer does something useful, alternating between clicking
 * Run (a terminal slides up with a build log) and drag-selecting a word
 * (other occurrences light up). The file keeps scrolling down, line numbers
 * counting on, instead of restarting.
 */
export function Screen({
  desk,
  reduced,
  audio,
}: {
  desk: RefObject<Desk>;
  reduced: boolean;
  audio: RefObject<RoomAudio | null>;
}) {
  const { gl } = useThree();
  const state = useRef({
    key: '',
    work: 0, // seconds of desk time (stops when the hero stops working)
    wasMouse: false,
    next: 0, // which action the next mouse visit does
    action: null as Action | null,
    termOpen: false,
    termAt: 0,
    termCloseAt: Infinity,
    term: 0,
    view: {
      typed: 0,
      caret: true,
      px: W * 0.72,
      py: H * 0.5,
      down: false,
      ripple: 0,
      runLit: false,
      term: 0,
      termTime: 0,
      sel: null,
    } as View,
  });
  const material = useRef<MeshBasicMaterial>(null),
    canvas = useRef<{
      texture: CanvasTexture;
      ctx: CanvasRenderingContext2D;
    } | null>(null);
  useEffect(() => {
    const el = document.createElement('canvas');
    el.width = W;
    el.height = H;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const texture = new CanvasTexture(el);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    canvas.current = { texture, ctx };
    if (material.current) {
      material.current.map = texture;
      material.current.needsUpdate = true;
    }
    state.current.key = '';
    return () => {
      texture.dispose();
      canvas.current = null;
    };
  }, [gl]);

  useFrame(({ clock, camera }, dt) => {
    const c = canvas.current,
      d = desk.current;
    if (!c || !d) return;
    const s = state.current,
      v = s.view,
      working = reduced ? 0 : d.active;
    s.work += dt * working;
    const mouse = d.mouse && working > 0;
    // The typing recording plays while the hands are on the keys, louder as
    // the camera comes in over the shoulder.
    audio.current?.setTyping(
      mouse ? 0 : working,
      MathUtils.clamp((11 - camera.position.distanceTo(d.keys)) / 8, 0, 1)
    );

    if (reduced) v.typed = TOTAL - 1;
    else if (!mouse) v.typed += dt * CPS * working;

    // Hand reaches for the mouse: start this visit's action.
    if (mouse && !s.wasMouse) {
      const kind = s.next++ % 2 === 0 ? 'run' : 'select';
      const word = kind === 'select' ? pickWord(c.ctx, v.typed) : null;
      const runTarget: [number, number] = [
        RUN.x + RUN.w * 0.45,
        RUN.y + RUN.h * 0.55,
      ];
      s.action = {
        kind: word ? 'select' : 'run',
        t0: s.work,
        from: [v.px, v.py],
        to: word ? [word.x0, word.y - 8] : runTarget,
        word,
        clicked: false,
      };
      v.sel = null;
    }
    // Hand back on the keys: the selection goes, the terminal closes soon.
    if (!mouse && s.wasMouse) {
      s.action = null;
      v.sel = null;
      v.down = false;
      if (s.termOpen) s.termCloseAt = s.work + 1.2;
    }
    s.wasMouse = mouse;

    const a = s.action;
    v.down = false;
    v.ripple = 0;
    if (a && mouse) {
      const e = s.work - a.t0,
        k = smooth(e / MOVE);
      v.px = MathUtils.lerp(a.from[0], a.to[0], k);
      v.py = MathUtils.lerp(a.from[1], a.to[1], k);
      if (e >= CLICK && !a.clicked) {
        a.clicked = true;
        if (a.kind === 'run') {
          s.termOpen = true;
          s.termAt = s.work;
          s.termCloseAt = Infinity;
        }
      }
      if (a.clicked) v.ripple = MathUtils.clamp((e - CLICK) / 0.35, 0, 1) % 1;
      if (a.kind === 'run') v.down = e >= CLICK && e < CLICK + 0.15;
      if (a.kind === 'select' && a.word && e >= CLICK) {
        const t = smooth((e - CLICK) / DRAG);
        v.down = t < 1;
        v.px = MathUtils.lerp(a.word.x0, a.word.x1, t);
        v.sel = {
          abs: a.word.abs,
          x0: a.word.x0,
          x: v.px,
          text: a.word.text,
          done: t >= 1,
        };
      }
    }
    v.runLit =
      !!a && a.kind === 'run' && a.clicked && s.work - a.t0 < CLICK + 0.4;

    if (s.termOpen && s.work >= s.termCloseAt) s.termOpen = false;
    s.term = MathUtils.clamp(
      s.term + (s.termOpen ? dt : -dt) * 3 * (working || 1),
      0,
      1
    );
    v.term = s.term;
    v.termTime = s.work - s.termAt;

    // The caret stays solid while typing and blinks otherwise.
    v.caret = !mouse && working > 0.5 ? true : (clock.elapsedTime * 2) % 2 < 1;
    const key = [
      Math.floor(v.typed),
      v.caret,
      Math.round(v.px),
      Math.round(v.py),
      v.down,
      Math.round(v.ripple * 20),
      v.runLit,
      Math.round(v.term * 60),
      Math.floor(v.termTime * 4),
      v.sel?.done,
    ].join('|');
    if (key === s.key) return;
    s.key = key;
    draw(c.ctx, v);
    c.texture.needsUpdate = true;
  });

  return (
    <mesh position={CENTRE}>
      <planeGeometry args={SIZE} />
      <meshBasicMaterial ref={material} toneMapped={false} color="#d8dcff" />
    </mesh>
  );
}
