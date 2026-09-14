import {B,V11,capFor,reserveFor,intervalFor} from './balance.js?v=11';
import {ROUTES,ENEMIES} from './content.js';
// Admission, pacing and route weighting only. Gameplay state writes go through Game methods.
export class Director {
  constructor(){this.clock=0;this.rest=0;this.faultUsed=false;this.fault=null;this.maxLoad=0;this.spawns=0;this.distressOffered=false;}
  enemyLoad(g){return g.enemies.filter(e=>e.hp>0).length;}
  load(g){return this.enemyLoad(g)+reserveFor(g.round);}
  weak(g){return g.engineState==='critical'||g.alive&&g.player.hp<=20;}
  recover(g,reason,seconds=B.recoveryTime){this.rest=Math.max(this.rest,seconds);this.clock=0;g.tell('recovery_started',{reason,seconds});}
  effectiveCap(g){return Math.max(reserveFor(g.round)+1,capFor(g.round)+(g.repeatPressure||0)-(this.weak(g)?1:0));}
  canSpawn(g){return this.load(g)+1<=this.effectiveCap(g)&&this.enemyLoad(g)<V11.enemyLimit;}
  pool(g){return g.round===1?[...ROUTES[g.route||'industrial'].firstEnemies]:Object.keys(ENEMIES).filter(type=>type!=='bruiser'||g.round>=3);}
  weights(g){
    const pool=this.pool(g),cargoCars=g.cars.filter(c=>c.type==='cargo').length;
    return Object.fromEntries(pool.map(type=>{
      let weight=g.round===1?(type==='boarder'?1-V11.firstSpecialWeight:V11.firstSpecialWeight):V11.routeWeights[g.route||'industrial'][type];
      if(type==='thief')weight*=1+V11.cargoThiefWeight*Math.max(0,cargoCars-1);
      return [type,weight];
    }));
  }
  chooseType(g){const entries=Object.entries(this.weights(g));let roll=g.rand()*entries.reduce((sum,[,weight])=>sum+weight,0);for(const [type,weight] of entries){roll-=weight;if(roll<0)return type;}return entries.at(-1)[0];}
  cancelFault(g,reason){if(!this.fault)return;this.fault=null;g.tell('fault_resolved',{reason});this.recover(g,'engine_fault');}
  step(g,dt){
    this.rest=Math.max(0,this.rest-dt);
    if(this.fault){
      const f=this.fault;f.time+=dt;
      if(f.time>=B.faultLead&&!f.active){f.active=true;g.tell('engine_fault_active');}
      if(f.active){f.tick+=Math.min(dt,Math.max(0,f.time-B.faultLead));if(f.tick>=1-1e-8){f.tick-=1;g.damageCar(0,B.faultDPS,'engine_fault');}}
      if(f.time>=B.faultLead+B.faultTime-1e-8){this.fault=null;this.recover(g,'fault_ended');g.tell('engine_fault_ended');}
    }
    if(this.weak(g)&&!this.distressOffered){this.distressOffered=true;if(this.rest<=0)this.recover(g,'critical_condition');}
    if(g.practice||this.rest>0||g.engineState==='stalled'){this.clock=0;return;}
    const config=V11.routes[g.route],headroom=((config?.crane?.[0]??config?.tunnel?.[0]??1)-g.t)*V11.duration/V11.speeds.FAST.speed;
    if(g.round>=3&&config?.fault!=null&&g.t>=config.fault&&g.phase==='yard'&&!this.faultUsed&&!this.fault&&headroom>B.faultLead+B.faultTime+1&&g.cars[0].hp/g.cars[0].max>.5&&g.alive&&g.player.hp>40){
      this.faultUsed=true;this.fault={time:0,tick:0,active:false};g.tell('engine_fault_warning',{lead:B.faultLead});g.event='01 冷却故障：3 秒后开始损伤，完成维修可提前止损。';
    }
    if(g.elapsed<V11.turntableSeconds&&g.t===0){this.clock=0;return;}
    this.clock+=dt*V11.speeds[g.speedMode].pressure;
    if(this.clock>=intervalFor(g.round)&&this.canSpawn(g)){
      this.clock=0;const e=g.spawn(this.chooseType(g));if(e){this.spawns++;this.maxLoad=Math.max(this.maxLoad,this.load(g));}
    }
  }
  snapshot(g){const actualHazard=['crane','approach','tunnel'].includes(g.phase)?reserveFor(g.round):0;return{
    cap:capFor(g.round)+(g.repeatPressure||0),effectiveCap:this.effectiveCap(g),enemies:this.enemyLoad(g),reserved:reserveFor(g.round),load:this.load(g),
    actual:this.enemyLoad(g)+Math.max(actualHazard,this.fault?2:0),maxLoad:this.maxLoad,rest:this.rest,
    fault:this.fault?{time:this.fault.time,active:this.fault.active}:null,relief:this.rest>0||g.engineState==='stalled',
    pool:this.pool(g),weights:this.weights(g),pressure:V11.speeds[g.speedMode].pressure
  };}
}
