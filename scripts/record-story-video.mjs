// Records /portfolio as the video phones are shown instead of the 3D page
// (docs/portfolio-room.md, "Phones"): the desktop page at 1440x900, the
// story played by itself (the chapter rail's Play) from the opening to the
// ending's card, frame by frame on a clock of its own, so each frame is a
// 30th of a second of the story however long it takes to draw. Its sound
// is recorded apart, in real time (record-story-audio.mjs), and added when
// encoding; here the sound is on only so the top bar shows it on.
//
// Requires the built page served (npm run build && npx vite preview --port
// 4173) and a Chrome with remote debugging, e.g.:
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
//     --remote-debugging-port=9231 --user-data-dir=/tmp/sheem-video-chrome \
//     --use-angle=metal --enable-gpu about:blank
// Then:
//   node scripts/record-story-video.mjs /tmp/story-frames
//   node scripts/record-story-audio.mjs /tmp/story.wav
//   swift scripts/encode-frames.swift /tmp/story-frames public/portfolio/story.mp4 30 1.8 /tmp/story.wav
import fs from 'node:fs/promises';
import path from 'node:path';

const cdpOrigin = process.env.PORTFOLIO_CDP_URL ?? 'http://127.0.0.1:9231';
const origin = process.env.PORTFOLIO_ORIGIN ?? 'http://127.0.0.1:4173';
const out = process.argv[2];
if (!out) throw new Error('usage: node scripts/record-story-video.mjs <frames dir>');
const FPS = 30,
  STEP = 1000 / FPS,
  // The opening held before Play, and the ending's card after the story ends.
  OPEN_S = 2.5,
  END_S = 4;
const W = 1440,
  H = 900,
  SCALE = +(process.env.VIDEO_SCALE ?? 1);

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

/** The rail's Play, pressed at its middle with a mouse. */
async function pressPlay(send, evaluate) {
  const { x, y } = await evaluate(
    `(() => { const r = document.querySelector('.room-rail-play').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`
  );
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  // Then off the rail (resting on it opens it), to the middle, where the
  // pointer's parallax is nil.
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 720, y: 450 });
}

// The page's clock: real until the recording starts, then moved on by hand,
// a frame at a time (requestAnimationFrame, performance.now, Date).
const CLOCK = `(() => {
  const realNow = performance.now.bind(performance),
    realRaf = window.requestAnimationFrame.bind(window),
    RealDate = Date;
  let manual = false, t = 0, t0 = 0, d0 = 0, n = 0;
  const queue = new Map();
  performance.now = () => (manual ? t : realNow());
  const dateNow = () => (manual ? d0 + (t - t0) : RealDate.now());
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(dateNow()); }
    static now() { return dateNow(); }
  }
  window.Date = FakeDate;
  window.requestAnimationFrame = (cb) => {
    const k = ++n;
    queue.set(k, cb);
    realRaf(() => {
      if (manual) return;
      const f = queue.get(k);
      if (!f) return;
      queue.delete(k);
      f(realNow());
    });
    return k;
  };
  window.cancelAnimationFrame = (k) => queue.delete(k);
  window.__clock = {
    manual() { t = t0 = realNow(); d0 = RealDate.now(); manual = true; },
    step(ms) {
      t += ms;
      const due = [...queue];
      queue.clear();
      for (const [, cb] of due) cb(t);
    },
  };
})()`;

await send('Page.enable');
await send('Animation.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
await send('Page.navigate', { url: 'about:blank' });
await delay(300);
// The sound on (audio.ts's preference), so the top bar says so.
await evaluate(`localStorage.setItem('portfolio-room-sound', 'on')`).catch(() => {});
await send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK });
await send('Page.navigate', { url: origin + '/portfolio' });
for (let i = 0; i < 1200; i++) {
  if ((await evaluate(`document.querySelector('.room-loader')?.dataset.done ?? ''`).catch(() => '')) === 'true') break;
  await delay(100);
}
// The loader's fade and the scene settling, in real time; then the clock is ours.
await delay(3500);
await evaluate('__clock.manual()');

await fs.mkdir(out, { recursive: true });
let frame = 0,
  realMs = 0;
const shoot = async () => {
  const t = performance.now();
  await evaluate(`__clock.step(${STEP})`);
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
  await fs.writeFile(path.join(out, `${String(frame++).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
  // CSS transitions run on real time: slowed to the recording's pace.
  realMs = realMs ? realMs * 0.9 + (performance.now() - t) * 0.1 : performance.now() - t;
  if (frame % 30 === 0) await send('Animation.setPlaybackRate', { playbackRate: Math.min(1, STEP / realMs) });
};

for (let i = 0; i < OPEN_S * FPS; i++) await shoot();
// Play, pressed as a pointer would (a gesture: the sound starts too).
await pressPlay(send, evaluate);
// Played until the rail says it has ended (or 4 minutes of story).
for (let i = 0; i < 240 * FPS; i++) {
  await shoot();
  const state = await evaluate(`document.querySelector('.room-rail')?.dataset.state`);
  if (i % (10 * FPS) === 0) console.log(`${(frame / FPS).toFixed(0)} s of video, rail ${state}, ${realMs.toFixed(0)} ms a frame`);
  if (state === 'ended') {
    console.log(`the story ended ${((i + 1) / FPS).toFixed(2)} s after Play`);
    break;
  }
}
for (let i = 0; i < END_S * FPS; i++) await shoot();
console.log(`${frame} frames (${(frame / FPS).toFixed(1)} s) in ${out}`);
await send('Animation.setPlaybackRate', { playbackRate: 1 });
await send('Page.navigate', { url: 'about:blank' });
process.exit(0);
