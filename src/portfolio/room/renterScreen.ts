/**
 * His monitor at Neighbor (RenterDesk.tsx): a storage marketplace's search,
 * drawn in our own style (not Neighbor's UI or marks): the search bar and
 * filters, results down the left, the map on the right with price pins; one
 * result at a time is hovered, its pin lit on the map. And the desk's
 * keyboard, from above.
 */

const SANS =
  "-apple-system, 'SF Pro Text', 'Helvetica Neue', 'Segoe UI', Arial, sans-serif";

export const MARKET_W = 1280,
  MARKET_H = 746;

type Listing = {
  title: string;
  where: string;
  size: string;
  price: number;
  /** Its pin on the map, 0..1 across and down. */
  pin: [number, number];
  /** Its photo's colours: door, wall. */
  tone: [string, string];
};

const LISTINGS: Listing[] = [
  {
    title: 'Two-car garage',
    where: 'Lehi, UT · 0.8 mi',
    size: "20' × 20'",
    price: 120,
    pin: [0.32, 0.38],
    tone: ['#d9d4c7', '#9fb3c2'],
  },
  {
    title: 'Climate-controlled unit',
    where: 'American Fork · 2.1 mi',
    size: "10' × 10'",
    price: 65,
    pin: [0.62, 0.24],
    tone: ['#c7d3dc', '#d7b98f'],
  },
  {
    title: 'Driveway, RV parking',
    where: 'Saratoga Springs · 3.4 mi',
    size: "12' × 40'",
    price: 85,
    pin: [0.22, 0.7],
    tone: ['#b9c4b0', '#e2dccd'],
  },
  {
    title: 'Basement storage room',
    where: 'Highland · 2.7 mi',
    size: "8' × 12'",
    price: 45,
    pin: [0.74, 0.62],
    tone: ['#e2d6c4', '#a9b8a0'],
  },
];
/** Other listings' pins: where and how much. */
const OTHERS: [number, number, number][] = [
  [0.45, 0.52, 95],
  [0.86, 0.36, 55],
  [0.12, 0.3, 140],
  [0.55, 0.82, 70],
  [0.9, 0.84, 110],
  [0.4, 0.15, 60],
];
export const LISTING_COUNT = LISTINGS.length;

function photo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  [door, wall]: [string, string]
) {
  // A garage front: sky, wall, a roll-up door's slats, a strip of drive.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#cfe2f1');
  g.addColorStop(1, '#eef4f8');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = wall;
  ctx.fillRect(x + w * 0.1, y + h * 0.28, w * 0.8, h * 0.62);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.04, y + h * 0.3);
  ctx.lineTo(x + w * 0.5, y + h * 0.1);
  ctx.lineTo(x + w * 0.96, y + h * 0.3);
  ctx.closePath();
  ctx.fillStyle = '#6f7782';
  ctx.fill();
  ctx.fillStyle = door;
  const dx = x + w * 0.24,
    dy = y + h * 0.42,
    dw = w * 0.52,
    dh = h * 0.48;
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = 'rgba(60,64,72,0.25)';
  ctx.lineWidth = 2;
  for (let k = 1; k < 7; k++) {
    ctx.beginPath();
    ctx.moveTo(dx, dy + (dh * k) / 7);
    ctx.lineTo(dx + dw, dy + (dh * k) / 7);
    ctx.stroke();
  }
  ctx.fillStyle = '#b7b9b6';
  ctx.fillRect(x, y + h * 0.9, w, h * 0.1);
  ctx.restore();
}

function pin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  on: boolean
) {
  ctx.font = `700 ${on ? 21 : 18}px ${SANS}`;
  const w = ctx.measureText(label).width + (on ? 26 : 22),
    h = on ? 36 : 31;
  ctx.fillStyle = 'rgba(20,30,50,0.18)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h + 3, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = on ? '#1d2433' : '#ffffff';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h, w, h, h / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 7, y - 1);
  ctx.lineTo(x + 7, y - 1);
  ctx.lineTo(x, y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = on ? '#ffffff' : '#1d2433';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y - h / 2 + (on ? 8 : 7));
  ctx.textAlign = 'left';
}

/**
 * The marketplace's search: results on the left (photo, title, where, size,
 * price, the host's reply time), the map on the right; result `hover` is
 * hovered, its card outlined and its pin lit and raised on the map.
 */
export function drawMarketplace(ctx: CanvasRenderingContext2D, hover: number) {
  const w = MARKET_W,
    h = MARKET_H;
  ctx.fillStyle = '#f5f6f8';
  ctx.fillRect(0, 0, w, h);
  // The top bar: a search field, the filters.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, 74);
  ctx.fillStyle = '#e4e7ec';
  ctx.fillRect(0, 74, w, 2);
  ctx.fillStyle = '#2f6fc0';
  ctx.beginPath();
  ctx.roundRect(28, 18, 38, 38, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(36, 40);
  ctx.lineTo(47, 29);
  ctx.lineTo(58, 40);
  ctx.lineTo(58, 49);
  ctx.lineTo(36, 49);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#eef0f3';
  ctx.beginPath();
  ctx.roundRect(88, 17, 520, 40, 20);
  ctx.fill();
  ctx.strokeStyle = '#8a93a3';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(112, 36, 8, 0, Math.PI * 2);
  ctx.moveTo(118, 42);
  ctx.lineTo(125, 49);
  ctx.stroke();
  ctx.fillStyle = '#2b3240';
  ctx.font = `500 20px ${SANS}`;
  ctx.fillText('Storage near Lehi, UT', 138, 44);
  let fx = 640;
  for (const f of [
    'Garage',
    'Under $150',
    'Climate controlled',
    '24/7 access',
  ]) {
    ctx.font = `500 17px ${SANS}`;
    const fw = ctx.measureText(f).width + 30;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#d5d9e0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(fx, 20, fw, 34, 17);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3a4252';
    ctx.fillText(f, fx + 15, 43);
    fx += fw + 10;
  }
  ctx.fillStyle = '#c9d6e8';
  ctx.beginPath();
  ctx.arc(w - 44, 37, 18, 0, Math.PI * 2);
  ctx.fill();

  // The results.
  ctx.fillStyle = '#5b6475';
  ctx.font = `600 17px ${SANS}`;
  ctx.fillText('128 spaces near you', 28, 108);
  const cx = 24,
    cw = 488,
    ch = 146;
  LISTINGS.forEach((l, i) => {
    const cy = 124 + i * (ch + 12),
      on = i === hover;
    ctx.fillStyle = 'rgba(20,30,50,0.06)';
    ctx.beginPath();
    ctx.roundRect(cx, cy + 3, cw, ch, 14);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(cx, cy, cw, ch, 14);
    ctx.fill();
    if (on) {
      ctx.strokeStyle = '#2f6fc0';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    photo(ctx, cx + 12, cy + 12, 170, ch - 24, l.tone);
    const tx = cx + 200;
    ctx.fillStyle = '#18202e';
    ctx.font = `700 21px ${SANS}`;
    ctx.fillText(l.title, tx, cy + 38);
    ctx.fillStyle = '#5b6475';
    ctx.font = `400 17px ${SANS}`;
    ctx.fillText(`${l.where} · ${l.size}`, tx, cy + 64);
    ctx.fillStyle = '#1f8a4c';
    ctx.beginPath();
    ctx.arc(tx + 5, cy + 88, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a4252';
    ctx.font = `400 16px ${SANS}`;
    ctx.fillText('Host replies within an hour', tx + 16, cy + 94);
    ctx.fillStyle = '#18202e';
    ctx.font = `700 22px ${SANS}`;
    ctx.fillText(`$${l.price}`, tx, cy + 126);
    ctx.font = `400 16px ${SANS}`;
    ctx.fillStyle = '#5b6475';
    ctx.fillText(
      ' / month',
      tx + ctx.measureText(`$${l.price}`).width + 16,
      cy + 126
    );
  });

  // The map.
  const mx = 532,
    my = 92,
    mw = w - mx - 20,
    mh = h - my - 18;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(mx, my, mw, mh, 16);
  ctx.clip();
  ctx.fillStyle = '#e7ecef';
  ctx.fillRect(mx, my, mw, mh);
  // Blocks between the streets.
  ctx.fillStyle = '#f4f6f7';
  for (let gy = 0; gy < 6; gy++)
    for (let gx = 0; gx < 7; gx++) {
      const bx = mx + 14 + gx * (mw / 7),
        by = my + 14 + gy * (mh / 6);
      ctx.beginPath();
      ctx.roundRect(bx, by, mw / 7 - 22, mh / 6 - 22, 6);
      ctx.fill();
    }
  // A park and the lake's edge.
  ctx.fillStyle = '#cfe3c4';
  ctx.beginPath();
  ctx.roundRect(mx + mw * 0.58, my + mh * 0.42, mw * 0.22, mh * 0.16, 18);
  ctx.fill();
  ctx.fillStyle = '#bcd6ea';
  ctx.beginPath();
  ctx.moveTo(mx, my + mh * 0.86);
  ctx.bezierCurveTo(
    mx + mw * 0.25,
    my + mh * 0.8,
    mx + mw * 0.4,
    my + mh * 0.98,
    mx + mw * 0.6,
    my + mh
  );
  ctx.lineTo(mx, my + mh);
  ctx.closePath();
  ctx.fill();
  // Main roads.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(mx, my + mh * 0.47);
  ctx.lineTo(mx + mw, my + mh * 0.4);
  ctx.moveTo(mx + mw * 0.42, my);
  ctx.lineTo(mx + mw * 0.5, my + mh);
  ctx.stroke();
  ctx.strokeStyle = '#f6d58a';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(mx + mw * 0.08, my);
  ctx.bezierCurveTo(
    mx + mw * 0.2,
    my + mh * 0.4,
    mx + mw * 0.1,
    my + mh * 0.7,
    mx + mw * 0.3,
    my + mh
  );
  ctx.stroke();
  // Pins: the others, then the results, the hovered one last, on top.
  for (const [px, py, price] of OTHERS)
    pin(ctx, mx + px * mw, my + py * mh, `$${price}`, false);
  LISTINGS.forEach((l, i) => {
    if (i !== hover)
      pin(ctx, mx + l.pin[0] * mw, my + l.pin[1] * mh, `$${l.price}`, false);
  });
  const l = LISTINGS[hover];
  pin(ctx, mx + l.pin[0] * mw, my + l.pin[1] * mh - 6, `$${l.price}`, true);
  ctx.restore();
}

/** What he writes (TypeScript, the search results kept in step with the
 *  map), typed out as he works at the keys; it starts over once done. */
const CODE = `import { useEffect, useState } from 'react';
import { searchSpaces } from '../api/search';
import type { Bounds, Listing } from '../types';

// Keep the results in step with the map:
// what's in view is what's listed.
export function useMapResults(bounds: Bounds) {
  const [results, setResults] = useState<Listing[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    searchSpaces({ bounds, limit: 24 }, ctrl.signal)
      .then((page) => setResults(page.listings))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [bounds]);

  // Hovering a card lights its pin, and back.
  const pinFor = (id: string) => ({
    active: id === hovered,
    onEnter: () => setHovered(id),
    onLeave: () => setHovered(null),
  });

  return { results, hovered, pinFor };
}
`;
export const CODE_LEN = CODE.length;

const KEYWORDS =
  /\b(import|from|export|function|const|return|type|new|null|useEffect|useState)\b/;
const MONO = "Menlo, Consolas, 'Courier New', monospace";

/**
 * The editor (in our own dark style): a file tree, a tab, the code typed so
 * far (`typed` characters) with simple colours and a caret, line numbers;
 * the view scrolls to keep the caret in sight.
 */
export function drawCode(
  ctx: CanvasRenderingContext2D,
  typed: number,
  caret: boolean
) {
  const w = MARKET_W,
    h = MARKET_H;
  ctx.fillStyle = '#1f232a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#252a32';
  ctx.fillRect(0, 0, 230, h);
  ctx.fillStyle = '#2a2f37';
  ctx.fillRect(230, 0, w - 230, 46);
  ctx.fillStyle = '#1f232a';
  ctx.fillRect(240, 8, 230, 38);
  ctx.font = `500 18px ${SANS}`;
  ctx.fillStyle = '#d7dae0';
  ctx.fillText('useMapResults.ts', 262, 33);
  const files = [
    'src',
    '  api',
    '    search.ts',
    '  components',
    '    ResultCard.tsx',
    '    SearchMap.tsx',
    '  hooks',
    '    useMapResults.ts',
    '  types.ts',
  ];
  files.forEach((f, i) => {
    ctx.fillStyle = f.includes('useMapResults') ? '#e5e8ee' : '#8b93a1';
    ctx.font = `400 17px ${SANS}`;
    ctx.fillText(f, 18, 40 + i * 30);
  });
  const text = CODE.slice(0, typed),
    lines = text.split('\n'),
    lh = 25,
    rowsShown = Math.floor((h - 70) / lh),
    first = Math.max(0, lines.length - rowsShown);
  ctx.font = `400 18px ${MONO}`;
  for (let i = first; i < lines.length; i++) {
    const y = 76 + (i - first) * lh;
    ctx.fillStyle = '#4b5260';
    ctx.textAlign = 'right';
    ctx.fillText(String(i + 1), 282, y);
    ctx.textAlign = 'left';
    let x = 300;
    for (const tok of lines[i].split(
      /(\s+|[(){}[\];,.:<>=]|'[^']*'?|\/\/.*$)/
    )) {
      if (!tok) continue;
      ctx.fillStyle = tok.startsWith('//')
        ? '#7f848e'
        : tok.startsWith("'")
          ? '#98c379'
          : KEYWORDS.test(tok)
            ? '#c678dd'
            : /^[A-Z]/.test(tok)
              ? '#e5c07b'
              : /^[(){}[\];,.:<>=]$/.test(tok)
                ? '#abb2bf'
                : '#61afef';
      if (/^\s+$/.test(tok)) ctx.fillStyle = '#abb2bf';
      ctx.fillText(tok, x, y);
      x += ctx.measureText(tok).width;
    }
    if (i === lines.length - 1 && caret) {
      ctx.fillStyle = '#e5e8ee';
      ctx.fillRect(x + 1, y - 17, 2, 22);
    }
  }
}

export const KEYS_W = 1224,
  KEYS_H = 504;

/** The room's keyboard from above (Magic Keyboard style, no logo): a silver
 *  deck, white keys in its US layout with every legend (as the lecture
 *  hall's laptop), the function row at the top (toward the monitor). Drawn
 *  at 80 px a key unit (15.3 x 6.3 units). */
export function drawDeskKeys(ctx: CanvasRenderingContext2D) {
  const U = 80,
    F = Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
    rows: [number, [number, string][]][] = [
      [0.5, [[1.5, 'esc'], ...F.map((f): [number, string] => [1, f]), [1, '']]],
      [
        1,
        [...'`1234567890-=']
          .map((c): [number, string] => [1, c])
          .concat([[1.5, 'delete']]),
      ],
      [
        1,
        [[1.5, 'tab'] as [number, string]].concat(
          [...'QWERTYUIOP[]'].map((c): [number, string] => [1, c]),
          [[1, '\\']]
        ),
      ],
      [
        1,
        [[1.75, 'caps lock'] as [number, string]].concat(
          [...`ASDFGHJKL;'`].map((c): [number, string] => [1, c]),
          [[1.75, 'return']]
        ),
      ],
      [
        1,
        [[2.25, 'shift'] as [number, string]].concat(
          [...'ZXCVBNM,./'].map((c): [number, string] => [1, c]),
          [[2.25, 'shift']]
        ),
      ],
      [
        1,
        [
          [1, 'fn'],
          [1, 'control'],
          [1, 'option'],
          [1.25, 'command'],
          [5, ''],
          [1.25, 'command'],
          [1, 'option'],
          [1, '◀'],
          [1, '▲▼'],
          [1, '▶'],
        ],
      ],
    ];
  ctx.fillStyle = '#c7c9cc';
  ctx.fillRect(0, 0, KEYS_W, KEYS_H);
  let y = 0.4 * U;
  for (const [depth, keys] of rows) {
    let x = 0.4 * U;
    for (const [w, label] of keys) {
      const kw = w * U - 6,
        kh = depth * U - 6;
      ctx.fillStyle = '#f6f6f3';
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 3, kw, kh, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(x + 5, y + depth * U - 7, kw - 4, 3);
      if (label) {
        ctx.fillStyle = '#3b3e44';
        const word =
          label === 'fn' || (label.length > 2 && !label.startsWith('F'));
        ctx.font = `${word ? 500 : 400} ${word || depth < 1 ? 15 : 26}px ${SANS}`;
        if (word) {
          // Modifier words sit low in the key's corner (left keys on the
          // left, right keys on the right), as on the real one.
          const right = x > KEYS_W / 2;
          ctx.textAlign = right ? 'right' : 'left';
          ctx.fillText(label, right ? x + kw - 6 : x + 12, y + kh - 8);
        } else {
          ctx.textAlign = 'center';
          ctx.fillText(
            label,
            x + 3 + kw / 2,
            y + 3 + kh / 2 + (depth < 1 ? 5 : 9)
          );
        }
        ctx.textAlign = 'left';
      }
      x += w * U;
    }
    y += depth * U;
  }
}
