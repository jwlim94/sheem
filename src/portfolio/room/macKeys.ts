/**
 * A MacBook's deck (2026-11-22, the user's call: the laptops' bases were
 * plain silver): its keyboard (US layout, black keys in the silver deck,
 * full-height function keys, the inverted-T arrows), the keys' legends,
 * and the trackpad below. In the laptop's base's frame (BridgeDesk's
 * LaptopOnStand): x across, v toward its front edge (its user) from the
 * base's middle, chapter 4's units (the hero's 1.38x scale; a real key
 * pitch of about 19 mm). Mirrored by art/portfolio-bridge/build_bridge.py
 * (the developer's laptop).
 */

/** A row's keys: its width in key pitches and its legend; `low`, the lower
 *  half of the row (the left and right arrows); `pair`, the up arrow over
 *  the down. */
type Key = [width: number, legend: string, shape?: 'low' | 'pair'];

const letters = (s: string): Key[] => [...s].map((c) => [1, c]);
const shifted = (pairs: string[]): Key[] => pairs.map((p) => [1, p]);

/** Back (the function row) to front; 14.5 pitches each. */
const ROWS: Key[][] = [
  [
    [1.5, 'esc'],
    ...Array.from({ length: 12 }, (_, i): Key => [1, `F${i + 1}`]),
    [1, ''], // Touch ID
  ],
  [
    ...shifted(['~ `', '! 1', '@ 2', '# 3', '$ 4', '% 5', '^ 6', '& 7']),
    ...shifted(['* 8', '( 9', ') 0', '_ -', '+ =']),
    [1.5, 'delete'],
  ],
  [[1.5, 'tab'], ...letters('QWERTYUIOP'), ...shifted(['{ [', '} ]', '| \\'])],
  [
    [1.75, 'caps lock'],
    ...letters('ASDFGHJKL'),
    ...shifted([': ;', '" \'']),
    [1.75, 'return'],
  ],
  [
    [2.25, 'shift'],
    ...letters('ZXCVBNM'),
    ...shifted(['< ,', '> .', '? /']),
    [2.25, 'shift'],
  ],
  [
    [1, 'fn'],
    [1, 'control'],
    [1, 'option'],
    [1.25, 'command'],
    [5, ''],
    [1.25, 'command'],
    [1, 'option'],
    [1, '◀', 'low'],
    [1, '▲▼', 'pair'],
    [1, '▶', 'low'],
  ],
];

/** The key pitch, the gap between caps, the keyboard's width and depth,
 *  where its back edge is (v), the deck's top over the base's middle. */
export const PITCH = 0.0258,
  GAP = 0.0036,
  KB_W = 14.5 * PITCH,
  KB_D = ROWS.length * PITCH,
  KB_V0 = -0.128,
  DECK_Y = 0.008;
/** The trackpad: its size and its middle (v). */
export const PAD = { w: 0.176, d: 0.104, v: 0.088 };

/** Each key's cap: its middle (x, v), size, and legend. */
export type Cap = {
  x: number;
  v: number;
  w: number;
  d: number;
  legend: string;
};

export const CAPS: Cap[] = ROWS.flatMap((row, r) => {
  let u = 0;
  const out: Cap[] = [];
  for (const [wide, legend, shape] of row) {
    const x = -KB_W / 2 + (u + wide / 2) * PITCH,
      w = wide * PITCH - GAP,
      v = KB_V0 + (r + 0.5) * PITCH;
    if (shape === 'low' || shape === 'pair') {
      // Half-height: the arrows.
      const half = (PITCH - GAP) / 2 - GAP / 4;
      const low = v + PITCH / 4 - GAP / 8;
      out.push({
        x,
        v: low,
        w,
        d: half,
        legend: shape === 'pair' ? '▼' : legend,
      });
      if (shape === 'pair')
        out.push({ x, v: v - PITCH / 4 + GAP / 8, w, d: half, legend: '▲' });
    } else out.push({ x, v, w, d: PITCH - GAP, legend });
    u += wide;
  }
  return out;
});

/** The legends' canvas: the keyboard's area, KB_W x KB_D. */
export const LEGENDS = { cw: 1024, ch: Math.round((1024 * KB_D) / KB_W) };

/** The keys' legends, white-grey on clear (laid over the caps): letters and
 *  digits in the middle, the shifted ones over them, the named keys small
 *  in their lower corner, the modifiers' symbols over their names. */
export function drawMacLegends(ctx: CanvasRenderingContext2D) {
  const { cw, ch } = LEGENDS,
    s = cw / KB_W; // canvas pixels a unit
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = 'rgba(236, 238, 240, 0.92)';
  ctx.textBaseline = 'middle';
  const font = (px: number) =>
    `${Math.round(px)}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  const SYMBOL: Record<string, string> = {
    control: '⌃',
    option: '⌥',
    command: '⌘',
  };
  for (const c of CAPS) {
    if (!c.legend) continue;
    const cx = (c.x + KB_W / 2) * s,
      cy = (c.v - KB_V0) * s,
      w = c.w * s,
      d = c.d * s,
      left = cx - w / 2 + d * 0.14,
      right = cx + w / 2 - d * 0.14,
      bottom = cy + d * 0.3;
    if (c.legend.length === 1) {
      // A letter, or an arrow.
      ctx.textAlign = 'center';
      ctx.font = font(d * (c.d < PITCH * 0.6 ? 0.55 : 0.36));
      ctx.fillText(c.legend, cx, cy);
    } else if (c.legend.length === 3 && c.legend[1] === ' ') {
      // A digit or a mark, its shifted one over it.
      ctx.textAlign = 'center';
      ctx.font = font(d * 0.27);
      ctx.fillText(c.legend[0], cx, cy - d * 0.18);
      ctx.fillText(c.legend[2], cx, cy + d * 0.18);
    } else if (/^F\d+$/.test(c.legend)) {
      ctx.textAlign = 'center';
      ctx.font = font(d * 0.2);
      ctx.fillText(c.legend, cx, bottom);
    } else {
      // A named key: on the left of the keyboard in its lower left, on
      // the right in its lower right; a modifier's symbol over it.
      const onLeft = c.x < 0;
      ctx.textAlign = onLeft ? 'left' : 'right';
      ctx.font = font(d * 0.19);
      ctx.fillText(c.legend, onLeft ? left : right, bottom);
      const sym = SYMBOL[c.legend];
      if (sym) {
        ctx.textAlign = onLeft ? 'right' : 'left';
        ctx.font = font(d * 0.24);
        ctx.fillText(sym, onLeft ? right : left, cy - d * 0.2);
      }
      if (c.legend === 'fn') {
        // The globe under fn.
        ctx.lineWidth = Math.max(1, d * 0.03);
        ctx.strokeStyle = 'rgba(236, 238, 240, 0.92)';
        ctx.beginPath();
        ctx.arc(cx + d * 0.18, cy - d * 0.12, d * 0.11, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}
