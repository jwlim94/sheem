// Samples how light /portfolio/7 is behind its top bar along the whole story,
// for the bar's text to turn ink-dark where it is light
// (src/portfolio/room/barLight.ts, which this writes); and behind the
// chapter rail down the left (ChapterRail.tsx), closed. Regenerate whenever
// the scenes, the camera's paths, the bar or the rail change.
// The bar has no box (the user's pick, 2026-11-22). Reading the canvas back
// live stalled Chrome (getBufferSubData waited up to 0.85 s on the GPU
// process), so the light is sampled once, here, off the story itself: the
// camera, the scenes and the white washes all follow the scroll.
// Requires the Vite dev server and a dedicated Chrome on the GPU:
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
//     --remote-debugging-port=9232 --user-data-dir=/tmp/sheem-shot-chrome \
//     --use-angle=metal --enable-gpu about:blank
// Then: node scripts/build-bar-light.mjs   (about 15 minutes)
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const cdpOrigin = process.env.PORTFOLIO_CDP_URL ?? 'http://127.0.0.1:9232';
const origin = process.env.PORTFOLIO_ORIGIN ?? 'http://127.0.0.1:5173';
/** Samples along the story (page progress 0..1), each end of the bar. */
const N = +(process.env.BAR_SAMPLES ?? 240);
/** A wide screen and a phone (barLight picks by the window's shape). */
const LAYOUTS = { wide: [1440, 900, false], tall: [390, 844, true] };

const tab = (await (await fetch(cdpOrigin + '/json')).json()).find(
  (t) => t.type === 'page'
);
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve) =>
  ws.addEventListener('open', resolve, { once: true })
);
let id = 0;
const pending = new Map();
ws.addEventListener('message', ({ data }) => {
  const msg = JSON.parse(data);
  if (!msg.id) return;
  const handler = pending.get(msg.id);
  pending.delete(msg.id);
  msg.error ? handler.reject(msg.error) : handler.resolve(msg.result);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const key = ++id;
    pending.set(key, { resolve, reject });
    ws.send(JSON.stringify({ id: key, method, params }));
  });
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 600));
  return result.result.value;
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await send('Runtime.enable');
await send('Page.enable');

const out = {};
for (const [name, [w, h, mobile]] of Object.entries(LAYOUTS)) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: w,
    height: h,
    deviceScaleFactor: 1,
    mobile,
  });
  await send('Page.navigate', { url: origin + '/portfolio/7' });
  for (let i = 0; i < 1200; i++) {
    if (
      (await evaluate(
        `document.querySelector('.room-loader')?.dataset.done ?? ''`
      ).catch(() => '')) === 'true'
    )
      break;
    await delay(50);
  }
  await delay(1500);
  // Each end's region (a little round its text), and the rail's (its play
  // button and list), then the bar and the rail hidden: what is behind them.
  const [ends, railBox] = await evaluate(`(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return [r.left - 8, r.top - 6, r.width + 16, r.height + 12].map(Math.round); };
    const b = [box(document.querySelector('.room-brand')), box(document.querySelector('.room-header nav'))];
    const play = document.querySelector('.room-rail-play').getBoundingClientRect(), list = document.querySelector('.room-rail-list').getBoundingClientRect();
    const x0 = Math.max(0, Math.min(play.left, list.left) - 8), y0 = play.top - 8;
    const rail = [x0, y0, Math.max(play.right, list.right) + 8 - x0, list.bottom + 8 - y0].map(Math.round);
    document.querySelector('.room-header').style.visibility = 'hidden';
    document.querySelector('.room-rail').style.visibility = 'hidden';
    return [b, rail];
  })()`);
  const band = Math.max(...ends.map((r) => r[1] + r[3])) + 2;
  const left = [],
    right = [],
    rail = [];
  // From the end back to the start: the scroll's brakes (story.ts HOLDS)
  // stop it going forward past each in small steps, as a viewer's scroll,
  // but not going back (the first, a jump to the end, passes them all).
  // (Sampled forward, each hold held the next 300dvh's samples on it.)
  for (let i = N; i >= 0; i--) {
    await evaluate(
      `(() => { const e = document.querySelector('.room-scroll'); e.scrollTop = ${i / N} * (e.scrollHeight - e.clientHeight); })()`
    );
    // The page eases toward the scroll; sampled once it has settled.
    await delay(i === N ? 2500 : 1100);
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: w, height: band, scale: 1 },
    });
    const [rx, ry, rw, rh] = railBox;
    const railShot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: rx, y: ry, width: rw, height: rh, scale: 1 },
    });
    // Decoded in the page (no image library here): the mean relative
    // luminance of each end's region, and of the rail's.
    const [l, r, m] = await evaluate(`(async () => {
      const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      // The mean, or (q) the q-th quantile: how light its darker parts are.
      const light = async (data, boxes, q) => {
        const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + data)).blob());
        const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        return boxes.map(([x, y, w, h]) => {
          const d = g.getImageData(Math.max(0, x), Math.max(0, y), w, h).data, v = [];
          for (let i = 0; i < d.length; i += 8) v.push(0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]));
          if (q === undefined) return v.reduce((a, b) => a + b, 0) / v.length;
          v.sort((a, b) => a - b);
          return v[Math.floor(q * (v.length - 1))];
        });
      };
      return [
        ...(await light('${shot.data}', ${JSON.stringify(ends)})),
        // The rail: its 20th percentile. Ink-dark text is lost on any dark
        // part (the cream, with its shadow, holds up on mixed ground), so
        // it goes ink only where the rail is light nearly all over.
        ...(await light('${railShot.data}', [[0, 0, ${rw}, ${rh}]], 0.2)),
      ];
    })()`);
    left[i] = Math.round(l * 255);
    right[i] = Math.round(r * 255);
    rail[i] = Math.round(m * 255);
    if (i % 20 === 0)
      console.log(
        name,
        (i / N).toFixed(2),
        l.toFixed(2),
        r.toFixed(2),
        m.toFixed(2)
      );
  }
  out[name] = { left, right, rail };
}

const rows = (a) => a.join(',');
await writeFile(
  new URL('../src/portfolio/room/barLight.ts', import.meta.url),
  `// Generated by scripts/build-bar-light.mjs (${new Date().toISOString().slice(0, 10)}): do not edit.
// How light /portfolio/7 is behind its top bar's two ends (the name, the
// links), mean relative luminance x 255, and behind the chapter rail, its
// 20th percentile (how light its darker parts are), along the story at
// ${N + 1} even steps of the page's progress, on a wide screen and on a phone.
const N = ${N};
const LIGHT = {
  wide: {
    left: [${rows(out.wide.left)}],
    right: [${rows(out.wide.right)}],
    rail: [${rows(out.wide.rail)}],
  },
  tall: {
    left: [${rows(out.tall.left)}],
    right: [${rows(out.tall.right)}],
    rail: [${rows(out.tall.rail)}],
  },
};

/** How light it is behind each end of the top bar and behind the chapter
 *  rail (0..1) at the page's progress \`page\` (0..1); \`tall\`, a
 *  portrait window. */
export function barLight(page: number, tall: boolean) {
  const t = tall ? LIGHT.tall : LIGHT.wide,
    f = Math.min(N, Math.max(0, page * N)),
    i = Math.min(N - 1, Math.floor(f)),
    k = f - i,
    at = (a: number[]) => (a[i] + (a[i + 1] - a[i]) * k) / 255;
  return { left: at(t.left), right: at(t.right), rail: at(t.rail) };
}
`
);
execFileSync('npx', ['prettier', '--write', 'src/portfolio/room/barLight.ts'], {
  cwd: new URL('..', import.meta.url),
});
console.log('wrote src/portfolio/room/barLight.ts');
ws.close();
