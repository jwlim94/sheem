// /portfolio/7 frame-rate audit (docs/portfolio-room.md, "Performance").
// Requires the Vite dev server and a dedicated Chrome on the GPU, without
// vsync or a frame cap (so frame rates show the headroom past 60 fps):
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
//     --remote-debugging-port=9231 --user-data-dir=/tmp/sheem-perf-chrome \
//     --use-angle=metal --enable-gpu --disable-gpu-vsync --disable-frame-rate-limit \
//     --autoplay-policy=no-user-gesture-required about:blank
// Then: node scripts/check-portfolio-room-perf.mjs
// 1. A first visit (cache cleared): when the loader lifts (after the scene's
//    warm-up), then a steady scroll through the whole story at once: frames
//    over 50 and 100 ms, with where; shader programs created on the way
//    (fails on any: the warm-up compiles them all behind the loader).
//    And what the scene draws less of (stage 3, 2026-11-20): his parts at
//    their simplified level (heroLod.ts), the bookcase's meshes merged, one
//    copy of the backpack's cloth textures (fails without the first or the
//    last).
// 2. Shadow maps: at spots through the story, which maps the scene redraws,
//    and how its picture differs from the one with both maps on (fails over
//    0.5 % of pixels).
// 3. The same scroll again, warm: frames per second per section, frames
//    over 18 and 34 ms, the worst.
// Frame times depend on the machine and on what else uses its GPU (another
// app's work showed as 0.2-0.3 s stalls inside WebGL calls); programs don't.
const cdpOrigin = process.env.PORTFOLIO_CDP_URL ?? 'http://127.0.0.1:9231';
const origin = process.env.PORTFOLIO_ORIGIN ?? 'http://127.0.0.1:5173';
const dpr = +(process.env.PORTFOLIO_DPR ?? 2);
const seconds = +(process.env.PORTFOLIO_SCROLL_SECONDS ?? 60);

const tab = (await (await fetch(cdpOrigin + '/json')).json()).find((t) => t.type === 'page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map(),
  errors = [];
ws.addEventListener('message', ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id) {
    const handler = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? handler.reject(msg.error) : handler.resolve(msg.result);
  } else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
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
await send('Runtime.enable');
await send('Page.enable');

// The story's sections (story.ts SEG, in dvh) and a spot inside one.
const SEG = { room: 400, rewind: 280, school: 360, mail: 240, office: 520, desk: 380, grad: 460, mism: 520, fly: 560, bridge: 520 };
const TOTAL = Object.values(SEG).reduce((a, b) => a + b, 0);
const startOf = (k) => Object.keys(SEG).slice(0, Object.keys(SEG).indexOf(k)).reduce((a, b) => a + SEG[b], 0);
const at = (k, p) => (startOf(k) + SEG[k] * p) / TOTAL;
const go = async (page, wait) => {
  await evaluate(`(()=>{const e=document.querySelector('.room-scroll');e.scrollTop=${page}*(e.scrollHeight-e.clientHeight)})()`);
  await delay(wait);
};

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: dpr, mobile: false });
await send('Network.enable');
await send('Network.clearBrowserCache');
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.programsMade=0;const P=WebGL2RenderingContext.prototype,cp=P.createProgram;P.createProgram=function(){programsMade++;return cp.apply(this,arguments)}`,
});
const t0 = Date.now();
await send('Page.navigate', { url: origin + '/portfolio/7' });
for (let i = 0; i < 1200; i++) {
  if ((await evaluate(`document.querySelector('.room-loader')?.dataset.done ?? ''`).catch(() => '')) === 'true') break;
  await delay(50);
}
const loadedMs = Date.now() - t0;
await delay(1200);
for (const type of ['mousePressed', 'mouseReleased'])
  await send('Input.dispatchMouseEvent', { type, x: 5, y: 450, button: 'left', clickCount: 1 });
const scrollThrough = () =>
  evaluate(`new Promise(res=>{const made=programsMade,e=document.querySelector('.room-scroll'),max=e.scrollHeight-e.clientHeight,dur=${seconds}*1000;
  const f=[];let start=null,last=null;const tick=now=>{if(start===null){start=now;last=now}const p=Math.min(1,(now-start)/dur);e.scrollTop=p*max;f.push([now-last,p]);last=now;if(p<1)requestAnimationFrame(tick);else res({f:f.slice(1),programs:programsMade-made})};requestAnimationFrame(tick)})`);
const where = (p) => {
  let d = p * TOTAL;
  for (const k of Object.keys(SEG)) {
    if (d <= SEG[k]) return `${k} ${(d / SEG[k]).toFixed(2)}`;
    d -= SEG[k];
  }
  return 'end';
};
let failed = false;
console.log(`1. First visit: the loader lifted after ${loadedMs} ms, ${await evaluate('programsMade')} programs compiled behind it`);
const cold = await scrollThrough();
const slow = cold.f.filter(([d]) => d > 50);
console.log(`  scroll through in ${seconds} s: ${slow.filter(([d]) => d > 100).length} frames over 100 ms, ${slow.length} over 50 ms${slow.length ? ': ' + slow.map(([d, p]) => `${Math.round(d)}@${where(p)}`).join(', ') : ''}`);
console.log(`  shader programs created on the way: ${cold.programs}`);
if (cold.programs > 0) failed = true;
await evaluate(`(async()=>{const {_roots}=await import(performance.getEntriesByType('resource').find(r=>r.name.includes('@react-three_fiber.js')).name);window.portfolioStore=[..._roots.values()][0].store})()`);
const lean = await evaluate(`(()=>{const hero=[],fabric=new Set();let shelf=0;
  portfolioStore.getState().scene.traverse(o=>{if(o.geometry?.userData.heroLod)hero.push(o.name+' '+o.geometry.index.count/3);if(o.name==='Bookcase')shelf=o.children.length;
    const m=o.material;if(m&&!Array.isArray(m)&&m.name==='Backpack fabric'&&m.map)fabric.add(m.map.uuid)});
  return {hero,shelf,fabric:fabric.size}})()`);
console.log(`  his parts simplified (triangles): ${lean.hero.join(', ') || 'none'}; bookcase meshes: ${lean.shelf}; copies of the backpack's cloth: ${lean.fabric}`);
if (!lean.hero.length || lean.fabric > 1) failed = true;

await evaluate(`(()=>{
  const st=portfolioStore.getState(),r=st.gl,g=r.getContext();let lamp,sun;
  st.scene.traverse(l=>{if(l.isPointLight&&l.castShadow)lamp=l;if(l.isDirectionalLight&&l.castShadow)sun=l});
  const grab=()=>{r.render(st.scene,st.camera);const w=g.drawingBufferWidth,h=g.drawingBufferHeight,px=new Uint8Array(w*h*4);g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,px);return px};
  // One task: no frame runs between the two pictures.
  window.shadowAudit=()=>{
    const state={lamp:lamp.shadow.autoUpdate,sun:sun.shadow.autoUpdate};
    const app=grab(),saved=[lamp,sun].map(l=>[l.shadow.autoUpdate,l.shadow.intensity]);
    for(const l of [lamp,sun]){l.shadow.autoUpdate=true;l.shadow.intensity=1}
    const both=grab();[lamp,sun].forEach((l,i)=>{l.shadow.autoUpdate=saved[i][0];l.shadow.intensity=saved[i][1]});
    let n=0;const N=app.length/4;for(let i=0;i<N;i++)if((Math.abs(app[i*4]-both[i*4])+Math.abs(app[i*4+1]-both[i*4+1])+Math.abs(app[i*4+2]-both[i*4+2]))/3>6)n++;
    return {...state,changed:+(100*n/N).toFixed(2)}};
})()`);

console.log('2. Shadow maps redrawn, and the picture against both maps on');
const spots = 'room:0.3,rewind:0.7,school:0.3,school:0.85,mail:0.8,office:0.5,desk:0.2,desk:0.8,mism:0.3,mism:0.8,bridge:0.3,bridge:0.7,office:0.5,room:0.3';
for (const [k, p] of spots.split(',').map((s) => s.split(':'))) {
  await go(at(k, +p), 3000);
  const r = await evaluate('shadowAudit()');
  if (r.changed > 0.5) failed = true;
  console.log(`  ${(k + ' ' + p).padEnd(12)} lamp ${r.lamp ? 'on ' : 'off'}  sun ${r.sun ? 'on ' : 'off'}  ${r.changed} % of pixels differ`);
}

console.log(`3. Scroll through the story in ${seconds} s, warm`);
await go(0, 2500);
const frames = await scrollThrough();
for (const k of Object.keys(SEG)) {
  const a = startOf(k) / TOTAL,
    b = (startOf(k) + SEG[k]) / TOTAL;
  const s = frames.f.filter(([, p]) => p >= a && p < b).map(([d]) => d);
  const fps = (s.length / ((seconds * SEG[k]) / TOTAL)).toFixed(0);
  const over = (ms) => s.filter((d) => d > ms).length;
  console.log(`  ${k.padEnd(7)} ${fps.padStart(4)} fps  over 18 ms: ${over(18)}  over 34 ms: ${over(34)}  worst ${Math.round(Math.max(...s))} ms`);
}
console.log(`  shader programs created on the way: ${frames.programs}`);
if (frames.programs > 0) failed = true;
console.log('errors', errors);
ws.close();
if (failed || errors.length) throw new Error('Room performance audit failed');
