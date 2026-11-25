// Records the sound of /portfolio's story for the phone video (see
// record-story-video.mjs): the page played by itself in real time, as a
// visitor would hear it, from Play to the ending's card, into a WAV file.
// Everything the page plays goes through its one AudioContext (the songs
// too, through media element sources), so a tap between that context's
// output and the speakers hears all of it.
//
// The video's frames are drawn on a clock of their own, a 30th of a second
// each; this runs on the real one, so the two only line up as long as the
// page keeps its frame rate here (it reports how long the story took, to
// compare with the video's). The WAV starts with the video's opening (2.5 s
// of silence before Play).
//
// Requires the built page served and a Chrome with remote debugging that
// may play sound without a gesture (as in record-story-video.mjs, plus
// --autoplay-policy=no-user-gesture-required). Then:
//   node scripts/record-story-audio.mjs /tmp/story.wav
import fs from 'node:fs/promises';

const cdpOrigin = process.env.PORTFOLIO_CDP_URL ?? 'http://127.0.0.1:9231';
const origin = process.env.PORTFOLIO_ORIGIN ?? 'http://127.0.0.1:4173';
const out = process.argv[2];
if (!out) throw new Error('usage: node scripts/record-story-audio.mjs <out.wav>');
// As in the video: the opening before Play, and the ending's card after.
const OPEN_S = 2.5,
  END_S = 4;

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

// The tap: the page's AudioContext, its destination swapped for a bus that
// goes on to the speakers and, through a script processor, into memory.
const TAP = `(() => {
  const Real = window.AudioContext,
    destination = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'destination').get;
  window.__tap = { left: [], right: [], rate: 0, first: -1 };
  window.AudioContext = class extends Real {
    constructor(...a) {
      super(...a);
      const speakers = destination.call(this),
        bus = this.createGain(),
        tap = this.createScriptProcessor(1024, 2, 2);
      bus.connect(speakers);
      bus.connect(tap);
      tap.connect(speakers); // (silent: it writes nothing out)
      tap.onaudioprocess = (e) => {
        if (__tap.first < 0) __tap.first = e.playbackTime;
        __tap.left.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        __tap.right.push(new Float32Array(e.inputBuffer.getChannelData(1)));
      };
      Object.defineProperty(this, 'destination', { get: () => bus });
      __tap.rate = this.sampleRate;
      __tap.tapNode = tap;
    }
  };
})()`;

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'about:blank' });
await delay(300);
await evaluate(`localStorage.setItem('portfolio-room-sound', 'on')`).catch(() => {});
await send('Page.addScriptToEvaluateOnNewDocument', { source: TAP });
await send('Page.navigate', { url: origin + '/portfolio' });
for (let i = 0; i < 1200; i++) {
  if ((await evaluate(`document.querySelector('.room-loader')?.dataset.done ?? ''`).catch(() => '')) === 'true') break;
  await delay(100);
}
await delay(3500);
// Play, pressed with a mouse (the gesture that starts the sound).
const { x, y } = await evaluate(
  `(() => { const r = document.querySelector('.room-rail-play').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`
);
const pressed = performance.now();
for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
  await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
// Then off the rail (resting on it opens it), to the middle.
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 720, y: 450 });
for (let i = 0; i < 2400; i++) {
  await delay(100);
  if ((await evaluate(`document.querySelector('.room-rail')?.dataset.state`)) === 'ended') break;
}
console.log(`the story ended ${((performance.now() - pressed) / 1000).toFixed(2)} s after Play`);
await delay(END_S * 1000);

// Out as 16-bit PCM, after the opening's silence (less the time the context
// took to start after Play), raised so its loudest moment is just under
// full scale (the page is mixed to be heard beside other sounds; a video
// plays alone), in pieces.
const info = await evaluate(`(() => {
  __tap.tapNode.onaudioprocess = null;
  const n = __tap.left.reduce((s, b) => s + b.length, 0), rate = __tap.rate,
    lead = Math.max(0, Math.round((${OPEN_S} + Math.max(0, __tap.first)) * rate)),
    pcm = new Int16Array((lead + n) * 2);
  let top = 0;
  for (const b of [...__tap.left, ...__tap.right]) for (let i = 0; i < b.length; i++) top = Math.max(top, Math.abs(b[i]));
  const gain = top > 0 ? 0.89 / top : 1;
  let k = lead * 2;
  for (let b = 0; b < __tap.left.length; b++) {
    const l = __tap.left[b], r = __tap.right[b];
    for (let i = 0; i < l.length; i++) {
      pcm[k++] = Math.max(-32768, Math.min(32767, Math.round(l[i] * gain * 32767)));
      pcm[k++] = Math.max(-32768, Math.min(32767, Math.round(r[i] * gain * 32767)));
    }
  }
  window.__pcm = new Uint8Array(pcm.buffer);
  let peak = 0;
  for (let i = 0; i < pcm.length; i += 7) peak = Math.max(peak, Math.abs(pcm[i]));
  return { rate, bytes: __pcm.length, seconds: (lead + n) / rate, peak, gain: +gain.toFixed(2), first: __tap.first };
})()`);
console.log(info);
const parts = [];
const CHUNK = 512 * 1024;
for (let at = 0; at < info.bytes; at += CHUNK) {
  const b64 = await evaluate(`(() => { const p = __pcm.subarray(${at}, ${at + CHUNK}); let s = ''; for (let i = 0; i < p.length; i += 32768) s += String.fromCharCode.apply(null, p.subarray(i, i + 32768)); return btoa(s); })()`);
  parts.push(Buffer.from(b64, 'base64'));
}
const data = Buffer.concat(parts);
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(2, 22);
header.writeUInt32LE(info.rate, 24);
header.writeUInt32LE(info.rate * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);
await fs.writeFile(out, Buffer.concat([header, data]));
console.log(`wrote ${out}: ${info.seconds.toFixed(1)} s`);
await send('Page.navigate', { url: 'about:blank' });
process.exit(0);
