import * as T from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {cutForeground,catwalkBaseY,buildServiceCarBody} from './train_cutaway.js';
import {prepareTrainWheels} from './train_wheels.js';
import {assetURL} from './cache_identity.js';
// Selected CC0 models and palettes are vendored locally. Gameplay retains its validated
// floor, roof and combat sockets; meshes never become collision or reward authority.
export class AssetLibrary{
 constructor(view){this.view=view;this.models=new Map();this.failures=[];this.replacements=0;this.cutawayTriangles=0;}
 async load(){const manifest=await fetch(assetURL('../assets/kenney/manifest.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Asset manifest unavailable');return r.json();}),manager=new T.LoadingManager();manager.setURLModifier(uri=>assetURL(uri,import.meta.url));const loader=new GLTFLoader(manager);
  await Promise.all(Object.entries(manifest.packs).flatMap(([pack,p])=>p.models.map(async ({file})=>{const key=pack+'/'+file.replace('.glb','');try{const gltf=await loader.loadAsync(new URL('../assets/kenney/'+pack+'/'+file,import.meta.url).href);if(pack==="train")prepareTrainWheels(gltf.scene);gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});this.models.set(key,gltf);}catch(e){this.failures.push(key);this.view.log('asset_load_failed',{asset:key,message:String(e)});}})));
  if(this.failures.length){const n=document.createElement('div');n.id='assetWarning';n.textContent='V13 素材加载失败：'+this.failures.join(', ')+' · 此处使用简化备份，请重新加载';document.getElementById('viewport').append(n);}
 }
 clone(key){const data=this.models.get(key);if(!data)return null;const group=new T.Group();group.name='Kenney-'+key;const model=data.scene.clone(true);group.add(model);group.userData.model=model;group.userData.clips=data.animations;this.replacements++;return group;}
 // Size in game metres, pivot at bottom centre. Transform the model, preserving nodes.
 fit(key,size,rotation=0){const group=this.clone(key);if(!group)return null;const model=group.userData.model;model.rotation.y=rotation;model.updateMatrixWorld(true);const box=new T.Box3().setFromObject(model),extent=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());group.scale.set(size[0]/extent.x,size[1]/extent.y,size[2]/extent.z);model.position.set(-center.x,-box.min.y,-center.z);return group;}
 add(parent,key,size,pos=[0,0,0],rotation=0){const m=this.fit(key,size,rotation);if(m){m.position.set(...pos);parent.add(m);}return m;}
 car(m,type){if(!this.models.has('train/train-carriage-flatbed'))return false;
  m.getObjectByName('Hull').visible=false;for(const o of m.children)if(o.name==='Wheel')o.visible=false;m.getObjectByName('RoofCutaway').visible=false;
  const flatbed=this.add(m,'train/train-carriage-flatbed',[7.9,2.78,3.0],[0,0,0],-Math.PI/2);if(flatbed)this.cutawayTriangles+=cutForeground(flatbed,m,{floor:1.12}).removedTriangles;
  if(type==='engine')this.add(m,'train/train-diesel-a',[7.4,2.65,1.65],[0,.14,-.72],-Math.PI/2);
  else if(type==='cargo')this.add(m,'train/train-carriage-container-red',[7.5,3.35,1.15],[0,0,-1.05],-Math.PI/2);
  else this.add(m,'industrial/shipping-container-a',[5.8,type==='battery'?2.2:1.4,1.05],[0,1.1,-.94],Math.PI/2);
  buildServiceCarBody(this.view,m,type);
  this.add(m,'train/train-connector',[.45,.45,.65],[4.07,.45,0],Math.PI/2);
  return true;
 }
 actor(rig,enemy){const key=enemy?'characters/character-h':'characters/character-g',body=this.fit(key,[.65,1.72,.65],Math.PI/2);if(!body)return;
  for(const name of ['Body','LegL','LegR','Player-visual-kit']){const o=rig.getObjectByName(name);if(o)o.visible=false;}
  // Keep attack meshes and muzzle sockets. Replace original torso/head/legs with the
  // animated character; role equipment remains recognisable across enemy behaviours.
  rig.add(body);const mixer=new T.AnimationMixer(body.userData.model),clips=body.userData.clips,actions=new Map();for(const clip of clips)actions.set(clip.name,mixer.clipAction(clip));rig.userData.kenney={mixer,actions,state:null};
 }
 animate(rig,p,dt,moving){const k=rig.userData.kenney;if(!k)return;const state=p.carry?'holding-both':p.swing>0?'attack-melee-right':moving?'walk':'idle';if(k.state!==state){k.actions.get(k.state)?.fadeOut(.1);k.actions.get(state)?.reset().fadeIn(.1).play();k.state=state;}k.mixer.update(Math.min(dt,.1));}
 segment(parts,i,theme){if(!this.models.has('industrial/building-h'))return false;
  if(theme==='industrial'){this.add(parts,i%2?'industrial/building-h':'industrial/building-i',[12,7+(i%3)*2,9],[0,0,0]);if(i%3===0)this.add(parts,'industrial/water-tower',[3,12,3],[7,0,-5]);if(i%4===0)this.add(parts,'factory/crane',[8,11,7],[-7,0,0]);}
  else if(theme==='freight'){for(let k=0;k<4;k++)this.add(parts,'industrial/shipping-container-a',[6,2.5,3.5],[(k%2)*6.4-3.2,Math.floor(k/2)*2.5,0],Math.PI/2);if(i%3===0)this.add(parts,'factory/crane',[8,10,6],[7,0,-3]);}
  else {for(const x of [-5.7,5.7]){this.add(parts,'factory/structure-wall',[.8,10,7],[x,0,0]);this.add(parts,'factory/structure-tall',[.6,10,2],[x,0,3]);}this.add(parts,'factory/structure-doorway-wide',[12,2,1],[0,9,0]);}
  return true;
 }
 depot(group){if(!this.models.has('factory/catwalk-straight'))return;
  // Keep bridge identity/visibility authoritative; replace the station floor and rails.
  for(const child of [...group.children])if(child.isMesh&&child.name!=='Roof-Depot-Bridge')child.visible=false;
  for(let k=0;k<12;k++){const platform=this.add(group,'factory/catwalk-straight',[2,1.2,4],[k*2-11,catwalkBaseY(4.12,1.2),0]);if(platform)this.cutawayTriangles+=cutForeground(platform,group,{floor:4.12}).removedTriangles;}
  for(const x of [-10,-5,0,5,10])this.add(group,'factory/structure-tall',[.7,4,2.9],[x,0,0]);
  this.add(group,'factory/structure-doorway-wide',[5,3.2,.8],[0,4.12,-1.8]);this.add(group,'factory/door-wide-open',[3,2.5,.5],[0,4.12,-1.65]);
  this.add(group,'factory/catwalk-stairs',[4,4,2],[-10,0,-3.4]);this.add(group,'factory/catwalk-corner',[2,1.2,2],[11,3.97,-1]);
 }
 tracks(world){if(!this.models.has('train/railroad-straight'))return;world.tangent.visible=false;world.sleepers.visible=false;world.assetTracks=[];
  for(let i=0;i<14;i++){const m=this.fit('train/railroad-straight',[8,.22,2.8],-Math.PI/2);world.rails.add(m);world.assetTracks.push(m);}
 }
 trackStep(world,focus,travel){for(let i=0;i<(world.assetTracks?.length||0);i++)world.assetTracks[i].position.set(Math.floor(focus/16)*16-48+i*8+travel%8,.02,0);}
 snapshot(){return {assetModelsLoaded:this.models.size,foregroundCutawayTriangles:this.cutawayTriangles,assetFailures:[...this.failures],assetReplacements:this.replacements,assetStyle:'Kenney CC0 / industrial railway',modelOrigin:'Kenney GLB'};}
}
