import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {BufferGeometry, BufferAttribute, SkinnedMesh, Group} from 'three';
const compile=s=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')}`;
const island=compile(await readFile(new URL('../src/portfolio/island.ts',import.meta.url),'utf8'));
const reading=compile((await readFile(new URL('../src/portfolio/reading.ts',import.meta.url),'utf8')).replace("'./island'",JSON.stringify(island)));
const choreography=compile((await readFile(new URL('../src/portfolio/bookChoreography.ts',import.meta.url),'utf8')).replace("'./reading'",JSON.stringify(reading)).replace("'three'",JSON.stringify(import.meta.resolve('three'))));
const {bookScore,notebookTransform,prepareReadingRabbit,BENCH_BOOK}=await import(choreography);
const {BOOK_LAP,BENCH_SEAT_TOP}=await import(reading);
assert.ok(BENCH_BOOK.y-.0305*BOOK_LAP.scale >= BENCH_SEAT_TOP,'Closed cover must rest above seat');
for(let i=0;i<=1000;i++){
 const p=i/1000,s=bookScore(p),t=notebookTransform(p);
 assert.ok(Object.values(t).every(Number.isFinite));
 assert.ok(t.y>=BENCH_BOOK.y,'Pickup/return must clear the seat');
 if(s.open>0)assert.equal(s.carry,1,'Open only after reaching the lap');
 if(s.lift===0)assert.equal(t.x,BENCH_BOOK.x,'Book stays on bench until grasp');
}
const bytes=await readFile(new URL('../public/models/rabbit/portfolio-reading-rig.glb',import.meta.url));
const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length).toString()),base=28+length;
function attribute(id){
 const a=json.accessors[id],v=json.bufferViews[a.bufferView],n={SCALAR:1,VEC3:3,VEC4:4}[a.type];
 const Typed={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[a.componentType];
 const stride=v.byteStride??n*Typed.BYTES_PER_ELEMENT,values=new Typed(a.count*n);
 for(let i=0;i<a.count;i++){
  const start=base+(v.byteOffset??0)+(a.byteOffset??0)+i*stride;
  values.set(new Typed(bytes.buffer.slice(bytes.byteOffset+start,bytes.byteOffset+start+n*Typed.BYTES_PER_ELEMENT)),i*n);
 }
 return new BufferAttribute(values,n,a.normalized??false);
}
const model=new Group(),sources=[];
for(const m of json.meshes)for(const p of m.primitives){
 const g=new BufferGeometry();g.setAttribute('color',attribute(p.attributes.COLOR_0));g.setIndex(attribute(p.indices));
 const mesh=new SkinnedMesh(g);model.add(mesh);sources.push({mesh,g,count:g.index.count});
}
for(let repeat=0;repeat<2;repeat++){
 const cleanup=prepareReadingRabbit(model);
 let removed=0;
 for(const {mesh,g,count} of sources){
  assert.equal(g.index.count,count,'Source GLB geometry stays unchanged');
  removed+=count-mesh.geometry.index.count;
  const colors=mesh.geometry.getAttribute('color');
  for(const index of mesh.geometry.index.array){
   const c=[colors.getX(index),colors.getY(index),colors.getZ(index)];
   assert.ok(![[.55,.29,.14],[.63,.36,.19],[.76,.52,.30]].some(t=>t.every((x,i)=>Math.abs(x-c[i])<.0001)),'No bag or strap vertices remain in draw indices');
  }
 }
 assert.ok(removed>1000,'Remove all pouch and strap geometry from actual V65');
 cleanup();for(const {mesh,g} of sources)assert.equal(mesh.geometry,g);
}
for(const {mesh,g} of sources){g.dispose();mesh.material.dispose();}
console.log('Bench notebook: seat clearance, pickup ordering, complete portfolio rig bag/strap removal and reversible cleanup passed.');

const names=json.nodes.map(n=>n.name);
for(const side of ['L','R'])for(const part of ['Forearm','Hand','Grip'])assert.ok(names.includes(`${part}.${side}`));
assert.deepEqual(json.animations.map(a=>a.name).sort(),['Idle','Run','Walk']);
const weighted=new Set();
for(const mesh of json.meshes)for(const p of mesh.primitives){
 const joints=attribute(p.attributes.JOINTS_0),weights=attribute(p.attributes.WEIGHTS_0);
 for(let i=0;i<joints.count;i++)for(let k=0;k<4;k++)if(weights.array[i*4+k]>.01)weighted.add(names[json.skins[0].joints[joints.array[i*4+k]]]);
}
for(const side of ['L','R'])for(const part of ['Forearm','Hand'])assert.ok(weighted.has(`${part}.${side}`),'New joints must actually deform the mesh');
console.log('Articulated GLB: elbow/wrist weights, grip sockets and original locomotion clips verified.');
