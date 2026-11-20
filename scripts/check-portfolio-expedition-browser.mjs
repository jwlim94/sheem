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
    '/private/tmp/exp-' + name + '.png',
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
await send('Log.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url: 'http://127.0.0.1:5173/portfolio/3' });
await delay(1500);
await ev(`localStorage.removeItem('jongwoo-expedition-v1')`);
await send('Page.reload');
await delay(2500);
await shot('desktop');
await ev(
  `(async()=>{const {_roots}=await import(performance.getEntriesByType('resource').find(r=>r.name.includes('@react-three_fiber.js')).name);window.expStore=[..._roots.values()][0].store})()`
);
const ship = () =>
  ev(
    `expStore.getState().scene.getObjectByName('expedition-ship').position.toArray()`
  );
const start = await ship();
await send('Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'd',
  code: 'KeyD',
});
await delay(450);
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD' });
await delay(300);
assert((await ship())[0] > start[0] + 1, 'Keyboard pilots ship');
for (let i = 0; i < 5; i++) {
  await ev(
    `document.querySelectorAll('.exp-radar-field button')[${i}].click()`
  );
  let arrived = false;
  for (let n = 0; n < 100; n++) {
    if (await ev(`!!document.querySelector('.exp-docking button')`)) {
      const text = await ev(
        `document.querySelector('.exp-docking button').textContent`
      );
      if (
        text.includes(
          [
            'Bridge',
            'BYU Archaeology',
            'Fitzza',
            'Neighbor',
            'BYU Broadcasting',
          ][i]
        )
      ) {
        arrived = true;
        break;
      }
    }
    await delay(100);
  }
  assert(arrived, 'Autopilot arrives at station ' + (i + 1));
  if (i === 0) {
    await shot('docking');
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'e',
      code: 'KeyE',
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'e',
      code: 'KeyE',
    });
  } else await ev(`document.querySelector('.exp-docking button').click()`);
  await delay(150);
  assert(
    await ev(
      `document.querySelector('dialog').open&&document.querySelectorAll('.exp-contribution').length>=2`
    ),
    'Scan opens resume contribution log'
  );
  if (i === 0) {
    await shot('log');
    const before = await ship();
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'w',
      code: 'KeyW',
    });
    await delay(300);
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'w',
      code: 'KeyW',
    });
    assert(
      JSON.stringify(before) === JSON.stringify(await ship()),
      'Flight pauses while reading'
    );
  }
  await ev(`document.querySelector('[aria-label="Close flight log"]').click()`);
  await delay(100);
}
assert(
  await ev(
    `JSON.parse(localStorage.getItem('jongwoo-expedition-v1')).length===5`
  ),
  'Five unique discoveries saved'
);
assert(
  await ev(
    `document.querySelector('.exp-objective').textContent.includes('All logs recovered')`
  ),
  'Mission completion displayed'
);
await send('Page.reload');
await delay(1600);
assert(
  await ev(
    `document.querySelector('.exp-objective').textContent.includes('All logs recovered')`
  ),
  'Progress survives reload'
);
await ev(`document.querySelector('.exp-header nav button').click()`);
await delay(150);
assert(
  await ev(`document.querySelectorAll('.exp-log-list>div').length===5`),
  'Flight log exposes all five experiences'
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
await delay(100);
assert(
  await ev(`!document.querySelector('dialog').open`),
  'Escape closes modal'
);
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await delay(2500);
await shot('mobile');
await ev(`document.querySelector('.exp-header nav button').click()`);
await delay(100);
await ev(`document.querySelector('.exp-log-list button').click()`);
await delay(100);
await shot('mobile-log');
assert(
  await ev(`document.documentElement.scrollWidth===390`),
  'No mobile page overflow'
);
assert(
  await ev(
    `document.querySelector('dialog').scrollHeight>document.querySelector('dialog').clientHeight`
  ),
  'Mobile log scrolls'
);
assert(!errors.length, 'No runtime exceptions');
ws.close();
