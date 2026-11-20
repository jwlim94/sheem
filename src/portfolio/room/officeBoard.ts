/**
 * The whiteboard in Neighbor's meeting room (chapter 2), drawn to a canvas: the
 * interview problem as he remembers it (a queen and a target square on a
 * chessboard: in how few moves can the queen get there?) on the left half,
 * and his high-level pseudo-code on the right, written out in blue marker as
 * the scroll goes on. Hand-drawn: wobbly marker lines, hatched dark squares,
 * Kalam (OFL, public/fonts/kalam), faint ghosts of old, erased writing.
 *
 * Coordinates are canvas pixels (BOARD_W x BOARD_H over the board's 3.2 x
 * 1.6 m, x from the left end as you face it).
 */
export const BOARD_W = 2048;
export const BOARD_H = 1024;
export const HAND = "Kalam, 'Bradley Hand', 'Marker Felt', cursive";

const INK = {
  black: '#25282e',
  blue: '#1d4fb0',
  red: '#c8322c',
  grey: '#8d939b',
};

/** The pseudo-code, line by line (indent in spaces). */
export const CODE = [
  'minQueenMoves(Q, T):',
  '  if Q == T: return 0',
  '  dr = |Q.row - T.row|',
  '  dc = |Q.col - T.col|',
  '  if dr == 0 or dc == 0:',
  '    return 1     // same row / col',
  '  if dr == dc: return 1   // diagonal',
  '  return 2   // two lines always cross',
];
// Below the board's top, where his marker first meets the board as he
// raises his hand (2026-10-13: from the very top his arm went straight up;
// then from his shoulders, his hand slid down to it before he wrote).
const CODE_X = 1100,
  CODE_Y = 360,
  CODE_LH = 62,
  CODE_SIZE = 40;
export const CODE_CHARS = CODE.reduce((n, l) => n + l.trimStart().length, 0);

// The chessboard: 8 x 8 cells of CELL px from (BX, BY) at the top left.
const BX = 250,
  BY = 250,
  CELL = 68;
// The queen on c2, the target on f7; the path c2 → f5 (diagonal) → f7.
const Q = { file: 2, rank: 2 },
  TGT = { file: 5, rank: 7 },
  MID = { file: 5, rank: 5 };
const cell = (file: number, rank: number) => ({
  x: BX + (file + 0.5) * CELL,
  y: BY + (8 - rank + 0.5) * CELL,
});

/** Deterministic pseudo-random in [0, 1). */
function rand(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** A marker stroke from a to b, a little wobbly. */
function stroke(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  seed: number,
  width = 5,
  t = 1
) {
  const x = x0 + (x1 - x0) * t,
    y = y0 + (y1 - y0) * t,
    mx = (x0 + x) / 2 + (rand(seed) - 0.5) * 4,
    my = (y0 + y) / 2 + (rand(seed + 1) - 0.5) * 4;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0 + (rand(seed + 2) - 0.5) * 2, y0 + (rand(seed + 3) - 0.5) * 2);
  ctx.quadraticCurveTo(mx, my, x, y);
  ctx.stroke();
}

/** An arrow from a to b drawn up to t (0..1), its head once it arrives. */
function arrow(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
  seed: number
) {
  if (t <= 0) return;
  stroke(ctx, a.x, a.y, b.x, b.y, seed, 6, Math.min(1, t));
  if (t < 0.98) return;
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  for (const s of [-1, 1])
    stroke(
      ctx,
      b.x,
      b.y,
      b.x - 26 * Math.cos(ang + s * 0.45),
      b.y - 26 * Math.sin(ang + s * 0.45),
      seed + s * 7,
      6
    );
}

function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  colour: string,
  bold = false
) {
  ctx.font = `${bold ? 700 : 400} ${size}px ${HAND}`;
  ctx.fillStyle = colour;
  ctx.fillText(s, x, y);
}

/** The queen: a crown in a circle. */
function queen(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = ctx.fillStyle = INK.blue;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, 25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 14, y + 10);
  ctx.lineTo(x - 15, y - 8);
  ctx.lineTo(x - 7, y + 1);
  ctx.lineTo(x, y - 12);
  ctx.lineTo(x + 7, y + 1);
  ctx.lineTo(x + 15, y - 8);
  ctx.lineTo(x + 14, y + 10);
  ctx.closePath();
  ctx.stroke();
}

/** The target: a star. */
function star(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = INK.red;
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    const px = x + 24 * Math.cos(a),
      py = y + 24 * Math.sin(a);
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
}

export interface BoardState {
  /** The queen's lines and the path, drawn as he thinks (0..1). */
  reach: number;
  /** The pseudo-code written so far (0..1). */
  write: number;
}

/**
 * Draws the board; returns where the marker is (canvas px) while writing,
 * or null.
 */
export function drawBoard(
  ctx: CanvasRenderingContext2D,
  { reach, write }: BoardState
): { x: number; y: number } | null {
  const w = BOARD_W,
    h = BOARD_H;
  // The white surface, a touch brighter toward the top (the ceiling lights),
  // with faint ghosts of old writing wiped off.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#fbfcfc');
  g.addColorStop(1, '#f1f3f4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = INK.grey;
  ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const x = 1100 + rand(i) * 860,
      y = 120 + rand(i + 40) * 820;
    stroke(
      ctx,
      x,
      y,
      x + 60 + rand(i + 9) * 160,
      y + (rand(i + 3) - 0.5) * 40,
      i * 11,
      9
    );
  }
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = INK.grey;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(
      1300 + rand(i + 70) * 600,
      200 + rand(i + 80) * 600,
      120,
      26,
      rand(i) - 0.5,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  // The problem, as the interviewers put it.
  text(ctx, 'Min queen moves', 90, 120, 64, INK.black, true);
  ctx.strokeStyle = INK.black;
  stroke(ctx, 92, 138, 520, 134, 3, 5);
  text(
    ctx,
    '8×8 board · queen Q · target ★ → fewest moves?',
    92,
    196,
    36,
    INK.black
  );

  // The chessboard: hatched dark squares, wobbly grid, labels.
  ctx.strokeStyle = INK.black;
  ctx.globalAlpha = 0.35;
  for (let f = 0; f < 8; f++)
    for (let r = 0; r < 8; r++) {
      if ((f + r) % 2 === 0) continue;
      const x = BX + f * CELL,
        y = BY + r * CELL;
      for (let k = 1; k < 5; k++) {
        const o = (k / 5) * CELL;
        stroke(ctx, x + o, y + 4, x + 4, y + o, f * 31 + r * 7 + k, 2.5);
        stroke(
          ctx,
          x + CELL - 4,
          y + o,
          x + o,
          y + CELL - 4,
          f * 17 + r * 3 + k,
          2.5
        );
      }
    }
  ctx.globalAlpha = 1;
  for (let i = 0; i <= 8; i++) {
    stroke(
      ctx,
      BX + i * CELL,
      BY,
      BX + i * CELL,
      BY + 8 * CELL,
      100 + i,
      i % 8 ? 4 : 6
    );
    stroke(
      ctx,
      BX,
      BY + i * CELL,
      BX + 8 * CELL,
      BY + i * CELL,
      200 + i,
      i % 8 ? 4 : 6
    );
  }
  ctx.textAlign = 'center';
  'abcdefgh'
    .split('')
    .forEach((c, i) =>
      text(ctx, c, BX + (i + 0.5) * CELL, BY + 8 * CELL + 46, 34, INK.black)
    );
  for (let r = 1; r <= 8; r++)
    text(ctx, String(r), BX - 30, BY + (8 - r + 0.62) * CELL, 34, INK.black);
  ctx.textAlign = 'left';
  const q = cell(Q.file, Q.rank),
    t = cell(TGT.file, TGT.rank),
    m = cell(MID.file, MID.rank);
  queen(ctx, q.x, q.y);
  star(ctx, t.x, t.y);

  // Thinking: the queen's eight lines, dashed, then the path in red.
  if (reach > 0) {
    const rays = Math.min(1, reach / 0.55);
    ctx.save();
    ctx.strokeStyle = INK.blue;
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([14, 14]);
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    dirs.forEach(([df, dr], i) => {
      let n = 0;
      while (
        Q.file + df * (n + 1) >= 0 &&
        Q.file + df * (n + 1) < 8 &&
        Q.rank + dr * (n + 1) >= 1 &&
        Q.rank + dr * (n + 1) <= 8
      )
        n++;
      if (!n) return;
      const end = cell(Q.file + df * n, Q.rank + dr * n),
        k = Math.min(1, Math.max(0, rays * 8 - i * 0.6));
      if (k > 0)
        stroke(ctx, q.x + df * 28, q.y - dr * 28, end.x, end.y, 300 + i, 4, k);
    });
    ctx.restore();
    ctx.strokeStyle = INK.red;
    arrow(
      ctx,
      { x: q.x + 18, y: q.y - 18 },
      { x: m.x - 4, y: m.y + 4 },
      (reach - 0.55) / 0.2,
      400
    );
    arrow(
      ctx,
      { x: m.x, y: m.y - 8 },
      { x: t.x, y: t.y + 28 },
      (reach - 0.75) / 0.15,
      420
    );
    if (reach > 0.92) {
      ctx.globalAlpha = Math.min(1, (reach - 0.92) / 0.06);
      text(ctx, '1', m.x - 58, (q.y + m.y) / 2 + 10, 38, INK.red, true);
      text(ctx, '2', m.x + 18, (m.y + t.y) / 2 + 12, 38, INK.red, true);
      text(ctx, '= 2 moves', BX + 8 * CELL + 30, m.y + 12, 44, INK.red, true);
      ctx.globalAlpha = 1;
    }
  }

  // The pseudo-code, character by character (the one being written only in
  // part), then a circled O(1).
  let left = write * (CODE_CHARS + 6),
    tip: { x: number; y: number } | null = null;
  ctx.font = `400 ${CODE_SIZE}px ${HAND}`;
  for (let i = 0; i < CODE.length && left > 0; i++) {
    const line = CODE[i],
      indent = line.length - line.trimStart().length,
      body = line.trimStart(),
      y = CODE_Y + i * CODE_LH;
    let x = CODE_X + indent * 22;
    for (let c = 0; c < body.length && left > 0; c++) {
      const ch = body[c],
        cw = ctx.measureText(ch).width,
        part = Math.min(1, left),
        comment = body.indexOf('//') >= 0 && c >= body.indexOf('//');
      ctx.fillStyle = comment ? INK.grey : INK.blue;
      if (part < 1) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - 2, y - CODE_SIZE, cw * part + 2, CODE_SIZE * 1.4);
        ctx.clip();
        ctx.fillText(ch, x, y);
        ctx.restore();
      } else ctx.fillText(ch, x, y);
      if (part < 1 || (left <= 1.0001 && ch !== ' '))
        tip = {
          x: x + cw * part,
          y: y - CODE_SIZE * 0.32 + Math.sin((x + c) * 0.9) * 6,
        };
      x += cw;
      left -= 1;
    }
  }
  if (left > 0) {
    const k = Math.min(1, left / 6),
      cx = 1820,
      cy = CODE_Y + CODE.length * CODE_LH + 10;
    text(ctx, 'O(1)', cx - 50, cy + 16, 50, INK.red, true);
    ctx.strokeStyle = INK.red;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      92,
      46,
      -0.08,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * k
    );
    ctx.stroke();
    if (k < 1) {
      const a = -Math.PI / 2 + Math.PI * 2 * k;
      tip = { x: cx + 92 * Math.cos(a), y: cy + 46 * Math.sin(a) };
    }
  }
  return write > 0 && write < 1 ? tip : null;
}
