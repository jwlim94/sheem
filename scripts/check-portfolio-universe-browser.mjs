// Requires Vite on 5173 and a dedicated Chrome CDP instance on 9227.
import fs from 'node:fs/promises';
const tab = (await (await fetch('http://127.0.0.1:9227/json')).json()).find(
  (t) => t.type === 'page'
);
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(m.error) : p.resolve(m.result);
  } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params);
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) =>
  fs.writeFile(
    '/private/tmp/space-' + name + '.png',
    Buffer.from(
      (await send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url: 'http://127.0.0.1:5173/portfolio/2' });
await delay(5000);
const assert = (ok, message) => {
  if (!ok) throw Error(message);
  console.log('PASS', message);
};
await ev(
  `(async()=>{const {_roots}=await import(performance.getEntriesByType('resource').find(r=>r.name.includes('@react-three_fiber.js')).name);window.spaceStore=[..._roots.values()][0].store})()`
);
const before = await ev('spaceStore.getState().camera.position.toArray()');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1300, y: 200 });
await send('Input.dispatchMouseEvent', {
  type: 'mouseWheel',
  x: 1300,
  y: 200,
  deltaX: 0,
  deltaY: 500,
});
await delay(2000);
const after = await ev('spaceStore.getState().camera.position.toArray()');
assert(
  Math.abs(after[2] - before[2]) > 1 && Math.abs(after[0] - before[0]) > 0.5,
  'Mouse parallax and wheel camera movement'
);
for (let i = 0; i < 5; i++) {
  await ev(`document.querySelectorAll('.experience-nav button')[${i}].click()`);
  await delay(150);
  assert(
    await ev(
      `document.querySelectorAll('.experience-nav button')[${i}].getAttribute('aria-pressed')==='true'`
    ),
    'Chapter ' + (i + 1) + ' selection'
  );
  assert(
    await ev(
      `document.querySelectorAll('.experience-contributions p').length>=2`
    ),
    'Chapter contributions'
  );
}
await send('Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'ArrowRight',
  code: 'ArrowRight',
});
await delay(100);
assert(
  await ev(
    `document.querySelector('.universe-panel h2').textContent==='Bridge'`
  ),
  'Arrow keyboard chapter navigation'
);
await send('Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'Escape',
  code: 'Escape',
});
await delay(100);
assert(
  await ev(`!document.querySelector('.universe-panel')`),
  'Escape closes chapter'
);
await ev(`document.querySelector('.universe-header nav button').click()`);
await delay(200);
assert(
  await ev(
    `document.querySelector('.contact-links a').href==='mailto:limjongwoo1994@gmail.com'`
  ),
  'Contact panel'
);
assert(
  await ev(
    `fetch('/portfolio/jongwoo-lim-resume.pdf').then(r=>r.ok&&r.headers.get('content-type').includes('pdf'))`
  ),
  'Resume PDF accessible'
);
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await ev(`document.querySelector('.universe-back').click()`);
await delay(2000);
await shot('mobile');
assert(
  await ev('document.documentElement.scrollWidth===390'),
  'Mobile no page overflow'
);
await ev(`document.querySelector('.experience-nav button').click()`);
await delay(2000);
await shot('mobile-chapter');
assert(
  await ev(
    `document.querySelector('.universe-panel').scrollHeight>document.querySelector('.universe-panel').clientHeight`
  ),
  'Mobile experience scroll container'
);
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});
await ev(`document.querySelector('.universe-back').click()`);
await delay(200);
const still = await ev('spaceStore.getState().camera.position.toArray()');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 300, y: 200 });
await delay(300);
assert(
  JSON.stringify(still) ===
    JSON.stringify(await ev('spaceStore.getState().camera.position.toArray()')),
  'Reduced motion ignores pointer drift'
);
assert(!errors.length, 'No runtime exceptions');
ws.close();
