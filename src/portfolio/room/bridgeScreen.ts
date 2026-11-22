/**
 * His screens at Bridge (BridgeDesk.tsx), in our own style (no Bridge marks;
 * made-up listings, as the flight's):
 * - the monitor: the business marketplace he built: its natural-language
 *   search (the flight's query), filters, listing cards down the left
 *   (picture, category, name, town, asking price and SDE), the map on the
 *   right with clusters and pins; one listing at a time hovered, its pin
 *   lit, while his hand is on the trackpad;
 * - the laptop: the valuation pipeline's code (his résumé: tax returns and
 *   P&Ls turned into structured financials, SDE and a value), typed as he
 *   types.
 */

const SANS =
  "-apple-system, 'SF Pro Text', 'Helvetica Neue', 'Segoe UI', Arial, sans-serif";
const MONO = "Menlo, Consolas, 'Courier New', monospace";

export const MARKET_W = 1280,
  MARKET_H = 746;
export const LAPTOP_W = 1024,
  LAPTOP_H = 640;

type Listing = {
  category: string;
  title: string;
  where: string;
  price: string;
  sde: string;
  /** Its pin on the map, 0..1 across and down. */
  pin: [number, number];
  /** Its picture's gradient. */
  tone: [string, string];
};

const LISTINGS: Listing[] = [
  {
    category: 'Food & Beverage',
    title: 'Specialty Coffee Roaster & Café',
    where: 'Lehi, UT',
    price: '$850K',
    sde: '$240K',
    pin: [0.36, 0.3],
    tone: ['#c79a6b', '#6e4630'],
  },
  {
    category: 'Home Services',
    title: 'Established HVAC Service Company',
    where: 'Orem, UT',
    price: '$1.4M',
    sde: '$410K',
    pin: [0.55, 0.52],
    tone: ['#9fb7c9', '#4b6478'],
  },
  {
    category: 'Health & Fitness',
    title: 'Boutique Fitness Studio',
    where: 'American Fork, UT',
    price: '$420K',
    sde: '$130K',
    pin: [0.42, 0.42],
    tone: ['#d8a3a0', '#8a4f5c'],
  },
  {
    category: 'Technology',
    title: 'IT Managed Services Firm',
    where: 'Provo, UT',
    price: '$1.2M',
    sde: '$360K',
    pin: [0.62, 0.7],
    tone: ['#a9b6d8', '#4a5888'],
  },
  {
    category: 'Automotive',
    title: 'Auto Repair & Tire Shop',
    where: 'Pleasant Grove, UT',
    price: '$980K',
    sde: '$290K',
    pin: [0.5, 0.36],
    tone: ['#b9b3a6', '#5d5a52'],
  },
  {
    category: 'Retail',
    title: 'Outdoor Gear Retailer',
    where: 'Springville, UT',
    price: '$640K',
    sde: '$175K',
    pin: [0.72, 0.84],
    tone: ['#a8c39a', '#4f6b44'],
  },
];
export const LISTING_COUNT = LISTINGS.length;
const QUERY = 'profitable businesses in Utah County under $1.5M';

/** The marketplace, `hover` the listing under his pointer. */
export function drawMarket(ctx: CanvasRenderingContext2D, hover: number) {
  const w = MARKET_W,
    h = MARKET_H;
  ctx.fillStyle = '#f5f6f8';
  ctx.fillRect(0, 0, w, h);
  // The top bar: the search, its query, the filters.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, 74);
  ctx.fillStyle = '#e4e6ea';
  ctx.fillRect(0, 74, w, 1);
  ctx.fillStyle = '#f1f2f5';
  ctx.beginPath();
  ctx.roundRect(24, 14, 760, 46, 23);
  ctx.fill();
  ctx.strokeStyle = '#8b909a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(52, 36, 9, 0, Math.PI * 2);
  ctx.moveTo(59, 43);
  ctx.lineTo(66, 50);
  ctx.stroke();
  ctx.font = `500 19px ${SANS}`;
  ctx.fillStyle = '#2a2d33';
  ctx.textBaseline = 'middle';
  ctx.fillText(QUERY, 80, 37);
  ctx.fillStyle = '#e98b3a';
  ctx.beginPath();
  ctx.roundRect(800, 14, 120, 46, 23);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 18px ${SANS}`;
  ctx.fillText('Search', 830, 37);
  ['Price < $1.5M', 'Utah County', 'Profitable', 'Sort: SDE'].forEach(
    (chip, i) => {
      ctx.font = `500 15px ${SANS}`;
      const cw = ctx.measureText(chip).width + 26,
        x = 940 + [0, 128, 240, 340][i];
      if (x + cw > w - 10) return;
      ctx.fillStyle = i < 3 ? '#fff1e4' : '#eef0f3';
      ctx.beginPath();
      ctx.roundRect(x, 22, cw, 30, 15);
      ctx.fill();
      ctx.fillStyle = i < 3 ? '#b4621d' : '#555a63';
      ctx.fillText(chip, x + 13, 37);
    }
  );
  // The count.
  ctx.font = `600 18px ${SANS}`;
  ctx.fillStyle = '#2a2d33';
  ctx.fillText('128 businesses · Utah County', 24, 102);
  // The listing cards, two columns down the left.
  const cw = 318,
    ch = 196;
  LISTINGS.forEach((l, i) => {
    const x = 24 + (i % 2) * (cw + 14),
      y = 124 + Math.floor(i / 2) * (ch + 12),
      on = i === hover;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = on ? 'rgba(233, 139, 58, 0.45)' : 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = on ? 14 : 6;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 12);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    if (on) {
      ctx.strokeStyle = '#e98b3a';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, cw, 92, [12, 12, 0, 0]);
    ctx.clip();
    const g = ctx.createLinearGradient(x, y, x + cw, y + 92);
    g.addColorStop(0, l.tone[0]);
    g.addColorStop(1, l.tone[1]);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, cw, 92);
    ctx.restore();
    ctx.font = `600 13px ${SANS}`;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(
      x + 10,
      y + 10,
      ctx.measureText(l.category).width + 24,
      26,
      13
    );
    ctx.fill();
    ctx.fillStyle = '#4a4e57';
    ctx.fillText(l.category, x + 22, y + 23);
    ctx.font = `700 17px ${SANS}`;
    ctx.fillStyle = '#1d1f24';
    ctx.fillText(l.title, x + 14, y + 112, cw - 28);
    ctx.font = `500 14px ${SANS}`;
    ctx.fillStyle = '#6b707a';
    ctx.fillText(l.where, x + 14, y + 134);
    ctx.font = `700 12px ${SANS}`;
    ctx.fillStyle = '#8a8f99';
    ctx.fillText('ASKING', x + 14, y + 158);
    ctx.fillText('SDE', x + 130, y + 158);
    ctx.font = `700 19px ${SANS}`;
    ctx.fillStyle = '#1d1f24';
    ctx.fillText(l.price, x + 14, y + 180);
    ctx.fillText(l.sde, x + 130, y + 180);
  });
  // The map on the right: land, the lake, roads, clusters and pins.
  const mx = 700,
    my = 90,
    mw = w - mx - 16,
    mh = h - my - 16;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(mx, my, mw, mh, 12);
  ctx.clip();
  ctx.fillStyle = '#e9eee6';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#b9d4e6';
  ctx.beginPath();
  ctx.ellipse(
    mx + mw * 0.12,
    my + mh * 0.62,
    mw * 0.2,
    mh * 0.34,
    0.2,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(mx + mw * 0.3, my);
  ctx.bezierCurveTo(
    mx + mw * 0.45,
    my + mh * 0.4,
    mx + mw * 0.5,
    my + mh * 0.6,
    mx + mw * 0.7,
    my + mh
  );
  ctx.stroke();
  ctx.lineWidth = 3;
  for (let k = 1; k < 6; k++) {
    ctx.beginPath();
    ctx.moveTo(mx, my + (mh * k) / 6);
    ctx.lineTo(mx + mw, my + (mh * k) / 6 + 12);
    ctx.stroke();
  }
  // Clusters.
  [
    [0.25, 0.18, '30+'],
    [0.8, 0.3, '20+'],
    [0.82, 0.62, '10+'],
  ].forEach(([px, py, n]) => {
    const x = mx + mw * (px as number),
      y = my + mh * (py as number);
    ctx.fillStyle = '#1d1f24';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 15px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText(n as string, x, y + 1);
    ctx.textAlign = 'left';
  });
  // Each listing's price pin; the hovered one lit and raised.
  LISTINGS.forEach((l, i) => {
    const x = mx + mw * l.pin[0],
      y = my + mh * l.pin[1],
      on = i === hover;
    ctx.font = `700 ${on ? 17 : 14}px ${SANS}`;
    const pw = ctx.measureText(l.price).width + 20,
      ph = on ? 32 : 26;
    ctx.fillStyle = on ? '#e98b3a' : '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.roundRect(x - pw / 2, y - ph, pw, ph, ph / 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = on ? '#ffffff' : '#1d1f24';
    ctx.textAlign = 'center';
    ctx.fillText(l.price, x, y - ph / 2 + 1);
    ctx.textAlign = 'left';
  });
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

const CODE = `import { extractTables } from './ocr';
import { model } from './model';
import { Financials, FinancialsSchema } from './schema';

// Tax returns and P&Ls in, structured financials out.
export async function extractFinancials(doc: TaxReturn | PnL) {
  const pages = await extractTables(doc);
  const fields = await model.parse(pages, FinancialsSchema);
  return Financials.from({
    revenue: fields.grossReceipts,
    cogs: fields.costOfGoodsSold,
    expenses: fields.totalDeductions,
    addBacks: [fields.depreciation, fields.interest, fields.ownerPay],
  });
}

// Seller's discretionary earnings: what the owner takes home.
export function sde(f: Financials) {
  return f.revenue - f.cogs - f.expenses + sum(f.addBacks);
}

export function valuation(f: Financials, multiple: number) {
  return { sde: sde(f), value: sde(f) * multiple };
}
`;
export const CODE_LEN = CODE.length;

const KEYWORDS =
  /\b(import|from|export|async|await|function|const|return|type|new)\b/;

/** The laptop's editor (our dark style): a file tree, a tab, the code typed
 *  so far (`typed` characters) with simple colours and a caret, line
 *  numbers; the view scrolls to keep the caret in sight. */
export function drawValuationCode(
  ctx: CanvasRenderingContext2D,
  typed: number,
  caret: boolean
) {
  const w = LAPTOP_W,
    h = LAPTOP_H;
  ctx.fillStyle = '#1f232a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#252a32';
  ctx.fillRect(0, 0, 190, h);
  ctx.fillStyle = '#2a2f37';
  ctx.fillRect(190, 0, w - 190, 40);
  ctx.fillStyle = '#1f232a';
  ctx.fillRect(198, 6, 200, 34);
  ctx.font = `500 16px ${SANS}`;
  ctx.fillStyle = '#d7dae0';
  ctx.fillText('extract.ts', 218, 29);
  [
    'valuation',
    '  ocr.ts',
    '  model.ts',
    '  schema.ts',
    '  extract.ts',
    '  report.ts',
    'marketplace',
    '  search.ts',
  ].forEach((f, i) => {
    ctx.fillStyle = f.includes('extract') ? '#e5e8ee' : '#8b93a1';
    ctx.font = `400 15px ${SANS}`;
    ctx.fillText(f, 14, 34 + i * 26);
  });
  const lines = CODE.slice(0, typed).split('\n'),
    lh = 22,
    rows = Math.floor((h - 60) / lh),
    first = Math.max(0, lines.length - rows);
  ctx.font = `400 15px ${MONO}`;
  for (let i = first; i < lines.length; i++) {
    const y = 66 + (i - first) * lh;
    ctx.fillStyle = '#4b5260';
    ctx.textAlign = 'right';
    ctx.fillText(String(i + 1), 234, y);
    ctx.textAlign = 'left';
    let x = 250;
    for (const tok of lines[i].split(
      /(\s+|[(){}[\];,.:<>=|+*-]|'[^']*'?|\/\/.*$)/
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
              : /^[(){}[\];,.:<>=|+*-]$/.test(tok) || /^\s+$/.test(tok)
                ? '#abb2bf'
                : '#61afef';
      ctx.fillText(tok, x, y);
      x += ctx.measureText(tok).width;
    }
    if (i === lines.length - 1 && caret) {
      ctx.fillStyle = '#e5e8ee';
      ctx.fillRect(x + 1, y - 14, 2, 18);
    }
  }
}

/** The CEO's laptop: his mail (made-up senders and deals). The inbox down
 *  the left, the deal he is reading open on the right. */
export function drawInbox(ctx: CanvasRenderingContext2D) {
  const w = LAPTOP_W,
    h = LAPTOP_H;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'alphabetic';
  // The folders.
  ctx.fillStyle = '#f3f4f7';
  ctx.fillRect(0, 0, 170, h);
  ctx.fillStyle = '#e98b3a';
  ctx.beginPath();
  ctx.roundRect(14, 16, 142, 36, 18);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 15px ${SANS}`;
  ctx.fillText('Compose', 52, 39);
  [
    ['Inbox', '12'],
    ['Starred', ''],
    ['Sent', ''],
    ['Drafts', '2'],
    ['Deals', '5'],
  ].forEach(([f, n], i) => {
    const y = 88 + i * 34;
    if (i === 0) {
      ctx.fillStyle = '#fde9d6';
      ctx.beginPath();
      ctx.roundRect(8, y - 22, 154, 30, 15);
      ctx.fill();
    }
    ctx.fillStyle = i === 0 ? '#b4621d' : '#4a4e57';
    ctx.font = `${i === 0 ? 700 : 500} 15px ${SANS}`;
    ctx.fillText(f, 26, y);
    if (n) ctx.fillText(n, 136, y);
  });
  // The list.
  const mails = [
    [
      'Sarah K. · Broker',
      'Re: LOI · HVAC Service Co.',
      'Buyer accepted the revised terms',
      '9:42 AM',
    ],
    [
      'Valuation Team',
      'Certified valuation ready',
      'Coffee roaster: report attached',
      '9:15 AM',
    ],
    [
      'Credit Union Partners',
      'Vendor review: approved',
      'Thanks for the security docs',
      '8:58 AM',
    ],
    [
      'Marketplace',
      'New buyer inquiry',
      'Boutique fitness studio, Lehi',
      '8:30 AM',
    ],
    [
      'Mike R.',
      'Q4 seller pipeline',
      'Twelve owners ready to list',
      'Yesterday',
    ],
    [
      'Events',
      'Utah ETA meetup: speakers',
      'Can you open the evening?',
      'Yesterday',
    ],
  ];
  const lx = 170,
    lw = 330;
  ctx.fillStyle = '#e6e7eb';
  ctx.fillRect(lx + lw, 0, 1, h);
  mails.forEach(([from, subject, snip, time], i) => {
    const y = i * 96;
    if (i === 0) {
      ctx.fillStyle = '#eef3fb';
      ctx.fillRect(lx, y, lw, 96);
      ctx.fillStyle = '#e98b3a';
      ctx.fillRect(lx, y, 4, 96);
    }
    ctx.fillStyle = '#e6e7eb';
    ctx.fillRect(lx, y + 95, lw, 1);
    ctx.fillStyle = '#1d1f24';
    ctx.font = `${i < 3 ? 700 : 500} 15px ${SANS}`;
    ctx.fillText(from, lx + 18, y + 28, 210);
    ctx.font = `500 13px ${SANS}`;
    ctx.fillStyle = '#8a8f99';
    ctx.fillText(time, lx + lw - 74, y + 28);
    ctx.fillStyle = '#2a2d33';
    ctx.font = `${i < 3 ? 600 : 400} 14px ${SANS}`;
    ctx.fillText(subject, lx + 18, y + 52, lw - 36);
    ctx.fillStyle = '#6b707a';
    ctx.font = `400 13px ${SANS}`;
    ctx.fillText(snip, lx + 18, y + 74, lw - 36);
  });
  // The open mail.
  const rx = lx + lw + 28;
  ctx.fillStyle = '#1d1f24';
  ctx.font = `700 21px ${SANS}`;
  ctx.fillText('Re: LOI · Established HVAC Service Co.', rx, 52, w - rx - 20);
  ctx.fillStyle = '#e98b3a';
  ctx.beginPath();
  ctx.arc(rx + 18, 96, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 15px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('SK', rx + 18, 101);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1d1f24';
  ctx.font = `600 15px ${SANS}`;
  ctx.fillText('Sarah K.', rx + 46, 92);
  ctx.fillStyle = '#8a8f99';
  ctx.font = `400 13px ${SANS}`;
  ctx.fillText('to me · 9:42 AM', rx + 46, 111);
  const body = [
    'Great news: the buyer accepted the revised LOI',
    'at $1.4M, with a 90-day close.',
    '',
    'Can we send over the updated valuation report',
    'and the data room checklist by Friday? The',
    'lender wants the SDE add-backs broken out.',
    '',
    'Thanks,',
    'Sarah',
  ];
  ctx.fillStyle = '#2a2d33';
  ctx.font = `400 15px ${SANS}`;
  body.forEach((line, i) => ctx.fillText(line, rx, 160 + i * 26));
  ctx.strokeStyle = '#d6d9df';
  ctx.lineWidth = 1.5;
  ['Reply', 'Forward'].forEach((b, i) => {
    ctx.beginPath();
    ctx.roundRect(rx + i * 110, 420, 96, 36, 18);
    ctx.stroke();
    ctx.fillStyle = '#2a2d33';
    ctx.font = `600 14px ${SANS}`;
    ctx.fillText(b, rx + i * 110 + 24, 443);
  });
}

/** The COO's laptop: a listing's financial statements (the coffee roaster
 *  on the marketplace: its TTM SDE is the card's $240K), in a spreadsheet,
 *  the income statement's years side by side, the add-backs, SDE. */
export function drawFinancials(ctx: CanvasRenderingContext2D) {
  const w = LAPTOP_W,
    h = LAPTOP_H;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f3f4f7';
  ctx.fillRect(0, 0, w, 44);
  ['Income Statement', 'Balance Sheet', 'Cash Flow', 'Add-backs'].forEach(
    (t, i) => {
      ctx.font = `${i === 0 ? 700 : 500} 14px ${SANS}`;
      const x = 16 + [0, 150, 270, 365][i];
      if (i === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 10, 8, 140, 36);
      }
      ctx.fillStyle = i === 0 ? '#1d1f24' : '#6b707a';
      ctx.fillText(t, x, 31);
    }
  );
  ctx.fillStyle = '#1d1f24';
  ctx.font = `700 19px ${SANS}`;
  ctx.fillText('Specialty Coffee Roaster & Café', 20, 82);
  ctx.fillStyle = '#6b707a';
  ctx.font = `500 14px ${SANS}`;
  ctx.fillText('Income statement · USD · from tax returns and P&Ls', 20, 104);
  const cols = ['2022', '2023', '2024', 'TTM'],
    rows: [string, number[], number][] = [
      ['Revenue', [1120000, 1240000, 1310000, 1352000], 1],
      ['Cost of goods sold', [-380800, -421600, -445400, -459700], 0],
      ['Gross profit', [739200, 818400, 864600, 892300], 1],
      ['Operating expenses', [-612000, -655000, -690000, -702300], 0],
      ['EBITDA', [127200, 163400, 174600, 190000], 1],
      ["Owner's compensation", [45000, 45000, 45000, 45000], 0],
      ['Depreciation, one-time', [5000, 5000, 5000, 5000], 0],
      ['SDE', [177200, 213400, 224600, 240000], 2],
    ];
  const x0 = 20,
    cw = 150,
    nameW = 300,
    y0 = 128;
  ctx.fillStyle = '#f7f8fa';
  ctx.fillRect(x0, y0, nameW + cw * 4, 34);
  ctx.font = `700 13px ${SANS}`;
  ctx.fillStyle = '#6b707a';
  cols.forEach((c, i) =>
    ctx.fillText(c, x0 + nameW + cw * i + cw - 60, y0 + 22)
  );
  rows.forEach(([name, vals, kind], r) => {
    const y = y0 + 34 + r * 38;
    if (kind === 2) {
      ctx.fillStyle = '#fff1e4';
      ctx.fillRect(x0, y, nameW + cw * 4, 38);
    }
    ctx.fillStyle = '#e6e7eb';
    ctx.fillRect(x0, y + 37, nameW + cw * 4, 1);
    ctx.fillStyle = kind === 2 ? '#b4621d' : '#1d1f24';
    ctx.font = `${kind ? 700 : 400} 15px ${SANS}`;
    ctx.fillText(name, x0 + 12, y + 25);
    vals.forEach((v, i) => {
      const s =
        (v < 0 ? '(' : '') +
        Math.abs(v).toLocaleString('en-US') +
        (v < 0 ? ')' : '');
      ctx.textAlign = 'right';
      ctx.fillText(s, x0 + nameW + cw * (i + 1) - 14, y + 25);
      ctx.textAlign = 'left';
    });
  });
  // Under it: the multiple and the value.
  const y = y0 + 34 + rows.length * 38 + 36;
  ctx.fillStyle = '#1d1f24';
  ctx.font = `600 15px ${SANS}`;
  ctx.fillText('Asking  $850,000', x0 + 12, y);
  ctx.fillText('Multiple of TTM SDE  3.5×', x0 + 220, y);
  ctx.fillStyle = '#2f8f5b';
  ctx.fillText('Revenue +3.2% TTM', x0 + 500, y);
}
