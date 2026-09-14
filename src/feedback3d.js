import * as T from '../vendor/three.module.min.js';
import {B,V11,stationX} from './balance.js?v=11';
// Small, pooled scene cues. Does not own damage, timers or rewards.
export class Feedback3D {
  constructor(view){
    this.view=view;this.group=new T.Group();view.train.add(this.group);
    this.beacon=new T.Mesh(new T.SphereGeometry(.16,8,6),new T.MeshBasicMaterial({color:0x98e5bd}));this.beacon.position.set(stationX(0),2.78,.70);this.group.add(this.beacon);
    this.smoke=Array.from({length:6},()=>{const m=new T.Mesh(new T.IcosahedronGeometry(.16,0),new T.MeshBasicMaterial({color:0x9faeb2,transparent:true,opacity:.22,depthWrite:false}));this.group.add(m);return m;});
    this.zone=new T.Mesh(new T.PlaneGeometry(2.5,1.9),new T.MeshBasicMaterial({color:0xe7aa54,transparent:true,opacity:.24,side:T.DoubleSide,depthWrite:false}));this.zone.rotation.x=-Math.PI/2;this.group.add(this.zone);
    this.repairRing=new T.Mesh(new T.TorusGeometry(.34,.025,4,20),new T.MeshBasicMaterial({color:0x9ae5bd}));this.repairRing.rotation.x=Math.PI/2;this.group.add(this.repairRing);
    this.speedStreaks=new T.InstancedMesh(view.cube,view.mat(0x90b7bd),18);this.speedStreaks.frustumCulled=false;this.group.add(this.speedStreaks);this.speedScratch=new T.Object3D();
    this.station=new T.Mesh(new T.ConeGeometry(.10,.24,6),new T.MeshBasicMaterial({color:0xeac481}));this.station.rotation.z=Math.PI;this.group.add(this.station);
  }
  update(){
    const {game:g,reducedMotion:reduced}=this.view,t=g.elapsed;
    const moving=g.status==='running'&&g.speed>0&&!g.paused;this.speedStreaks.visible=moving&&!reduced&&g.t>0;const scratch=this.speedScratch,travel=g.t*2*Math.PI*V11.world.radius;for(let i=0;i<18;i++){scratch.position.set(g.player.x-17+(i*2.1+travel*1.5)%36,.5+(i%5)*.78,2.2+(i%3));scratch.scale.set((g.speedMode==='FAST'?1.4:.4),.018,.018);scratch.updateMatrix();this.speedStreaks.setMatrixAt(i,scratch.matrix);}this.speedStreaks.instanceMatrix.needsUpdate=true;
    const color={normal:0x98e5bd,damaged:0xe4bd68,critical:0xe6775c,stalled:0xffa875}[g.engineState]||0x98e5bd;
    this.beacon.material.color.setHex(color);this.beacon.scale.setScalar(!reduced&&['critical','stalled'].includes(g.engineState)?1+.15*Math.sin(t*5):1);
    const count=g.engineState==='normal'?0:g.engineState==='damaged'?3:6;
    this.smoke.forEach((m,i)=>{m.visible=i<count;const u=(t*.35+i/6)%1;m.position.set(1.7+Math.sin(i*2+u)*.24,3.7+u*1.3,-.6);m.scale.setScalar(.5+u*1.8);m.material.opacity=(1-u)*.24;});
    this.zone.visible=g.phase==='crane';this.zone.position.set(g.craneX,4.235,.55);this.zone.material.color.setHex(g.t>=(V11.routes[g.route]?.crane?.[1]??1)?0xe97e5c:0xe7c878);
    this.zone.material.opacity=reduced?.23:.18+Math.abs(Math.sin(t*5))*.08;
    const job=g.repairJob;this.repairRing.visible=!!job;this.repairRing.position.set(g.player.x,1.135,.65);if(job)this.repairRing.scale.setScalar(.8+.4*job.progress/job.duration);
    const index=g.currentCar;this.station.position.set(stationX(index),3.12,.88);this.station.visible=g.status==='running'&&(g.cars[index].hp<g.cars[index].max||index===0&&g.director.fault);
    if(!reduced&&this.station.visible)this.station.position.y+=Math.sin(t*3)*.04;
  }
}
