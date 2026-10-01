import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
const source=fs.readFileSync(new URL('../src/train_wheels.js',import.meta.url),'utf8').replace('../vendor/three.module.min.js',new URL('../node_modules/three/build/three.module.js',import.meta.url).href);
const {prepareTrainWheels,rollTrainWheels}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

// Read the actual selected GLB geometry, not a fixture shaped like the implementation.
function model(file){
 const bytes=fs.readFileSync('assets/kenney/train/'+file+'.glb'),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),base=28+bytes.readUInt32LE(12);
 const result=new T.Group(),nodes=json.nodes.map(node=>{
  const primitive=json.meshes[node.mesh].primitives[0],g=new T.BufferGeometry();
  for(const [name,id] of Object.entries(primitive.attributes)){
   const a=json.accessors[id],v=json.bufferViews[a.bufferView],size={VEC2:2,VEC3:3,VEC4:4}[a.type],values=new Float32Array(bytes.buffer,bytes.byteOffset+base+(v.byteOffset||0)+(a.byteOffset||0),a.count*size);
   g.setAttribute({POSITION:'position',NORMAL:'normal',TANGENT:'tangent',TEXCOORD_0:'uv'}[name],new T.BufferAttribute(values.slice(),size));
  }
  const a=json.accessors[primitive.indices],v=json.bufferViews[a.bufferView];
  g.setIndex(new T.BufferAttribute(new Uint16Array(bytes.buffer,bytes.byteOffset+base+(v.byteOffset||0)+(a.byteOffset||0),a.count).slice(),1));
  const mesh=new T.Mesh(g,new T.MeshBasicMaterial());mesh.name=node.name;if(node.translation)mesh.position.fromArray(node.translation);return mesh;
 });
 json.nodes.forEach((n,i)=>{for(const child of n.children||[])nodes[i].add(nodes[child]);});result.add(nodes[0]);return result;
}
for(const file of ['train-diesel-a','train-carriage-flatbed','train-carriage-container-red'])test(file+' preserves bogies and animates four independent tyres per bogie',()=>{
 const m=model(file),bogies=[];m.traverse(o=>{if(o.name.startsWith('wheels-'))bogies.push(o);});
 const transforms=bogies.map(o=>({p:o.position.toArray(),q:o.quaternion.toArray()})),original=bogies.map(o=>o.geometry.index.count);
 prepareTrainWheels(m);
 bogies.forEach((b,i)=>{assert.equal(b.children.length,4);assert.equal(b.geometry.getAttribute('position').count+b.children.reduce((n,o)=>n+o.geometry.getAttribute('position').count,0),original[i]);});
 m.rotation.y=-Math.PI/2;m.scale.set(2.9,2.1,2.7);m.updateMatrixWorld(true);
 const staticBounds=bogies.map(o=>o.geometry.boundingBox.clone()),centres=bogies.flatMap(o=>o.children.map(w=>w.getWorldPosition(new T.Vector3()).toArray()));
 for(const travel of [0,.08,.16,.24,.24,.16,.08,0,-.08]){
  rollTrainWheels(m,travel);m.updateMatrixWorld(true);
  bogies.forEach((b,i)=>{assert.deepEqual(b.position.toArray(),transforms[i].p);assert.deepEqual(b.quaternion.toArray(),transforms[i].q);assert(b.geometry.boundingBox.equals(staticBounds[i]));
   b.children.forEach(w=>{const r=travel/(.189*2.1)%(Math.PI*2);assert(Math.abs(w.rotation.x-r)<1e-8);assert.equal(w.rotation.y,0);assert.equal(w.rotation.z,0);});
  });
  assert.deepEqual(bogies.flatMap(o=>o.children.map(w=>w.getWorldPosition(new T.Vector3()).toArray())),centres);
 }
});
