// Samples how light /portfolio/7 is behind its top bar along the whole story,
// for the bar's text to turn ink-dark where it is light
// (src/portfolio/room/barLight.ts, which this writes). Regenerate whenever
// the scenes, the camera's paths or the bar change.
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
  // Each end's region (a little round its text), then the bar hidden: what
  // is behind it.
  const ends = await evaluate(`(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return [r.left - 8, r.top - 6, r.width + 16, r.height + 12].map(Math.round); };
    const b = [box(document.querySelector('.room-brand')), box(document.querySelector('.room-header nav'))];
    document.querySelector('.room-header').style.visibility = 'hidden';
    return b;
  })()`);
  const band = Math.max(...ends.map((r) => r[1] + r[3])) + 2;
  const left = [],
    right = [];
  for (let i = 0; i <= N; i++) {
    await evaluate(
      `(() => { const e = document.querySelector('.room-scroll'); e.scrollTop = ${i / N} * (e.scrollHeight - e.clientHeight); })()`
    );
    // The page eases toward the scroll; sampled once it has settled.
    await delay(i === 0 ? 2500 : 1100);
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: w, height: band, scale: 1 },
    });
    // Decoded in the page (no image library here): the mean relative
    // luminance of each end's region.
    const [l, r] = await evaluate(`(async () => {
      const img = await createImageBitmap(await (await fetch('data:image/png;base64,${shot.data}')).blob());
      const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return ${JSON.stringify(ends)}.map(([x, y, w, h]) => {
        const d = g.getImageData(Math.max(0, x), Math.max(0, y), w, h).data;
        let s = 0, n = 0;
        for (let i = 0; i < d.length; i += 8) { s += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); n++; }
        return s / n;
      });
    })()`);
    left.push(Math.round(l * 255));
    right.push(Math.round(r * 255));
    if (i % 20 === 0)
      console.log(name, (i / N).toFixed(2), l.toFixed(2), r.toFixed(2));
  }
  out[name] = { left, right };
}

const rows = (a) => a.join(',');
await writeFile(
  new URL('../src/portfolio/room/barLight.ts', import.meta.url),
  `// Generated by scripts/build-bar-light.mjs (${new Date().toISOString().slice(0, 10)}): do not edit.
// How light /portfolio/7 is behind its top bar's two ends (the name, the
// links) along the story: relative luminance x 255, at ${N + 1} even steps of
// the page's progress, on a wide screen and on a phone.
const N = ${N};
const LIGHT = {
  wide: {
    left: [${rows(out.wide.left)}],
    right: [${rows(out.wide.right)}],
  },
  tall: {
    left: [${rows(out.tall.left)}],
    right: [${rows(out.tall.right)}],
  },
};

/** How light it is behind each end of the top bar (0..1) at the page's
 *  progress \`page\` (0..1); \`tall\`, a portrait window. */
export function barLight(page: number, tall: boolean) {
  const t = tall ? LIGHT.tall : LIGHT.wide,
    f = Math.min(N, Math.max(0, page * N)),
    i = Math.min(N - 1, Math.floor(f)),
    k = f - i,
    at = (a: number[]) => (a[i] + (a[i + 1] - a[i]) * k) / 255;
  return { left: at(t.left), right: at(t.right) };
}
`
);
execFileSync('npx', ['prettier', '--write', 'src/portfolio/room/barLight.ts'], {
  cwd: new URL('..', import.meta.url),
});
console.log('wrote src/portfolio/room/barLight.ts');
ws.close();
