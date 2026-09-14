"""Readable V11-D migration. Exact input/output hashes; no encoded executable payload."""
from pathlib import Path
import hashlib
root=Path('.')
checks={
'src/sim.js':('50fdec97089c4604dcf594d2fdf43abcba4d91f56295d194eb04979c547d2944','a6fdb1a04717ddeed9faa65e9536cdbba71b21bdb5403aeb330061974b2f0184'),
'src/main.js':('09d924fe6faa5450c7e81ab73d15c3fbeba45e5e867f4328fc2b3412244e3f60','a60a94208e55a8c6c9176f07893a38b2f2b99cd59638dca7838617e1e8ca3a21'),
'src/view.js':('9696c322b4ff85d65290e30ee6315965b9fa8b9192823ea765eaec2babcbc5bc','6b7121fb6e233a0ab3630048881ca02dcd059ca8abeb0dff30d7f634e8695724'),
'src/routeworld.js':('515af779afa3ca5ddef5c43914ab71c11a25d3efd47cbfb8a69d026c7347795a','ed12fea0c84e55568e8361c928b7df941ea83cf048cae8aa019c921ba7518257'),
'index.html':('23c28438c179b2062a46c4df18f2d21c3fefa0394a7c377a3e225a0ad0476ab8','38cb69307c88f53704556c906188add697b6f347240d167a0d0d1e3948cef41a'),
'style.css':('11cd1060602e7390b4fa5c70286f29daabffeb30f3d44d18dd266d6a6a1d0b04','7826422fde586be5b40e3e7d88c3076fdaa188c53611d14bc63f849bb7740d32'),
 'tests/simulation.test.mjs':('752eb2bd042c5e69ab2ba6adb9aacbfe04b8da061d152f922911d5f621285fbc','efa791a6af14c62e663257511f93d416b036179c1e3c7a9c34c84d6e97b3afd6'),
 'tests/browser_smoke.py':('d3bb36f16c21f2b482347282bd30f7b5b6df53ead64312e869fdaf3b386fe97c','7fafec52e1a23f128343c06dc9f2545c1b76cecae5f30b80cdfbd7aeb0a2ccf0'),
 'tests/browser_v11.py':('d2067d887441cb00417acb0ba6e5f61f71bb103e8fa753effa2dc7b34666f349','38b90b27bd20e28081786b04623235d7c24dfde6ef5f09d508ac43a74fe3d26f')}
for name,(before,after) in checks.items():
 assert hashlib.sha256((root/name).read_bytes()).hexdigest()==before,'BASE MISMATCH '+name
p=root/'src/sim.js'; s=p.read_text()
s=s.replace("import {ROUTES} from './content.js';", "import {ROUTES,LIFE,LAYER} from './content.js';\nimport {cargoCapacity,depotPose,isAlive} from './contracts.js';")
s=s.replace("cargo:type==='cargo'?3:0", "cargo:0")
s=s.replace("this.route=null;this.previousRoute", "this.cargoCrates=[];this.depots=[];this.terminalDestroyed=false;\n    this.route=null;this.previousRoute",1)
s=s.replace("this.player={x:3,y:FLOOR,roof:false,hp:100,", "this.player={x:V11.respawnX,y:FLOOR,z:.65,roof:false,layer:LAYER.INTERIOR,lifeState:LIFE.ALIVE,respawnRemaining:0,respawnAt:0,protection:0,hp:100,")
start=s.index('  get length()')
s=s[:start]+'''  get alive(){return isAlive(this.player.lifeState);}
  get playerLayer(){return this.player.layer===LAYER.DEPOT?LAYER.DEPOT:this.player.roof?LAYER.ROOF:LAYER.INTERIOR;}
  setPlayerLayer(layer){const p=this.player;p.layer=layer;p.roof=layer!==LAYER.INTERIOR;p.y=p.roof?ROOF:FLOOR;if(layer!==LAYER.DEPOT){p.z=.65;p.depotId=null;}}
  get cargoCapacity(){return cargoCapacity(this.cars);}
  get cargoUsed(){return this.cargoCrates.filter(c=>['stored','floor','player','thief'].includes(c.location)).length;}
  get storedCargo(){return this.cargoCrates.filter(c=>c.location==='stored').length;}
  get cargoValue(){return this.cargoCrates.filter(c=>c.secured&&!['lost','banked'].includes(c.location)).reduce((n,c)=>n+c.value,0);}
  get heldCargo(){return this.cargoCrates.find(c=>c.id===this.player.carry&&c.location==='player')||null;}
  createCargo(value,location='depot',extra={}){
    const c={id:this.nextId++,value:Math.max(0,Number(value)||0),location,secured:false,carIndex:null,x:0,...extra};
    this.cargoCrates.push(c);this.syncCargo();return c;
  }
  prepareDepots(){
    // Keep the run's secured cargo; old unclaimed platforms do not follow us into the next lap.
    this.cargoCrates=this.cargoCrates.filter(c=>!['depot','lost','banked'].includes(c.location));
    const config=V11.routes[this.route];
    this.depots=config.depots.map((marker,i)=>({id:this.route+'-'+i,marker}));
    for(const d of this.depots)for(let i=0;i<config.crates;i++)this.createCargo(config.value,'depot',{depotId:d.id,x:V11.depot.crateXs[i]});
  }
  syncCargo(){for(let i=0;i<this.cars.length;i++)this.cars[i].cargo=this.cargoCrates.filter(c=>c.location==='stored'&&c.carIndex===i).length;}
  depotState(id=this.player.depotId){const d=this.depots.find(d=>d.id===id);return d?{...d,...depotPose(this.t,d.marker)}:null;}
  nearestDepot(){return this.depots.map(d=>this.depotState(d.id)).sort((a,b)=>a.connection-b.connection)[0]||null;}
  depotConnected(d){return !!d&&d.connection<=V11.depot.connectionLimit&&d.x>=.4&&d.x<=this.length-.4;}
  enterDepot(){
    if(!this.alive||this.playerLayer!==LAYER.ROOF)return false;
    const d=this.nearestDepot();if(!this.depotConnected(d)||Math.abs(this.player.x-d.x)>V11.depot.boardRadius)return false;
    if(!['STOP','SLOW'].includes(this.speedMode)){this.event='TOO FAST TO BOARD DEPOT';this.tell('depot_board_blocked',{speed:this.speedMode});return false;}
    this.cancelRepair('depot');this.consoleOpen=false;this.setPlayerLayer(LAYER.DEPOT);
    Object.assign(this.player,{depotId:d.id,depotX:0});this.syncDepotPlayer();
    this.tell('depot_enter',{depot:d.id,speed:this.speedMode});this.event='DEPOT · PICK UP CARGO · RETURN VIA THE CENTER BRIDGE';return true;
  }
  exitDepot(){
    if(!this.alive||this.playerLayer!==LAYER.DEPOT)return false;
    const p=this.player,d=this.depotState();
    if(!this.depotConnected(d)||Math.abs(p.depotX)>V11.depot.bridgeRadius){this.event='RETURN TO THE CENTER BRIDGE';return false;}
    p.x=clamp(d.x,.4,this.length-.4);this.setPlayerLayer(LAYER.ROOF);this.tell('depot_exit',{depot:d.id});return true;
  }
  syncDepotPlayer(){
    if(this.playerLayer!==LAYER.DEPOT||!this.alive)return;
    const p=this.player,d=this.depotState();if(!d)return;
    const angle=(d.marker-this.t)*Math.PI*2;
    p.x=d.x+Math.cos(angle)*p.depotX;p.z=d.z+Math.sin(angle)*p.depotX;p.y=ROOF;
    if(d.connection>V11.depot.connectionLimit)this.killPlayer('train_lost');
  }
  pickupCargo(c){
    if(!this.alive||this.player.carry||!c)return false;
    const p=this.player,onDepot=this.playerLayer===LAYER.DEPOT;
    const reachable=onDepot?c.location==='depot'&&c.depotId===p.depotId&&Math.abs(c.x-p.depotX)<=V11.depot.crateRadius:
      ['stored','floor'].includes(c.location)&&c.carIndex===this.currentCar&&(c.location==='stored'||Math.abs(c.x-p.x)<V11.depot.crateRadius);
    if(!reachable)return false;
    if(c.location==='depot'&&this.cargoUsed>=this.cargoCapacity){this.event='CARGO FULL · '+this.cargoUsed+' / '+this.cargoCapacity;this.tell('cargo_full_block',{used:this.cargoUsed,capacity:this.cargoCapacity});return false;}
    c.location='player';p.carry=c.id;this.syncCargo();this.tell('cargo_pickup',{crate:c.id,value:c.value,layer:this.playerLayer});this.feedback('cargo',p.x,p.y+1,'CARGO');return true;
  }
  loadCargo(){
    const c=this.heldCargo;if(!c||this.playerLayer===LAYER.DEPOT)return false;
    const i=this.currentCar;if(this.cars[i].type!=='cargo'){this.event='RETURN TO A CARGO CAR / ROOF LOADING HATCH';return false;}
    // A stolen or carried crate reserves its original slot until recovered or lost.
    let target=i;
    if(this.cargoCrates.filter(x=>x.id!==c.id&&x.carIndex===i&&['stored','thief'].includes(x.location)).length>=V11.cargoSlots){
      target=this.cars.findIndex((x,j)=>x.type==='cargo'&&this.cargoCrates.filter(k=>k.id!==c.id&&k.carIndex===j&&['stored','thief'].includes(k.location)).length<V11.cargoSlots);
    }
    if(target<0)return false;
    c.location='stored';c.carIndex=target;this.player.carry=false;
    if(!c.secured){c.secured=true;this.money+=c.value;}
    this.syncCargo();this.tell('cargo_loaded',{crate:c.id,value:c.value,car:target});this.tell('cargo_drop',{car:target});this.event='CARGO LOADED · '+this.cargoUsed+' / '+this.cargoCapacity;return true;
  }
  loseCargo(c,reason){
    if(!c||['lost','banked'].includes(c.location))return false;
    if(c.secured)this.money=Math.max(0,this.money-c.value);c.secured=false;c.location='lost';
    this.inc('cargoLost',c.value);if(this.player.carry===c.id)this.player.carry=false;
    this.syncCargo();this.tell('cargo_lost',{crate:c.id,value:c.value,reason});return true;
  }
  dropDeathCargo(onDepot){
    const c=this.heldCargo;if(c){if(onDepot)this.loseCargo(c,'player_death_depot');else{c.location='floor';c.carIndex=this.currentCar;c.x=this.player.x;this.tell('cargo_drop',{crate:c.id,car:c.carIndex,reason:'death'});}}
    this.player.carry=false;this.syncCargo();
  }
  killPlayer(reason='hp_zero'){
    if(!this.alive||this.status!=='running')return false;
    const p=this.player,onDepot=this.playerLayer===LAYER.DEPOT;
    this.dropDeathCargo(onDepot);this.cancelRepair('death');this.consoleOpen=false;this.armoryOpen=false;
    p.hp=0;p.lifeState=LIFE.DEAD;p.respawnRemaining=V11.respawnSeconds;p.respawnAt=this.elapsed+V11.respawnSeconds;
    p.swing=0;p.protection=0;p.invul=0;
    if(reason==='train_lost'){this.tell('train_lost',{depot:p.depotId});this.event='TRAIN LOST';}
    this.tell('player_death',{reason,layer:this.playerLayer});this.tell('respawn_start',{seconds:V11.respawnSeconds});
    this.feedback('death',p.x,p.y+1);return true;
  }
  lifeStep(dt){
    const p=this.player;
    if(p.lifeState===LIFE.DEAD){
      if(this.terminalDestroyed){this.fail('engine_timeout');return;}
      p.respawnRemaining=Math.max(0,p.respawnAt-this.elapsed);
      if(p.respawnRemaining<=1e-8){
        p.lifeState=LIFE.RESPAWNING;this.setPlayerLayer(LAYER.INTERIOR);
        Object.assign(p,{x:V11.respawnX,hp:V11.playerMaxHP*V11.respawnFraction,carry:false,stun:0,cooldown:0,swing:0,invul:0,protection:V11.spawnProtection});
        p.lifeState=LIFE.PROTECTED;this.tell('respawn_complete',{x:p.x,hp:p.hp,layer:LAYER.INTERIOR,protection:p.protection});this.feedback('respawn',p.x,p.y+1);
      }
    }else if(p.lifeState===LIFE.PROTECTED){p.protection=Math.max(0,p.protection-dt);if(p.protection<=1e-8){p.protection=0;p.lifeState=LIFE.ALIVE;}}
  }
''' +s[start:]
s=s.replace("this.player.hp<=0||this.engineState", "!this.alive||this.engineState")
s=s.replace("this.player.hp<=0||this.player.layer==='DEPOT'", "!this.alive||this.playerLayer===LAYER.DEPOT")
s=s.replace("this.route=id;this.repeatPressure", "this.route=id;this.prepareDepots();this.repeatPressure")
s=s.replace("if(this.status!=='running'||this.paused||this.player.stun>0)return false;", "if(this.status!=='running'||this.paused||!this.alive||this.player.stun>0)return false;\n    if(this.playerLayer===LAYER.DEPOT)return this.exitDepot();",1)
s=s.replace("this.cancelRepair('layer');p.roof=!p.roof;p.y=p.roof?ROOF:FLOOR;", "this.cancelRepair('layer');this.setPlayerLayer(p.roof?LAYER.INTERIOR:LAYER.ROOF);")
s=s.replace("if(this.status!=='running'||this.paused)return false;", "if(this.status!=='running'||this.paused||!this.alive)return false;")
s=s.replace("if(this.status!=='running'||p.invul>0)return;", "if(this.status!=='running'||!this.alive||p.invul>0||p.protection>0)return;")
s=s.replace("if(p.hp<=0)this.fail('player_down');", "if(p.hp<=0)this.killPlayer('hp_zero');")
s=s.replace("if(p.roof||p.carry||p.stun>0||p.swing>0||this.repCd>0)", "if(this.playerLayer!==LAYER.INTERIOR||p.carry||p.stun>0||p.swing>0||this.repCd>0)")
start=s.index('  interact(){'); end=s.index('  spawn(',start)
s=s[:start]+'''  interact(){
    if(this.status!=='running'||this.paused||!this.alive||this.player.stun>0)return false;
    const p=this.player,c=this.cars[this.currentCar];this.cancelRepair('interaction');
    if(this.playerLayer===LAYER.DEPOT){
      if(p.carry)return this.exitDepot();
      const crate=this.cargoCrates.filter(c=>c.location==='depot'&&c.depotId===p.depotId&&Math.abs(c.x-p.depotX)<=V11.depot.crateRadius).sort((a,b)=>Math.abs(a.x-p.depotX)-Math.abs(b.x-p.depotX))[0];
      if(crate)return this.pickupCargo(crate);return this.exitDepot();
    }
    if(p.carry)return this.loadCargo();
    if(this.playerLayer===LAYER.ROOF)return this.enterDepot();
    const floor=this.cargoCrates.find(c=>c.location==='floor'&&c.carIndex===this.currentCar&&Math.abs(c.x-p.x)<V11.depot.crateRadius);
    if(floor)return this.pickupCargo(floor);
    if(c.hp<=0){this.event='设备损坏，先修理本节车厢。';return false;}
    if(c.type==='engine'){this.consoleOpen=this.atConsole&&!this.consoleOpen;this.event=this.atConsole?'ENGINE CONSOLE · SELECT A SUSTAINED SPEED':'MOVE TO ENGINE CONSOLE';return this.consoleOpen;}
    if(c.type==='cargo')return this.pickupCargo(this.cargoCrates.find(c=>c.location==='stored'&&c.carIndex===this.currentCar));
    if(c.type==='workshop'){const gain=Math.min(20,100-p.hp);if(!gain||this.money<120)return false;this.money-=120;this.creditsSpent+=120;p.hp+=gain;this.playerWarnings();this.tell('workshop_heal',{gain});return true;}
    if(c.type==='battery'){this.event='BATTERY CHARGE '+Math.round(c.charge||0);return true;}
    return false;
  }
''' +s[end:]
s=s.replace("const c=this.cars[e.cargoCar];if(c)c.cargo++;e.carry=false;this.inc('cargoSaved',B.cargoValue);", "const crate=this.cargoCrates.find(c=>c.id===e.carry);if(crate){crate.location='stored';crate.carIndex=e.cargoCar;}e.carry=false;this.syncCargo();this.inc('cargoSaved',crate?.value||0);")
s=s.replace("e.hp=0;e.carry=false;this.money=Math.max(0,this.money-B.cargoValue);this.inc('cargoLost',B.cargoValue);", "e.hp=0;const crate=this.cargoCrates.find(c=>c.id===e.carry);this.loseCargo(crate,'thief_escape');e.carry=false;")
s=s.replace("this.cars[ci].cargo--;e.carry=true;e.cargoCar=ci;", "const crate=this.cargoCrates.find(c=>c.location==='stored'&&c.carIndex===ci);if(!crate)continue;crate.location='thief';e.carry=crate.id;e.cargoCar=ci;this.syncCargo();")
s=s.replace("const sameLane=e.roof===p.roof,near=sameLane", "const sameLane=this.alive&&this.playerLayer!==LAYER.DEPOT&&e.roof===p.roof,near=sameLane")
s=s.replace("if(this.status==='arriving'){this.arrivalElapsed+=dt;this.elapsed+=dt;this.effectsStep(dt);", "if(this.status==='arriving'){this.arrivalElapsed+=dt;this.elapsed+=dt;this.lifeStep(dt);this.effectsStep(dt);")
s=s.replace("this.syncSystems();const p=this.player;this.elapsed+=dt;this.effectsStep(dt);", "this.syncSystems();const p=this.player;this.elapsed+=dt;this.lifeStep(dt);this.effectsStep(dt);")
s=s.replace("const dir=clamp(Number(input.move)||0,-1,1);", "const dir=this.alive?clamp(Number(input.move)||0,-1,1):0;")
s=s.replace("p.x=clamp(p.x+dir*dt*(p.carry?B.carrySpeed:B.walk*(p.roof?B.roofSpeed:1)),.4,this.length-.4);p.face=dir;", "if(this.playerLayer===LAYER.DEPOT){p.depotX=clamp(p.depotX+dir*dt*(p.carry?B.carrySpeed:B.walk),-V11.depot.width/2+.4,V11.depot.width/2-.4);}else p.x=clamp(p.x+dir*dt*(p.carry?B.carrySpeed:B.walk*(p.roof?B.roofSpeed:1)),.4,this.length-.4);p.face=dir;")
s=s.replace("this.routeStep(dt);if(!this.atConsole)", "this.routeStep(dt);this.syncDepotPlayer();if(!this.atConsole)")
s=s.replace("if(p.hp<=0){this.fail('player_down');return;}", "if(p.hp<=0&&this.alive)this.killPlayer('hp_zero');")
s=s.replace("||this.player.hp<=0)return false;", ")return false;")
s=s.replace("if(this.player.carry){const c=this.cars.find(c=>c.type==='cargo');if(c)c.cargo++;this.player.carry=false;}", "if(this.heldCargo&&this.playerLayer!==LAYER.DEPOT){const c=this.heldCargo;c.location='stored';c.carIndex=this.cars.findIndex(c=>c.type==='cargo');if(!c.secured){c.secured=true;this.money+=c.value;}this.player.carry=false;}")
s=s.replace("const c=this.cars[e.cargoCar];if(c)c.cargo++;e.carry=false;this.tell('cargo_secured_at_dock'", "const c=this.cargoCrates.find(c=>c.id===e.carry);if(c)c.location='stored';e.carry=false;this.syncCargo();this.tell('cargo_secured_at_dock'")
s=s.replace("this.enemies=[];this.projectiles=[];this.event='你回来了。", "this.syncCargo();this.enemies=[];this.projectiles=[];this.event='你回来了。")
s=s.replace("roof:false,y:FLOOR,x:3,swing:0", "roof:false,layer:LAYER.INTERIOR,lifeState:LIFE.ALIVE,protection:0,respawnRemaining:0,z:.65,y:FLOOR,x:3,swing:0")
s=s.replace("this.bank+=this.settledAmount;this.money=0;", "this.bank+=this.settledAmount;for(const c of this.cargoCrates)if(c.secured)c.location='banked';this.syncCargo();this.money=0;")
old="fail(reason='player_down'){if(this.status!=='running')return;this.cancelRepair('failure');this.status='lost';"
new="fail(reason='engine_timeout'){if(this.status!=='running')return;this.cancelRepair('failure');if(this.player.lifeState===LIFE.DEAD)this.tell('respawn_cancel_engine_failure',{remaining:this.player.respawnRemaining});this.terminalDestroyed=true;this.player.lifeState=LIFE.FAILED;this.player.respawnRemaining=0;this.status='lost';"
s=s.replace(old,new)
s=s.replace("snapshot(){return{build:BUILD,", "snapshot(){return{build:BUILD,playerLayer:this.playerLayer,playerLifeState:this.player.lifeState,respawnRemaining:this.player.respawnRemaining,spawnProtection:this.player.protection,terminalDestroyed:this.terminalDestroyed,cargoUsed:this.cargoUsed,cargoCapacity:this.cargoCapacity,cargoValue:this.cargoValue,heldCargo:this.heldCargo?{id:this.heldCargo.id,value:this.heldCargo.value}:null,")
p.write_text(s)
p=root/'src/routeworld.js';s=p.read_text();s=s.replace("this.depots.push({id:route+'-'+i,marker,group,bridge,cargo,crates:[]});", "const crates=[];for(let k=0;k<V11.routes[route].crates;k++){const m=v.crateTemplate.clone(true);cargo.add(m);crates.push(m);}\n   this.depots.push({id:route+'-'+i,marker,group,bridge,cargo,crates});")
s=s.replace("const g=this.view.game,focus=g.player.x", "const g=this.view.game,focus=g.alive?g.player.x:V11.respawnX")
s=s.replace("d.bridge.visible=p.connection<V11.depot.connectionLimit;", "d.bridge.visible=p.connection<V11.depot.connectionLimit&&p.x>=.4&&p.x<=g.length-.4;\n   const cargo=g.cargoCrates.filter(c=>c.location==='depot'&&c.depotId===d.id);d.crates.forEach((m,i)=>{m.visible=i<cargo.length;if(cargo[i])m.position.set(cargo[i].x,4.12,0);});")
p.write_text(s)
p=root/'src/view.js';s=p.read_text();s=s.replace("this.enemyModels=new Map();", "this.floorCrates=[];this.enemyModels=new Map();",1)
s=s.replace("rig.position.set(p.x,p.y,.65)", "rig.position.set(p.x,p.y,p.z??.65)")
s=s.replace("this.poseRobot(this.playerRig,p,dt);", "this.poseRobot(this.playerRig,p,dt);this.playerRig.visible=g.alive;\n  const floorCrates=g.cargoCrates.filter(c=>c.location==='floor');this.floorCrates.forEach(m=>m.visible=false);for(let i=0;i<floorCrates.length;i++){let m=this.floorCrates[i];if(!m){m=this.crateTemplate.clone(true);this.floorCrates.push(m);this.actorGroup.add(m);}m.visible=true;m.position.set(floorCrates[i].x,FLOOR,.65);} ")
s=s.replace("(hubMin+hubMax)*.5:p.x", "(hubMin+hubMax)*.5:g.alive?p.x:V11.respawnX")
s=s.replace("const s=this.project(p.x,p.y+1.85,.7);", "const s=this.project(p.x,p.y+1.85,p.z??.7);")
s=s.replace("tag.hidden=s.x<0||s.x>this.w;", "tag.hidden=!g.alive||s.x<0||s.x>this.w;")
s=s.replace("tag.textContent=p.carry?'YOU · 搬运'", "tag.textContent=g.playerLayer==='DEPOT'?'YOU · DEPOT':p.carry?'YOU · 搬运'")
s=s.replace("this.project(p.x,p.y+1,.65)", "this.project(p.x,p.y+1,p.z??.65)")
p.write_text(s)
p=root/'src/main.js';s=p.read_text();s=s.replace("$('round').textContent=", "$('cargoHud').textContent='CARGO '+game.cargoUsed+' / '+game.cargoCapacity;\n  $('lifePanel').hidden=game.alive||game.status!=='running';$('lifePanel').textContent=(game.event==='TRAIN LOST'?'TRAIN LOST':'PLAYER DOWN')+' · RESPAWN '+game.player.respawnRemaining.toFixed(1);\n  $('round').textContent=")
s=s.replace("$('layer').textContent=game.player.roof?", "$('layer').textContent=game.playerLayer==='DEPOT'?'RETURN':game.player.roof?")
s=s.replace("$('interact').textContent=game.player.carry?'放货'", "$('interact').textContent=game.playerLayer==='DEPOT'?(game.player.carry?'RETURN':'PICKUP'):game.player.roof?(game.player.carry?'LOAD':'DEPOT'):game.player.carry?'放货'")
s=s.replace("game.player.y=roof?ROOF:FLOOR;view.cameraX", "game.player.y=roof?ROOF:FLOOR;game.player.layer=roof?'ROOF':'INTERIOR';game.player.z=.65;view.cameraX")
p.write_text(s)
p=root/'index.html';s=p.read_text().replace('<nav><button id="angle">','<div><small>货舱</small><b id="cargoHud">CARGO 0 / 0</b></div><nav><button id="angle">').replace('<div id="playerTag">','<div id="lifePanel" hidden></div><div id="playerTag">');p.write_text(s)
p=root/'style.css';p.write_text(p.read_text()+"\n#lifePanel{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);padding:12px 18px;border:1px solid #e4b281;background:#311f29eb;color:#ffe1af;font-size:17px;font-weight:800;z-index:6;pointer-events:none;white-space:nowrap}\n")
p=root/'tests/simulation.test.mjs';s=p.read_text();s=s.replace("g.chooseCar('cargo');g.start();return g;", "g.chooseCar('cargo');for(let i=0;i<3;i++)g.createCargo(250,'stored',{carIndex:1,secured:true});g.start();return g;")
s=s.replace("test('fatal player damage still wins over arrival',()=>{const g=fresh();g.t=.99999;g.hurt(200,'boarder');g.step(.05);assert.equal(g.status,'lost');assert.equal(g.bank,0);});", "test('V11 fatal player damage starts respawn without banking or failing the live engine',()=>{const g=fresh();g.t=.5;g.hurt(200,'boarder');g.step(.05);assert.equal(g.player.lifeState,'DEAD_WAITING_RESPAWN');assert.equal(g.status,'running');assert.equal(g.bank,0);});")
p.write_text(s)
p=root/'tests/browser_smoke.py';s=p.read_text().replace("g=a.game(),e=g.spawn('thief',12.4,false);", "g=a.game();for(let i=0;i<3;i++)g.createCargo(250,'stored',{carIndex:1,secured:true});const e=g.spawn('thief',12.4,false);")
p.write_text(s)
for name in ['browser_smoke.py','browser_v11.py']:
 p=root/'tests'/name;s=p.read_text();s=s.replace('import asyncio', 'import os,shutil\nimport asyncio',1)
 s=s.replace("browser=await getattr(p,name).launch(**kw)", "browser=await getattr(p,name).launch(**({**kw,'executable_path':os.environ['CHROMIUM_PATH']} if name=='chromium' and os.environ.get('CHROMIUM_PATH') else kw))")
 s=s.replace("for name in ['chromium','webkit']", "for name in os.environ.get('RH_BROWSERS','chromium,webkit').split(',')")
 s=s.replace("for n in ['chromium','webkit']", "for n in os.environ.get('RH_BROWSERS','chromium,webkit').split(',')")
 p.write_text(s)
for name,(before,after) in checks.items():
 actual=hashlib.sha256((root/name).read_bytes()).hexdigest()
 assert actual==after,'OUTPUT MISMATCH '+name+' '+actual
print('V11-D exact source hashes match locally tested 75-unit tree; browser gates remain mandatory.')
