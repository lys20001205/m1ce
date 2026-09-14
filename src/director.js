import {B,V11,capFor,reserveFor,intervalFor} from './balance.js?v=11';
// Admission control, not a hidden rubber-band damage system. Existing enemies are never deleted.
export class Director {
  constructor(){this.clock=0;this.rest=0;this.faultUsed=false;this.fault=null;this.maxLoad=0;this.spawns=0;this.distressOffered=false;}
  enemyLoad(g){return g.enemies.filter(e=>e.hp>0).length;}
  load(g){return this.enemyLoad(g)+reserveFor(g.round);}
  recover(g,reason,seconds=B.recoveryTime){this.rest=Math.max(this.rest,seconds);this.clock=0;g.tell('recovery_started',{reason,seconds});}
  effectiveCap(g){const weak=g.engineState==='critical'||g.player.hp<=20;return Math.max(reserveFor(g.round)+1,capFor(g.round)+(g.repeatPressure||0)-(weak?1:0));}
  canSpawn(g){return this.load(g)+1<=this.effectiveCap(g) && this.enemyLoad(g)<16;}
  cancelFault(g,reason){if(!this.fault)return;this.fault=null;g.tell('fault_resolved',{reason});this.recover(g,'engine_fault');}
  step(g,dt){
    this.rest=Math.max(0,this.rest-dt);
    if(this.fault){
      const f=this.fault;f.time+=dt;
      if(f.time>=B.faultLead && !f.active){f.active=true;g.tell('engine_fault_active');}
      if(f.active){f.tick+=Math.min(dt,Math.max(0,f.time-B.faultLead));if(f.tick>=1-1e-8){f.tick-=1;g.damageCar(0,B.faultDPS,'engine_fault');}}
      if(f.time>=B.faultLead+B.faultTime-1e-8){this.fault=null;this.recover(g,'fault_ended');g.tell('engine_fault_ended');}
    }
    const weak=g.engineState==='critical'||g.player.hp<=20;
    // One grace offer per lap, then reduced pressure: staying weak is not permanent immunity.
    if(weak&&!this.distressOffered){this.distressOffered=true;if(this.rest<=0)this.recover(g,'critical_condition');}
    const relief=this.rest>0 || g.engineState==='stalled';
    if(g.practice || relief){this.clock=0;return;}
    // A maintenance fault is advertised, finite, and reserved away from environmental hazards.
    const headroom=((V11.routes[g.route]?.crane?.[0]??V11.routes[g.route]?.tunnel?.[0]??1)-g.t)*V11.duration/V11.speeds.FAST.speed;
    if(g.round>=3 && g.phase==='yard' && !this.faultUsed && !this.fault && headroom>B.faultLead+B.faultTime+1 && g.cars[0].hp/g.cars[0].max>.5 && g.player.hp>40){
      this.faultUsed=true;this.fault={time:0,tick:0,active:false};
      g.tell('engine_fault_warning',{lead:B.faultLead});g.event='01 动力车冷却故障：3 秒后开始损伤，完成维修可提前止损。';
    }
    if(g.elapsed<V11.turntableSeconds&&g.t===0){this.clock=0;return;}
    this.clock+=dt*V11.speeds[g.speedMode].pressure;
    if(this.clock>=intervalFor(g.round) && this.canSpawn(g)){
      this.clock=0;const cargoCars=g.cars.filter(c=>c.type==='cargo').length;
      const type=g.round===1?'boarder':g.rand()<Math.min(.5,.28+.1*Math.max(0,cargoCars-1))?'thief':'boarder';
      const e=g.spawn(type);if(e){this.spawns++;this.maxLoad=Math.max(this.maxLoad,this.load(g));}
    }
  }
  snapshot(g){const actualHazard=['crane','approach','tunnel'].includes(g.phase)?reserveFor(g.round):0;return{
    cap:capFor(g.round)+(g.repeatPressure||0),effectiveCap:this.effectiveCap(g),enemies:this.enemyLoad(g),reserved:reserveFor(g.round),load:this.load(g),
    actual:this.enemyLoad(g)+Math.max(actualHazard,this.fault?2:0),maxLoad:this.maxLoad,
    rest:this.rest,fault:this.fault?{time:this.fault.time,active:this.fault.active}:null,
    relief:this.rest>0||g.engineState==='stalled'
  };}
}
