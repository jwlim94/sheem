import { arrow, INK, rand, stroke, text } from './officeBoard';

/**
 * The whiteboard between the classroom's screens (chapter 3), drawn to a
 * canvas once (2026-11-20: it stood blank in the middle of every shot): the
 * professor's frame for the course, in marker, from before the case. Not
 * the case's answer (that goes up on the right screen as the class gives
 * it). Risk as likelihood times impact, with a risk matrix and what to do
 * with a risk; defence in depth; what a control costs against the risk it
 * removes; the memo due and the reading. Hand-drawn with the office board's
 * marker (officeBoard.ts), Kalam, faint ghosts of old writing.
 *
 * The board is 2.6 x 1.5 m (build_class.py); canvas pixels, x from the left
 * end as the class faces it.
 */
export const MISM_BOARD = { w: 2.6, h: 1.5, cw: 2048, ch: 1182 };

export function drawMismBoard(ctx: CanvasRenderingContext2D) {
  const { cw: w, ch: h } = MISM_BOARD;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#fbfcfc');
  g.addColorStop(1, '#f0f2f3');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Ghosts of last class's writing, wiped off.
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = INK.grey;
  for (let i = 0; i < 18; i++) {
    const x = 80 + rand(i + 3) * 1800,
      y = 90 + rand(i + 50) * 980;
    stroke(
      ctx,
      x,
      y,
      x + 80 + rand(i + 9) * 220,
      y + (rand(i + 4) - 0.5) * 30,
      i * 13,
      10
    );
  }
  ctx.globalAlpha = 0.045;
  ctx.fillStyle = INK.grey;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(
      200 + rand(i + 70) * 1600,
      160 + rand(i + 80) * 800,
      150,
      30,
      rand(i) - 0.5,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();

  // Bold marker (2026-11-20: at 5 px, as on Neighbor's board, it read as a
  // blank board from the seats: the classroom is seen from 10-15 m).
  const W = 10;
  // Left: risk, in shorthand: a risk matrix and what to do with a risk.
  // (Not "L × I": in the marker hand its I read as a 1.)
  text(ctx, 'Risk = likelihood', 80, 130, 62, INK.black, true);
  text(ctx, '× impact', 230, 200, 62, INK.black, true);
  ctx.strokeStyle = INK.red;
  stroke(ctx, 82, 224, 560, 218, 21, W);
  const mx = 170,
    my = 300,
    c = 112;
  ctx.strokeStyle = INK.black;
  for (let i = 0; i <= 3; i++) {
    stroke(
      ctx,
      mx,
      my + i * c,
      mx + 3 * c,
      my + i * c + (rand(i) - 0.5) * 6,
      30 + i,
      8
    );
    stroke(
      ctx,
      mx + i * c,
      my,
      mx + i * c + (rand(i + 5) - 0.5) * 6,
      my + 3 * c,
      40 + i,
      8
    );
  }
  // The likely, costly corner hatched.
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = INK.red;
  for (const [hx, hy] of [
    [2, 0],
    [1, 0],
    [2, 1],
  ])
    for (let k = 1; k < 6; k++)
      stroke(
        ctx,
        mx + hx * c + k * 19,
        my + hy * c + 8,
        mx + hx * c + 8,
        my + hy * c + k * 19,
        50 + k + hx * 7 + hy * 3,
        6
      );
  ctx.restore();
  ctx.save();
  ctx.translate(mx - 30, my + 3 * c - 20);
  ctx.rotate(-Math.PI / 2);
  text(ctx, 'likelihood', 0, 0, 44, INK.black, true);
  ctx.restore();
  text(ctx, 'impact', mx + 0.9 * c, my + 3 * c + 64, 44, INK.black, true);
  ctx.strokeStyle = INK.blue;
  for (const [x, y] of [
    [mx + 2.5 * c, my + 0.5 * c],
    [mx + 0.5 * c, my + 2.45 * c],
  ]) {
    stroke(ctx, x - 22, y - 22, x + 22, y + 22, x, W);
    stroke(ctx, x + 22, y - 22, x - 22, y + 22, y, W);
  }
  ['accept', 'reduce', 'transfer', 'avoid'].forEach((s, i) =>
    text(ctx, s, mx + 3 * c + 56, my + 50 + i * 78, 52, INK.blue, true)
  );

  // Middle: defence in depth, layer within layer.
  text(ctx, 'Defense in depth', 850, 150, 66, INK.black, true);
  const layers = ['people', 'network', 'host', 'app', 'data'],
    cx = 1090,
    cy = 480;
  layers.forEach((s, i) => {
    const rw = 250 - i * 44,
      rh = 215 - i * 38;
    ctx.strokeStyle = i === 4 ? INK.red : INK.blue;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.roundRect(cx - rw, cy - rh, rw * 2, rh * 2, 36 - i * 5);
    ctx.stroke();
    text(
      ctx,
      s,
      cx - rw + 20,
      cy - rh + 36,
      32,
      i === 4 ? INK.red : INK.blue,
      true
    );
  });

  // Right: a control's cost against the risk it removes.
  text(ctx, 'Cost of a control', 1420, 150, 62, INK.black, true);
  text(ctx, 'vs. the risk it removes', 1420, 214, 48, INK.black, true);
  const ox = 1470,
    oy = 680;
  ctx.strokeStyle = INK.black;
  arrow(ctx, { x: ox, y: oy }, { x: ox, y: oy - 360 }, 1, 71, 8);
  arrow(ctx, { x: ox, y: oy }, { x: ox + 480, y: oy }, 1, 73, 8);
  text(ctx, 'risk', ox + 22, oy - 330, 42, INK.black, true);
  text(ctx, '$ spent', ox + 330, oy + 58, 42, INK.black, true);
  ctx.strokeStyle = INK.blue;
  ctx.lineWidth = W;
  ctx.beginPath();
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const x = ox + 24 + t * 430,
      y = oy - 34 - 300 * Math.exp(-t * 4.2) + (rand(t * 100) - 0.5) * 4;
    if (t === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  const kx = ox + 24 + 0.27 * 430,
    ky = oy - 34 - 300 * Math.exp(-0.27 * 4.2);
  ctx.strokeStyle = INK.red;
  ctx.lineWidth = W;
  ctx.beginPath();
  ctx.arc(kx, ky, 28, 0, Math.PI * 2);
  ctx.stroke();
  text(ctx, 'where?', kx + 44, ky - 30, 58, INK.red, true);

  // Along the bottom: the memo due, the reading.
  text(ctx, 'Case 7 memo due Thu', 80, h - 96, 54, INK.black, true);
  ctx.strokeStyle = INK.black;
  stroke(ctx, 82, h - 76, 560, h - 82, 91, 8);
  text(ctx, 'Read: NIST CSF 2.0', 1420, h - 96, 52, INK.blue, true);
}
