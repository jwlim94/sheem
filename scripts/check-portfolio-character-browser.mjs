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
    '/private/tmp/happy-' + name + '.png',
    Buffer.from(
      (await send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );

const assert = (ok, msg) => {
  if (!ok) throw Error(msg);
  console.log('PASS', msg);
};
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', {
  url: 'http://127.0.0.1:5180/portfolio/5',
});
await delay(3500);
await ev(
  `(async()=>{const {_roots}=await import(performance.getEntriesByType('resource').find(r=>r.name.includes('@react-three_fiber.js')).name);window.studentStore=[..._roots.values()][0].store})()`
);
const info = () =>
  ev(
    `(()=>{let m=[];studentStore.getState().scene.traverse(o=>{if(o.isMesh)m.push({name:o.name,vertices:o.geometry.attributes.position.count,color:!!o.geometry.attributes.color,texture:!!o.material.map})});return m})()`
  );
await ev(
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Refined').click()`
);
await delay(1400);
let refined = await info();
console.log(refined);
assert(
  refined.some((m) => m.name.includes('Small_ivory')),
  'Refined model and badge loaded'
);
assert(
  refined.filter((m) => m.texture && m.name.startsWith('texture_pbr'))
    .length === 2,
  'Both original PBR meshes retained'
);
await shot('refined');
const before = await ev('studentStore.getState().camera.position.toArray()');
await ev(
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Original').click()`
);
await delay(1500);
let original = await info();
assert(
  !original.some((m) => m.name.includes('Small_ivory')),
  'Original comparison has no badge'
);
assert(
  JSON.stringify(before) ===
    JSON.stringify(
      await ev('studentStore.getState().camera.position.toArray()')
    ),
  'Comparison keeps camera'
);
await shot('original');
await ev(
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Refined').click()`
);
await ev(
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Back').click()`
);
await delay(500);
await shot('back');
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await ev(
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Portrait').click()`
);
await delay(500);
await shot('mobile');
assert(errors.length === 0, 'No runtime exceptions');
console.log('Browser review completed');
ws.close();
