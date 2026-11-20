/**
 * Chapter 2's table, drawn live (InterviewDesk.tsx): one engineer's laptop,
 * its screen showing the candidate's profile with interview notes typed
 * into it as the interview goes on, and the other engineer's notebook,
 * open on a page of handwritten notes, a pen on it. Also the handwriting
 * (Kalam, OFL), shared with the whiteboard.
 */
import { HAND } from './officeBoard';

let fontsLoading: Promise<unknown> | null = null;
/** Kalam (OFL), the board's and the notebook's handwriting, loaded once. */
export function loadKalam() {
  fontsLoading ??= Promise.all(
    [
      ['400', '/fonts/kalam/Kalam-Regular.woff2'],
      ['700', '/fonts/kalam/Kalam-Bold.woff2'],
    ].map(([weight, url]) => {
      const f = new FontFace('Kalam', `url(${url})`, { weight });
      document.fonts.add(f);
      return f.load();
    })
  ).catch(() => undefined);
  return fontsLoading;
}

const SANS =
  "-apple-system, 'SF Pro Text', 'Helvetica Neue', 'Segoe UI', Arial, sans-serif";

/** The laptop's screen texture (its glass, the bezel drawn in). */
export const SCREEN_W = 1024,
  SCREEN_H = 690;

/**
 * The engineer's notes on him, typed in as the interview goes on (each line
 * over its part of the chapter, 0..1): the problem as he hears it, then as
 * he asks about it, talks it through, writes it, and finishes.
 */
const NOTES: { text: string; from: number; to: number }[] = [
  { text: 'Problem: min queen moves, 8x8 board', from: 0.03, to: 0.11 },
  { text: '• Clarified the rules before coding', from: 0.16, to: 0.3 },
  { text: '• Talked it through: 0, 1 or 2 moves', from: 0.4, to: 0.5 },
  { text: '• Clean pseudo-code, O(1)', from: 0.66, to: 0.82 },
  { text: '→ Strong hire', from: 0.87, to: 0.92 },
];
export const NOTES_CHARS = NOTES.reduce((n, l) => n + l.text.length, 0);

/** How many characters of the notes are typed at this point (0..1). */
export function notesTyped(o: number) {
  let n = 0;
  for (const l of NOTES) {
    const k = Math.min(1, Math.max(0, (o - l.from) / (l.to - l.from)));
    n += Math.round(k * l.text.length);
    if (k < 1) break;
  }
  return n;
}

function pill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string
) {
  ctx.font = `600 17px ${SANS}`;
  const w = ctx.measureText(label).width + 26;
  ctx.fillStyle = '#e7effc';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 32, 16);
  ctx.fill();
  ctx.fillStyle = '#2f5fb8';
  ctx.fillText(label, x + 13, y + 22);
  return w;
}

/**
 * The screen: an interview app's candidate page (his photo, name, school,
 * last role, skills, as of 2022), and below, the notes, typed so far, with
 * the caret.
 */
export function drawProfile(
  ctx: CanvasRenderingContext2D,
  typed: number,
  caret: boolean,
  avatar: HTMLImageElement | null
) {
  const w = SCREEN_W,
    h = SCREEN_H,
    b = 16; // the bezel
  ctx.fillStyle = '#0e0f11';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f5f6f8';
  ctx.fillRect(b, b, w - 2 * b, h - 2 * b);
  // The window's title bar.
  ctx.fillStyle = '#e9ebef';
  ctx.fillRect(b, b, w - 2 * b, 46);
  ['#f0605a', '#f5bd4f', '#5fc455'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(b + 24 + i * 22, b + 23, 7, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#6b7280';
  ctx.font = `500 18px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('Onsite interview · Candidate', w / 2, b + 29);
  ctx.textAlign = 'left';

  // The profile card.
  const cx = b + 22,
    cy = b + 66,
    cw = w - 2 * b - 44,
    ch = 236;
  ctx.fillStyle = 'rgba(20,30,50,0.06)';
  ctx.beginPath();
  ctx.roundRect(cx, cy + 3, cw, ch, 14);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(cx, cy, cw, ch, 14);
  ctx.fill();
  // His photo, round.
  const ax = cx + 100,
    ay = cy + ch / 2,
    ar = 82;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, ax - ar, ay - ar, ar * 2, ar * 2);
  else {
    ctx.fillStyle = '#c9d6e8';
    ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
  }
  ctx.restore();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.stroke();
  // Name, role, school, last role, skills.
  const tx = ax + ar + 34;
  ctx.fillStyle = '#18202e';
  ctx.font = `700 42px ${SANS}`;
  ctx.fillText('Jongwoo Lim', tx, cy + 62);
  ctx.fillStyle = '#4b5565';
  ctx.font = `500 22px ${SANS}`;
  ctx.fillText('Software Engineer · Full-stack', tx, cy + 96);
  ctx.fillStyle = '#6b7280';
  ctx.font = `400 19px ${SANS}`;
  ctx.fillText(
    'Brigham Young University · B.S. Computer Science',
    tx,
    cy + 130
  );
  ctx.fillText('Prev. BYU Broadcasting · Stream Saver (AWS)', tx, cy + 158);
  let px = tx;
  for (const s of ['React', 'TypeScript', 'Python', 'AWS', 'Node'])
    px += pill(ctx, px, cy + 178, s) + 10;

  // The notes.
  const nx = cx,
    ny = cy + ch + 22,
    nh = h - b - 18 - ny;
  ctx.fillStyle = '#18202e';
  ctx.font = `700 22px ${SANS}`;
  ctx.fillText('Interview notes', nx + 2, ny + 4);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#d9dde4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(nx, ny + 18, cw, nh - 18, 10);
  ctx.fill();
  ctx.stroke();
  ctx.font = `400 23px ${SANS}`;
  ctx.fillStyle = '#263043';
  let left = typed,
    y = ny + 56,
    endX = nx + 20,
    endY = y;
  for (const l of NOTES) {
    if (left <= 0) break;
    const part = l.text.slice(0, left);
    left -= l.text.length;
    ctx.fillStyle = l.text.startsWith('→') ? '#1f8a4c' : '#263043';
    if (l.text.startsWith('→')) ctx.font = `700 23px ${SANS}`;
    ctx.fillText(part, nx + 20, y);
    endX = nx + 20 + ctx.measureText(part).width;
    endY = y;
    y += 36;
  }
  if (caret) {
    ctx.fillStyle = '#2f5fb8';
    ctx.fillRect(endX + 3, endY - 20, 2.5, 26);
  }
}

/** The notebook's open spread (two pages side by side). */
export const SPREAD_W = 1024,
  SPREAD_H = 720;

/** When (0..1 through the chapter) each of the right page's notes is
 *  there: as he asks, explains, handles the edge case, finishes. */
const JOTS = [0.3, 0.5, 0.76, 0.87, 0.92];
/** How many of the notebook's notes are written at this point. */
export function notebookStage(o: number) {
  return JOTS.filter((t) => o >= t).length;
}

/**
 * The other engineer's notebook, open: ruled pages with a margin, his notes
 * in a blue-black hand (the problem and a little sketch of the board on the
 * left; on the right, what he makes of the candidate, a note at a time:
 * stage 0..5), the spine's shadow down the middle.
 */
export function drawNotebook(ctx: CanvasRenderingContext2D, stage: number) {
  const w = SPREAD_W,
    h = SPREAD_H,
    page = w / 2;
  ctx.fillStyle = '#fbf9f3';
  ctx.fillRect(0, 0, w, h);
  // Rules and margins.
  ctx.strokeStyle = '#c9d6e8';
  ctx.lineWidth = 2;
  for (let y = 92; y < h - 30; y += 44) {
    ctx.beginPath();
    ctx.moveTo(18, y);
    ctx.lineTo(w - 18, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#efb4b4';
  for (const x of [70, page + 70]) {
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x, h - 20);
    ctx.stroke();
  }
  // The spine's shadow.
  const g = ctx.createLinearGradient(page - 40, 0, page + 40, 0);
  g.addColorStop(0, 'rgba(60,50,30,0)');
  g.addColorStop(0.5, 'rgba(60,50,30,0.22)');
  g.addColorStop(1, 'rgba(60,50,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(page - 40, 0, 80, h);

  const ink = '#24315e',
    write = (t: string, x: number, y: number, size = 34, bold = false) => {
      ctx.font = `${bold ? 700 : 400} ${size}px ${HAND}`;
      ctx.fillStyle = ink;
      ctx.fillText(t, x, y);
      return ctx.measureText(t).width;
    },
    line = (x0: number, y0: number, x1: number, y1: number, lw = 3) => {
      ctx.strokeStyle = ink;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    };
  // Left page: who and what, and a sketch of the board.
  const tw = write('Onsite: Jongwoo L.', 86, 80, 38, true);
  line(86, 90, 86 + tw, 88);
  write('Q: min queen moves', 86, 168);
  const sx = 110,
    sy = 220,
    cell = 34;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.2;
  for (let i = 0; i <= 6; i++) {
    line(sx, sy + i * cell, sx + 6 * cell, sy + i * cell, 2.2);
    line(sx + i * cell, sy, sx + i * cell, sy + 6 * cell, 2.2);
  }
  write('Q', sx + cell * 1 + 8, sy + cell * 5 + 27, 28, true);
  write('★', sx + cell * 4 + 6, sy + cell * 1 + 27, 26);
  ctx.setLineDash([7, 7]);
  line(sx + cell * 1.5, sy + cell * 4.5, sx + cell * 4.5, sy + cell * 1.5, 2.6);
  ctx.setLineDash([]);
  write('0 / 1 / 2 ?', 120, 512);
  write('edge: Q = T', 120, 600, 30);
  // Right page: what he makes of him, as it goes.
  if (stage > 0) write('✓ asks before coding', page + 86, 124);
  if (stage > 1) write('✓ explains as he goes', page + 86, 212);
  if (stage > 2) write('✓ handles edge cases', page + 86, 300);
  if (stage > 3) {
    const o = write('O(1)', page + 120, 420, 40, true);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(page + 120 + o / 2, 408, o / 2 + 22, 34, -0.06, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (stage > 4) {
    const hw = write('→ hire', page + 100, 560, 44, true);
    line(page + 150, 574, page + 100 + hw, 571);
    line(page + 152, 584, page + 100 + hw - 4, 582);
  }
}
