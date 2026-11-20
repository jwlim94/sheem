import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {Vector3} from 'three';
const source=(await readFile(new URL('../src/portfolio/armIK.ts',import.meta.url),'utf8')).replace("'three'",JSON.stringify(import.meta.resolve('three')));
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {solveElbow}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const shoulder=new Vector3(.2,1.2,.1),elbow=new Vector3(),wrist=new Vector3();
for(let i=0;i<400;i++){
 const distance=.02+(i%37)/36*.26,a=i*.17;
 const target=new Vector3(Math.cos(a),Math.sin(a),Math.sin(a*.3)).normalize().multiplyScalar(distance).add(shoulder);
 const error=solveElbow(shoulder,target,new Vector3(.8,.8,.3),.15,.14,elbow,wrist);
 assert.ok(error<1e-6);assert.ok(wrist.distanceTo(target)<1e-6);
 assert.ok(Math.abs(elbow.distanceTo(shoulder)-.15)<1e-6);
 assert.ok(Math.abs(wrist.distanceTo(elbow)-.14)<1e-6);
}
for(const target of [shoulder.clone(),new Vector3(.2,1.2,3),new Vector3(5,0,0)]){
 solveElbow(shoulder,target,target,.15,.14,elbow,wrist);
 assert.ok([...elbow.toArray(),...wrist.toArray()].every(Number.isFinite));
 assert.ok(Math.abs(elbow.distanceTo(shoulder)-.15)<1e-6);
 assert.ok(Math.abs(wrist.distanceTo(elbow)-.14)<1e-6);
}
console.log('Arm IK: 400 reachable targets, fixed bone lengths, unreachable and degenerate targets passed.');
