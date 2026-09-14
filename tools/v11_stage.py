"""V11-G: readable hash-bound source migration; never deploys."""
from pathlib import Path
import hashlib
root=Path('.')
checks={'index.html': ['38cb69307c88f53704556c906188add697b6f347240d167a0d0d1e3948cef41a', '41d84474ef3986076ce805be79fe57dfb4a2312745857241e16319ae74cfaf9a'], 'package.json': ['13e11e6b5669c604f2aed0fab3f1fe31d4ef6236343291fb64254f28fd8c522a', '6438c7a845124014bbe98024aa48f13093586dd5f8ccf89835371065b464ba13'], 'src/actors3d.js': ['f0919c0833a1f35df204ac8cd347114a8c6fdfd48cc397eebf1787a97cbd8186', '35eef2f449ec52656c04ef849db72a29d85eaec1f57da7b4e54b5219b1318252'], 'src/balance.js': ['772f78de6179f038c29e0ebe028d2f0d59918c66bcdf8deda8beedbd4216c50b', '26bd31f64403ddc21214aa08325057f661599d7398cb4a32d8c6cb38971c1da4'], 'src/feedback3d.js': ['798ae5e0ade0a7a116f8c967f8a215bcad67ac5b1454d07c0b1769a1e2b5cb9d', '44aca7cd5f782772e061db441a0894f20400b063ddd724e8f02c1111966a9099'], 'src/main.js': ['412ddec66f36619f5ca9e5fe37bbd41e9d8c28ed3b0c2507e80f1c0f163ec764', '367e8c95193db1decc9b978d2f64b844265f542eddc251fd2983e5b68f29e65c'], 'src/sim.js': ['5777664c783a11b01ddc37e270fc4b656936f66e95e8cb8874eb222cc202f325', 'ea6208acddf2158631e7c16895e897c887d3b52daa9804dbb1cc2f7a2db9a6f3'], 'src/view.js': ['a87a756a4a44d745270bce46ae1c00bd48c12c4fb24d26da603ea094d4542101', '5e98dcf129b4110558a04b6dc7c5f1cc46f39a2693896df9eb1b5f7dfc4281c4'], 'style.css': ['7826422fde586be5b40e3e7d88c3076fdaa188c53611d14bc63f849bb7740d32', '88cd72b4a6d58547d0a70fae11c584de84295cad6336152661c706bae4b7cbc2'], 'tests/browser_smoke.py': ['7fafec52e1a23f128343c06dc9f2545c1b76cecae5f30b80cdfbd7aeb0a2ccf0', 'b236ab9e1d6c1263de592be95bbc495197f4a1489ffdca23f02a0bc3eeb7d6ec'], 'tests/model_roundtrip.test.mjs': ['599bf34268e8d0ee9d33953acee13dbd86cf8e5f79b16d164e4b34506c5f3b1c', '706a587e385e53b7882fbeb3704fc0a1105c46d3f4f558d6be833361526aa314'], 'tests/simulation.test.mjs': ['ec7d9ce127bffbf05ead3e0eadc0499fb76f44587c79bd90c51d32fac8e7f96d', '578075023eb14b94b5b9ff0b4f4776ede2e4a0b08b29fe264254697aa7ed4a74']}
for name,(before,after) in checks.items():
 assert hashlib.sha256((root/name).read_bytes()).hexdigest()==before,'BASE MISMATCH '+name
p=root/'src/balance.js';s=p.read_text().replace('V11-F-ENEMIES-20260914','V11-G-COMBAT-20260914')
s=s.replace('stopQuota:6,reinforcementReward:.25,','stopQuota:6,reinforcementReward:.25,stopRegionProgress:.1,depotEncounterDistance:55,')
s=s.replace('  weapons:{', '  combat:{enemyStun:.32,enemyFlash:.18,meleeTargets:2,behindSlack:.3,bulletRadius:.28,rangedFlash:.12,popLifetime:.9},\n  rig:{scale:1.07,armX:.22,armY:1.05,armZ:.22},\n  weapons:{')
s=s.replace('velocity:35,knockback:.25','velocity:35,knockback:.25,muzzle:.795').replace('velocity:42,knockback:.10','velocity:42,knockback:.10,muzzle:1.05').replace('velocity:60,knockback:.65','velocity:60,knockback:.65,muzzle:1.33')
p.write_text(s)
p=root/'src/sim.js';s=p.read_text()
s=s.replace('cargoCapacity,depotPose,isAlive','cargoCapacity,depotPose,isAlive,weaponAt,weaponStats,scrapReward')
s=s.replace('this.round=1;this.scrap=0;', 'this.armoryOpen=false;this.rewardEncounters=new Map();this.round=1;this.scrap=0;')
s=s.replace('cooldown:0,stun:0', 'cooldown:0,rangedCooldown:0,rangedFlash:0,meleeAttack:null,stun:0',1)
s=s.replace("get weapon(){return this.round>=3?'SIDEARM':this.round===2?'HEAVY WRENCH':'WRENCH';}", "get melee(){return weaponAt('melee',this.meleeTier);}\n  get ranged(){return weaponAt('ranged',this.rangedTier);}\n  get combatTier(){return this.meleeTier;}\n  get meleeStats(){return weaponStats('melee',this.meleeTier);}\n  get rangedStats(){return weaponStats('ranged',this.rangedTier);}\n  get weapon(){return this.melee.name+' / '+(this.ranged?.name||'RANGED LOCKED');}")
s=s.replace('get range(){return this.round>=3?9:this.round===2?2.2:1.85;}', 'get range(){return this.rangedStats?.range||this.meleeStats.range;}')
a=s.index('  attack(){');b=s.index('  hitEnemy(',a)
s=s[:a]+'''  get atArmory(){return this.playerLayer===LAYER.INTERIOR&&this.currentCar===0&&Math.abs(this.player.x-V11.armoryX)<=V11.armoryRadius;}
  armoryOffer(slot){
    if(!['melee','ranged'].includes(slot))return null;
    const tier=(slot==='melee'?this.meleeTier:this.rangedTier)+1,weapon=weaponAt(slot,tier);
    return weapon?{slot,tier,weapon:weapon.id,name:weapon.name,cost:weaponStats(slot,tier).cost,locked:slot==='ranged'&&this.combatTier<3}:null;
  }
  openArmory(){
    if(this.status!=='running'||this.paused||!this.alive||!this.atArmory||this.player.carry||this.player.stun>0)return false;
    this.cancelRepair('armory');this.consoleOpen=false;this.armoryOpen=!this.armoryOpen;
    if(this.armoryOpen)this.tell('armory_open',{scrap:this.scrap});return true;
  }
  buyWeapon(slot){
    if(this.status!=='running'||this.paused||!this.alive||!this.armoryOpen||!this.atArmory||this.player.stun>0||this.player.carry)return false;
    const offer=this.armoryOffer(slot);if(!offer||offer.locked||this.scrap<offer.cost)return false;
    this.scrap-=offer.cost;if(slot==='melee')this.meleeTier=offer.tier;else this.rangedTier=offer.tier;
    this.tell('armory_purchase',{slot,weapon:offer.weapon,tier:offer.tier,cost:offer.cost,scrap:this.scrap});
    this.feedback('buy',this.player.x,this.player.y+1.3,offer.name);
    if(slot==='melee'&&offer.tier===3){this.tell('combat_tier_unlock',{tier:3});this.tell('ranged_unlock',{weapon:'handgun'});this.event='COMBAT TIER 3 · HANDGUN AVAILABLE AT ARMORY';}
    return true;
  }
  rewardEncounter(){
    const d=this.nearestDepot();
    if(d&&d.connection<=V11.depotEncounterDistance)return this.round+':depot:'+d.id;
    return ['STOP','SLOW'].includes(this.speedMode)||this.engineState==='stalled'?this.round+':stop:'+Math.floor(this.t/V11.stopRegionProgress):null;
  }
  grantKillScrap(e){
    if(e.rewarded||this.practice)return 0;e.rewarded=true;
    // Admission remembers a stop encounter, so accelerating before the kill cannot reset its quota.
    const key=e.rewardEncounter||this.rewardEncounter(),prior=key?(this.rewardEncounters.get(key)||0):0;
    if(key)this.rewardEncounters.set(key,prior+1);
    const amount=scrapReward(e.type,prior);this.scrap+=amount;
    this.tell('scrap_gain',{enemy:e.id,enemy_type:e.type,amount,total:this.scrap,encounter:key,reinforcement:!!key&&prior>=V11.stopQuota});
    this.feedback('scrap',e.x,e.y+1.2,'+'+amount+' SCRAP');return amount;
  }
  resetCombat(){this.scrap=0;this.meleeTier=1;this.rangedTier=0;this.armoryOpen=false;this.player.swing=0;this.player.meleeAttack=null;this.player.cooldown=0;this.player.rangedCooldown=0;this.player.rangedFlash=0;this.projectiles=[];this.rewardEncounters.clear();}
  attack(){
    if(this.status!=='running'||this.paused||!this.alive)return false;
    const p=this.player;if(p.cooldown>1e-8||p.stun>0||p.carry)return false;
    this.cancelRepair('attack');this.armoryOpen=false;const spec=this.meleeStats;
    p.cooldown=spec.cooldown;p.swing=spec.duration;p.swingHit=false;p.meleeAttack={...spec,weapon:this.melee.id,layer:this.playerLayer};
    this.tell('attack',{x:p.x,roof:p.roof,slot:'melee',weapon:this.melee.id});return true;
  }
  rangedAttack(){
    if(this.status!=='running'||this.paused||!this.alive||!this.ranged||this.playerLayer===LAYER.DEPOT)return false;
    const p=this.player;if(p.rangedCooldown>1e-8||p.stun>0||p.carry)return false;
    this.cancelRepair('attack');this.armoryOpen=false;const spec=this.rangedStats,m=this.muzzle();
    p.rangedCooldown=spec.cooldown;p.rangedFlash=V11.combat.rangedFlash;this.lastMuzzle={...m};
    this.projectiles.push({id:this.nextId++,...m,origin:m.x,dir:p.face,roof:p.roof,weapon:this.ranged.id,damage:spec.damage,range:spec.range,velocity:spec.velocity,life:spec.range/spec.velocity+V11.step});
    this.feedback('muzzle',m.x,m.y);this.tell('projectile_spawn',{...m,roof:p.roof,weapon:this.ranged.id});this.tell('attack',{x:p.x,roof:p.roof,slot:'ranged',weapon:this.ranged.id});return true;
  }
  muzzle(){const r=V11.rig,spec=this.rangedStats||V11.weapons.handgun,p=this.player;return{x:p.x+p.face*(r.armX+spec.muzzle)*r.scale,y:p.y+r.armY*r.scale,z:(p.z??.65)+p.face*r.armZ*r.scale};}
  meleeStep(dt){
    const p=this.player,attack=p.meleeAttack,old=p.swing;p.swing=Math.max(0,p.swing-dt);
    if(!attack||p.swingHit||!this.alive||this.playerLayer===LAYER.DEPOT||this.playerLayer!==attack.layer)return;
    const active=attack.duration-attack.active;
    if(old>active+1e-8&&p.swing<=active+1e-8){
      p.swingHit=true;const targets=this.enemies.filter(e=>e.hp>0&&e.roof===p.roof&&e.climb<=0&&!e.layerMove&&(e.x-p.x)*p.face>=-V11.combat.behindSlack&&(e.x-p.x)*p.face<=attack.range);
      targets.slice(0,V11.combat.meleeTargets).forEach(e=>this.hitEnemy(e,attack.damage,p.face,attack.weapon));this.feedback('swing',p.x,p.y+1);
    }
  }
  projectileStep(dt){
    for(const b of this.projectiles){
      const old=b.x,remaining=Math.max(0,b.range-Math.abs(old-b.origin));b.x+=b.dir*Math.min(b.velocity*dt,remaining);b.life-=dt;
      const r=V11.combat.bulletRadius,hits=this.enemies.filter(e=>e.hp>0&&e.roof===b.roof&&e.climb<=0&&!e.layerMove&&e.x>=Math.min(old,b.x)-r&&e.x<=Math.max(old,b.x)+r).sort((a,c)=>Math.abs(a.x-old)-Math.abs(c.x-old));
      if(hits.length){this.hitEnemy(hits[0],b.damage,b.dir,b.weapon);b.life=0;}
      if(Math.abs(b.x-b.origin)>=b.range-1e-8)b.life=0;
    }
    this.projectiles=this.projectiles.filter(b=>b.life>0);
  }
''' +s[b:]
s=s.replace('e.stun=.32*spec.stun;e.flash=.18;', 'e.stun=V11.combat.enemyStun*spec.stun;e.flash=V11.combat.enemyFlash;')
s=s.replace("if(e.hp>0)return;this.totalKills++;this.inc('kills');this.money+=50;", "if(e.hp>0)return;this.totalKills++;this.inc('kills');this.grantKillScrap(e);")
s=s.replace("this.feedback('kill',e.x,e.y+.9,'+50');", "this.feedback('kill',e.x,e.y+.9);")
s=s.replace("this.cancelRepair('damage');this.feedback", "this.armoryOpen=false;this.consoleOpen=false;this.cancelRepair('damage');this.feedback")
s=s.replace("this.cancelRepair('layer');this.setPlayerLayer", "this.player.swing=0;this.player.meleeAttack=null;this.cancelRepair('layer');this.setPlayerLayer")
s=s.replace("if(c.type==='engine'){this.consoleOpen", "if(c.type==='engine'){if(this.atArmory)return this.openArmory();this.armoryOpen=false;this.consoleOpen")
s=s.replace("const e={id:this.nextId++,type,x,y:", "const e={id:this.nextId++,rewardEncounter:this.rewardEncounter(),rewarded:false,type,x,y:")
s=s.replace("feedback(type,x,y,text=''){const life=['restart','repair'].includes(type)?.9:.45;this.effects.push({type,x,y,text,life,max:life});", "feedback(type,x,y,text=''){const life=['restart','repair','scrap','buy'].includes(type)?V11.combat.popLifetime:.45;this.effects.push({id:this.nextId++,type,x,y,text,life,max:life});")
s=s.replace("p.cooldown=Math.max(0,p.cooldown-dt);", "p.cooldown=Math.max(0,p.cooldown-dt);p.rangedCooldown=Math.max(0,p.rangedCooldown-dt);p.rangedFlash=Math.max(0,p.rangedFlash-dt);")
a=s.index('    if(input.attack)this.attack();');b=s.index('    this.director.step',a)
s=s[:a]+'''    if(input.attack)this.attack();if(input.ranged)this.rangedAttack();this.meleeStep(dt);
''' +s[b:]
s=s.replace("input.repair&&!input.attack&&!dir", "input.repair&&!input.attack&&!input.ranged&&!dir")
a=s.index('    for(const b of this.projectiles){',s.index('  step(dt'));b=s.index('    this.syncSystems();',a)
s=s[:a]+'''    this.projectileStep(dt);this.enemies=this.enemies.filter(e=>e.hp>0);
''' +s[b:]
s=s.replace("if(!this.atConsole)this.consoleOpen=false;", "if(!this.atConsole)this.consoleOpen=false;if(!this.atArmory)this.armoryOpen=false;")
s=s.replace("this.cancelRepair('arrival');this.status", "this.armoryOpen=false;this.consoleOpen=false;this.cancelRepair('arrival');this.status")
s=s.replace("this.speedMode='CRUISE';this.consoleOpen=false;this.phase='dock'", "this.speedMode='CRUISE';this.consoleOpen=false;this.armoryOpen=false;this.phase='dock'")
s=s.replace("invul:0,cooldown:0}", "invul:0,cooldown:0,rangedCooldown:0,rangedFlash:0,meleeAttack:null}")
s=s.replace("this.money=0;this.status='cashed';this.tell('cash_out'", "this.money=0;this.resetCombat();this.status='cashed';this.tell('cashout',{bank:this.bank,amount:this.settledAmount});this.tell('cash_out'")
s=s.replace("stats:this.total});this.money=0;}", "stats:this.total});this.money=0;this.resetCombat();}")
s=s.replace("snapshot(){return{build:BUILD,", "snapshot(){return{build:BUILD,combatTier:this.combatTier,meleeWeapon:this.melee.id,rangedWeapon:this.ranged?.id||null,armoryOpen:this.armoryOpen,armoryOffers:{melee:this.armoryOffer('melee'),ranged:this.armoryOffer('ranged')},rewardEncounters:Object.fromEntries(this.rewardEncounters),")
p.write_text(s)
p=root/'src/actors3d.js';s=p.read_text();i=s.index('  decorateEnemy(')
s=s[:i]+'''  decoratePlayer(rig){
    const v=this.view,d=rig.userData;
    d.gunArm=d.arm;d.gunArm.name='RangedArm';
    const rear=d.gunArm.clone(true);rear.name='MeleeArm';rear.position.z=-V11.rig.armZ;
    rear.remove(rear.getObjectByName('Sidearm'));rig.add(rear);d.arm=rear;
    const wrench=rear.getObjectByName('Wrench');d.wrench.visible=false;
    const knife=new T.Group(),axe=new T.Group();knife.name='Knife';axe.name='Axe';rear.add(knife,axe);
    v.box(knife,.49,0,0,.26,.10,.10,0x34454c);v.box(knife,.74,0,0,.34,.085,.045,0xdbe3df);
    v.box(axe,.56,0,0,.74,.075,.08,0x775b43);v.box(axe,.88,.08,0,.24,.46,.10,0xc1d0d2);
    d.meleeModels={wrench,knife,axe};d.rangedModels={handgun:d.gun};
    for(const type of ['smg','rifle']){
      const gun=new T.Group();gun.name=type==='smg'?'SMG':'HighDamageRifle';d.gunArm.add(gun);d.rangedModels[type]=gun;
      const spec=V11.weapons[type];
      v.box(gun,.64,0,0,.48,.16,.16,type==='smg'?0x4a6975:0x607361);
      v.box(gun,.58,-.18,0,.11,.30,.10,0x283c46);
      if(type==='smg')v.box(gun,.97,0,0,.16,.09,.10,0x9baab0);
      else{v.box(gun,1.13,0,0,.40,.08,.09,0xb3bbac);v.box(gun,.30,-.03,0,.30,.18,.14,0x70694e);v.box(gun,.70,.16,0,.28,.10,.11,0x273943);}
      const socket=new T.Object3D();socket.name='Muzzle';socket.position.x=spec.muzzle;gun.add(socket);
    }
    d.wrench=wrench;d.activeMuzzle=d.rangedModels.handgun.getObjectByName('Muzzle');
  }
  player(rig,p){
    const d=rig.userData,g=this.view.game,repair=!!g.repairJob,carried=!!p.carry;
    for(const [id,m] of Object.entries(d.meleeModels))m.visible=!carried&&id===(repair?'wrench':g.melee.id);
    for(const [id,m] of Object.entries(d.rangedModels))m.visible=!carried&&!repair&&id===g.ranged?.id;
    const duration=p.meleeAttack?.duration||g.meleeStats.duration;
    d.arm.rotation.z=p.swing>0?1.20-(1-p.swing/duration)*2.3:-.20;
    if(repair)d.arm.rotation.z=-.3+Math.sin(g.elapsed*16)*.18;
    d.gunArm.rotation.z=0;d.activeMuzzle=(d.rangedModels[g.ranged?.id||'handgun']).getObjectByName('Muzzle');
    rig.scale.setScalar(V11.rig.scale);
  }
''' +s[i:];p.write_text(s)
p=root/'src/view.js';s=p.read_text().replace('if(enemy)this.actorPresentation.decorateEnemy(m);return m','if(enemy)this.actorPresentation.decorateEnemy(m);else this.actorPresentation.decoratePlayer(m);return m')
s=s.replace('rig.scale.setScalar(isEnemy?1:1.07)}', 'rig.scale.setScalar(isEnemy?1:V11.rig.scale);if(!isEnemy)this.actorPresentation.player(rig,p)}')
s=s.replace("const node=this.playerRig.getObjectByName('Muzzle');", "const node=this.playerRig.userData.activeMuzzle;")
s=s.replace('this.renderer.render(this.scene,this.camera);this.frames++;','this.renderer.render(this.scene,this.camera);this.juice.updateLabels();this.frames++;')
p.write_text(s)
p=root/'src/feedback3d.js';s=p.read_text();s=s.replace('    this.view=view;', '''    this.labels=Array.from({length:12},()=>{const el=document.createElement('span');el.className='combatPop';el.hidden=true;document.getElementById('feedbackPops').append(el);return el;});
    this.view=view;''',1)
s=s.replace('  update(){', '''  updateLabels(){
    const g=this.view.game,fx=g.effects.filter(e=>e.text&&['scrap','buy'].includes(e.type)).slice(-this.labels.length);
    this.labels.forEach((el,i)=>{const f=fx[i];el.hidden=!f;if(!f)return;const p=this.view.project(f.x,f.y+(1-f.life/f.max)*1.8,.65);el.textContent=f.text;el.style.left=p.x+'px';el.style.top=p.y+'px';el.style.opacity=Math.min(1,f.life/.2);});
  }
  update(){''',1);p.write_text(s)
p=root/'src/main.js';s=p.read_text().replace('ROUTES,SPEED_MODES','ROUTES,SPEED_MODES,INPUT_BINDINGS_SSOT')
s=s.replace('input={move:0,attack:false,repair:false}', 'input={move:0,attack:false,ranged:false,repair:false}')
s=s.replace('audio.event(type);','audio.event(type,data);')
a=s.index('function refreshInputs()');b=s.index("for(const type of ['contextmenu'",a)
s=s[:a]+'''const actions={climb:()=>game.layer(),interact:()=>game.interact(),brake:()=>game.emergencyStop()};
function refreshInputs(){
  const held=new Set(pressed.values()),repair=held.has('repair');if(input.repair&&!repair)game.cancelRepair('released');
  input={move:Number(held.has('right'))-Number(held.has('left')),attack:held.has('melee'),ranged:held.has('ranged'),repair};
}
for(const [action,binding] of Object.entries(INPUT_BINDINGS_SSOT)){
  const el=$(binding.button);el.title=binding.label+' · '+binding.display;
  if(!binding.hold){el.onclick=()=>actions[action]?.();continue;}
  el.addEventListener('pointerdown',e=>{e.preventDefault();if(game.paused||game.status!=='running'||!game.alive)return;el.setPointerCapture(e.pointerId);pressed.set(e.pointerId,action);el.classList.add('active');refreshInputs();telemetry.log('input_down',{key:binding.button,x:game.player.x});});
  const release=e=>{e.preventDefault();pressed.delete(e.pointerId);if(![...pressed.values()].includes(action))el.classList.remove('active');refreshInputs();telemetry.log('input_up',{key:binding.button,x:game.player.x});};
  el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',()=>{for(const [k,a] of pressed)if(a===action)pressed.delete(k);refreshInputs();el.classList.remove('active');});
}
const keyActions=new Map(Object.entries(INPUT_BINDINGS_SSOT).flatMap(([action,binding])=>binding.keys.map(code=>[code,{action,binding}])));
addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)||game.paused||game.status!=='running'||!game.alive)return;const entry=keyActions.get(e.code);if(!entry)return;e.preventDefault();if(entry.binding.hold){pressed.set('key'+e.code,entry.action);refreshInputs();}else if(!e.repeat)actions[entry.action]?.();});
addEventListener('keyup',e=>{pressed.delete('key'+e.code);refreshInputs();});
const mobileInput=navigator.maxTouchPoints>0||matchMedia('(pointer: coarse)').matches;
$('keyboardLegend').hidden=mobileInput;$('app').classList.toggle('touchUI',mobileInput);
for(const [action,binding] of Object.entries(INPUT_BINDINGS_SSOT)){
  const span=document.createElement('span');span.dataset.action=action;span.textContent=binding.label+' '+binding.display;$('keyboardLegend').append(span);
}
for(const slot of ['melee','ranged'])document.querySelector('[data-armory='+slot+']').onclick=()=>game.buyWeapon(slot);
$('closeArmory').onclick=()=>{game.armoryOpen=false;};
''' +s[b:]
s=s.replace("$('brake').onclick=()=>game.emergencyStop();\n$('layer').onclick=()=>game.layer();$('interact').onclick=()=>game.interact();\n",'')
s=s.replace("const descriptions={cargo:'新增实体货物；额外货车提高盗贼占比，不突破威胁上限',battery:'隧道照明、增压储能；完好时加快维修车作业',workshop:'维修更快；电池完好时再快 20%；可花本局钱治疗'};", "const descriptions={cargo:'+3 个空货位 · Freight 搬货 · 额外货车增加盗贼权重',battery:'FAST 储能 · 隧道照明 · 供电维修',workshop:'维修加速 · 工业故障处理 · 本地维修站'};")
s=s.replace("$('weapon').textContent=game.weapon;$('attack').textContent=game.round>=3?'射击':'挥击';", "$('weapon').textContent=game.weapon;$('scrapHud').textContent=String(game.scrap);$('attack').textContent=game.melee.name;$('ranged').textContent=game.ranged?.name==='HIGH-DAMAGE RIFLE'?'RIFLE':game.ranged?.name||'LOCKED';$('ranged').disabled=!game.ranged;")
s=s.replace("game.cars[game.currentCar].type==='engine'?'SPEED'", "game.cars[game.currentCar].type==='engine'?(game.atArmory?'ARMORY':'SPEED')")
s=s.replace("  $('repairPanel').hidden=!job;", """  $('armoryPanel').hidden=!game.armoryOpen||!game.atArmory||!game.alive||game.status!=='running';
  $('armoryScrap').textContent=game.scrap+' SCRAP · WORLD RUNNING';
  for(const slot of ['melee','ranged']){const b=document.querySelector('[data-armory='+slot+']'),offer=game.armoryOffer(slot);b.textContent=slot.toUpperCase()+' · '+(offer?(offer.locked?'LOCKED UNTIL COMBAT TIER 3':offer.name+' · '+offer.cost+' SCRAP'):'MAX TIER');b.disabled=!offer||offer.locked||game.scrap<offer.cost;}
  $('repairPanel').hidden=!job;""")
p.write_text(s)
p=root/'index.html';s=p.read_text().replace('<div><small>货舱</small>', '<div><small>SCRAP</small><b id="scrapHud">0</b></div><div><small>货舱</small>')
s=s.replace('<div id="lifePanel"', '<div id="armoryPanel" hidden><div class="armoryHead"><b>ENGINE ARMORY</b><button id="closeArmory" aria-label="Close Armory">×</button></div><small id="armoryScrap"></small><button data-armory="melee"></button><button data-armory="ranged"></button></div><div id="feedbackPops"></div><div id="lifePanel"')
s=s.replace('<button id="attack" class="attack">挥击</button>', '<button id="attack" class="attack">WRENCH</button><button id="ranged" class="attack" disabled>LOCKED</button>')
s=s.replace('</footer>', '</footer><div id="keyboardLegend" aria-label="Keyboard controls"></div>')
s=s.replace('3D 剖面列车 · 这次重点是预警、抢修和安全回站。停机不会立刻失败；修理需要站稳并持续按住。','路线决定危险与货物。停车抢货，击杀赚取 Scrap，返回 Engine Armory 实时升级双武器。动力停机后仍有最后抢修机会。')
s=s.replace('「增压」消耗储能。声音可在右上角开启。','FAST 消耗储能；重新加速必须返回 Engine。近战、远程分别操作。')
p.write_text(s)
p=root/'style.css';p.write_text(p.read_text()+'''
/* Independent weapon controls and non-modal armory; keyboard text comes from content SSOT. */
#app{grid-template-rows:48px 24px minmax(0,1fr) 72px 20px}#app.touchUI{grid-template-rows:48px 24px minmax(0,1fr) 72px 0}
#keyboardLegend{display:flex;justify-content:space-between;gap:8px;font-size:9px;color:#b3c9d0;align-items:center;white-space:nowrap}
#armoryPanel{position:absolute;z-index:5;left:12px;bottom:10px;width:228px;background:#122b34ed;border:1px solid #92c3b9;border-radius:8px;padding:8px;font-size:10px}
.armoryHead{display:flex;justify-content:space-between;align-items:center}.armoryHead button{padding:0 6px;font-size:15px}#armoryPanel small{display:block;font-size:9px;color:#b8d1c4;margin:3px 0}#armoryPanel>button{display:block;width:100%;font-size:10px;text-align:left;padding:7px;margin-top:4px}
#feedbackPops{position:absolute;inset:0;pointer-events:none;z-index:7}.combatPop{position:absolute;transform:translate(-50%,-100%);font-size:14px;font-weight:800;color:#c5f4b3;text-shadow:0 2px 3px #000;white-space:nowrap}
#weapon{display:block;max-width:210px;font-size:10px!important}#scrapHud{color:#c5f4b3}.group .attack{width:64px;font-size:10px}#ranged{background:#285b6e;border-color:#85b4c5}
@media(max-width:1050px){#hud .brand{display:none}#hud{gap:11px}#hud b{font-size:11px}#weapon{max-width:170px}}
@media(max-height:350px){#app{grid-template-rows:39px 20px minmax(0,1fr) 61px 20px}#app.touchUI{grid-template-rows:39px 20px minmax(0,1fr) 61px 0}#armoryPanel{width:224px;bottom:7px;padding:6px}#armoryPanel>button{padding:5px}.combatPop{font-size:12px}}
''')
p=root/'src/sim.js';s=p.read_text().replace('p.swing=0;p.protection=0;', 'p.swing=0;p.meleeAttack=null;p.rangedFlash=0;p.protection=0;').replace('stun:0,cooldown:0,swing:0,invul:0,protection:', 'stun:0,cooldown:0,rangedCooldown:0,rangedFlash:0,meleeAttack:null,swing:0,invul:0,protection:').replace('p.stun>0||p.swing>0||this.repCd', 'p.stun>0||p.swing>0||p.rangedFlash>0||this.repCd')
p.write_text(s)
p=root/'package.json';p.write_text(p.read_text().replace('tests/enemies.test.mjs','tests/enemies.test.mjs tests/combat.test.mjs'))
p=root/'tests/simulation.test.mjs';s=p.read_text();s=s.replace("function dock(g)","function equipHandgun(g){g.scrap=42;const x=g.player.x;g.player.x=1.7;g.openArmory();g.buyWeapon('melee');g.buyWeapon('melee');g.buyWeapon('ranged');g.player.x=x;g.armoryOpen=false;}\nfunction dock(g)")
s=s.replace('assert.equal(g.money,1050);','assert.equal(g.money,1000);assert.equal(g.scrap,3);')
for line in s.splitlines():
 if "test('projectile" in line or "test('ranged" in line:
  s=s.replace(line,line.replace('g.round=3;', 'g.round=3;equipHandgun(g);').replace('g.attack()', 'g.rangedAttack()'))
p.write_text(s)
p=root/'tests/browser_smoke.py';s=p.read_text().replace("g.round=3;g.player.cooldown=0;g.attack();", "g.round=3;g.scrap=42;const x=g.player.x;g.player.x=1.7;g.openArmory();g.buyWeapon('melee');g.buyWeapon('melee');g.buyWeapon('ranged');g.player.x=x;g.armoryOpen=false;g.rangedAttack();")
s=s.replace('saved:g.total.cargoSaved,cargo:g.cars[1].cargo','saved:g.total.cargoSaved,cargo:g.cars[1].cargo,scrap:g.scrap').replace("'after':1050,'saved':250,'cargo':3", "'after':1000,'saved':250,'cargo':3,'scrap':3")
p.write_text(s)
p=root/'tests/model_roundtrip.test.mjs';p.write_text(p.read_text()+'\nawait import("./weapon_models.test.mjs");\n')
for name,(before,after) in checks.items():
 assert hashlib.sha256((root/name).read_bytes()).hexdigest()==after,'OUTPUT MISMATCH '+name
print('G exact source hashes match 116-unit local validation; browser gates remain required.')
