import assert from 'node:assert/strict';
import { build } from 'esbuild';
const {outputFiles}=await build({stdin:{contents:`export * from './src/sheem/wind/terrainWind.ts'; export * from './src/sheem/wind/windTestGround.ts'; export * from './src/sheem/characters/rabbitMovement.ts';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {createTerrainWind,validateTerrainWind,WIND_TEST_CONFIG:defaults,windTestHeight:height,WIND_TEST_GROUND:ground,WIND_TEST_SPOTS:spots,createRabbitMovement,stepRabbit}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const config=()=>structuredClone(defaults);
const sample=(field,x,z,t=0,y=height(x,z)+1.08)=>{const out={velocity:{x:0,y:0,z:0},speed:0,exposure:1,gust:1,zone:1};field.sample({x,y,z},t,out);return out};
const c=config();c.gust.enabled=false;
const field=createTerrainWind(c,height);
const west=sample(field,-8,-14),east=sample(field,8,-14),top=sample(field,0,-14);
assert(west.speed>east.speed*1.5);assert(top.exposure>.99);
const reverse=createTerrainWind({...c,directionDegrees:270},height);
assert(sample(reverse,-8,-14).speed<sample(reverse,8,-14).speed*.67);
assert(Math.abs(west.speed-sample(reverse,8,-14).speed)<1e-8);
assert(sample(field,10,2).speed<sample(field,0,0).speed*.5);
const baseline=createTerrainWind({...c,zones:[],shelter:{...c.shelter,enabled:false}},height);
assert.equal(sample(baseline,8,-14).speed,4);
// Height matters: an observer above the ridge is not sheltered.
assert(sample(field,8,-14,0,8).exposure>.99);
// Continuous transitions across zone and hill, including heading changes.
let last=sample(field,-13,-14);
for(let x=-12.98;x<=13;x+=.02){const next=sample(field,x,-14);assert(Math.abs(next.speed-last.speed)<.12);last=next;}
last=sample(field,2,2);
for(let x=2.02;x<18;x+=.02){const next=sample(field,x,2);assert(Math.abs(next.speed-last.speed)<.08);last=next;}
let previous=sample(field,8,-14).speed;
for(let d=90.5;d<=450;d+=.5){const f=createTerrainWind({...c,directionDegrees:d},height),speed=sample(f,8,-14).speed;assert(Math.abs(speed-previous)<.15);previous=speed;}
const gustConfig=config();gustConfig.zones=[];gustConfig.shelter.enabled=false;
const gustField=createTerrainWind(gustConfig,height);
for(let t=0;t<30;t+=.05){const a=sample(gustField,0,0,t),b=sample(gustField,6,0,t+1);assert(Math.abs(a.speed-b.speed)<1e-9);assert(a.speed>=4&&a.speed<=6.4);}
const calm=createTerrainWind({...defaults,speed:0},height);assert.equal(sample(calm,8,-14,8).speed,0);
// Constructor copies nested settings, as an editor may mutate its own draft later.
const snapshot=config(),immutable=createTerrainWind(snapshot,height),before=sample(immutable,10,2);
snapshot.zones[0].multiplier=2;snapshot.gust.strength=0;assert.deepEqual(sample(immutable,10,2),before);
assert.throws(()=>validateTerrainWind({...config(),gust:{enabled:true,strength:NaN,period:14,travelSpeed:6}}));
assert.throws(()=>validateTerrainWind({...config(),zones:[{...defaults.zones[0],transition:0}]}));
for(const fps of [30,60,120])for(const sprint of [false,true]){
 const state=createRabbitMovement(ground);let frames=0;
 for(const p of [...spots.slice(1),spots[0]]){
  while(Math.hypot(p.x-state.position.x,p.z-state.position.z)>.15&&frames++<fps*120){
   const angle=Math.atan2(state.position.x-p.x,state.position.z-p.z);
   stepRabbit(state,0,1,angle,1/fps,sprint,ground);
   assert(Number.isFinite(state.position.y));assert(Math.abs(state.position.y-height(state.position.x,state.position.z))<1e-8);
  }
  assert(frames<fps*120,'Every comparison location must be reachable');
 }
}
console.log(JSON.stringify({west,east,top}));
console.log('Terrain wind: reversible shelter, height, zones, spatial/angular continuity, traveling gusts, config validation, and walking/running course at 30/60/120 fps passed.');
