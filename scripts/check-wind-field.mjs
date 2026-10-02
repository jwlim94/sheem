// Node 22.6+: node --experimental-strip-types scripts/check-wind-field.mjs
import assert from 'node:assert/strict';
import { createUniformWind, validateWindConfig, windExposure } from '../src/sheem/wind/windField.ts';
const sample = { velocity: { x: 0, y: 0, z: 0 }, speed: 0 };
const close = (a,b) => assert(Math.abs(a-b)<1e-8, `${a} != ${b}`);
for (const directionDegrees of [0,90,180,270,360,-90]) {
 const config={version:1,directionDegrees,speed:4};
 const field=createUniformWind(JSON.parse(JSON.stringify(config)));
 field.sample({x:0,y:0,z:0},0,sample);
 close(Math.hypot(...Object.values(sample.velocity)),4);
 const first=structuredClone(sample);
 field.sample({x:500,y:12,z:-90},120,sample);
 assert.deepEqual(sample,first,'Uniform field must not vary by position or time yet');
 config.speed=9; field.sample({x:0,y:0,z:0},0,sample);close(sample.speed,4);
}
createUniformWind({version:1,directionDegrees:90,speed:4}).sample({x:0,y:0,z:0},0,sample);
// Faces south: incoming wind from west is on the character's right (-X).
close(windExposure(sample,{x:0,y:0,z:1},{x:-1,y:0,z:0}).side,1);
close(windExposure(sample,{x:0,y:0,z:-1},{x:1,y:0,z:0}).side,-1);
close(windExposure(sample,{x:-1,y:0,z:0},{x:0,y:0,z:-1}).front,1);
close(windExposure(sample,{x:1,y:0,z:0},{x:0,y:0,z:1}).front,-1);
createUniformWind({version:1,directionDegrees:90,speed:0}).sample({x:0,y:0,z:0},0,sample);
assert.deepEqual(windExposure(sample,{x:0,y:0,z:1},{x:-1,y:0,z:0}),{front:0,side:0,strength:0});
for(const speed of [-1,13,NaN,Infinity])assert.throws(()=>validateWindConfig({version:1,directionDegrees:90,speed}));
assert.throws(()=>validateWindConfig({version:2,directionDegrees:0,speed:4}));
assert.throws(()=>validateWindConfig({version:1,directionDegrees:NaN,speed:4}));
console.log('Wind: serializable settings, immutable uniform field, cardinal arrivals, calm and invalid input passed.');

const { relativeWind } = await import('../src/sheem/wind/windField.ts');
const ambient = { velocity: { x: 4, y: 0, z: 0 }, speed: 4 };
const apparent = { velocity: { x: 0, y: 0, z: 0 }, speed: 0 };
for (const [x, expected] of [[0,4],[-1.8,5.8],[-3,7],[1.8,2.2],[3,1],[4,0],[5,1]]) {
 relativeWind(ambient,{x,y:0,z:0},apparent);close(apparent.speed,expected);
 if(x===5)assert(apparent.velocity.x<0,'Outrunning wind reverses arrival');
}
relativeWind(ambient,{x:0,y:0,z:3},apparent);close(apparent.speed,5);
assert.deepEqual(apparent.velocity,{x:4,y:0,z:-3});
assert.deepEqual(ambient,{velocity:{x:4,y:0,z:0},speed:4});
const calm={velocity:{x:0,y:0,z:0},speed:0};
for(const speed of [0,1.8,3]){
 relativeWind(calm,{x:0,y:0,z:speed},apparent);close(apparent.speed,speed);
 if(speed)close(windExposure(apparent,{x:0,y:0,z:1},{x:-1,y:0,z:0}).front,1);
}
relativeWind(calm,{x:0,y:2,z:0},apparent);close(apparent.velocity.y,-2);
assert(windExposure({velocity:{x:30,y:0,z:0},speed:30},{x:-1,y:0,z:0},{x:0,y:0,z:-1}).strength<=1);
console.log('Relative wind: headwind, tailwind, outrunning, crosswind, calm walking/running, vertical motion and bounded level passed.');
