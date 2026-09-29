// Run after build: real shipped Three.js objects and production presentation module.
// No WebGL/DOM replacement and no alternate presentation implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {WorldPolish} from '../dist/src/polish3d.js';
import {Game} from '../dist/src/sim.js';

function setup() {
  const game = new Game({seed:314159});
  game.chooseRoute('freight'); game.chooseCar('cargo'); game.start();
  game.speedMode='STOP'; game.t=.26; game.elapsed=5;
  const scene=new T.Scene();scene.fog=new T.Fog(0x20384a,80,420);
  const train=new T.Group(),actorGroup=new T.Group(),cube=new T.BoxGeometry(1,1,1);
  scene.add(train);train.add(actorGroup);
  const matCache=new Map();
  const view={game,scene,train,actorGroup,cube,cars:[],reducedMotion:false,
    hemi:new T.HemisphereLight(),sun:new T.DirectionalLight(),
    mat(color){if(!matCache.has(color))matCache.set(color,new T.MeshStandardMaterial({color}));return matCache.get(color);}};
  const art=new WorldPolish(view);art.update();
  return {game,view,art,matCache};
}
const pose=(mesh,index=0)=>{const m=new T.Matrix4();mesh.getMatrixAt(index,m);return {x:m.elements[12],scale:new T.Vector3().setFromMatrixScale(m).x};};

test('presentation updates leave every gameplay snapshot field untouched',()=>{
  const {game,art}=setup();const before=JSON.stringify(game.snapshot());
  for(let n=0;n<12;n++)art.update();assert.equal(JSON.stringify(game.snapshot()),before);
});
test('windup cue grows as the actual accumulated windup approaches impact',()=>{
  const {game,art}=setup();const e=game.spawn('bruiser',6,false);e.climb=0;e.state='heavy_windup';
  e.wind=.15;art.update();const early=pose(art.windups).scale;
  e.wind=1.35;art.update();const late=pose(art.windups).scale;
  assert(late>early,`cue must grow toward impact, early=${early}, late=${late}`);
});
test('reduced motion freezes warning opacity and beacon pulse',()=>{
  const {game,view,art}=setup();view.reducedMotion=true;
  const e=game.spawn('bruiser',6,false);e.wind=.4;
  game.elapsed=1;art.update();const opacity=art.windupMat.opacity;
  game.elapsed=1.5;art.update();assert.equal(art.windupMat.opacity,opacity);assert.equal(art.beacon.scale.x,1);
});
test('stationary backdrop does not re-upload unchanged GPU instance matrices',()=>{
  const {art}=setup();const before=[art.far,art.mid,art.signals].map(m=>m.instanceMatrix.version);
  for(let i=0;i<8;i++)art.update();assert.deepEqual([art.far,art.mid,art.signals].map(m=>m.instanceMatrix.version),before);
});
test('visible scenery stays continuous while player crosses an old 20-unit recenter boundary',()=>{
  const {art}=setup();art.updateBackdrop('freight',19.99,20);
  const before=Array.from({length:22},(_,i)=>pose(art.far,i).x);
  art.updateBackdrop('freight',20.01,20);
  for(let i=0;i<before.length;i++)if(Math.abs(before[i]-20)<60)assert(Math.abs(pose(art.far,i).x-before[i])<.01,'central scenery jumped');
});
test('visible scenery stays continuous across the old travel modulo boundary',()=>{
  const {art}=setup();art.updateBackdrop('freight',3,119.99);
  const before=Array.from({length:22},(_,i)=>pose(art.far,i).x);
  art.updateBackdrop('freight',3,120.01);
  for(let i=0;i<before.length;i++)if(Math.abs(before[i]-3)<60)assert(Math.abs(pose(art.far,i).x-before[i])<.01,'central scenery wrapped in view');
});
test('contact shadow grounds the complete train instead of only its center',()=>{
  const {art,game}=setup();assert(art.shadow.scale.x>=game.length-1);
});
test('livery leaves the camera-facing torso-height cutaway open',()=>{
  const {art,view}=setup();view.scene.updateMatrixWorld(true);
  for(const x of [1.15,2.65,4.15,5.65,7.15]){
    const ray=new T.Raycaster(new T.Vector3(x,2.2,10),new T.Vector3(0,0,-1),.01,9.1);
    assert.equal(ray.intersectObjects(art.groups).length,0,'front decorative post intersects the play lane');
  }
});
test('disposing art releases owned resources once without releasing shared geometry or throwing',()=>{
  const {art,view,matCache}=setup();let shared=0,owned=0;
  view.cube.addEventListener('dispose',()=>shared++);for(const m of matCache.values())m.addEventListener('dispose',()=>shared++);
  const ownedObjects=[art.shadow.geometry,art.shadow.material,art.windups.geometry,art.windupMat,art.marker.geometry,art.marker.material,art.beacon.geometry,art.beacon.material,art.farMat,art.midMat,art.signalMat,...art.roleMaterials.values()];
  for(const o of ownedObjects)o.addEventListener('dispose',()=>owned++);
  assert.doesNotThrow(()=>art.dispose());assert.equal(owned,ownedObjects.length);assert.equal(shared,0);
  assert.doesNotThrow(()=>art.dispose());assert.equal(owned,ownedObjects.length);assert.equal(art.backdrop.parent,null);
});
test('rebuilding livery releases replaced batches and keeps instance budget bounded',()=>{
  const {art,view}=setup();const count=art.groups.reduce((s,m)=>s+m.count,0);let disposed=0;
  for(const m of art.groups)m.addEventListener('dispose',()=>disposed++);const old=art.groups.length;
  view.cars=[];art.update();assert.equal(disposed,old);assert.equal(art.groups.reduce((s,m)=>s+m.count,0),count);
  assert(art.groups.length<=9&&count<=60);
});
