import * as T from '../vendor/three.module.min.js';
import {LENGTH} from './sim.js';
import {V11} from './balance.js';

// Render-only art direction: train livery, grounding, atmospheric parallax and combat telegraphs.
// No gameplay state writes, targeting changes or collision authority live here.
const CAR_COLORS={engine:0xf0b761,cargo:0x55c4b5,battery:0x64bfe7,workshop:0xd6d0a8};
const ROUTE_MOOD={
  industrial:{far:0x21323a,mid:0x3f5052,signal:0xd8a24a,hemi:0xc9e2e2,ground:0x382f2b,sun:0xffd3a3},
  freight:{far:0x173843,mid:0x2b5e69,signal:0xd98a3e,hemi:0xc3e9ed,ground:0x203238,sun:0xffd7aa},
  tunnel:{far:0x080d14,mid:0x1b2431,signal:0xdf5c4c,hemi:0x8297b2,ground:0x11131b,sun:0x9db8e8}
};
export class WorldPolish{
  constructor(view){
    this.view=view;this.cars=null;this.groups=[];this.scratch=new T.Object3D();this.route=null;
    this.marker=new T.Mesh(new T.RingGeometry(.40,.54,28),new T.MeshBasicMaterial({color:0x9cecff,side:T.DoubleSide,transparent:true,opacity:.78,depthWrite:false}));
    this.marker.name='Player-contact-marker';this.marker.rotation.x=-Math.PI/2;this.marker.renderOrder=3;view.actorGroup.add(this.marker);
    this.beacon=new T.Mesh(new T.OctahedronGeometry(.105,0),new T.MeshBasicMaterial({color:0xc6fbff,transparent:true,opacity:.92,depthWrite:false}));
    this.beacon.name='Player-beacon';this.beacon.renderOrder=3;view.actorGroup.add(this.beacon);
    this.shadow=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:0x02070a,transparent:true,opacity:.30,depthWrite:false}));
    this.shadow.name='Train-contact-shadow';this.shadow.rotation.x=-Math.PI/2;this.shadow.position.y=.015;this.shadow.renderOrder=0;view.train.add(this.shadow);
    this.track=new T.InstancedMesh(view.cube,view.mat(0x789096),40);this.track.name='Trackside-distance-posts';this.track.frustumCulled=false;view.scene.add(this.track);
    this.backdrop=new T.Group();this.backdrop.name='Atmospheric-parallax';view.scene.add(this.backdrop);
    this.farMat=new T.MeshStandardMaterial({color:0x21323a,roughness:1,metalness:0});
    this.midMat=new T.MeshStandardMaterial({color:0x3f5052,roughness:.92,metalness:.04});
    this.signalMat=new T.MeshBasicMaterial({color:0xd8a24a,transparent:true,opacity:.82,depthWrite:false});
    this.far=new T.InstancedMesh(view.cube,this.farMat,22);this.mid=new T.InstancedMesh(view.cube,this.midMat,26);this.signals=new T.InstancedMesh(view.cube,this.signalMat,18);
    for(const m of [this.far,this.mid,this.signals]){m.frustumCulled=false;this.backdrop.add(m);}this.lastTravel=NaN;this.lastBase=NaN;
    this.windupMat=new T.MeshBasicMaterial({color:0xf29b67,transparent:true,opacity:.32,side:T.DoubleSide,depthWrite:false});
    this.windups=new T.InstancedMesh(new T.RingGeometry(.48,.68,24),this.windupMat,V11.enemyLimit);this.windups.name='Enemy-windup-telegraphs';this.windups.frustumCulled=false;view.train.add(this.windups);
  }
  rebuild(){
    const v=this.view;
    for(const mesh of this.groups){mesh.removeFromParent();mesh.dispose();}this.groups=[];this.cars=v.cars;
    const batches=new Map();
    const add=(color,x,y,z,sx,sy,sz)=>{if(!batches.has(color))batches.set(color,[]);batches.get(color).push([x,y,z,sx,sy,sz]);};
    v.game.cars.forEach((car,i)=>{
      const x=i*LENGTH+4.15,c=CAR_COLORS[car.type];
      add(c,x,.84,1.61,7.72,.12,.04);add(c,x,3.53,-1.20,7.52,.14,.045);add(0x17242c,x,.43,.15,7.15,.28,.78);
      add(0x263c48,x,4.135,.78,7.82,.06,.11);add(0x0e171c,x,3.78,-1.22,7.35,.10,.04);
      for(const end of [-3.94,3.94]){add(0x17242c,x+end,1.85,-1.16,.10,3.35,.11);add(c,x+end,1.12,1.57,.15,.30,.065);}
      for(const offset of [-3.0,-1.5,0,1.5,3.0]){add(0x263c48,x+offset,2.02,1.585,.028,1.62,.025);add(0xa9bbc0,x+offset,3.20,-1.245,1.26,.030,.025);}
      for(const offset of [-2.65,2.65]){add(0x111b21,x+offset,.58,1.39,1.18,.20,.10);add(0xd7ddd3,x+offset,.79,1.49,.36,.035,.04);}
      add(c,x,4.15,.25,1.40,.028,.065);add(c,x,4.15,-.75,1.40,.028,.065);
      add(0x8fa8ae,x,1.02,-1.18,6.75,.035,.025);add(c,x,3.36,-1.18,2.2,.035,.028);
    });
    for(const [color,items] of batches){const m=new T.InstancedMesh(v.cube,v.mat(color),items.length);m.name='Livery-'+color;m.frustumCulled=false;
      items.forEach(([x,y,z,sx,sy,sz],i)=>{this.scratch.position.set(x,y,z);this.scratch.rotation.set(0,0,0);this.scratch.scale.set(sx,sy,sz);this.scratch.updateMatrix();m.setMatrixAt(i,this.scratch.matrix);});
      m.instanceMatrix.needsUpdate=true;v.train.add(m);this.groups.push(m);
    }
    this.shadow.position.x=v.game.length*.5;this.shadow.position.z=.15;this.shadow.scale.set(v.game.length*.56,2.75,1);
  }
  applyMood(route){
    if(this.route===route)return;this.route=route;const m=ROUTE_MOOD[route]||ROUTE_MOOD.industrial;
    this.farMat.color.setHex(m.far);this.midMat.color.setHex(m.mid);this.signalMat.color.setHex(m.signal);this.view.hemi.color.setHex(m.hemi);this.view.hemi.groundColor.setHex(m.ground);this.view.sun.color.setHex(m.sun);
    const fog=this.view.scene.fog;if(route==='tunnel'){fog.near=48;fog.far=250;}else if(route==='freight'){fog.near=78;fog.far=390;}else{fog.near=68;fog.far=340;}
  }
  updateBackdrop(route,focus,travel){
    const base=Math.floor(focus/20)*20,s=this.scratch;
    this.backdrop.visible=this.view.game.status==='running'||this.view.game.status==='arriving';
    for(let i=0;i<22;i++){
      const t=(i*37+11)%17,h=route==='industrial'?7+(t%6)*1.8:route==='freight'?3.5+(t%4)*1.35:7+(t%5)*1.5;
      const w=route==='freight'?8+(t%3)*2.6:route==='tunnel'?2.4+(t%2)*1.0:3.2+(t%4)*1.15;
      s.position.set(base-120+i*12+(travel*.10)%12,h*.5-1,-32-(i%3)*3);s.rotation.set(0,0,0);s.scale.set(w,h,5+(i%2)*2);s.updateMatrix();this.far.setMatrixAt(i,s.matrix);
    }
    for(let i=0;i<26;i++){
      const t=(i*19+5)%13,h=route==='tunnel'?6.5+(t%4)*1.3:2.8+(t%5)*1.25,w=route==='freight'?5.8+(t%3)*2.2:2.1+(t%3)*1.0;
      s.position.set(base-100+i*8+(travel*.25)%8,h*.5-.4,-17-(i%2)*2.5);s.rotation.set(0,0,0);s.scale.set(w,h,2.4+(i%3));s.updateMatrix();this.mid.setMatrixAt(i,s.matrix);
    }
    for(let i=0;i<18;i++){
      const x=base-90+i*11+(travel*.42)%11,y=route==='tunnel'?4.5+(i%3)*1.1:2.0+(i%4)*1.3;
      s.position.set(x,y,-9);s.rotation.set(0,0,0);s.scale.set(route==='freight'?1.6:.34,.06,.07);s.updateMatrix();this.signals.setMatrixAt(i,s.matrix);
    }
    this.far.instanceMatrix.needsUpdate=true;this.mid.instanceMatrix.needsUpdate=true;this.signals.instanceMatrix.needsUpdate=true;
  }
  updateWindups(){
    const g=this.view.game,s=this.scratch;let n=0;
    for(const e of g.enemies){if(e.hp<=0||e.wind<=0||n>=V11.enemyLimit)continue;const spec=V11.enemies[e.type],u=Math.max(0,Math.min(1,1-e.wind/spec.windup));
      s.position.set(e.x,(e.y||0)+.035,e.z??.65);s.rotation.set(Math.PI/2,0,0);s.scale.set(1+u*.65,1+u*.65,1);s.updateMatrix();this.windups.setMatrixAt(n++,s.matrix);
    }
    this.windups.count=n;this.windups.instanceMatrix.needsUpdate=true;this.windupMat.opacity=.22+.13*Math.abs(Math.sin(this.view.game.elapsed*7));
  }
  update(){
    const v=this.view,g=v.game,p=g.player;if(this.cars!==v.cars)this.rebuild();const route=g.route||g.previousRoute||'industrial';this.applyMood(route);
    this.marker.visible=g.alive;this.beacon.visible=g.alive;this.marker.position.set(p.x,p.y+.025,p.z??.65);this.beacon.position.set(p.x,p.y+2.14,p.z??.65);
    this.marker.material.color.setHex(g.playerLayer==='DEPOT'?0xffd28a:0x9cecff);this.beacon.scale.setScalar(v.reducedMotion?1:1+.12*Math.sin(g.elapsed*5));
    const focus=g.alive?p.x:3,base=Math.floor(focus/20)*20,travel=g.t*2*Math.PI*V11.world.radius;
    if(travel!==this.lastTravel||base!==this.lastBase){
      for(let i=0;i<40;i++){const x=base-100+i*5+travel%5;this.scratch.position.set(x,.33,-3.4);this.scratch.rotation.set(0,0,0);this.scratch.scale.set(.13,.66,.13);this.scratch.updateMatrix();this.track.setMatrixAt(i,this.scratch.matrix);}
      this.track.instanceMatrix.needsUpdate=true;this.lastTravel=travel;this.lastBase=base;
    }
    this.updateBackdrop(route,focus,travel);this.updateWindups();
  }
  snapshot(){return {liveryBatches:this.groups.length,liveryInstances:this.groups.reduce((n,m)=>n+m.count,0),contactMarker:this.marker.visible,polishDrawObjects:this.groups.length+7,backdropInstances:this.far.count+this.mid.count+this.signals.count,windupCount:this.windups.count};}
  dispose(){for(const m of [...this.groups,this.track,this.far,this.mid,this.signals,this.windups,this.shadow]){m.removeFromParent();m.dispose();}for(const m of [this.marker,this.beacon]){m.removeFromParent();m.geometry.dispose();m.material.dispose();}for(const m of [this.farMat,this.midMat,this.signalMat,this.windupMat])m.dispose();this.groups=[];}
}
