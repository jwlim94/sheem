import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')}`;
const islandURL=compile(await readFile(new URL('../src/portfolio/island.ts',import.meta.url),'utf8'));
const {obstacles,constrainPosition}=await import(islandURL);
const reading=await readFile(new URL('../src/portfolio/reading.ts',import.meta.url),'utf8');
const {benchPath,BENCH_APPROACH}=await import(compile(reading.replace("'./island'",JSON.stringify(islandURL))));
let checked=0;
for(const [x,z] of [[0,8.6],[-8,0],[-7,-7],[8,-5],[0,-9],[8,5],[4.8,1.9],[-4.2,0],...Array.from({length:24},(_,i)=>[Math.cos(i*Math.PI/12)*10,Math.sin(i*Math.PI/12)*10])]) {
  const start=constrainPosition(x,z);const path=benchPath(start.x,start.z);
  assert.ok(path.length,`Route exists from ${x},${z}`);
  assert.deepEqual(path.at(-1),BENCH_APPROACH);
  let from=[start.x,start.z];
  for(const to of path){const n=Math.ceil(Math.hypot(to[0]-from[0],to[1]-from[1])/.025);
    for(let i=1;i<=n;i++) {const a=from[0]+(to[0]-from[0])*i/n,b=from[1]+(to[1]-from[1])*i/n;
      for(const o of obstacles)assert.ok(Math.hypot(a-o.x,b-o.z)>=o.radius+.34-1e-6,'Path must clear rabbit collision radius');}
    from=to;
  }
  checked++;
}
console.log(`Bench paths clear all obstacles from ${checked} starting locations.`);
