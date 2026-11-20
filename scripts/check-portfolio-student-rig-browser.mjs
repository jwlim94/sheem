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
    '/private/tmp/rigged-' + name + '.png',
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
await send('Page.navigate', { url: 'http://127.0.0.1:5180/portfolio/5' });
await delay(4500);
await ev(
  `(async()=>{const {_roots}=await import(performance.getEntriesByType('resource').find(r=>r.name.includes('@react-three_fiber.js')).name);window.studentStore=[..._roots.values()][0].store})()`
);
const bones = () =>
  ev(
    `(()=>{let b={};studentStore.getState().scene.traverse(o=>{if(o.isBone)b[o.name]=o.matrixWorld.elements.slice()});return b})()`
  );
const initial = await bones();
console.log('BONES', Object.keys(initial));
assert(Object.keys(initial).length === 20, '20-joint humanoid skeleton loaded');
assert(
  await ev(
    `document.querySelector('button[aria-pressed=true]').textContent==='Student'`
  ),
  'Animated student is default'
);
await shot('idle');
await delay(400);
assert(
  JSON.stringify(initial) !== JSON.stringify(await bones()),
  'Idle actually animates bones'
);
for (const motion of ['Walk', 'Wave']) {
  await ev(
    `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='${motion}').click()`
  );
  await delay(motion === 'Walk' ? 500 : 1100);
  await shot(motion.toLowerCase());
  const pose = await bones();
  assert(
    JSON.stringify(initial) !== JSON.stringify(pose),
    motion + ' changes pose'
  );
  assert(
    Object.values(pose).every((a) => a.every(Number.isFinite)),
    motion + ' matrices remain finite'
  );
}
await ev(
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Pause').click()`
);
await delay(100);
const frozen = await bones();
await delay(350);
assert(
  JSON.stringify(frozen) === JSON.stringify(await bones()),
  'Pause freezes pose'
);
await ev(
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Walk').click()`
);
await delay(400);
assert(
  JSON.stringify(frozen) !== JSON.stringify(await bones()),
  'Selecting motion resumes playback'
);
await ev(
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Back').click()`
);
await delay(300);
await shot('back');
await ev(
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Original').click()`
);
await delay(1400);
assert(
  Object.keys(await bones()).length === 0,
  'Original reference remains static'
);
await ev(
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Student').click()`
);
await delay(600);
assert(
  Object.keys(await bones()).length === 20,
  'Rig remounts after comparison'
);
await ev(
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Idle').click()`
);
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await ev(
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Portrait').click()`
);
await delay(400);
await shot('mobile');
assert(errors.length === 0, 'No runtime exceptions');
ws.close();
