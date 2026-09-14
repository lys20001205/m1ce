"""V11-F readable exact-hash migration. Non-deploying work-branch validation only."""
from pathlib import Path
import hashlib
root=Path('.')
checks={
'src/balance.js':('1cd190ff4d0f0bddf964a4cd52c35e2391cda80b6a3833f2527b1f8828c02aa4','772f78de6179f038c29e0ebe028d2f0d59918c66bcdf8deda8beedbd4216c50b'),
'src/sim.js':('c89165461dad172caca72e9a73f99f5f468f414bc929be6e3a95af8a84b46f6a','5777664c783a11b01ddc37e270fc4b656936f66e95e8cb8874eb222cc202f325'),
'src/view.js':('09ce67fbb68e77b2b33b28f66cfad2a7a875fb356d7efc5f6b636e1f55ddfae7','a87a756a4a44d745270bce46ae1c00bd48c12c4fb24d26da603ea094d4542101'),
'src/telemetry.js':('8073058e80b5331ee5f0b8baee2cf14714548a7ab44bb9ba072640b5fbc86e46','273ef903cf5adb7befa9b91fb3f99073e10926b132d15f0b5b2e5f64ffaa211b'),
 'tests/simulation.test.mjs':('efa791a6af14c62e663257511f93d416b036179c1e3c7a9c34c84d6e97b3afd6','ec7d9ce127bffbf05ead3e0eadc0499fb76f44587c79bd90c51d32fac8e7f96d'),
 'package.json':('8a19138df28e25bcc6cd6789b0e290a9f7106de08a98fa3c7fd009d91d8a62e0','13e11e6b5669c604f2aed0fab3f1fe31d4ef6236343291fb64254f28fd8c522a')}
for name,(before,after) in checks.items():
 assert hashlib.sha256((root/name).read_bytes()).hexdigest()==before,'BASE MISMATCH '+name
p=root/'src/balance.js';s=p.read_text()
s=s.replace('V11-E-LIFE-20260914','V11-F-ENEMIES-20260914')
s=s.replace('  caps: [2, 3, 4, 5, 6], spawnIntervals: [8.5, 8, 7, 6, 5.2],\n','')
s=s.replace('  boostTime: 4, boostScale: 1.65, boostCost: 35,\n','')
s=s.replace('B.caps[Math.min(4,Math.max(0,round-1))] + Math.min(2,Math.max(0,round-5))','V11.caps[Math.min(V11.caps.length-1,Math.max(0,Math.floor(round)-1))]')
s=s.replace('B.spawnIntervals[Math.min(4,Math.max(0,round-1))]','V11.spawnIntervals[Math.min(V11.spawnIntervals.length-1,Math.max(0,Math.floor(round)-1))]')
s=s.replace('firstSpecialWeight:.28,cargoThiefWeight:.6,enemyLimit:16,','firstSpecialWeight:.28,cargoThiefWeight:.6,enemyLimit:16,enemyBoardingSeconds:.7,enemyLadderSeconds:1.2,thiefEscapeWarning:4.6,')
s=s.replace('damage:9,windup:', 'damage:9,systemDamage:8,windup:').replace('damage:8,windup:', 'damage:8,systemDamage:8,windup:').replace('damage:6,windup:', 'damage:6,systemDamage:6,windup:').replace('damage:20,windup:', 'damage:20,systemDamage:20,windup:').replace('damage:24,windup:', 'damage:24,systemDamage:24,windup:')
p.write_text(s)
p=root/'src/sim.js';s=p.read_text()
s=s.replace('ROUTES,LIFE,LAYER', 'ROUTES,LIFE,LAYER,ENEMIES')
a=s.index('  hitEnemy(');b=s.index('  hurt(',a)
s=s[:a]+'''  hitEnemy(e,damage,dir=this.player.face,weapon='wrench'){
    if(e.hp<=0||!Number.isFinite(damage)||damage<=0)return;
    const spec=V11.enemies[e.type],tool=V11.weapons[weapon]||V11.weapons.wrench;
    const actual=damage*(weapon==='wrench'?(spec.wrenchArmor||1):1);
    e.hp=Math.max(0,e.hp-actual);e.stun=.32*spec.stun;e.flash=.18;
    // Light tools cannot permanently stunlock an armored heavy windup.
    if(e.type!=='bruiser'||tool.knockback>=V11.weapons.axe.knockback)e.wind=0;
    e.x=clamp(e.x+dir*tool.knockback*spec.knockback,.3,this.length-.3);
    this.feedback('hit',e.x,e.y+.8);this.tell('enemy_hit',{id:e.id,type:e.type,damage:actual,weapon});
    if(e.hp>0)return;this.totalKills++;this.inc('kills');this.money+=50;
    if(e.carry){const crate=this.cargoCrates.find(c=>c.id===e.carry);if(crate){crate.location='stored';crate.carIndex=e.cargoCar;}e.carry=false;this.syncCargo();const value=crate?.value||0;this.inc('cargoSaved',value);this.tell('cargo_recovered',{value,enemy:e.id});this.notice('货物追回','保住 '+value+' · 未额外发放救援奖金');}
    this.tell('enemy_kill',{id:e.id,type:e.type,enemy_type:e.type,weapon});this.tell('enemy_killed',{enemy:e.type});this.feedback('kill',e.x,e.y+.9,'+50');
  }
''' +s[b:]
a=s.index('  spawn(');b=s.index('  warn(',a)
s=s[:a]+'''  spawn(type=null,x=null,roof=null){
    if(this.status!=='running'||!this.director.canSpawn(this))return null;
    type??=this.director.chooseType(this);if(!ENEMIES[type])return null;
    const spec=V11.enemies[type];roof??=false;if(type==='clinger')roof=this.phase!=='tunnel';if(type==='thief'||type==='saboteur')roof=false;
    x??=(this.rand()<.5?.5:this.length-.5);
    const e={id:this.nextId++,type,x,y:roof?ROOF:FLOOR,z:.65,roof,face:1,hp:spec.hp,maxHP:spec.hp,wind:0,recovery:0,stun:0,flash:0,climb:type==='clinger'?spec.attach+spec.climb:V11.enemyBoardingSeconds,carry:false,cargoCar:null,escapeWarned:false,state:type==='clinger'?'attach':'boarding',targetKind:null,targetCar:null,layerMove:null};
    if(type==='clinger'){e.y=.45;e.z=1.62;}
    this.enemies.push(e);this.director.maxLoad=Math.max(this.director.maxLoad,this.director.load(this));
    this.tell('enemy_spawn',{id:e.id,type,enemy_type:type,x,roof,load:this.director.load(this),cap:capFor(this.round)+this.repeatPressure});this.tell('spawn',{id:e.id,type,x,roof});return e;
  }
''' +s[b:]
a=s.index('  enemyStep(');b=s.index('  effectsStep(',a)
s=s[:a]+'''  systemTarget(e){
    if(e.type==='saboteur'){
      for(const type of ['battery','workshop','engine']){const candidates=this.cars.map((c,i)=>({c,i})).filter(x=>x.c.type===type&&x.c.hp>0);if(candidates.length)return candidates.sort((a,b)=>Math.abs(stationX(a.i)-e.x)-Math.abs(stationX(b.i)-e.x))[0].i;}
      return -1;
    }
    const local=clamp(Math.floor(e.x/LENGTH),0,this.cars.length-1);
    return this.cars[local].hp>0?local:this.cars.findIndex(c=>c.hp>0);
  }
  moveEnemy(e,target,dt,speed){
    const delta=target-e.x;e.face=Math.sign(delta)||e.face;
    e.x=clamp(e.x+Math.sign(delta)*Math.min(Math.abs(delta),speed*dt),.3,this.length-.3);
  }
  enemyLayerStep(e,roof,dt){
    const targetY=roof?ROOF:FLOOR;
    if(!e.layerMove){const ladder=Math.floor(e.x/LENGTH)*LENGTH+LENGTH*.52;if(Math.abs(e.x-ladder)>.25){this.moveEnemy(e,ladder,dt,V11.enemies[e.type].speed);e.state='to_ladder';return;}
      e.layerMove={from:e.y,to:targetY,roof,remaining:V11.enemyLadderSeconds};e.wind=0;
    }
    const m=e.layerMove;m.remaining=Math.max(0,m.remaining-dt);e.y=m.to+(m.from-m.to)*m.remaining/V11.enemyLadderSeconds;e.state='climb_ladder';
    if(m.remaining<=1e-8){e.roof=m.roof;e.y=m.to;e.layerMove=null;e.state='hunt';}
  }
  enemyStep(dt){
    const p=this.player;
    for(const e of this.enemies){
      if(this.status!=='running')break;
      const spec=V11.enemies[e.type];e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);e.recovery=Math.max(0,e.recovery-dt);
      if(e.hp<=0||e.stun>0)continue;
      if(e.climb>0){
        e.climb=Math.max(0,e.climb-dt);
        if(e.type==='clinger'){
          const u=spec.attach+spec.climb-e.climb;e.state=u<spec.attach?'attach':'climb';
          const fraction=clamp((u-spec.attach)/spec.climb,0,1);e.y=.45+((e.roof?ROOF:FLOOR)-.45)*fraction;e.z=1.62-(1.62-.65)*fraction;
        }
        if(e.climb>1e-8)continue;e.climb=0;e.y=e.roof?ROOF:FLOOR;e.z=.65;e.state='hunt';
      }
      if(e.roof&&this.phase==='tunnel'){e.roof=false;e.y=FLOOR;e.layerMove=null;e.wind=0;}
      if(e.type==='thief'){
        if(e.carry){
          e.state='escape';e.targetKind='escape';e.face=1;e.x+=dt*spec.escapeSpeed;
          const crate=this.cargoCrates.find(c=>c.id===e.carry),value=crate?.value||0;
          if(!e.escapeWarned&&this.length-e.x<V11.thiefEscapeWarning){e.escapeWarned=true;this.tell('thief_escaping',{enemy:e.id,value,seconds:Math.max(0,(this.length-.2-e.x)/spec.escapeSpeed)});}
          if(e.x>=this.length-.2){e.hp=0;this.loseCargo(crate,'thief_escape');e.carry=false;this.tell('cargo_stolen',{enemy:e.id,value});this.event='盗贼逃离：损失 '+value+'，本局仍可继续。';}continue;
        }
        const candidates=this.cargoCrates.filter(c=>c.location==='stored').sort((a,b)=>Math.abs(stationX(a.carIndex)-e.x)-Math.abs(stationX(b.carIndex)-e.x));
        if(candidates.length){
          const crate=candidates[0],target=stationX(crate.carIndex);e.targetKind='cargo';e.targetCar=crate.carIndex;
          if(Math.abs(e.x-target)>.6){this.moveEnemy(e,target,dt,spec.speed);e.wind=0;e.state='seek_cargo';continue;}
          e.state='steal';e.wind+=dt;if(e.wind+1e-8>=spec.windup){crate.location='thief';e.carry=crate.id;e.cargoCar=crate.carIndex;this.syncCargo();e.wind=0;this.tell('thief_pickup',{car:crate.carIndex,enemy:e.id,value:crate.value});this.event='货物被抱走：在盗贼逃离车尾前仍可追回。';}continue;
        }
      }
      const canPursue=this.alive&&this.playerLayer!==LAYER.DEPOT&&e.type!=='saboteur';
      // Boarders and bruisers must actually use a ladder to reach a different player lane.
      if(canPursue&&e.roof!==p.roof&&e.type!=='clinger'){this.enemyLayerStep(e,p.roof,dt);continue;}
      if(e.layerMove){this.enemyLayerStep(e,e.layerMove.roof,dt);continue;}
      const targetPlayer=canPursue&&e.roof===p.roof;
      const carIndex=targetPlayer?-1:this.systemTarget(e);if(!targetPlayer&&carIndex<0){e.state='wait';continue;}
      const target=targetPlayer?p.x:stationX(carIndex),kind=targetPlayer?'player':'system';
      if(e.targetKind!==kind||e.targetCar!==carIndex)e.wind=0;
      e.targetKind=kind;e.targetCar=carIndex;
      if(Math.abs(e.x-target)>spec.reach&&!(e.type==='bruiser'&&e.wind>0)){this.moveEnemy(e,target,dt,spec.speed);e.wind=0;e.state=targetPlayer?'hunt':'seek_system';continue;}
      if(e.recovery>0){e.state='recover';continue;}
      if(e.wind===0){e.face=Math.sign(target-e.x)||e.face;this.tell('enemy_windup',{id:e.id,type:e.type,target:kind,car:carIndex,seconds:spec.windup});}
      e.state=e.type==='saboteur'?'system_windup':e.type==='bruiser'?'heavy_windup':'attack_windup';e.wind+=dt;
      if(e.wind+1e-8>=spec.windup){
        e.wind=0;e.recovery=spec.recovery;e.state='recover';
        if(targetPlayer){if(this.alive&&this.playerLayer!==LAYER.DEPOT&&e.roof===p.roof&&Math.abs(e.x-p.x)<=spec.reach&&(p.x-e.x)*e.face>=-.3)this.hurt(spec.damage,e.type);}
        else if(Math.abs(e.x-stationX(carIndex))<=spec.reach+.1)this.damageCar(carIndex,spec.systemDamage,e.type);
      }
    }
  }
''' +s[b:]
s=s.replace("if(this.round<3&&!p.swingHit", "if(this.playerLayer!==LAYER.DEPOT&&this.round<3&&!p.swingHit")
s=s.replace("e.climb<=0&&(e.x-p.x)", "e.climb<=0&&!e.layerMove&&(e.x-p.x)")
s=s.replace("this.hitEnemy(e,this.round===2?2:1)", "this.hitEnemy(e,V11.weapons.wrench.damage)")
s=s.replace("if(hits.length&&distance<=this.range){this.hitEnemy(hits[0],1,b.dir)", "if(this.playerLayer!==LAYER.DEPOT&&hits.length&&distance<=this.range){this.hitEnemy(hits[0],V11.weapons.handgun.damage,b.dir,'handgun')")
s=s.replace("enemyCount:this.enemies.length,", "enemyCount:this.enemies.length,enemyStates:this.enemies.map(e=>({id:e.id,type:e.type,state:e.state,targetKind:e.targetKind,targetCar:e.targetCar,wind:e.wind,hp:e.hp,x:e.x,y:e.y,roof:e.roof})),")
p.write_text(s)
p=root/'src/view.js';s=p.read_text();s=s.replace("import {RouteWorld}", "import {ActorPresentation} from './actors3d.js';\nimport {RouteWorld}")
s=s.replace("this.juice=new Feedback3D(this)", "this.actorPresentation=new ActorPresentation(this);this.juice=new Feedback3D(this)")
s=s.replace("m.userData.carried=carried;return m", "m.userData.carried=carried;if(enemy)this.actorPresentation.decorateEnemy(m);return m")
s=s.replace("face:e.x>p.x?-1:1", "face:e.face")
s=s.replace("if(e.climb>0)m.position.y-=e.climb*1.5", "if(e.type!=='clinger'&&e.climb>0)m.position.y-=e.climb*1.5")
s=s.replace("m.userData.wrench.visible=!e.carry}", "m.userData.wrench.visible=!e.carry;this.actorPresentation.enemy(m,e)}")
p.write_text(s)
p=root/'tests/simulation.test.mjs';s=p.read_text();s=s.replace('assert.equal(e.hp,2);','assert.equal(e.hp,45);').replace('assert.equal(e.hp,1);','assert.equal(e.hp,23);')
s=s.replace("g.round=3;g.t=.121;g.phase='yard'", "g.round=3;g.t=.151;g.phase='yard'")
p.write_text(s)
p=root/'package.json';p.write_text(p.read_text().replace('tests/life.test.mjs','tests/life.test.mjs tests/enemies.test.mjs'))
p=root/'src/sim.js';s=p.read_text().replace("{id:e.id,type:e.type,damage:actual,weapon}","{id:e.id,enemy_type:e.type,damage:actual,weapon}").replace("{id:e.id,type:e.type,enemy_type:e.type,weapon}","{id:e.id,enemy_type:e.type,weapon}").replace("{id:e.id,type,enemy_type:type,x,roof,load:","{id:e.id,enemy_type:type,x,roof,load:").replace("{id:e.id,type:e.type,target:kind,car:carIndex,seconds:spec.windup}","{id:e.id,enemy_type:e.type,target:kind,car:carIndex,seconds:spec.windup}");p.write_text(s)
p=root/'src/telemetry.js';s=p.read_text().replace("{seq:++this.seq,ms:Math.round(performance.now()),type,...data}","{...data,seq:++this.seq,ms:Math.round(performance.now()),type}");p.write_text(s)
for name,(before,after) in checks.items():
 assert hashlib.sha256((root/name).read_bytes()).hexdigest()==after,'OUTPUT MISMATCH '+name
print('V11-F exact source hashes verified; all browser gates remain mandatory.')
