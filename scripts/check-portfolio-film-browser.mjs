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
    '/private/tmp/film-' + name + '.png',
    Buffer.from(
      (await send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );

const assert = (v, m) => {
  if (!v) throw Error(m);
  console.log('PASS', m);
};
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url: 'http://127.0.0.1:5173/portfolio/4' });
await delay(2200);
await ev(
  `(async()=>{const {_roots}=await import(performance.getEntriesByType('resource').find(r=>r.name.includes('@react-three_fiber.js')).name);window.filmStore=[..._roots.values()][0].store})()`
);
const camera = () => ev('filmStore.getState().camera.position.toArray()');
const start = await camera();
for (let i = 0; i < 7; i++) {
  await ev(`document.querySelector('.film-scroll').scrollTo(0,${i}*1500)`);
  await delay(800);
  assert(
    await ev(
      `document.querySelectorAll('.film-index button')[${i}].getAttribute('aria-current')==='step'`
    ),
    'Chapter ' + i + ' is active'
  );
  if (i === 0 || i === 4 || i === 5) await shot('final-' + i);
  if (i > 0 && i < 6) {
    await ev(
      `document.querySelectorAll('.film-section')[${i}].querySelector('.film-read').click()`
    );
    await delay(100);
    assert(
      await ev(
        `document.querySelector('dialog').open&&document.querySelectorAll('.film-contribution').length>=2`
      ),
      'Resume details available'
    );
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Escape',
      code: 'Escape',
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Escape',
      code: 'Escape',
    });
    await delay(80);
    assert(
      await ev(`!document.querySelector('dialog').open`),
      'Escape restores story'
    );
  }
}
assert(
  (await camera())[2] < start[2] - 240,
  'Camera travels through the career'
);
await ev(`document.querySelector('.film-scroll').scrollTo(0,0)`);
await delay(1200);
assert(
  Math.abs((await camera())[2] - start[2]) < 0.1,
  'Reverse scroll returns camera to start'
);
await send('Input.dispatchMouseEvent', {
  type: 'mouseWheel',
  x: 900,
  y: 650,
  deltaY: 750,
  deltaX: 0,
});
await delay(500);
assert(
  await ev(`document.querySelector('.film-scroll').scrollTop>600`),
  'Native wheel scrolling'
);
await ev(`document.querySelector('[aria-label="Go to Bridge"]').click()`);
await delay(1600);
assert(
  await ev(
    `document.querySelector('[aria-label="Go to Bridge"]').getAttribute('aria-current')==='step'`
  ),
  'Chapter navigation jumps to Bridge'
);
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await ev(`document.querySelector('.film-scroll').scrollTo(0,0)`);
await delay(700);
await shot('mobile-intro');
assert(
  await ev('document.documentElement.scrollWidth===390'),
  'Mobile no horizontal overflow'
);
await ev(`document.querySelector('.film-scroll').scrollTo(0,1266)`);
await delay(600);
await shot('mobile-chapter');
await ev(`document.querySelector('.film-section-5 .film-read').click()`);
await delay(120);
await shot('mobile-details');
assert(
  await ev(
    `document.querySelector('dialog').scrollHeight>document.querySelector('dialog').clientHeight`
  ),
  'Mobile detailed resume scrolls'
);
await ev(
  `document.querySelector('[aria-label="Close chapter details"]').click()`
);
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});
await delay(200);
await ev(`document.querySelector('[aria-label="Go to Neighbor"]').click()`);
await delay(250);
assert(
  Math.abs((await camera())[2] - (22 - 84)) < 0.1,
  'Reduced motion uses immediate chapter cuts'
);
assert(!errors.length, 'No runtime exceptions');
ws.close();
