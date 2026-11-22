import { arrow, INK, rand, stroke, text } from './officeBoard';

/**
 * The whiteboard on Bridge's east wall (chapter 4), drawn to a canvas once
 * (2026-11-22, the user's call: what Bridge does, so the board says it,
 * business valuation, exit and the marketplace; bridge.financial). In
 * marker (officeBoard.ts's hand, Kalam, bold for the distance), faint
 * ghosts of old writing:
 * - Bridge, bridge.financial, and what it is for, in its own words:
 *   small business owners valuing, scaling and exiting with confidence
 *   (its site, 2026-11-22); Value → Scale → Exit, and Buy, the
 *   marketplace;
 * - down the left, the valuation pipeline he built (his résumé): tax
 *   returns and P&Ls through AI extraction to structured financials, the
 *   value (SDE × a multiple), the PDF report;
 * - on the right, the marketplace: a map with pins and a cluster, listing
 *   cards, 9,500+ listings across 1,400+ industries (his résumé), the
 *   natural-language search;
 * - "sell without regret" (its site's), circled.
 *
 * The board is 2.66 x 1.55 (bridge.ts BOARD); canvas pixels, x from its
 * left end as you face it (its north end).
 */
export const BRIDGE_BOARD = { cw: 2048, ch: 1193 };

export function drawBridgeBoard(ctx: CanvasRenderingContext2D) {
  const { cw: w, ch: h } = BRIDGE_BOARD;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#fcfdfd');
  g.addColorStop(1, '#eff1f2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Ghosts of what was wiped off.
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = INK.grey;
  for (let i = 0; i < 16; i++) {
    const x = 120 + rand(i + 7) * 1700,
      y = 90 + rand(i + 41) * 980;
    stroke(
      ctx,
      x,
      y,
      x + 90 + rand(i + 3) * 240,
      y + (rand(i) - 0.5) * 26,
      i * 11,
      10
    );
  }
  ctx.restore();

  const W = 10; // the marker's width
  // Bridge, its site, and what it is for.
  text(ctx, 'Bridge', 80, 165, 140, INK.black, true);
  ctx.strokeStyle = INK.red;
  stroke(ctx, 76, 196, 480, 190, 5, W);
  text(ctx, 'bridge.financial', 520, 150, 72, INK.blue, true);
  text(ctx, 'small business owners:', 84, 268, 58, INK.black, true);
  text(
    ctx,
    'value, scale & exit with confidence',
    84,
    338,
    58,
    INK.black,
    true
  );

  // Value → Scale → Exit, and buyers: the marketplace.
  const box = (
    x: number,
    y: number,
    bw: number,
    label: string,
    ink: string
  ) => {
    ctx.strokeStyle = ink;
    ctx.lineWidth = W;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, 104, 22);
    ctx.stroke();
    text(ctx, label, x + 30, y + 72, 64, INK.black, true);
  };
  box(1130, 92, 250, 'Value', INK.blue);
  box(1450, 92, 250, 'Scale', INK.blue);
  box(1770, 92, 230, 'Exit', INK.blue);
  ctx.strokeStyle = INK.black;
  arrow(ctx, { x: 1388, y: 144 }, { x: 1440, y: 144 }, 1, 61, 8);
  arrow(ctx, { x: 1708, y: 144 }, { x: 1760, y: 144 }, 1, 63, 8);
  arrow(ctx, { x: 1885, y: 204 }, { x: 1885, y: 268 }, 1, 65, 8);
  box(1770, 278, 230, 'Buy', INK.red);
  text(ctx, 'the marketplace', 1520, 446, 48, INK.red, true);

  // Down the left: the valuation pipeline.
  text(ctx, 'Valuation', 84, 480, 76, INK.red, true);
  ctx.strokeStyle = INK.red;
  stroke(ctx, 82, 500, 400, 496, 13, 8);
  const steps: [string, string][] = [
    ['tax returns + P&L', INK.black],
    ['AI extraction', INK.blue],
    ['structured financials', INK.black],
    ['SDE × multiple = value', INK.blue],
    ['PDF report ✓', INK.black],
  ];
  steps.forEach(([s, ink], i) => {
    const y = 585 + i * 112;
    text(ctx, s, 120, y, 60, ink, true);
    if (i < steps.length - 1) {
      ctx.strokeStyle = INK.black;
      arrow(
        ctx,
        { x: 150, y: y + 18 },
        { x: 150, y: y + 62 },
        1,
        80 + i * 5,
        7
      );
    }
  });
  text(ctx, '~70% faster', 760, 818, 54, INK.red, true);

  // On the right: the marketplace. A map, its pins and a cluster.
  const mx = 1080,
    my = 520,
    mw = 430,
    mh = 330;
  ctx.strokeStyle = INK.black;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(mx, my, mw, mh, 20);
  ctx.stroke();
  ctx.strokeStyle = INK.grey;
  stroke(ctx, mx + 20, my + 230, mx + mw - 30, my + 120, 91, 6);
  stroke(ctx, mx + 140, my + 20, mx + 200, my + mh - 20, 93, 6);
  const pin = (x: number, y: number, ink: string) => {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, y, 20, Math.PI * 0.85, Math.PI * 2.15);
    ctx.lineTo(x, y + 44);
    ctx.closePath();
    ctx.stroke();
  };
  pin(mx + 90, my + 120, INK.red);
  pin(mx + 270, my + 210, INK.red);
  pin(mx + 340, my + 90, INK.red);
  ctx.strokeStyle = INK.blue;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(mx + 200, my + 110, 42, 0, Math.PI * 2);
  ctx.stroke();
  text(ctx, '50+', mx + 166, my + 128, 46, INK.blue, true);
  // Listing cards beside it.
  for (let i = 0; i < 3; i++) {
    const cx = 1570,
      cy = 520 + i * 116;
    ctx.strokeStyle = INK.black;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.roundRect(cx, cy, 380, 96, 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(cx + 14, cy + 14, 86, 68, 8);
    ctx.stroke();
    stroke(ctx, cx + 120, cy + 34, cx + 330, cy + 32, 101 + i, 6);
    text(
      ctx,
      ['$850K', '$1.4M', '$420K'][i],
      cx + 120,
      cy + 80,
      44,
      INK.blue,
      true
    );
  }
  text(
    ctx,
    '9,500+ listings · 1,400+ industries',
    1080,
    935,
    56,
    INK.black,
    true
  );
  text(ctx, '"natural-language search"', 1080, 1010, 50, INK.blue, true);

  // Along the bottom: why.
  text(ctx, 'sell without regret', 1430, 1118, 62, INK.red, true);
  ctx.strokeStyle = INK.red;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(1688, 1098, 290, 56, -0.03, 0, Math.PI * 2);
  ctx.stroke();
}
