/**
 * Chapter 3's screens, drawn to canvases (MismScene.tsx): the case on the
 * left-hand screen (a breach in four steps), the discussion's question on the
 * right-hand one, which turns into the controls that would have stopped each
 * step; and his notes on his laptop, typed by the scroll. A made-up case in
 * our own style (no real company, no logos).
 */

const FONT = "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Helvetica Neue', Arial";
const MONO = "Menlo, Consolas, 'Courier New', monospace";
const NAVY = '#1f2d4d',
  INK = '#1f2433',
  PAPER = '#f7f5f0',
  RUST = '#b5642f',
  MUTED = '#7a8091',
  RED = '#c2453a',
  GREEN = '#2f8f5b';

/** The case's four steps: what happened, and the control that was missing. */
export const STEPS = [
  { day: 'Day 1', what: 'A phishing email', how: 'a fake payroll update', fix: 'Mail filtering, training' },
  { day: 'Day 1', what: 'A VPN password, stolen', how: 'no second factor', fix: 'MFA on remote access' },
  { day: 'Days 2–19', what: 'Across a flat network', how: 'file server to database', fix: 'Segmentation, least privilege' },
  { day: 'Day 20', what: '40 GB copied out', how: 'no one alerted', fix: 'Egress monitoring' },
];

function header(ctx: CanvasRenderingContext2D, w: number, right: string) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, 9999);
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, 92);
  ctx.fillStyle = PAPER;
  ctx.font = `600 38px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('Information Security · Case Discussion', 56, 46);
  ctx.textAlign = 'right';
  ctx.fillText(right, w - 56, 46);
  ctx.textAlign = 'left';
}

/** The left screen: the breach, step by step, on a timeline. */
export function drawCase(ctx: CanvasRenderingContext2D, w: number, h: number) {
  header(ctx, w, 'Fall 2024');
  ctx.fillStyle = RUST;
  ctx.font = `700 32px ${FONT}`;
  ctx.fillText('CASE 7', 70, 170);
  ctx.fillStyle = INK;
  ctx.font = `800 76px ${FONT}`;
  ctx.fillText('One password, four steps.', 66, 248);
  ctx.fillStyle = MUTED;
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText('A regional retailer · 2.1 million customer records', 70, 312);
  // The timeline: four cards joined by arrows.
  const top = 390,
    gap = 34,
    cw = (w - 140 - gap * 3) / 4,
    ch = 330;
  STEPS.forEach((s, i) => {
    const x = 70 + i * (cw + gap);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#d9d4c8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, top, cw, ch, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(x + 46, top + 52, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 28px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), x + 46, top + 53);
    ctx.textAlign = 'left';
    ctx.fillStyle = MUTED;
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(s.day, x + 84, top + 53);
    ctx.fillStyle = INK;
    ctx.font = `800 36px ${FONT}`;
    wrap(ctx, s.what, x + 26, top + 130, cw - 52, 44);
    ctx.fillStyle = MUTED;
    ctx.font = `500 28px ${FONT}`;
    wrap(ctx, s.how, x + 26, top + 250, cw - 52, 36);
    if (i < 3) {
      ctx.fillStyle = '#c9c3b6';
      const ax = x + cw + 6,
        ay = top + ch / 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay - 12);
      ctx.lineTo(ax + gap - 12, ay);
      ctx.lineTo(ax, ay + 12);
      ctx.fill();
    }
  });
  ctx.fillStyle = INK;
  ctx.font = `700 36px ${FONT}`;
  ctx.fillText('Found on day 61, by a customer.', 70, h - 90);
  ctx.fillStyle = '#9aa0ab';
  ctx.font = `600 26px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('7 / 18', w - 56, h - 40);
  ctx.textAlign = 'left';
}

/** The right screen: the question (q, 0..1 as it comes up); then, as the
 *  class answers (a, 0..1), each step's control, one by one, and last step
 *  2's boxed with the line that it's the cheapest place to break the chain.
 *  (Step 2 had gone up first, his, his name by it, as he raised his hand:
 *  cut 2026-11-19.) */
export function drawQuestion(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  q: number,
  a: number
) {
  header(ctx, w, 'Discussion');
  ctx.globalAlpha = q;
  ctx.fillStyle = RUST;
  ctx.font = `700 32px ${FONT}`;
  ctx.fillText('THE QUESTION', 70, 170);
  ctx.fillStyle = INK;
  ctx.font = `800 66px ${FONT}`;
  wrap(ctx, 'Which control would have stopped it — and where?', 66, 250, w - 140, 78);
  ctx.globalAlpha = 1;
  // The controls, one per step, in order; then the conclusion.
  const top = 450,
    rh = 104,
    slot = (i: number) => Math.min(1, Math.max(0, a * 5 - i));
  STEPS.forEach((s, i) => {
    const t = slot(i),
      y = top + i * rh;
    ctx.globalAlpha = q * (0.35 + 0.65 * t);
    ctx.fillStyle = t > 0.5 ? GREEN : '#c9c3b6';
    ctx.beginPath();
    ctx.arc(96, y + 36, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 28px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(t > 0.5 ? '✓' : String(i + 1), 96, y + 37);
    ctx.textAlign = 'left';
    ctx.fillStyle = MUTED;
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText(s.what, 142, y + 18);
    ctx.globalAlpha = q * t;
    ctx.fillStyle = INK;
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(s.fix, 142, y + 62);
  });
  // Once all are up: step 2 boxed, and why.
  ctx.globalAlpha = q * slot(4);
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(60, top + rh - 6, w - 120, rh - 4, 18);
  ctx.stroke();
  ctx.fillStyle = GREEN;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText('Cheapest fix that breaks the chain: MFA at step 2.', 70, h - 70);
  ctx.globalAlpha = 1;
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number
) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const t = line ? `${line} ${word}` : word;
    if (ctx.measureText(t).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineH;
    } else line = t;
  }
  if (line) ctx.fillText(line, x, y);
}

/** His notes on the case, in a dark editor. */
export const NOTES = `# Case 7: where it could have been stopped

1  phishing email        -> mail filtering, training
2  VPN password only     -> MFA on remote access
3  flat network          -> segmentation, least privilege
4  40 GB out, no alert   -> egress monitoring

risk = likelihood x impact
step 2 is the choke point: MFA is cheap,
and it breaks the chain before anything moves.`;
export const NOTES_LENGTH = NOTES.length;
/** He types them at the hall's pace (characters a second), then reads them
 *  over for a few seconds before starting again (RoomScene). */
export const NOTES_CPS = 14,
  NOTES_HOLD = 4;

export function drawNotes(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  typed: number,
  caret: boolean
) {
  ctx.fillStyle = '#0b0b0c';
  ctx.fillRect(0, 0, w, h);
  const b = 14,
    x0 = b,
    y0 = b,
    sw = w - 2 * b;
  ctx.fillStyle = '#1e222a';
  ctx.fillRect(x0, y0, sw, h - 2 * b);
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
  ctx.fillText('case-07.md — infosec', x0 + sw / 2, y0 + 20);
  ctx.textAlign = 'left';
  const shown = NOTES.slice(0, Math.floor(typed)).split('\n'),
    lineH = 38,
    top = y0 + 70;
  ctx.font = `21px ${MONO}`;
  shown.forEach((line, i) => {
    const y = top + i * lineH;
    ctx.fillStyle = '#495162';
    ctx.textAlign = 'right';
    ctx.fillText(String(i + 1), x0 + 40, y);
    ctx.textAlign = 'left';
    const head = line.startsWith('#'),
      arrow = line.indexOf('->');
    if (head) {
      ctx.fillStyle = '#e5c07b';
      ctx.fillText(line, x0 + 56, y);
    } else if (arrow > 0) {
      ctx.fillStyle = '#abb2bf';
      const left = line.slice(0, arrow);
      ctx.fillText(left, x0 + 56, y);
      const lx = x0 + 56 + ctx.measureText(left).width;
      ctx.fillStyle = '#56b6c2';
      ctx.fillText('->', lx, y);
      ctx.fillStyle = line.includes('MFA') ? '#98c379' : '#c8ccd4';
      ctx.fillText(line.slice(arrow + 2), lx + ctx.measureText('->').width, y);
    } else {
      ctx.fillStyle = line.startsWith('risk') ? '#c678dd' : '#abb2bf';
      ctx.fillText(line, x0 + 56, y);
    }
    if (i === shown.length - 1 && caret) {
      ctx.fillStyle = '#528bff';
      ctx.fillRect(x0 + 58 + ctx.measureText(line).width, y - 13, 3, 26);
    }
  });
}
