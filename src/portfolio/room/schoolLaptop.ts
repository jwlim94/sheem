/**
 * His laptop in the lecture hall, drawn to canvases: a MacBook-like keyboard
 * deck (black keys in a well, a wide trackpad, speaker grilles) and the screen,
 * where the first CS 142 program is typed out line by line, then compiled and
 * run in a terminal, and typed again.
 */
const MONO = "Menlo, Consolas, 'Courier New', monospace";

const CODE = `// CS 142 · Lecture 1 — my first program
#include <iostream>
#include <string>
using namespace std;

int main() {
    string name;
    cout << "What's your name? ";
    cin >> name;

    cout << "Hello, " << name << "!" << endl;
    cout << "Welcome to CS 142." << endl;
    return 0;
}`;
export const CODE_LENGTH = CODE.length;

const RUN = [
  ['#9da5b4', '~/cs142 $ g++ hello.cpp -o hello'],
  ['#9da5b4', '~/cs142 $ ./hello'],
  ['#d7dae0', "What's your name? Jongwoo"],
  ['#98c379', 'Hello, Jongwoo!'],
  ['#98c379', 'Welcome to CS 142.'],
] as const;

const KEYWORDS =
  /^(#include|using|namespace|int|string|return|cout|cin|endl|std)\b/;

/** One Dark-ish colours for a line of C++. */
function tokens(line: string): [string, string][] {
  const out: [string, string][] = [];
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    let m: RegExpMatchArray | null;
    if (rest.startsWith('//')) {
      out.push([rest, '#7f848e']);
      break;
    } else if ((m = rest.match(/^"[^"]*"?/))) out.push([m[0], '#98c379']);
    else if ((m = rest.match(/^<[a-z]+>/))) out.push([m[0], '#98c379']);
    else if ((m = rest.match(KEYWORDS))) out.push([m[0], '#c678dd']);
    else if ((m = rest.match(/^\d+/))) out.push([m[0], '#d19a66']);
    else if ((m = rest.match(/^main\b/))) out.push([m[0], '#61afef']);
    else if ((m = rest.match(/^[A-Za-z_]\w*/))) out.push([m[0], '#e5c07b']);
    else out.push([rest[0], '#abb2bf']);
    i += out[out.length - 1][0].length;
  }
  return out;
}

/**
 * The screen at `typed` characters of the program (fractional), with the
 * terminal showing `run` (0..1) once it is all typed.
 */
export function drawScreen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  typed: number,
  run: number,
  caret: boolean
) {
  // Black glass bezel, then the editor.
  ctx.fillStyle = '#0b0b0c';
  ctx.fillRect(0, 0, w, h);
  const b = 14,
    x0 = b,
    y0 = b,
    sw = w - 2 * b,
    sh = h - 2 * b;
  ctx.fillStyle = '#1e222a';
  ctx.fillRect(x0, y0, sw, sh);
  // Title bar with the window controls and the file name.
  ctx.fillStyle = '#2b303b';
  ctx.fillRect(x0, y0, sw, 40);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x0 + 24 + i * 24, y0 + 20, 7.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.font = `20px ${MONO}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9da5b4';
  ctx.fillText('hello.cpp — cs142', x0 + sw / 2, y0 + 20);
  ctx.textAlign = 'left';

  // The code typed so far, with line numbers; the caret follows the typing.
  const lineH = 33,
    top = y0 + 64,
    left = x0 + 66,
    shown = CODE.slice(0, Math.floor(typed)),
    lines = shown.split('\n');
  ctx.font = `23px ${MONO}`;
  lines.forEach((line, i) => {
    const y = top + i * lineH;
    ctx.fillStyle = '#495162';
    ctx.textAlign = 'right';
    ctx.fillText(String(i + 1), x0 + 44, y);
    ctx.textAlign = 'left';
    let x = left;
    for (const [text, color] of tokens(line)) {
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      x += ctx.measureText(text).width;
    }
    if (i === lines.length - 1 && caret && run <= 0) {
      ctx.fillStyle = '#528bff';
      ctx.fillRect(x + 1, y - 13, 3, 26);
    }
  });

  // The terminal slides up and runs the program. Tall, so its output sits
  // mid-screen, clear of his hands in the over-the-shoulder close-up; the
  // program's own lines larger and bold: the chapter ends on them.
  if (run > 0) {
    const th = 330 * Math.min(1, run * 4),
      ty = y0 + sh - th;
    ctx.fillStyle = '#181b21';
    ctx.fillRect(x0, ty, sw, th);
    ctx.fillStyle = '#3b4048';
    ctx.fillRect(x0, ty, sw, 2);
    const n = Math.min(RUN.length, Math.floor(run * RUN.length * 1.4));
    RUN.slice(0, n).forEach(([color, text], i) => {
      const output = i >= 3;
      ctx.font = output ? `bold 30px ${MONO}` : `22px ${MONO}`;
      ctx.fillStyle = color;
      ctx.fillText(text, x0 + 24, ty + 36 + i * 40 + (output ? 8 : 0));
    });
  }
}

/** The keyboard deck: aluminium, the keys in a dark well (a US MacBook Pro
 *  layout with every legend), a wide trackpad. Drawn in 1024 x 707 units. */
export function drawKeyboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#cfd1d4');
  g.addColorStop(1, '#c2c4c8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const round = (x: number, y: number, rw: number, rh: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, rw, rh, r);
    ctx.fill();
  };
  // Speaker grilles either side of the keyboard.
  ctx.fillStyle = '#9fa2a7';
  for (const sx of [32, w - 52])
    for (let i = 0; i < 26; i++)
      for (let j = 0; j < 3; j++) round(sx + j * 7, 40 + i * 13, 3, 3, 1.5);
  // The key well and the keys: a US MacBook Pro layout on a 15-unit grid
  // (the function row shorter), each key with its legends.
  const kx = 90,
    ky = 30,
    kw = w - 180,
    kh = h * 0.5;
  ctx.fillStyle = '#17181b';
  round(kx - 8, ky - 8, kw + 16, kh + 16, 14);
  const gap = 6,
    unit = (kw + gap) / 15,
    fnH = 0.62,
    keyH = (kh - gap * 5) / (5 + fnH);
  let y = ky;
  KEY_ROWS.forEach((row, r) => {
    const rh = r === 0 ? keyH * fnH : keyH;
    let x = kx;
    for (const key of row) {
      const wpx = key.w * unit - gap;
      if (key.arrows) {
        // ← (full height), ↑ over ↓ (half height each), →.
        const aw = unit - gap,
          hh = (rh - gap / 2) / 2;
        keycap(ctx, x, y, aw, rh, () =>
          arrow(ctx, x + aw / 2, y + rh / 2, 'left')
        );
        keycap(
          ctx,
          x + unit,
          y,
          aw,
          hh,
          () => arrow(ctx, x + unit + aw / 2, y + hh / 2, 'up'),
          4
        );
        keycap(
          ctx,
          x + unit,
          y + hh + gap / 2,
          aw,
          hh,
          () => arrow(ctx, x + unit + aw / 2, y + hh * 1.5 + gap / 2, 'down'),
          4
        );
        keycap(ctx, x + unit * 2, y, aw, rh, () =>
          arrow(ctx, x + unit * 2 + aw / 2, y + rh / 2, 'right')
        );
      } else keycap(ctx, x, y, wpx, rh, () => legend(ctx, key, x, y, wpx, rh));
      x += key.w * unit;
    }
    y += rh + gap;
  });
  // Trackpad.
  const tw = w * 0.44,
    tx = (w - tw) / 2,
    ty = ky + kh + 36,
    th = h - ty - 24;
  ctx.fillStyle = '#b4b7bc';
  round(tx - 2, ty - 2, tw + 4, th + 4, 18);
  ctx.fillStyle = '#c6c8cc';
  round(tx, ty, tw, th, 16);
}

type Glyph =
  | 'sunLow'
  | 'sunHigh'
  | 'mission'
  | 'search'
  | 'mic'
  | 'moon'
  | 'back'
  | 'play'
  | 'forward'
  | 'mute'
  | 'volDown'
  | 'volUp'
  | 'globe'
  | 'touchId';
interface Key {
  /** Width in grid units (15 to a row). */
  w: number;
  /** One centred legend (letters). */
  c?: string;
  /** Two stacked legends (shifted over plain). */
  top?: string;
  bottom?: string;
  /** Small word legends in a corner, and a modifier's symbol. */
  bl?: string;
  br?: string;
  word?: string;
  sym?: string;
  symLeft?: boolean;
  /** A function key: its icon, its F-number. */
  icon?: Glyph;
  f?: string;
  /** The inverted-T arrow cluster (three units). */
  arrows?: boolean;
}

const letters = (keys: string): Key[] => [...keys].map((c) => ({ w: 1, c }));
const pairs = (keys: [string, string][]): Key[] =>
  keys.map(([top, bottom]) => ({ w: 1, top, bottom }));
const fKey = (n: number, icon: Glyph): Key => ({ w: 1.0417, icon, f: `F${n}` });

const KEY_ROWS: Key[][] = [
  [
    { w: 1.5, bl: 'esc' },
    fKey(1, 'sunLow'),
    fKey(2, 'sunHigh'),
    fKey(3, 'mission'),
    fKey(4, 'search'),
    fKey(5, 'mic'),
    fKey(6, 'moon'),
    fKey(7, 'back'),
    fKey(8, 'play'),
    fKey(9, 'forward'),
    fKey(10, 'mute'),
    fKey(11, 'volDown'),
    fKey(12, 'volUp'),
    { w: 1, icon: 'touchId' },
  ],
  [
    ...pairs([
      ['~', '`'],
      ['!', '1'],
      ['@', '2'],
      ['#', '3'],
      ['$', '4'],
      ['%', '5'],
      ['^', '6'],
      ['&', '7'],
      ['*', '8'],
      ['(', '9'],
      [')', '0'],
      ['_', '\u2013'],
      ['+', '='],
    ]),
    { w: 2, br: 'delete' },
  ],
  [
    { w: 1.5, bl: 'tab' },
    ...letters('QWERTYUIOP'),
    ...pairs([
      ['{', '['],
      ['}', ']'],
    ]),
    { w: 1.5, top: '|', bottom: '\\' },
  ],
  [
    { w: 1.75, bl: 'caps lock' },
    ...letters('ASDFGHJKL'),
    ...pairs([
      [':', ';'],
      ['"', "'"],
    ]),
    { w: 2.25, br: 'return' },
  ],
  [
    { w: 2.25, bl: 'shift' },
    ...letters('ZXCVBNM'),
    ...pairs([
      ['<', ','],
      ['>', '.'],
      ['?', '/'],
    ]),
    { w: 2.75, br: 'shift' },
  ],
  [
    { w: 1, icon: 'globe', sym: 'fn' },
    { w: 1, sym: '\u2303', word: 'control' },
    { w: 1, sym: '\u2325', word: 'option' },
    { w: 1.25, sym: '\u2318', word: 'command' },
    { w: 5.5 },
    { w: 1.25, sym: '\u2318', word: 'command', symLeft: true },
    { w: 1, sym: '\u2325', word: 'option', symLeft: true },
    { w: 3, arrows: true },
  ],
];

const SANS =
  "-apple-system, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";
const INK = '#d3d6dc';

/** A keycap: its dark edge, a slightly lighter top, then its legends. */
function keycap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  draw: () => void,
  r = 6
) {
  ctx.fillStyle = '#0e0f11';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.fillStyle = '#2c2e33';
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, h - 6, r - 1);
  ctx.fill();
  ctx.fillStyle = '#3a3d43';
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 3, w - 8, 2.5, 1.5);
  ctx.fill();
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw();
  ctx.restore();
}

function text(
  ctx: CanvasRenderingContext2D,
  t: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign = 'center',
  weight = 400
) {
  ctx.font = `${weight} ${size}px ${SANS}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(t, x, y);
}

function legend(
  ctx: CanvasRenderingContext2D,
  key: Key,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const face = h - 4, // the cap's top, above its front edge
    pad = 6;
  if (key.c) text(ctx, key.c, x + w / 2, y + face * 0.5, 15.5);
  if (key.top && key.bottom) {
    text(ctx, key.top, x + w / 2, y + face * 0.3, 12);
    text(ctx, key.bottom, x + w / 2, y + face * 0.7, 12);
  }
  if (key.bl) text(ctx, key.bl, x + pad, y + face - 9, 9.5, 'left');
  if (key.br) text(ctx, key.br, x + w - pad, y + face - 9, 9.5, 'right');
  if (key.word) {
    text(
      ctx,
      key.sym ?? '',
      key.symLeft ? x + pad : x + w - pad,
      y + 12,
      11,
      key.symLeft ? 'left' : 'right'
    );
    text(ctx, key.word, x + w / 2, y + face - 9, 8.5);
  } else if (key.sym) text(ctx, key.sym, x + w - pad, y + 12, 9.5, 'right');
  if (key.f) {
    if (key.icon) glyph(ctx, key.icon, x + w / 2, y + face * 0.36);
    text(ctx, key.f, x + w / 2, y + face * 0.76, 8);
  } else if (key.icon === 'globe') glyph(ctx, 'globe', x + 13, y + face - 11);
  else if (key.icon) glyph(ctx, key.icon, x + w / 2, y + face / 2);
}

function arrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  dir: 'left' | 'right' | 'up' | 'down'
) {
  const s = 4.2,
    [dx, dy] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
  ctx.beginPath();
  ctx.moveTo(cx + dx * s, cy + dy * s);
  ctx.lineTo(cx - dx * s * 0.6 - dy * s, cy - dy * s * 0.6 + dx * s);
  ctx.lineTo(cx - dx * s * 0.6 + dy * s, cy - dy * s * 0.6 - dx * s);
  ctx.closePath();
  ctx.fill();
}

/** The function keys' small line icons (and fn's globe, Touch ID's ring). */
function glyph(
  ctx: CanvasRenderingContext2D,
  g: Glyph,
  cx: number,
  cy: number
) {
  const line = (pts: [number, number][]) => {
    ctx.beginPath();
    pts.forEach(([px, py], i) =>
      i ? ctx.lineTo(cx + px, cy + py) : ctx.moveTo(cx + px, cy + py)
    );
    ctx.stroke();
  };
  const tri = (ox: number, dir: number, s = 3.6) => {
    ctx.beginPath();
    ctx.moveTo(cx + ox + dir * s, cy);
    ctx.lineTo(cx + ox - dir * s, cy - s);
    ctx.lineTo(cx + ox - dir * s, cy + s);
    ctx.closePath();
    ctx.fill();
  };
  const speaker = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 2);
    ctx.lineTo(cx - 4, cy - 2);
    ctx.lineTo(cx - 0.5, cy - 5);
    ctx.lineTo(cx - 0.5, cy + 5);
    ctx.lineTo(cx - 4, cy + 2);
    ctx.lineTo(cx - 6, cy + 2);
    ctx.closePath();
    ctx.fill();
  };
  const wave = (r: number) => {
    ctx.beginPath();
    ctx.arc(cx + 0.5, cy, r, -0.8, 0.8);
    ctx.stroke();
  };
  switch (g) {
    case 'sunLow':
    case 'sunHigh': {
      const big = g === 'sunHigh',
        r = big ? 3 : 2.4,
        ray = big ? 6.2 : 4.6;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        line([
          [Math.cos(a) * (r + 1.6), Math.sin(a) * (r + 1.6)],
          [Math.cos(a) * ray, Math.sin(a) * ray],
        ]);
      }
      break;
    }
    case 'mission':
      ctx.strokeRect(cx - 7, cy - 4.5, 6, 4);
      ctx.strokeRect(cx + 1, cy - 4.5, 6, 4);
      ctx.strokeRect(cx - 3, cy + 1.5, 6, 4);
      break;
    case 'search':
      ctx.beginPath();
      ctx.arc(cx - 1, cy - 1, 3.6, 0, Math.PI * 2);
      ctx.stroke();
      line([
        [1.6, 1.6],
        [5, 5],
      ]);
      break;
    case 'mic':
      ctx.beginPath();
      ctx.roundRect(cx - 2, cy - 6, 4, 7.5, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy - 1.5, 4.2, 0.2, Math.PI - 0.2);
      ctx.stroke();
      line([
        [0, 2.8],
        [0, 5.5],
      ]);
      break;
    case 'moon':
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0.35 * Math.PI, 1.65 * Math.PI, false);
      ctx.arc(cx + 2.6, cy - 1, 4, 1.45 * Math.PI, 0.55 * Math.PI, true);
      ctx.closePath();
      ctx.fill();
      break;
    case 'back':
      tri(-3.4, -1);
      tri(3, -1);
      break;
    case 'play':
      tri(-3.5, 1, 3.4);
      ctx.fillRect(cx + 1.5, cy - 3.4, 1.6, 6.8);
      ctx.fillRect(cx + 4.4, cy - 3.4, 1.6, 6.8);
      break;
    case 'forward':
      tri(-3, 1);
      tri(3.4, 1);
      break;
    case 'mute':
      speaker();
      break;
    case 'volDown':
      speaker();
      wave(3);
      break;
    case 'volUp':
      speaker();
      wave(3);
      wave(5.6);
      break;
    case 'globe':
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy, 2.2, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      line([
        [-5, 0],
        [5, 0],
      ]);
      break;
    case 'touchId':
      // The sensor: a flat, slightly glossier cap with a faint ring.
      ctx.strokeStyle = 'rgba(160, 166, 176, 0.35)';
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.stroke();
      break;
  }
}

const SYS = "-apple-system, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";

const MAIL_BODY = [
  'Hi Jongwoo,',
  '',
  'Thanks for applying to Neighbor! We’d love to have you in',
  'for an onsite interview at our Lehi office.',
  '',
  'You’ll meet two of our engineers and work through a coding',
  'problem together on the whiteboard.',
  '',
  'See you soon,',
  'Neighbor Recruiting',
];

/**
 * Chapter 1's last screen turning into chapter 2: the program's output stays
 * up while a mail notification slides in from the top right (`notify`,
 * 0..1), then the mail itself opens over it (`open`, 0..1): the invitation
 * to the onsite interview at Neighbor. The camera then dives into its white
 * page.
 */
export function drawMail(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  notify: number,
  open: number
) {
  drawScreen(ctx, w, h, CODE_LENGTH, 1, false);
  const b = 14,
    round = (x: number, y: number, rw: number, rh: number, r: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, rw, rh, r);
      ctx.fill();
    };
  // The banner: frosted, rounded, with the Mail icon, sliding in.
  if (notify > 0 && open < 1) {
    const nw = 360,
      nh = 86,
      e = 1 - (1 - Math.min(1, notify)) ** 3,
      x = w - b - 14 - nw + (1 - e) * (nw + 40),
      y = b + 54;
    ctx.save();
    ctx.globalAlpha = 1 - open;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(236, 238, 242, 0.96)';
    round(x, y, nw, nh, 16);
    ctx.shadowBlur = 0;
    // The app icon: a blue square with a white envelope.
    const g = ctx.createLinearGradient(0, y + 16, 0, y + 58);
    g.addColorStop(0, '#4fb3ff');
    g.addColorStop(1, '#1576f0');
    ctx.fillStyle = g;
    round(x + 14, y + 16, 42, 42, 10);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 22, y + 28, 26, 18);
    ctx.strokeStyle = '#2a86f2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 22, y + 28);
    ctx.lineTo(x + 35, y + 39);
    ctx.lineTo(x + 48, y + 28);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#1d1d1f';
    ctx.font = `600 17px ${SYS}`;
    ctx.fillText('Neighbor Recruiting', x + 70, y + 32);
    ctx.fillStyle = '#86868b';
    ctx.font = `14px ${SYS}`;
    ctx.textAlign = 'right';
    ctx.fillText('now', x + nw - 16, y + 32);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1d1d1f';
    ctx.font = `15px ${SYS}`;
    ctx.fillText('Onsite interview invitation', x + 70, y + 54);
    ctx.fillStyle = '#6e6e73';
    ctx.fillText('Hi Jongwoo, we’d love to have you in…', x + 70, y + 74);
    ctx.restore();
  }
  if (open <= 0) return;
  // The mail window, opening over the editor (it grows from the banner).
  const e = 1 - (1 - Math.min(1, open)) ** 3,
    x = b + (1 - e) * (w - 2 * b) * 0.55,
    y = b + (1 - e) * 60,
    mw = (w - 2 * b) * (0.45 + 0.55 * e),
    mh = (h - 2 * b) * (0.25 + 0.75 * e);
  ctx.save();
  ctx.globalAlpha = Math.min(1, open * 2.5);
  ctx.beginPath();
  ctx.rect(x, y, mw, mh);
  ctx.clip();
  ctx.translate(x, y);
  ctx.scale(mw / (w - 2 * b), mh / (h - 2 * b));
  const W = w - 2 * b,
    H = h - 2 * b;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  // Toolbar and the message list (narrow, the invitation selected).
  ctx.fillStyle = '#f2f2f4';
  ctx.fillRect(0, 0, W, 44);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(22 + i * 22, 22, 7, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#e4e4e8';
  ctx.fillRect(0, 44, W, 1);
  const list = 250;
  ctx.fillStyle = '#f7f7f9';
  ctx.fillRect(0, 45, list, H - 45);
  ctx.fillStyle = '#e4e4e8';
  ctx.fillRect(list, 45, 1, H - 45);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1d1d1f';
  ctx.font = `700 19px ${SYS}`;
  ctx.fillText('Inbox', 18, 78);
  ctx.fillStyle = '#2f7cf6';
  ctx.fillRect(10, 94, list - 20, 74);
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 15px ${SYS}`;
  ctx.fillText('Neighbor Recruiting', 22, 118);
  ctx.font = `14px ${SYS}`;
  ctx.fillText('Onsite interview invitation', 22, 138);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('Hi Jongwoo, thanks for…', 22, 157);
  for (let i = 0; i < 4; i++) {
    const ly = 186 + i * 78;
    ctx.fillStyle = '#c9c9ce';
    ctx.fillRect(22, ly, 120 + ((i * 37) % 60), 10);
    ctx.fillStyle = '#dedee2';
    ctx.fillRect(22, ly + 20, 170 - ((i * 23) % 50), 8);
    ctx.fillRect(22, ly + 36, 150 - ((i * 41) % 40), 8);
  }
  // The message.
  const mx = list + 34;
  ctx.fillStyle = '#1d1d1f';
  ctx.font = `700 24px ${SYS}`;
  ctx.fillText('Onsite interview invitation', mx, 92);
  ctx.fillStyle = '#e6eefc';
  ctx.beginPath();
  ctx.arc(mx + 22, 134, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2f7cf6';
  ctx.font = `600 18px ${SYS}`;
  ctx.textAlign = 'center';
  ctx.fillText('N', mx + 22, 140);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1d1d1f';
  ctx.font = `600 16px ${SYS}`;
  ctx.fillText('Neighbor Recruiting', mx + 56, 128);
  ctx.fillStyle = '#86868b';
  ctx.font = `14px ${SYS}`;
  ctx.fillText('To: Jongwoo Lim', mx + 56, 148);
  ctx.fillStyle = '#e4e4e8';
  ctx.fillRect(mx, 172, W - mx - 30, 1);
  ctx.fillStyle = '#2c2c2e';
  ctx.font = `17px ${SYS}`;
  MAIL_BODY.forEach((line, i) => ctx.fillText(line, mx, 210 + i * 28));
  ctx.restore();
}
