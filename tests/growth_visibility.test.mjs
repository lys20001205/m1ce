import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';
import {Game} from '../src/sim.js';import {SaveStore,cleanSave} from '../src/save.js';import {CAREER_MAX,careerCost,cleanStarter} from '../src/career.js';
import {cargoNavigation} from '../src/cargo_navigation.js';
import {showCarHealthLabel} from '../src/world_label_layout.js';

test('healthy world labels are quiet and damaged labels cannot cover touch controls',()=>{
 const pos={x:140,y:250},controls=[{left:120,right:164,top:230,bottom:274}];
 assert.equal(showCarHealthLabel({hp:100,max:100},false,pos,[]),false);
 assert.equal(showCarHealthLabel({hp:50,max:100},false,pos,controls),false);
 assert.equal(showCarHealthLabel({hp:50,max:100},false,{x:140,y:190},controls),true);
 assert.equal(showCarHealthLabel({hp:100,max:100},true,{x:140,y:190},controls),true);
});
test('early engine-side docking gives an executable ladder then bridge direction',()=>{
 const g=new Game();g.chooseRoute('freight');g.chooseCar('cargo');g.start();g.t=.255;g.speedMode='STOP';g.player.x=1.7;
 let nav=cargoNavigation(g);assert(nav);assert.match(nav.cue,/→ 黄色梯/);assert.doesNotMatch(nav.cue,/F 入站/);
 g.player.x=4.316;nav=cargoNavigation(g);assert.match(nav.cue,/W 上车顶/);
 g.player.roof=true;g.player.layer='ROOF';nav=cargoNavigation(g);assert.match(nav.cue,/接驳桥|已对准桥/);
 g.player.x=g.nearestDepot().x;nav=cargoNavigation(g);assert.match(nav.cue,/已对准桥 · F 入站/);
});
const source=fs.readFileSync(new URL('../src/train_cutaway.js',import.meta.url),'utf8').replace('../vendor/three.module.min.js',new URL('../node_modules/three/build/three.module.js',import.meta.url).href);
const {cutForeground,catwalkBaseY}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('an old completed 7-level career retains its currency and gains real starter choices',()=>{
 const old=cleanSave({version:11,bank:4000,career:{boots:3,hull:3,kit:1},prep:{intel:1}}),g=new Game(old);assert.equal(g.bank,4000);assert.deepEqual(g.career,{boots:3,hull:3,kit:1});assert.equal(CAREER_MAX,9);assert(!g.chooseStarter('shotgun'));assert(g.buyCareer('kit'));assert.equal(g.bank,2600);assert(g.chooseStarter('shotgun'));assert.equal(g.ranged.id,'shotgun');assert.deepEqual(g.weaponInventory.ranged,['shotgun']);assert(!g.chooseStarter('rifle'));assert.equal(careerCost('kit',2),2400);
});
test('selected persistent weapon survives save, next-run and admission rules without free lower-tier weapons',()=>{
 const map=new Map(),store=new SaveStore({backend:{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}}),g=new Game({bank:5000,career:{kit:1,hull:1}});assert(g.buyCareer('kit'));assert(g.buyCareer('kit'));assert(g.chooseStarter('rifle'));assert(store.write(g));const next=new Game(store.read());assert.equal(next.starterWeapon,'rifle');next.chooseRoute('freight');next.chooseCar('cargo');next.start();assert.equal(next.ranged.id,'rifle');assert.equal(next.rangedMagazine.max,3);assert.equal(next.cars[0].max,210);assert.equal(next.scrap,6);assert.deepEqual(next.weaponInventory.ranged,['rifle']);assert(!next.chooseStarter('shotgun'));assert.equal(next.bank,1200);assert.equal(cleanStarter('rifle',2),'handgun');assert.equal(cleanStarter('axe',3),'handgun');
});
test('different licensed departure weapons retain different actual attacks and ammo',()=>{
 for(const [id,pellets,max]of [['shotgun',5,2],['smg',1,24],['rifle',1,3]]){const g=new Game({career:{kit:3},starterWeapon:id});g.chooseRoute('industrial');g.chooseCar('cargo');g.start();assert.equal(g.ranged.id,id);assert.equal(g.rangedMagazine.max,max);assert(g.rangedAttack());assert.equal(g.projectiles.length,pellets);assert.equal(g.projectiles[0].pierce,id==='rifle'?3:1);}
});
test('cargo guidance preserves stock and unsecured value while showing the actual next action',()=>{
 const g=new Game();g.chooseRoute('freight');g.chooseCar('cargo');g.start();g.t=.26;g.speedMode='STOP';g.player.x=12.45;let nav=cargoNavigation(g);assert.match(nav.text,/站内库存 2,250/);assert.match(nav.text,/F 入站/);assert(g.interact());assert(g.interact());nav=cargoNavigation(g);assert.match(nav.text,/携带 450 · 尚未装车/);assert.match(nav.text,/F 回车并装载 450/);assert.equal(g.money,1000);
});
// Actual authored GLB vertices, node transforms and primitive groups, not a
// surrogate made to resemble the plane classifier.
function glb(path){const bytes=fs.readFileSync(path),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),base=28+bytes.readUInt32LE(12);
 function attribute(id){const a=json.accessors[id],v=json.bufferViews[a.bufferView],size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],Type={5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[a.componentType];return new T.BufferAttribute(new Type(bytes.buffer,bytes.byteOffset+base+(v.byteOffset||0)+(a.byteOffset||0),a.count*size).slice(),size);}
 const nodes=json.nodes.map(n=>{const group=new T.Group();group.name=n.name||'';if(n.translation)group.position.fromArray(n.translation);if(n.rotation)group.quaternion.fromArray(n.rotation);if(n.scale)group.scale.fromArray(n.scale);if(n.matrix)group.applyMatrix4(new T.Matrix4().fromArray(n.matrix));if(n.mesh!==undefined)for(const p of json.meshes[n.mesh].primitives){const geo=new T.BufferGeometry();for(const [name,id]of Object.entries(p.attributes))geo.setAttribute({POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',TANGENT:'tangent'}[name],attribute(id));if(p.indices!==undefined)geo.setIndex(attribute(p.indices));const m=new T.Mesh(geo,new T.MeshBasicMaterial({side:T.DoubleSide}));m.name=n.name||'';group.add(m);}return group;});json.nodes.forEach((n,i)=>{for(const c of n.children||[])nodes[i].add(nodes[c]);});const scene=new T.Group();for(const id of json.scenes[json.scene||0].nodes)scene.add(nodes[id]);return scene;
}
function fit(scene,size,rotation=0){scene.rotation.y=rotation;scene.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(scene),extent=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),root=new T.Group();root.add(scene);root.scale.set(size[0]/extent.x,size[1]/extent.y,size[2]/extent.z);scene.position.set(-center.x,-bounds.min.y,-center.z);root.updateMatrixWorld(true);return root;}
test('real flatbed foreground posts open the actor lane while wheels, floor and source geometry remain intact',()=>{
 const original=glb('assets/kenney/train/train-carriage-flatbed.glb'),first=fit(original.clone(true),[7.9,2.78,3],-Math.PI/2),second=fit(original.clone(true),[7.9,2.78,3],-Math.PI/2);let hits=0;const ray=new T.Raycaster();for(let i=0;i<120;i++){ray.set(new T.Vector3(-3.8+i*7.6/120,2.1,2.5),new T.Vector3(0,0,-1));ray.far=1.4;if(ray.intersectObject(first,true).length)hits++;}assert(hits>0,'authored posts must occlude the front lane before the cut');const before=[];first.traverse(m=>{if(m.isMesh)before.push({mesh:m,geometry:m.geometry,count:m.geometry.index.count,wheel:/wheels/.test(m.name)});});const car=new T.Group();car.add(first);const cut=cutForeground(first,car,{floor:1.12});assert(cut.removedTriangles>0);let after=0;for(let i=0;i<120;i++){ray.set(new T.Vector3(-3.8+i*7.6/120,2.1,2.5),new T.Vector3(0,0,-1));ray.far=1.4;if(ray.intersectObject(first,true).length)after++;}assert(after<hits*.25,`${hits} original occlusions / ${after} after`);for(const m of before){assert.equal(m.geometry.index.count,m.count,'shared source must remain unchanged');if(m.wheel)assert.equal(m.mesh.geometry,m.geometry,'wheels must not be cut');}
 const otherCar=new T.Group();otherCar.add(second);cutForeground(second,otherCar,{floor:1.12});const geos=[];second.traverse(m=>{if(m.isMesh)geos.push(m.geometry)});first.traverse(m=>{if(m.isMesh)assert(geos.includes(m.geometry),'rebuild must reuse derived geometry');});ray.set(new T.Vector3(0,1.35,.65),new T.Vector3(0,-1,0));ray.far=1.35;assert(ray.intersectObject(first,true).length,'walk deck remains present');
});
test('real depot catwalk walking deck aligns with the 4.12m game floor after foreground opening',()=>{
 const root=new T.Group(),platform=fit(glb('assets/kenney/factory/catwalk-straight.glb'),[2,1.2,4]);platform.position.y=catwalkBaseY(4.12,1.2);root.add(platform);const cut=cutForeground(platform,root,{floor:4.12});assert(cut.removedTriangles>0);const ray=new T.Raycaster(new T.Vector3(0,4.6,.65),new T.Vector3(0,-1,0),0,1),hits=ray.intersectObject(root,true);assert(hits.length);assert(Math.abs(hits[0].point.y-4.12)<.015,`authored deck is at ${hits[0].point.y}`);
});
test('late bridge return guides a carrier to cargo LOAD rather than the unavailable ladder or depot entry',()=>{
 const g=new Game();g.chooseRoute('freight');g.chooseCar('cargo');g.start();const c=g.createCargo(450,'player');g.player.carry=c.id;g.player.x=5.8;g.player.roof=true;g.player.layer='ROOF';let nav=cargoNavigation(g);assert.match(nav.text,/→ 去货车/);assert.match(nav.text,/不能爬梯/);assert.equal(nav.goal.x,12.450000000000001);g.player.x=12.45;nav=cargoNavigation(g);assert.equal(nav.action,'LOAD 装载');assert.match(nav.text,/F \/ LOAD/);g.loadCargo();assert.equal(cargoNavigation(g),null);assert.equal(g.money,1450);
});
test('an actual off-center landing returns on the engine roof, then movement and F load at cargo correctly',()=>{
 const g=new Game();g.chooseRoute('freight');g.chooseCar('cargo');g.start();g.elapsed=40;g.t=.255;g.speedMode='STOP';g.director.rest=999;const d=g.nearestDepot();assert(d.x<8.3);g.player.x=d.x;g.player.roof=true;g.player.layer='ROOF';assert(g.interact());g.step(.025);assert(g.interact());assert(g.heldCargo);assert.match(cargoNavigation(g).text,/再去货车 LOAD/);assert(g.interact());assert.equal(g.playerLayer,'ROOF');assert(g.heldCargo);assert.match(cargoNavigation(g).text,/→ 去货车/);for(let i=0;i<80;i++)g.step(.025,{move:1});assert.equal(g.currentCar,1);assert.equal(cargoNavigation(g).action,'LOAD 装载');assert(g.interact());assert.equal(g.money,1450);assert.equal(g.storedCargo,1);
});

test('cargo navigation keeps the carrier and fixed phone HUD clear',async()=>{
 const {cargoGoalPosition}=await import('../src/world_label_layout.js');
 for(const [width,height] of [[844,390],[812,332]]){
  const player={x:width/2,head:160,feet:235},p=cargoGoalPosition({x:width/2,y:185},player,width,height);
  assert(Math.abs(p.x-player.x)>=88,'label yields horizontally to the carrier');
  assert(p.y-24>=110&&p.y<=height-88,'fixed HUD and touch controls remain clear');
  const edge=cargoGoalPosition({x:-300,y:20},player,width,height);
  assert(edge.x>=68&&edge.y>=135);
 }
});

test('role grading isolates shared imported materials and reuses derived copies',async()=>{
 const T=await import('three'),{MaterialRoles}=await import('../src/material_roles.js');
 const source=new T.MeshStandardMaterial({color:0xffffff}),roles=new MaterialRoles(),geometry=new T.BoxGeometry();
 const player=new T.Mesh(geometry,source),enemy=new T.Mesh(geometry,source),scenery=new T.Mesh(geometry,source);
 roles.apply(enemy,'enemy');roles.apply(scenery,'scenery');
 assert.equal(player.material,source);assert.equal(source.color.getHex(),0xffffff);
 assert.notEqual(enemy.material,scenery.material);assert(enemy.material.color.r>enemy.material.color.b);
 assert(scenery.material.color.r<enemy.material.color.r);
 const another=new T.Mesh(geometry,source);roles.apply(another,'enemy');assert.equal(another.material,enemy.material);
 assert.equal(enemy.geometry,player.geometry,'presentation does not replace geometry');
});

test('touch cargo guidance names available buttons while keyboard instructions remain intact',async()=>{
 const {cargoInstruction}=await import('../src/cargo_navigation.js');
 const text='W 上车顶 · 到桥按 F 入站 · 货车 LOAD';
 assert.equal(cargoInstruction(text,true),'⇅ 上车顶 · 到桥按 ↗ 入站 · 货车 LOAD');
 assert.equal(cargoInstruction(text,false),text);
});
