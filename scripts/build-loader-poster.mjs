// The loading screen's backdrop for /portfolio (docs/portfolio-room.md,
// "Loading"): the room's opening view with no page UI, as small WebP
// thumbnails that the loader blurs and brings into focus. Two shapes, wide
// (1440x900) and tall (390x844, phones), each in two sizes: tiny (inlined in
// the page's CSS, under 1 KB) and mid (the focus pull's sharper stage).
// Run again whenever the opening view changes.
// Requires the Vite dev server and a Chrome with remote debugging, e.g.:
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
//     --remote-debugging-port=9231 --user-data-dir=/tmp/sheem-poster-chrome \
//     --use-angle=metal --enable-gpu about:blank
// Then: node scripts/build-loader-poster.mjs
// Writes src/portfolio/room/poster/{wide,tall}-{tiny,mid}.webp.
import fs from 'node:fs/promises';
import path from 'node:path';

const cdpOrigin = process.env.PORTFOLIO_CDP_URL ?? 'http://127.0.0.1:9231';
const origin = process.env.PORTFOLIO_ORIGIN ?? 'http://127.0.0.1:5173';
const out = path.resolve(import.meta.dirname, '../src/portfolio/room/poster');

const SHAPES = [
  { name: 'wide', w: 1440, h: 900, mobile: false, sizes: { tiny: [64, 40], mid: [480, 300] } },
  { name: 'tall', w: 390, h: 844, mobile: true, sizes: { tiny: [32, 70], mid: [240, 520] } },
];
// Everything the page puts over the scene.
const UI = ['.room-header', '.room-rail', '.room-rail-shade', '.room-caption', '.room-hint', '.room-hold', '.room-credit', '.room-loader'];

const tab = (await (await fetch(cdpOrigin + '/json')).json()).find((t) => t.type === 'page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
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
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 600));
  return result.result.value;
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await send('Page.enable');

await fs.mkdir(out, { recursive: true });
for (const s of SHAPES) {
  await send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: 1, mobile: s.mobile });
  await send('Page.navigate', { url: origin + '/portfolio' });
  for (let i = 0; i < 1200; i++) {
    if ((await evaluate(`document.querySelector('.room-loader')?.dataset.done ?? ''`).catch(() => '')) === 'true') break;
    await delay(50);
  }
  // The loader's fade, and the scene settling.
  await delay(3500);
  await evaluate(`for (const s of ${JSON.stringify(UI)}) document.querySelectorAll(s).forEach((e) => (e.style.visibility = 'hidden'))`);
  await delay(300);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  // Scaled down in the page, halving at a time (one big step aliases).
  const webps = await evaluate(`(async () => {
    const img = new Image();
    img.src = 'data:image/png;base64,${data}';
    await img.decode();
    return Object.fromEntries(Object.entries(${JSON.stringify(s.sizes)}).map(([k, [w, h]]) => {
      let src = img, sw = img.width, sh = img.height;
      while (sw / 2 >= w) {
        const c = document.createElement('canvas');
        c.width = Math.round(sw / 2); c.height = Math.round(sh / 2);
        const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height);
        src = c; sw = c.width; sh = c.height;
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
      return [k, c.toDataURL('image/webp', 0.7).split(',')[1]];
    }));
  })()`);
  for (const [k, b64] of Object.entries(webps)) {
    const file = path.join(out, `${s.name}-${k}.webp`);
    await fs.writeFile(file, Buffer.from(b64, 'base64'));
    console.log(path.relative(process.cwd(), file), Buffer.from(b64, 'base64').length, 'bytes');
  }
}
await send('Emulation.clearDeviceMetricsOverride');
await send('Page.navigate', { url: 'about:blank' });
process.exit(0);
