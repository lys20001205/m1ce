import * as T from '../vendor/three.module.min.js';
import {LENGTH} from './sim.js';
import {V11} from './balance.js';

// Render-only livery, contact marker and trackside detail. No gameplay state writes.
const COLORS={engine:0xeeb96b,cargo:0x64c9be,battery:0x79c9e8,workshop:0xd9d6ae};
export class WorldPolish{
  constructor(view){
    this.view=view;this.cars=null;this.groups=[];this.scratch=new T.Object3D();
    this.marker=new T.Mesh(new T.RingGeometry(.40,.53,28),new T.MeshBasicMaterial({color:0x99eeff,side:T.DoubleSide,transparent:true,opacity:.84,depthWrite:false}));
    this.marker.name='Player-contact-marker';this.marker.rotation.x=-Math.PI/2;this.marker.renderOrder=2;view.actorGroup.add(this.marker);
    this.beacon=new T.Mesh(new T.OctahedronGeometry(.10,0),new T.MeshBasicMaterial({color:0xb1f5ff}));this.beacon.name='Player-beacon';view.actorGroup.add(this.beacon);
    this.track=new T.InstancedMesh(view.cube,view.mat(0x8ba2a4),36);this.track.name='Trackside-distance-posts';this.track.frustumCulled=false;view.scene.add(this.track);
    this.lastTravel=NaN;this.lastBase=NaN;
  }
  rebuild(){
    const v=this.view;
    for(const mesh of this.groups){mesh.removeFromParent();mesh.dispose();}this.groups=[];this.cars=v.cars;
    const batches=new Map();
    const add=(color,x,y,z,sx,sy,sz)=>{if(!batches.has(color))batches.set(color,[]);batches.get(color).push([x,y,z,sx,sy,sz]);};
    v.game.cars.forEach((car,i)=>{
      const x=i*LENGTH+4.15,c=COLORS[car.type];
      add(c,x,.84,1.61,7.7,.11,.035);add(c,x,3.53,-1.20,7.5,.13,.04);
      add(0x253947,x,4.135,.78,7.8,.055,.10); // Walkable roof edge, no front wall.
      for(const offset of [-3.60,3.60]){add(c,x+offset,1.31,1.55,.13,.24,.055);add(0xe8e6cc,x+offset,1.18,1.60,.27,.04,.06);}
      for(const offset of [-2.55,0,2.55]){add(0xa8c5cf,x+offset,3.20,-1.24,1.38,.028,.025);add(0x7895a3,x+offset,2.96,-1.24,.035,.45,.025);}
      // Roof hatch rails preserve the yellow ladder as the action landmark.
      add(c,x,4.145,.25,1.35,.025,.06);add(c,x,4.145,-.75,1.35,.025,.06);
    });
    for(const [color,items] of batches){const m=new T.InstancedMesh(v.cube,v.mat(color),items.length);m.name='Livery-'+color;m.frustumCulled=false;
      items.forEach(([x,y,z,sx,sy,sz],i)=>{this.scratch.position.set(x,y,z);this.scratch.rotation.set(0,0,0);this.scratch.scale.set(sx,sy,sz);this.scratch.updateMatrix();m.setMatrixAt(i,this.scratch.matrix);});
      m.instanceMatrix.needsUpdate=true;v.train.add(m);this.groups.push(m);
    }
  }
  update(){
    const v=this.view,g=v.game,p=g.player;if(this.cars!==v.cars)this.rebuild();
    this.marker.visible=g.alive;this.beacon.visible=g.alive;
    this.marker.position.set(p.x,p.y+.025,p.z??.65);this.beacon.position.set(p.x,p.y+2.12,p.z??.65);
    this.marker.material.color.setHex(g.playerLayer==='DEPOT'?0xffd28a:0x99eeff);
    const focus=g.alive?p.x:3,base=Math.floor(focus/20)*20,travel=g.t*2*Math.PI*V11.world.radius;
    if(travel!==this.lastTravel||base!==this.lastBase){
      for(let i=0;i<36;i++){const x=base-90+i*5+travel%5;this.scratch.position.set(x,.33,-3.4);this.scratch.rotation.set(0,0,0);this.scratch.scale.set(.13,.66,.13);this.scratch.updateMatrix();this.track.setMatrixAt(i,this.scratch.matrix);}
      this.track.instanceMatrix.needsUpdate=true;this.lastTravel=travel;this.lastBase=base;
    }
  }
  snapshot(){return {liveryBatches:this.groups.length,contactMarker:this.marker.visible,polishDrawObjects:this.groups.length+3};}
  dispose(){for(const m of [...this.groups,this.track]){m.removeFromParent();m.dispose();}for(const m of [this.marker,this.beacon]){m.removeFromParent();m.geometry.dispose();m.material.dispose();}this.groups=[];}
}
