import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';
const source=fs.readFileSync(new URL('../src/train_cutaway.js',import.meta.url),'utf8').replace('../vendor/three.module.min.js',new URL('../node_modules/three/build/three.module.js',import.meta.url).href);
const {buildServiceCarBody}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const cube=new T.BoxGeometry(1,1,1),materials=new Map();
const view={box(parent,x,y,z,sx,sy,sz,color){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color}));const mesh=new T.Mesh(cube,materials.get(color));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;}};
for(const type of ['engine','cargo','battery','workshop'])test(type+' integrates its roof with a rear shell while keeping the full play lane open',()=>{
 const car=new T.Group(),{body,deck}=buildServiceCarBody(view,car,type);car.updateMatrixWorld(true);
 assert.equal(body.children.length,2,'static shell and inspectable roof need only two draws');
 assert(Math.abs(deck.position.y+deck.scale.y/2-4.12)<1e-8);
 for(const x of [-3.75,-2,-1,0,1,2,3.75]){
  const floorRay=new T.Raycaster(new T.Vector3(x,3.95,.65),new T.Vector3(0,1,0),0,.3),roofHits=floorRay.intersectObject(body,true);assert(roofHits.length,'roof at x='+x); assert(Math.abs(roofHits[0].point.y-4.03)<1e-8);
  for(const y of [1.4,1.9,2.5,3.2]){const ray=new T.Raycaster(new T.Vector3(x,y,2.5),new T.Vector3(0,0,-1),0,2.0);assert.equal(ray.intersectObject(body,true).length,0,'front must remain open at x='+x+' y='+y);}
 }
 const parts=body.userData.parts,wall=parts.find(p=>p.name==='Car-Rear-Upper-Wall'),pillar=parts.find(p=>p.name==='Car-End-Pillar');
 assert(Math.abs(wall.position[1]+wall.size[1]/2-4.08)<1e-8);assert(Math.abs(pillar.position[1]+pillar.size[1]/2-4.12)<1e-8);
 assert(!parts.some(p=>p.name==='Car-Rear-Safety-Rail'||p.name==='Car-Rear-Rail-Stanchion'),'terrace-style external rails removed');
 assert(deck.scale.z<2.4&&deck.scale.x<=7.6&&deck.scale.y<=.1,'roof fits within chassis rather than overhanging like an awning');
 const bridge=new T.Raycaster(new T.Vector3(4.15,4.4,.65),new T.Vector3(0,-1,0),0,.5).intersectObject(body,true);assert(bridge.length&&Math.abs(bridge[0].point.y-4.12)<1e-5,'roof travel has a visible gangway across the unchanged inter-car gap');
 assert(parts.some(p=>p.name.startsWith({engine:'Cab-Window',cargo:'Freight-Body-Rib',battery:'Power-Vent',workshop:'Service-Tool'}[type])));
 assert(body.children.every(o=>o.material.opacity===1&&!o.material.transparent));
});
test('train replacement no longer adds detached Factory roof walk sections',()=>{const src=fs.readFileSync('src/assets3d.js','utf8'),car=src.slice(src.indexOf(' car(m,type)'),src.indexOf(' actor(rig,enemy)'));assert(!car.includes('factory/catwalk-straight'));assert(car.includes('buildServiceCarBody(this.view,m,type)'));assert(car.includes('train/train-diesel-a'));assert(car.includes('train/train-carriage-flatbed'));});
test('rebuilding car presentation reuses shell geometry without sharing transforms',()=>{const a=buildServiceCarBody(view,new T.Group(),'engine'),b=buildServiceCarBody(view,new T.Group(),'engine');assert.notEqual(a.body,b.body);assert.equal(a.body.getObjectByName('Car-Integrated-Shell').geometry,b.body.getObjectByName('Car-Integrated-Shell').geometry);assert.equal(a.body.getObjectByName('Car-Integrated-Shell').material,b.body.getObjectByName('Car-Integrated-Shell').material);b.body.position.x=10;assert.equal(a.body.position.x,0);});
