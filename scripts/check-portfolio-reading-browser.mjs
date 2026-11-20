// Requires Vite and a dedicated Chrome with --remote-debugging-port=9227.
import fs from 'node:fs/promises';
const cdpOrigin=process.env.PORTFOLIO_CDP_URL ?? 'http://127.0.0.1:9227';
const origin=process.env.PORTFOLIO_ORIGIN ?? 'http://127.0.0.1:5173';
const snapshots=process.env.PORTFOLIO_SCREENSHOTS ?? '/tmp/sheem-reading-motion';
await fs.mkdir(snapshots,{recursive:true});
const tab = (await (await fetch(cdpOrigin+'/json')).json()).find(tab => tab.type === 'page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open',resolve,{once:true}));
let id = 0; const pending = new Map(); const errors=[];
ws.addEventListener('message', ({data})=>{const msg=JSON.parse(data); if(msg.id){const handler=pending.get(msg.id); pending.delete(msg.id); msg.error ? handler.reject(msg.error) : handler.resolve(msg.result);} else if(msg.method==='Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails); else if(msg.method==='Log.entryAdded' && msg.params.entry.level==='error') errors.push(msg.params.entry);});
const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await send('Runtime.enable');await send('Log.enable');await send('Page.enable');await send('Page.bringToFront');

await send('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:origin+'/portfolio?readingLab=1'});
for(let i=0;i<400;i++){if(await evaluate(`!!document.querySelector('[aria-label="Open The experience book"]')`))break;await delay(100);}
await evaluate(`(async()=>{const {_roots}=await import(performance.getEntriesByType('resource').find(r=>r.name.includes('@react-three_fiber.js')).name);window.portfolioStore=[..._roots.values()][0].store})()`);
const scrub=async p=>{await evaluate(`(()=>{const e=document.querySelector('[aria-label="Reading progress"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'${p}');e.dispatchEvent(new Event('input',{bubbles:true}))})()`);await delay(80);};
await scrub(.001);let max=0,worst=0,seatError=0;
for(let i=0;i<=100;i++){
 const p=i/100;await scrub(p);
 const d=await evaluate("portfolioStore.getState().scene.getObjectByName('reading-notebook').userData");
 if(Math.abs(d.unpackProgress-p)>.001)throw new Error('Scrub did not apply '+JSON.stringify(d));
 seatError=Math.max(seatError,Math.abs(d.seatContactError));
 if(d.contactError>max){max=d.contactError;worst=p;}
 if([0,30,60,85,100].includes(i))await fs.writeFile(`${snapshots}/reading-lab-${i}.png`,Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
}
console.log('101 samples contact error',max,'worst progress',worst,'seat error',seatError);
await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='side').click()`);await delay(250);
await fs.writeFile(snapshots+'/reading-lab-side.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
console.log('errors',errors);ws.close();if(max>.003||seatError>.003||errors.length)throw new Error('Contact audit failed');
