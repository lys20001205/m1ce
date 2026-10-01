import * as T from '../vendor/three.module.min.js';
import {ROUTES} from './content.js';
import {V11} from './balance.js';
import {ringPose,depotPose} from './contracts.js';
// Render-only railway frame. One selected ring; the train remains in stable local space.
const ART={
 industrial:{sky:0x263840,body:0x586b70,accent:0xd9a24a,secondary:0x745f54,name:'FOUNDRY / EXHAUST TOWERS'},
 freight:{sky:0x244852,body:0x327784,accent:0xd98a3e,secondary:0x405f7a,name:'FREIGHT GANTRY / STACK YARD'},
 tunnel:{sky:0x090f17,body:0x303844,accent:0xdf5c4c,secondary:0x565267,name:'VENTILATION / EMERGENCY CONDUIT'}
};
export class RouteWorld {
 constructor(view){
  this.view=view;this.route=null;this.segments=[];this.landmarks=[];this.depots=[];
  this.scratch=new T.Object3D();this.point=new T.Vector3();
  this.hub=new T.Group();this.hub.name='Roundhouse-Three-Exit';view.railFrame.add(this.hub);
  this.deck=new T.Group();this.hub.add(this.deck);
  this.platform=view.cyl(this.deck,0,.02,0,13,.18,0x587682,48);
  this.rim=new T.Mesh(new T.TorusGeometry(13,.14,6,64),view.mat(0xe1b961));
  this.rim.rotation.x=Math.PI/2;this.rim.position.y=.14;this.deck.add(this.rim);
  this.gates=[];
  Object.values(ROUTES).forEach(r=>{
   const gate=new T.Group(),angle=V11.routes[r.id].gateAngle,color=ART[r.id].accent;
   gate.name=r.gate;gate.position.set(-25*Math.cos(angle),0,25*Math.sin(angle));gate.rotation.y=angle;
   for(const z of [-2.6,2.6])view.box(gate,0,3.1,z,.65,6.2,.6,0x455c6b);
   view.box(gate,0,6.25,0,.7,.55,5.8,color);view.box(gate,-.4,3,0,.18,5.8,4.6,0x132735);
   for(const z of [-.9,.9])view.box(gate,3,.16,z,9,.18,.13,0x9ea9a7);
   view.box(gate,.02,5.64,0,.2,.32,4.5,color);this.hub.add(gate);this.gates.push({id:r.id,mesh:gate,angle});
  });
  this.root=new T.Group();this.root.name='Selected-Continuous-Ring';view.railFrame.add(this.root);
  this.rails=new T.Group();view.railFrame.add(this.rails);
  for(const radius of [V11.world.radius-.9,V11.world.radius+.9]){
   const rail=new T.Mesh(new T.TorusGeometry(radius,.095,4,256),view.mat(0x88969c));
   rail.rotation.x=Math.PI/2;rail.position.set(0,.13,-V11.world.radius);this.rails.add(rail);
  }
  // Near-track tangent stabilizes the cutaway consist; the distant rails describe the loop.
  this.tangent=new T.Group();this.rails.add(this.tangent);
  for(const z of [-.9,.9])view.box(this.tangent,0,.14,z,240,.16,.12,0x9badb0).castShadow=false;
  this.sleepers=new T.InstancedMesh(view.cube,view.mat(0x524b3c),160);this.sleepers.frustumCulled=false;this.rails.add(this.sleepers);
  this.visibleSegments=0;this.nearSegments=0;
 }
 // Batch shared primitive geometry/material once, on route selection, never in the frame loop.
 batch(parts){
  parts.updateMatrixWorld(true);const groups=new Map(),out=new T.Group();
  parts.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+':'+o.material.uuid;
   if(!groups.has(key))groups.set(key,{geo:o.geometry,mat:o.material,matrices:[]});
   groups.get(key).matrices.push(o.matrixWorld.clone());
  });
  for(const b of groups.values()){
   const m=new T.InstancedMesh(b.geo,b.mat,b.matrices.length);b.matrices.forEach((x,i)=>m.setMatrixAt(i,x));
   m.instanceMatrix.needsUpdate=true;m.castShadow=false;m.receiveShadow=false;out.add(m);
  }
  return out;
 }
 makeSegment(i,theme){
  const v=this.view,a=ART[theme],parts=new T.Group(),far=new T.Group();
  if(v.assets?.segment(parts,i,theme)){const near=this.batch(parts);const group=new T.Group();group.add(near,far);this.root.add(group);return {marker:i/V11.world.segments,group,near,far};}
  if(theme==='industrial'){
   v.box(parts,0,3,0,8,6,6,a.body);v.box(parts,0,6.15,0,8.4,.3,6.3,a.secondary);v.box(parts,0,.55,2.8,9,.8,.35,0x28363b);
   for(const x of [-2.5,0,2.5]){v.box(parts,x,3.3,3.04,1.6,.9,.08,0xb8d0d0);v.box(parts,x,4.55,3.02,1.65,.10,.09,a.accent);}
   for(const x of [-2.6,2.5]){v.cyl(parts,x,9,-1.5,.65,7,a.secondary);v.cyl(parts,x,12.6,-1.5,.82,.25,a.accent);v.box(parts,x,6.9,-1.5,.16,5.5,.16,0x3a484b);}
   v.box(parts,0,4,-5,13,.6,.7,a.accent);for(const x of [-5.5,5.5])v.box(parts,x,2,-5,.4,4,.4,a.body);
   for(const y of [1.45,2.25,3.05]){const pipe=v.cyl(parts,0,y,-3.0,.16,10.5,0x59696c);pipe.rotation.z=Math.PI/2;}
   if(i%3===0){const arm=v.box(parts,5.5,7,2,.55,6,.7,a.accent);arm.rotation.z=.6;v.box(parts,4,9,2,5,.6,.7,a.accent);v.box(parts,1.5,7.9,2,.4,.4,.4,0xe5c26d);}
   if(i%10===2){for(const x of [-4.2,4.2]){v.cyl(parts,x,9.8,-2.4,.82,9,0x4a5b5e);v.cyl(parts,x,14.4,-2.4,1.0,.35,a.accent);}const link=v.cyl(parts,0,9.5,-2.4,.24,8.4,a.accent);link.rotation.z=Math.PI/2;}
   v.box(far,0,5,-1,8,10,6,0x415257);
  }else if(theme==='freight'){
   for(let k=0;k<6;k++){const c=k%2?a.accent:a.body,x=(k%2)*6.5-3.3,y=1.35+Math.floor(k/2)*2.7;v.box(parts,x,y,(i%2)*-1,6,2.55,3.8,c);v.box(parts,x,y+1.0,1.93,5.2,.08,.06,0xd1c39b);}
   for(const x of [-5.8,-3.5,-1.2,1.2,3.5,5.8])v.box(parts,x,2.6,2.01,.10,5.1,.08,0xaac1bf);
   v.box(parts,0,.7,-2.2,15,.18,1.2,0x253a43);for(const x of [-6,-2,2,6])v.box(parts,x,.95,-2.1,2.8,.08,.08,0xd0b06c);
   if(i%3===0){for(const x of [-8,8]){v.box(parts,x,5,-3,.6,10,.8,a.secondary);v.box(parts,x,1.2,-2.7,.9,.18,.9,0x253746);}v.box(parts,0,10.1,-3,17,.7,1.1,a.accent);v.box(parts,0,8.8,-2.7,1.2,1.6,.5,0x314b57);}
   if(i%10===2){for(const x of [-6,6])v.box(parts,x,6.3,-1.8,.45,8,.5,0x314d59);v.box(parts,0,10.3,-1.8,13,.45,.7,0xd49a4a);const hook=v.box(parts,1.8,7.3,-1.5,.18,5.1,.2,0x735b44);hook.rotation.z=-.12;}
   v.box(far,0,4,0,12,8,4,0x2b5660);
  }else{
   for(const x of [-5.7,5.7]){v.box(parts,x,6,0,1.1,12,8,a.body);v.box(parts,x,7.3,4.1,1.4,.35,.25,a.accent);for(const y of [1.4,3.8,6.2,8.6])v.box(parts,x*.92,y,2.7,.22,.16,2.0,0x727181);}
   v.box(parts,0,12.1,0,13,1.4,8,a.secondary);v.box(parts,0,3,-3,10,6,.6,a.body);
   for(const y of [2,3.2,4.4]){const pipe=v.cyl(parts,0,y,3.5,.26,13,0x777785);pipe.rotation.z=Math.PI/2;}
   for(const x of [-4,-2,0,2,4])v.box(parts,x,5.65,3.92,.52,.13,.12,i%2?a.accent:0x8a7f91);
   for(const x of [-5.9,5.9])for(const y of [2.1,5.2,8.3])v.box(parts,x,y,3.95,.22,.55,.18,a.accent);
   if(i%10===2){const fan=v.cyl(parts,0,6.7,-2.6,1.8,.25,0x68707d,20);fan.rotation.x=Math.PI/2;for(const a2 of [0,Math.PI/2]){const blade=v.box(parts,0,6.7,-2.75,3.1,.22,.12,0x303945);blade.rotation.z=a2;}}
   v.box(far,0,7,-2,13,14,5,0x202733);
  }
  const near=this.batch(parts);far.traverse(o=>{if(o.isMesh)o.castShadow=false;});
  const group=new T.Group();group.add(near,far);this.root.add(group);
  return {marker:i/V11.world.segments,group,near,far};
 }
 select(route){
  if(this.route===route)return;this.route=route;
  this.root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});this.root.clear();this.segments=[];this.landmarks=[];this.depots=[];
  for(let i=0;i<V11.world.segments;i++)this.segments.push(this.makeSegment(i,route));
  for(const i of [2,10,20,30])this.landmarks.push({id:route+'-'+i,name:ART[route].name,segment:this.segments[i]});
  const v=this.view;
  V11.routes[route].depots.forEach((marker,i)=>{
   const group=new T.Group();group.name='Depot-'+route+'-'+i;
   v.box(group,0,4,0,V11.depot.width,.24,V11.depot.depth,0x6d8790);
   for(const x of [-10,-5,0,5,10]){v.box(group,x,2,0,.6,4,2.8,0x405766);v.box(group,x,4.15,1.86,2,.06,.18,ART[route].accent);}
   for(const x of [-11.6,11.6]){v.box(group,x,5.7,-1.8,.18,3.2,.18,0x8fa7ab);v.box(group,x,7.35,-1.8,.7,.15,.45,ART[route].accent);}
   const bridge=v.box(group,0,4,3.25,2.5,.24,2.6,0x8ba2a4);bridge.name='Roof-Depot-Bridge';
   v.assets?.depot(group);const cargo=new T.Group();group.add(cargo);this.root.add(group);
   const crates=[];for(let k=0;k<V11.routes[route].crates;k++){const m=v.crateTemplate.clone(true);cargo.add(m);crates.push(m);}
   this.depots.push({id:route+'-'+i,marker,group,bridge,cargo,crates});
  });
 }
 update(){
  const g=this.view.game,focus=g.alive?g.player.x:V11.respawnX,route=g.route||g.previousRoute||'industrial';this.select(route);
  const hub=ringPose(g.t,0);this.hub.position.set(g.length*.5+hub.x,0,hub.z);this.hub.rotation.y=-hub.angle;
  this.hub.visible=(g.status==='ready'||g.t===0)&&Math.hypot(hub.x-focus,hub.z)<V11.world.farCull;
  this.visibleSegments=0;this.nearSegments=0;
  for(const s of this.segments){
   const p=ringPose(g.t,s.marker,-15);s.group.position.set(p.x,0,p.z);s.group.rotation.y=-p.angle;
   const distance=Math.hypot(p.x-focus,p.z);s.group.visible=distance<V11.world.farCull;
   s.near.visible=distance<V11.world.lod;s.far.visible=!s.near.visible;
   if(s.group.visible)this.visibleSegments++;if(s.group.visible&&s.near.visible)this.nearSegments++;
  }
  for(const d of this.depots){const p=depotPose(g.t,d.marker);d.group.position.set(p.x,0,p.z);d.group.rotation.y=-((d.marker-g.t)*Math.PI*2);
   d.group.visible=Math.hypot(p.x-focus,p.z)<V11.world.nearCull;d.bridge.visible=p.connection<V11.depot.connectionLimit&&p.x>=.4&&p.x<=g.length-.4;
   const cargo=g.cargoCrates.filter(c=>c.location==='depot'&&c.depotId===d.id);d.crates.forEach((m,i)=>{m.visible=i<cargo.length;if(cargo[i])m.position.set(cargo[i].x,4.12,0);});
  }
  const travel=g.t*2*Math.PI*V11.world.radius,base=Math.floor(focus/18)*18;
  this.tangent.position.x=base;const s=this.scratch;
  for(let i=0;i<160;i++){s.position.set(base-80+i*1.8+travel%1.8,.025,0);s.rotation.set(0,0,0);s.scale.set(1.04,.18,2.6);s.updateMatrix();this.sleepers.setMatrixAt(i,s.matrix);}
  this.sleepers.instanceMatrix.needsUpdate=true;this.view.assets?.trackStep(this,focus,travel);
 }
 get sky(){return ART[this.route||'industrial'].sky;}
 worldScreen(object,y=0){const p=object.getWorldPosition(new T.Vector3());p.y+=y;const world=p.toArray();p.project(this.view.camera);return {world,screen:[(p.x*.5+.5)*this.view.w,(-.5*p.y+.5)*this.view.h]};}
 snapshot(){return {
  gateCount:this.gates.length,gateAngles:Object.fromEntries(this.gates.map(g=>[g.id,g.angle])),renderedTurntableLocalAngle:this.deck.rotation.y,
  gateScreens:this.gates.map(g=>({id:g.id,...this.worldScreen(g.mesh,3)})),
  routeWorld:this.route,routeSegmentsVisible:this.visibleSegments,routeSegmentsNear:this.nearSegments,routeSegmentsTotal:this.segments.length,loadedRouteWorlds:1,
  landmarks:this.landmarks.map(l=>({id:l.id,name:l.name,marker:l.segment.marker,visible:l.segment.group.visible,...this.worldScreen(l.segment.group,3)})),
  depots:this.depots.map(d=>({id:d.id,marker:d.marker,floorY:4.12,z:d.group.position.z,x:d.group.position.x,visible:d.group.visible,...this.worldScreen(d.group,4.12)}))
 };}
}
