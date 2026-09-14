import * as T from '../vendor/three.module.min.js';
import {ROUTES} from './content.js';
import {V11} from './balance.js';
// Static hub and (in V11-C) moving ring scenery. No gameplay state or rewards.
export class RouteWorld {
  constructor(view){
    this.view=view;this.hub=new T.Group();this.hub.name='Roundhouse-Three-Exit';view.scene.add(this.hub);
    this.deck=new T.Group();this.hub.add(this.deck);
    this.platform=view.cyl(this.deck,0,.02,0,13,.18,0x587682,48);
    this.rim=new T.Mesh(new T.TorusGeometry(13,.14,6,64),view.mat(0xe1b961));
    this.rim.rotation.x=Math.PI/2;this.rim.position.y=.14;this.deck.add(this.rim);
    this.gates=[];const colors=[0xd7a355,0x69bbac,0xcb746c];
    Object.values(ROUTES).forEach((r,i)=>{
      const gate=new T.Group(),angle=V11.routes[r.id].gateAngle;
      gate.name=r.gate;gate.position.set(-25*Math.cos(angle),0,25*Math.sin(angle));gate.rotation.y=angle;
      for(const z of [-2.6,2.6])view.box(gate,0,3.1,z,.65,6.2,.6,0x455c6b);
      view.box(gate,0,6.25,0,.7,.55,5.8,colors[i]);view.box(gate,-.4,3.0,0,.18,5.8,4.6,0x132735);
      for(const z of [-.9,.9])view.box(gate,3,.16,z,9,.18,.13,0x9ea9a7);
      view.box(gate,.02,5.64,0,.2,.32,4.5,colors[i]);
      this.hub.add(gate);this.gates.push({id:r.id,mesh:gate,angle});
    });
  }
  snapshot(){return {gateCount:this.gates.length,gateAngles:Object.fromEntries(this.gates.map(g=>[g.id,g.angle])),turntableAngle:this.deck.rotation.y};}
}
