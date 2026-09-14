import * as T from '../vendor/three.module.min.js';
import {V11} from './balance.js';
// Shared visual labels and meters. This class never decides interaction or repair outcomes.
export class Stations3D {
  constructor(view){
    this.view=view;this.plane=new T.PlaneGeometry(1,1);this.labels=new Map();
    for(const text of ['ARMORY','SPEED','BATTERY','SERVICE']){
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
      const c=canvas.getContext('2d');c.fillStyle='#102d39';c.fillRect(0,0,256,64);c.strokeStyle='#8acac2';c.lineWidth=3;c.strokeRect(2,2,252,60);c.fillStyle='#e2f2dd';c.font='bold 32px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,128,33);
      const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
      this.labels.set(text,new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));
    }
  }
  label(car,text,x){const m=new T.Mesh(this.plane,this.labels.get(text));m.name='Station-'+text;m.position.set(x,2.88,-.20);m.scale.set(1.70,.425,1);car.add(m);return m;}
  decorate(model,car){
    if(car.type==='engine'){this.label(model,'ARMORY',V11.armoryX-4.15);this.label(model,'SPEED',V11.consoleX-4.15);}
    if(car.type==='workshop')this.label(model,'SERVICE',0);
    if(car.type==='battery'){
      this.label(model,'BATTERY',0);
      const meter=this.view.box(model,-.1,2.39,-.30,1.2,.14,.06,0x8de2b0);meter.name='BatteryChargeMeter';model.userData.chargeMeter=meter;
    }
  }
  update(model,car){const m=model.userData.chargeMeter;if(m)m.scale.x=1.2*Math.max(.01,car.hp>0?(car.charge||0)/V11.batteryCharge:0);}
}
