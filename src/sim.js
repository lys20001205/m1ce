// Deterministic rules; world distances are metres, timers are simulation seconds.
import {BUILD,B,stationX,engineBand,capFor} from './balance.js?v=11';
import {Director} from './director.js?v=11';
import {ROUTES,LIFE,LAYER,ENEMIES,CARS} from './content.js';
import {cargoCapacity,depotPose,isAlive,weaponAt,weaponStats,scrapReward} from './contracts.js';
import {V11} from './balance.js';
export {BUILD,B,stationX};
export const LENGTH=8.3,FLOOR=1.12,ROOF=4.12,DURATION=V11.duration,MAX_CARS=V11.maxCars;
export const DEFS=Object.freeze(Object.fromEntries(Object.entries(CARS).map(([id,c])=>[id,Object.freeze({name:c.label,hp:V11.carHP[id]})])));
export function clamp(v,a,b){return Math.min(b,Math.max(a,v));}
export function car(type){return{type,hp:DEFS[type].hp,max:DEFS[type].hp,cargo:0,charge:type==='battery'?V11.batteryCharge:0};}
export function phaseAt(t,route='industrial'){const c=V11.routes[route]||V11.routes.industrial;if(t<.08)return 'depart';if(t>=.90)return 'return';if(c.crane&&t>=c.crane[0]&&t<c.crane[2])return 'crane';if(c.tunnel&&t>=c.tunnel[0]&&t<c.tunnel[2])return t<c.tunnel[1]?'approach':'tunnel';return 'yard';}
export const LABELS={dock:'机库 / 准备',depart:'转盘对轨 / 出库',yard:'工业装卸区',crane:'机械臂区域',approach:'隧道预告',tunnel:'低净空隧道',return:'回库',complete:'回站完成',lost:'列车失守',cashed:'收益入库'};
export function phaseLabel(phase,route='industrial'){return phase==='yard'?(ROUTES[route]||ROUTES.industrial).travelLabel:LABELS[phase]||phase;}
const stats=()=>({clutchSaves:0,clutchRepairs:0,cargoSaved:0,cargoLost:0,criticalSeconds:0,repairs:0,kills:0,hazardHits:0});
export class Game {
  constructor({emit=()=>{},bank=0,seed=314159,practice=false,dev=false,prep={}}={}){
    this.dev=!!dev;this.timeScale=1;this.emit=emit;this.seed=seed>>>0;this.initialSeed=this.seed;this.bank=bank;this.practice=practice;
    this.prep=Object.fromEntries(Object.entries(V11.prep).map(([id,spec])=>[id,Math.min(spec.max,Math.max(0,Math.floor(Number(prep?.[id])||0)))]));this.runRepairKit=0;this.runPrepLoaded=false;this.routeIntel=null;this.intelPrepared=false;this.carOffers=[];this.carRerolled=false;
    this.armoryOpen=false;this.stopRewardRegion=null;this.rewardEncounters=new Map();this.round=1;this.scrap=0;this.meleeTier=1;this.rangedTier=0;this.money=1000;this.cars=[car('engine')];
    this.cargoCrates=[];this.depots=[];this.terminalDestroyed=false;
    this.route=null;this.previousRoute=null;this.hubStage='route';this.repeatPressure=0;this.turntableFrom=0;this.selectedCar=null;
    this.player={x:V11.respawnX,y:FLOOR,z:.65,roof:false,layer:LAYER.INTERIOR,lifeState:LIFE.ALIVE,respawnRemaining:0,respawnAt:0,protection:0,deathReason:null,deathLayer:null,deathCount:0,hp:100,face:1,carry:false,swing:0,swingHit:false,cooldown:0,rangedCooldown:0,rangedFlash:0,meleeAttack:null,stun:0,invul:0};
    this.speedMode='CRUISE';this.consoleOpen=false;this.armoryOpen=false;this.phase='dock';this.status='ready';this.t=0;this.elapsed=0;this.enemies=[];this.projectiles=[];this.effects=[];this.notices=[];this.nextId=1;
    this.craneHits=new Set();this.throttle=0;this.boostCharge=V11.engineCharge;this.repCd=0;this.repairJob=null;this.repairHint='靠近设备，长按修理。';
    this.paused=false;this.settled=false;this.lastMuzzle=null;this.totalKills=0;this.creditsSpent=0;this.engineState='normal';this.rescue=null;this.rescueSerial=0;this.engineShield=0;
    this.director=new Director();this.lap=stats();this.total=stats();this.warnings={};this.segmentHits={crane:0,tunnel:0};this.clutchRepairAwarded=false;
    this.lowPlayerBand='normal';this.batteryBand='absent';this.arrivalElapsed=0;this.lastRound=null;this.failReason=null;this.lastDamageSource=null;
    this.event='从机库出发。修理需站在设备附近持续操作；成功后再决定是否继续。';
  }
  // Explicit DEV-only commands. No normal URL has a mutable reference or access to this gate.
  devCommand(action,value){
    if(!this.dev)return false;
    const n=Number(value);
    if(action==='start'){
      if(this.status==='running'){this.pause(false);return true;}
      if(this.status!=='ready')return false;
      if(this.hubStage==='route')this.chooseRoute('industrial');
      if(this.hubStage==='car')this.chooseCar(ROUTES[this.route].recommended);
      return this.start();
    }
    if(action==='time'){if(![1,2,4].includes(n))return false;this.timeScale=n;}
    else if(action==='round'){if(!Number.isInteger(n)||n<1||n>8)return false;this.round=n;}
    else if(action==='route'){
      if(!ROUTES[value]||!['ready','running'].includes(this.status))return false;
      if(this.status==='ready'){this.hubStage='route';this.chooseRoute(value);}
      else{this.route=value;this.prepareDepots();this.t=0;this.phase=phaseAt(0,value);this.elapsed=Math.max(3,this.elapsed);this.director=new Director();this.warnings={};this.craneHits.clear();this.tell('route_select',{route:value});}
    }
    else if(action==='jump'){
      if(this.status!=='running')return false;const c=V11.routes[this.route];
      const marker={depot:c.depots[0],crane:c.crane?.[0],tunnel:c.tunnel?.[0],return:.98}[value];if(marker===undefined)return false;
      if(this.heldCargo&&this.playerLayer===LAYER.DEPOT)this.loseCargo(this.heldCargo,'dev_jump');
      this.setPlayerLayer(LAYER.INTERIOR);this.player.x=V11.consoleX;this.t=marker;this.elapsed=Math.max(3,this.elapsed);this.phase=phaseAt(marker,this.route);this.warnings={};this.craneHits.clear();
    }
    else if(action==='car'){if(!['cargo','battery','workshop'].includes(value)||this.trainFull)return false;this.cars.push(car(value));if(this.trainFull&&this.status==='ready'&&this.hubStage==='car'){this.hubStage='depart';this.carOffers=[];this.selectedCar=null;}this.syncSystems();}
    else if(action==='cargo'){
      if(value==='fill'){
        const amount=V11.routes[this.route||'industrial'].value;
        for(let i=0;i<this.cars.length;i++){if(this.cars[i].type!=='cargo')continue;let count=this.cargoCrates.filter(c=>c.carIndex===i&&['stored','thief'].includes(c.location)).length;
          while(count<V11.cargoSlots&&this.cargoUsed<this.cargoCapacity){this.createCargo(amount,'stored',{carIndex:i,secured:true});this.money+=amount;count++;}}
      }else if(value==='clear'){for(const c of this.cargoCrates)if(['stored','player','floor','thief'].includes(c.location))this.loseCargo(c,'dev_clear');for(const e of this.enemies)e.carry=false;this.player.carry=false;this.syncCargo();}else return false;
    }
    else if(action==='scrap')this.scrap+=100;
    else if(action==='tier'){this.meleeTier=3;this.tell('combat_tier_unlock',{tier:3});this.tell('ranged_unlock',{weapon:'handgun'});}
    else if(action==='spawn'){if(!ENEMIES[value]||!this.spawn(value))return false;}
    else if(action==='speed'){
      if(!V11.speeds[value]||this.status!=='running'||this.engineState==='stalled')return false;
      const from=this.speedMode;this.speedMode=value;this.rewardEncounter();this.tell('speed_change',{from,to:value,reason:'dev_console_override'});
    }
    else if(action==='engine'){
      if(this.status!=='running'||!['20','stall'].includes(String(value)))return false;
      this.engineShield=0;this.cars[0].hp=value==='stall'?0:this.cars[0].max*.2;this.syncSystems();
    }
    else if(action==='kill'){if(!this.killPlayer())return false;}
    else if(action==='trainLost'){if(this.status!=='running'||!this.alive)return false;this.setPlayerLayer(LAYER.DEPOT);this.player.depotId=this.depots[0]?.id;this.killPlayer('train_lost');}
    else return false;
    this.tell('dev_action',{action,value:typeof value==='string'||typeof value==='number'?value:null});return true;
  }
  get trainFull(){return this.cars.length>=MAX_CARS;}
  get alive(){return isAlive(this.player.lifeState);}
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
    p.deathReason=reason;p.deathLayer=this.playerLayer;p.deathCount++;
    p.hp=0;p.lifeState=LIFE.DEAD;p.respawnRemaining=V11.respawnSeconds;p.respawnAt=this.elapsed+V11.respawnSeconds;
    p.swing=0;p.meleeAttack=null;p.rangedFlash=0;p.protection=0;p.invul=0;
    if(reason==='train_lost'){this.tell('train_lost',{depot:p.depotId});this.event='TRAIN LOST';}
    this.tell('player_death',{reason,layer:this.playerLayer});this.tell('respawn_start',{seconds:V11.respawnSeconds});
    this.feedback('death',p.x,p.y+1);return true;
  }
  lifeStep(dt){
    const p=this.player;
    if(p.lifeState===LIFE.DEAD){
      if(this.terminalDestroyed){this.fail('engine_timeout');return;}
      p.respawnRemaining=Math.max(0,p.respawnAt-this.elapsed);
      // A rescue expiry in this simulation step wins over a simultaneous respawn.
      // Player death never creates, resets or extends the engine rescue clock.
      const engineExpires=this.engineState==='stalled'&&this.rescue&&this.rescue.remaining<=dt+1e-8;
      if(p.respawnRemaining<=1e-8&&!engineExpires){
        p.lifeState=LIFE.RESPAWNING;this.setPlayerLayer(LAYER.INTERIOR);
        Object.assign(p,{x:V11.respawnX,hp:V11.playerMaxHP*V11.respawnFraction,carry:false,stun:0,cooldown:0,rangedCooldown:0,rangedFlash:0,meleeAttack:null,swing:0,invul:0,protection:V11.spawnProtection});
        p.lifeState=LIFE.PROTECTED;this.tell('respawn_complete',{x:p.x,hp:p.hp,layer:LAYER.INTERIOR,protection:p.protection});this.feedback('respawn',p.x,p.y+1);
      }
    }else if(p.lifeState===LIFE.PROTECTED){p.protection=Math.max(0,p.protection-dt);if(p.protection<=1e-8){p.protection=0;p.lifeState=LIFE.ALIVE;}}
  }
  get length(){return this.cars.length*LENGTH;}
  get currentCar(){return clamp(Math.floor(this.player.x/LENGTH),0,this.cars.length-1);}
  get melee(){return weaponAt('melee',this.meleeTier);}
  get ranged(){return weaponAt('ranged',this.rangedTier);}
  get combatTier(){return this.meleeTier;}
  get meleeStats(){return weaponStats('melee',this.meleeTier);}
  get rangedStats(){return weaponStats('ranged',this.rangedTier);}
  get weapon(){return this.melee.name+' / '+(this.ranged?.name||'RANGED LOCKED');}
  get range(){return this.rangedStats?.range||this.meleeStats.range;}
  get craneX(){const c=V11.routes[this.route]?.crane||V11.routes.industrial.crane;return this.length+3-clamp((this.t-c[1])/(c[2]-c[1]),0,1)*(this.length+6);}
  get battery(){return this.cars.some(c=>c.type==='battery'&&c.hp>0);}
  get power(){const cells=this.cars.filter(c=>c.type==='battery'&&c.hp>0);return cells.length?Math.max(...cells.map(c=>Math.min(c.hp/c.max,(c.charge||0)/V11.batteryCharge))):0;}
  get batterySupply(){const cells=this.cars.filter(c=>c.type==='battery'&&c.hp>0);return cells.length?cells.reduce((n,c)=>n+(c.charge||0),0)/(cells.length*V11.batteryCharge):0;}
  get repairSpeed(){return (this.cars.some(c=>c.type==='workshop'&&c.hp>0)?B.workshopSpeed:1)*(this.batterySupply>V11.poweredRepairThreshold?B.poweredWorkshopSpeed:1);}
  refillBattery(){this.boostCharge=V11.engineCharge;for(const c of this.cars)if(c.type==='battery')c.charge=V11.batteryCharge;this.syncSystems();}
  get speed(){return this.engineState==='stalled'?0:V11.speeds[this.speedMode].speed*(this.engineState==='critical'?B.criticalSpeed:this.engineState==='damaged'?B.damagedSpeed:1);}
  get batteryCapacity(){return V11.engineCharge+this.cars.filter(c=>c.type==='battery'&&c.hp>0).length*V11.batteryCharge;}
  get batteryCharge(){return this.boostCharge+this.cars.filter(c=>c.type==='battery'&&c.hp>0).reduce((sum,c)=>sum+(c.charge||0),0);}
  get atConsole(){return !this.player.roof&&this.player.layer!=='DEPOT'&&this.currentCar===0&&Math.abs(this.player.x-V11.consoleX)<=V11.consoleRadius;}
  setSpeed(mode){
    if(this.status!=='running'||this.paused||!this.atConsole||!this.alive||this.engineState==='stalled'||!V11.speeds[mode])return false;
    if(mode==='FAST'&&this.batteryCharge<=0){this.event='BATTERY EMPTY · CRUISE AVAILABLE';return false;}
    if(mode===this.speedMode)return true;const from=this.speedMode;this.speedMode=mode;this.rewardEncounter();this.tell('speed_change',{from,to:mode});this.event='ENGINE CONSOLE · '+mode;return true;
  }
  emergencyStop(){
    if(this.status!=='running'||this.paused||!this.alive||this.playerLayer===LAYER.DEPOT)return false;
    const from=this.speedMode;this.speedMode='STOP';this.rewardEncounter();this.tell('emergency_stop',{from});if(from!=='STOP')this.tell('speed_change',{from,to:'STOP',reason:'emergency'});
    this.event='EMERGENCY STOP · RETURN TO ENGINE TO ACCELERATE';return true;
  }
  drainBattery(dt){
    if(this.speedMode!=='FAST'||this.speed<=0)return;let use=V11.fastDrain*dt;
    const base=Math.min(this.boostCharge,use);this.boostCharge-=base;use-=base;
    for(const c of this.cars){if(c.type!=='battery'||c.hp<=0)continue;const amount=Math.min(c.charge||0,use);c.charge-=amount;use-=amount;}
    if(this.batteryCharge<1e-8){this.boostCharge=0;this.speedMode='CRUISE';this.tell('speed_change',{from:'FAST',to:'CRUISE',reason:'battery_empty'});this.event='BATTERY EMPTY · AUTO CRUISE';}
  }
  rand(){this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296;}
  tell(type,data={}){this.emit(type,{round:this.round,phase:this.phase,mode:this.practice?'practice':'run',time:this.elapsed,...data,dev:this.dev});}
  inc(key,value=1){this.lap[key]+=value;this.total[key]+=value;}
  feedback(type,x,y,text=''){const life=['restart','repair','scrap','buy'].includes(type)?V11.combat.popLifetime:.45;this.effects.push({id:this.nextId++,type,x,y,text,life,max:life});if(this.effects.length>48)this.effects.shift();}
  notice(title,detail='',kind='success'){const n={id:this.nextId++,title,detail,kind,life:3.2};this.notices.push(n);if(this.notices.length>4)this.notices.shift();this.tell('success_feedback',{title,detail});}
  buyPrep(id){
    const spec=V11.prep[id],atShop=!this.practice&&(this.status==='cashed'||(this.status==='ready'&&this.hubStage==='route'));
    if(!spec||!atShop||this.bank<spec.cost||this.prep[id]>=spec.max)return false;
    this.bank-=spec.cost;this.prep[id]++;if(id==='intel')this.intelPrepared=false;
    this.tell('prep_purchase',{item:id,cost:spec.cost,count:this.prep[id],bank:this.bank});return true;
  }
  prepareRouteIntel(){
    if(this.status!=='ready'||this.hubStage!=='route'||this.intelPrepared)return this.routeIntel;
    this.intelPrepared=true;if(this.prep.intel<=0)return null;
    const ids=Object.keys(ROUTES),route=ids[Math.floor(this.rand()*ids.length)];this.prep.intel--;this.routeIntel={route,text:ROUTES[route].intel};
    this.tell('prep_use',{item:'intel',route,text:this.routeIntel.text});return this.routeIntel;
  }
  prepareCarOffers(rerolled=false){
    if(!this.route||this.trainFull){this.carOffers=[];return this.carOffers;}const recommended=ROUTES[this.route].recommended;
    const normal={industrial:'cargo',freight:'battery',tunnel:'cargo'},redraw={industrial:'battery',freight:'workshop',tunnel:'workshop'};
    const alt=(rerolled?redraw:normal)[this.route];this.carOffers=[recommended,alt].filter((v,i,a)=>a.indexOf(v)===i);return this.carOffers;
  }
  rerollCars(){
    if(this.status!=='ready'||this.hubStage!=='car'||this.trainFull||this.carRerolled||this.prep.reroll<=0)return false;
    const before=[...this.carOffers];this.prep.reroll--;this.carRerolled=true;this.prepareCarOffers(true);
    this.tell('prep_use',{item:'reroll',before,after:[...this.carOffers]});return true;
  }
  get emergencyRepairTime(){return B.restartTime/(this.repairSpeed*(this.runRepairKit?V11.kitSpeed:1));}
  chooseRoute(id){
    if(this.status!=='ready'||this.hubStage!=='route'||!ROUTES[id])return false;
    this.route=id;this.prepareDepots();this.repeatPressure=this.previousRoute===id?1:0;this.hubStage=this.trainFull?'depart':'car';this.selectedCar=null;this.carRerolled=false;this.prepareCarOffers(false);
    this.tell('route_select',{route:id});if(this.repeatPressure)this.tell('route_repeat',{route:id,extraCap:1});return true;
  }
  chooseCar(type){
    if(this.status!=='ready'||this.hubStage!=='car'||this.trainFull||!this.carOffers.includes(type))return false;
    this.cars.push(car(type));this.selectedCar=type;this.hubStage='depart';
    this.tell('car_select',{route:this.route,type,cars:this.cars.length});return true;
  }
  get routeAngle(){return V11.routes[this.route]?.gateAngle||0;}
  get turntableAngle(){const u=clamp(this.elapsed/V11.turntableSeconds,0,1);return this.status==='ready'?this.turntableFrom:this.turntableFrom+(this.routeAngle-this.turntableFrom)*u*u*(3-2*u);}
  start(){if(this.status!=='ready'||this.hubStage!=='depart')return false;if(!this.practice&&!this.runPrepLoaded){this.runPrepLoaded=true;if(this.prep.repairKit>0){this.prep.repairKit--;this.runRepairKit=1;this.tell('prep_equip',{item:'repairKit'});}}this.status='running';this.phase='depart';this.t=0;this.elapsed=0;this.settled=false;this.paused=false;this.event='转盘对轨。完整回站后才能兑现，停机时仍有抢救机会。';this.tell('depart',{seed:this.initialSeed});return true;}
  pause(value){if(this.paused===value)return;this.paused=value;this.tell(value?'pause':'resume');}
  cancelRepair(reason){if(!this.repairJob)return;this.tell('repair_interrupted',{reason,car:this.repairJob.car,progress:this.repairJob.progress});this.repairJob=null;this.repairHint=({damage:'受击中断，清理敌人后再维修。',move:'移动中断，请站稳。',released:'已松开修理。',layer:'切层中断。',attack:'攻击中断维修。'}[reason]||'维修中断。');}
  layer(){
    if(this.status!=='running'||this.paused||!this.alive||this.player.stun>0)return false;
    if(this.playerLayer===LAYER.DEPOT)return this.exitDepot();
    if(this.phase==='tunnel'){this.event='低净空：隧道内不能登上车顶。';return false;}
    const p=this.player;if(p.carry){this.event='先放下货箱，再爬梯。';return false;}
    const ladder=this.currentCar*LENGTH+LENGTH*.52;
    if(Math.abs(p.x-ladder)>1.8){this.event='走近本节中央黄色梯子，再切换车顶。';return false;}
    this.player.swing=0;this.player.meleeAttack=null;this.cancelRepair('layer');this.setPlayerLayer(p.roof?LAYER.INTERIOR:LAYER.ROOF);this.tell('layer',{roof:p.roof});return true;
  }
  get atArmory(){return this.playerLayer===LAYER.INTERIOR&&this.currentCar===0&&Math.abs(this.player.x-V11.armoryX)<=V11.armoryRadius;}
  armoryOffer(slot){
    if(!['melee','ranged'].includes(slot))return null;
    const tier=(slot==='melee'?this.meleeTier:this.rangedTier)+1,weapon=weaponAt(slot,tier);
    return weapon?{slot,tier,weapon:weapon.id,name:weapon.name,cost:weaponStats(slot,tier).cost,locked:slot==='ranged'&&this.combatTier<3}:null;
  }
  closeArmory(){this.armoryOpen=false;}
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
    const region=this.round+':stop:'+Math.floor(this.t/V11.stopRegionProgress);
    if(['STOP','SLOW'].includes(this.speedMode)||this.engineState==='stalled')this.stopRewardRegion=region;
    return this.stopRewardRegion===region?region:null;
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
  resetCombat(){this.scrap=0;this.meleeTier=1;this.rangedTier=0;this.armoryOpen=false;this.player.swing=0;this.player.meleeAttack=null;this.player.cooldown=0;this.player.rangedCooldown=0;this.player.rangedFlash=0;this.projectiles=[];this.rewardEncounters.clear();this.stopRewardRegion=null;}
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
  hitEnemy(e,damage,dir=this.player.face,weapon='wrench'){
    if(e.hp<=0||!Number.isFinite(damage)||damage<=0)return;
    const spec=V11.enemies[e.type],tool=V11.weapons[weapon]||V11.weapons.wrench;
    const actual=damage*(weapon==='wrench'?(spec.wrenchArmor||1):1);
    e.hp=Math.max(0,e.hp-actual);e.stun=V11.combat.enemyStun*spec.stun;e.flash=V11.combat.enemyFlash;
    // Light tools cannot permanently stunlock an armored heavy windup.
    if(e.type!=='bruiser'||tool.knockback>=V11.weapons.axe.knockback)e.wind=0;
    e.x=clamp(e.x+dir*tool.knockback*spec.knockback,.3,this.length-.3);
    this.feedback('hit',e.x,e.y+.8);this.tell('enemy_hit',{id:e.id,enemy_type:e.type,damage:actual,weapon});
    if(e.hp>0)return;this.totalKills++;this.inc('kills');this.grantKillScrap(e);
    if(e.carry){const crate=this.cargoCrates.find(c=>c.id===e.carry);if(crate){crate.location='stored';crate.carIndex=e.cargoCar;}e.carry=false;this.syncCargo();const value=crate?.value||0;this.inc('cargoSaved',value);this.tell('cargo_recovered',{value,enemy:e.id});this.notice('货物追回','保住 '+value+' · 未额外发放救援奖金');}
    this.tell('enemy_kill',{id:e.id,enemy_type:e.type,weapon});this.tell('enemy_killed',{enemy:e.type});this.feedback('kill',e.x,e.y+.9);
  }
  hurt(amount,source){
    const p=this.player;if(this.status!=='running'||!this.alive||p.invul>0||p.protection>0)return;
    p.hp=Math.max(0,p.hp-amount);p.invul=.6;p.stun=.12;this.lastDamageSource=source;
    this.armoryOpen=false;this.consoleOpen=false;this.cancelRepair('damage');this.feedback('damage',p.x,p.y+.9,'-'+amount);this.tell('player_damage',{amount,source});this.playerWarnings();
    if(p.hp<=0)this.killPlayer('hp_zero');
  }
  damageCar(index,amount,source='boarder'){
    if(this.status!=='running')return;const c=this.cars[index];if(!c||amount<=0||(index===0&&this.engineShield>0))return;
    const actual=Math.min(c.hp,amount);c.hp=Math.max(0,c.hp-amount);
    if(actual){this.feedback('damage',index*LENGTH+4.1,2,'-'+Math.round(actual));this.tell('car_damage',{car:index,amount:actual,hp:c.hp,source});}
    this.syncSystems();
  }
  syncSystems(){
    const next=engineBand(this.cars[0]);
    if(next!==this.engineState){const old=this.engineState;this.engineState=next;this.tell('engine_state',{from:old,to:next,hp:this.cars[0].hp});
      if(['critical','stalled'].includes(next)&&!['critical','stalled'].includes(old))this.tell('critical_enter',{system:'engine'});
      if(['critical','stalled'].includes(old)&&!['critical','stalled'].includes(next))this.tell('critical_exit',{system:'engine'});
      if(next==='damaged')this.event='01 动力车受损：可趁空隙修理，列车轻微降速。';
      if(next==='critical')this.event='01 动力车危急：耐久低于 25%，请回动力控制柜维修。';
    }
    if(next==='stalled'&&!this.rescue&&this.status==='running'){
      let travel=Math.max(0,Math.abs(this.player.x-stationX(0))-B.repairRadius)/B.walk;
      if(this.player.carry){const options=this.cars.flatMap((c,i)=>{if(c.type!=='cargo')return [];const drop=clamp(this.player.x,i*LENGTH+.4,(i+1)*LENGTH-.4);return [Math.abs(this.player.x-drop)/B.carrySpeed+Math.max(0,Math.abs(drop-stationX(0))-B.repairRadius)/B.walk+1];});travel=Math.max(travel,...(options.length?[Math.min(...options)]:[]));}
      const restartTime=this.emergencyRepairTime,window=Math.max(B.rescueMinimum,Math.ceil(travel+B.restartTime+B.rescueMargin));
      this.rescue={id:++this.rescueSerial,remaining:window,window,entered:this.elapsed};this.throttle=0;
      this.cancelRepair('stalled');this.tell('engine_stalled',{window,travel,repairTime:restartTime,x:this.player.x});
      this.event='动力停机！赶往 01 控制柜，长按修理完成重启。';
    }
    // A direct debug HP edit may recover an engine; do not leave a stale deadline behind.
    if(next!=='stalled'&&this.rescue)this.rescue=null;
    const cells=this.cars.filter(c=>c.type==='battery'),level=!cells.length?'absent':this.power<=0?'offline':this.power<=.25?'emergency':this.power<=.5?'flicker':'normal';
    if(level!==this.batteryBand){this.batteryBand=level;this.tell('battery_state',{level});if(['emergency','offline','flicker'].includes(level))this.event=level==='offline'?'供电失效：隧道保留应急照明，请维修电池车。':level==='emergency'?'供电危急：应急灯已接管。':'供电不稳：灯光开始闪烁。';}
    this.playerWarnings();
  }
  playerWarnings(){const hp=this.player.hp,next=hp<=20?'critical':hp<=40?'warning':'normal';if(next===this.lowPlayerBand)return;const old=this.lowPlayerBand;this.lowPlayerBand=next;this.tell('player_health_band',{from:old,to:next,hp});if(next==='critical')this.tell('player_near_death',{hp});}
  repair(dt){
    if(this.status!=='running'||this.paused||!this.alive)return false;const p=this.player,i=this.currentCar,c=this.cars[i];
    if(this.playerLayer!==LAYER.INTERIOR||p.carry||p.stun>0||p.swing>0||p.rangedFlash>0||this.repCd>0){this.cancelRepair('unavailable');return false;}
    if(Math.abs(p.x-stationX(i))>B.repairRadius){this.cancelRepair('range');this.repairHint='靠近本节设备中心再修理；动力控制柜在车厢右侧。';return false;}
    const localFault=c.type==='workshop'&&c.hp>0&&!!this.director.fault;
    if(c.hp>=c.max&&!(i===0&&this.director.fault)&&!localFault){this.cancelRepair('full');this.repairHint='这节车厢完好。';return false;}
    const emergency=i===0&&this.engineState==='stalled';
    if(!this.repairJob||this.repairJob.car!==i||this.repairJob.emergency!==emergency||this.repairJob.localFault!==localFault){
      this.repairJob={car:i,progress:0,duration:emergency?this.emergencyRepairTime:(localFault?V11.workshopFaultTime:B.repairTime)/this.repairSpeed,emergency,localFault,low:c.hp/c.max<=.10};
      this.tell('repair_started',{...this.repairJob});
    }
    const job=this.repairJob;job.duration=emergency?this.emergencyRepairTime:(localFault?V11.workshopFaultTime:B.repairTime)/this.repairSpeed;job.progress+=job.emergency&&this.rescue?Math.min(dt,this.rescue.remaining):dt;
    if(job.progress+1e-8<job.duration)return false;
    this.repairJob=null;this.repCd=B.repairCooldown;const before=c.hp;
    if(emergency){const rescueId=this.rescue?.id,remaining=this.rescue?.remaining;c.hp=c.max*B.restartFraction;this.engineShield=B.restartShield;this.inc('clutchSaves');this.tell('engine_recovered',{rescueId,remaining,hp:c.hp});this.tell('clutch_save',{rescueId});this.notice('引擎重新启动','最后一搏成功 · 4 秒防护 / 8 秒恢复期');this.feedback('restart',stationX(0),2.5);if(this.runRepairKit){this.runRepairKit=0;this.tell('prep_use',{item:'repairKit',reason:'emergency_repair'});}this.director.recover(this,'engine_restarted');}
    else{c.hp=Math.min(c.max,c.hp+B.repairHP);if(i===0&&job.low&&!this.clutchRepairAwarded){this.clutchRepairAwarded=true;this.inc('clutchRepairs');this.notice('关键维修','动力车从极低耐久脱险');}this.feedback('repair',p.x,FLOOR+1,'+'+Math.round(c.hp-before));}
    this.inc('repairs');this.tell('repair_complete',{car:i,amount:c.hp-before,emergency});this.repairHint='维修完成 +'+Math.round(c.hp-before);
    if(i===0||localFault)this.director.cancelFault(this,localFault?'workshop_local_service':'repair');
    if(localFault){this.repairHint='FAULT CLEARED · WORKSHOP SERVICE';this.tell('workshop_fault_repaired',{car:i});this.notice('故障已排除','维修车本地检修已恢复动力冷却');}
    this.syncSystems();
    if(emergency&&this.practice){this.status='practice_complete';this.tell('practice_complete');}
    return true;
  }
  interact(){
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
    if(c.type==='engine'){if(this.atArmory)return this.openArmory();this.armoryOpen=false;this.consoleOpen=this.atConsole&&!this.consoleOpen;this.event=this.atConsole?'ENGINE CONSOLE · SELECT A SUSTAINED SPEED':'MOVE TO ENGINE CONSOLE';return this.consoleOpen;}
    if(c.type==='cargo')return this.pickupCargo(this.cargoCrates.find(c=>c.location==='stored'&&c.carIndex===this.currentCar));
    if(c.type==='workshop'){const gain=Math.min(V11.workshopHeal,V11.playerMaxHP-p.hp);if(!gain||this.money-this.cargoValue<V11.workshopCost)return false;this.money-=V11.workshopCost;this.creditsSpent+=V11.workshopCost;p.hp+=gain;this.playerWarnings();this.tell('workshop_heal',{gain});return true;}
    if(c.type==='battery'){this.event='BATTERY CHARGE '+Math.round(c.charge||0);return true;}
    return false;
  }
  spawn(type=null,x=null,roof=null){
    if(this.status!=='running'||!this.director.canSpawn(this))return null;
    type??=this.director.chooseType(this);if(!ENEMIES[type])return null;
    const spec=V11.enemies[type];roof??=false;if(type==='clinger')roof=this.phase!=='tunnel';if(type==='thief'||type==='saboteur')roof=false;
    x??=(this.rand()<.5?.5:this.length-.5);
    const e={id:this.nextId++,rewardEncounter:this.rewardEncounter(),rewarded:false,type,x,y:roof?ROOF:FLOOR,z:.65,roof,face:1,hp:spec.hp,maxHP:spec.hp,wind:0,recovery:0,stun:0,flash:0,climb:type==='clinger'?spec.attach+spec.climb:V11.enemyBoardingSeconds,carry:false,cargoCar:null,escapeWarned:false,state:type==='clinger'?'attach':'boarding',targetKind:null,targetCar:null,layerMove:null};
    if(type==='clinger'){e.y=.45;e.z=1.62;}
    this.enemies.push(e);this.director.maxLoad=Math.max(this.director.maxLoad,this.director.load(this));
    this.tell('enemy_spawn',{id:e.id,enemy_type:type,x,roof,load:this.director.load(this),cap:capFor(this.round)+this.repeatPressure});this.tell('spawn',{id:e.id,type,x,roof});return e;
  }
  warn(kind,lead){if(this.warnings[kind]!==undefined)return;this.warnings[kind]=this.elapsed;this.tell('hazard_warning',{hazard:kind,minimumLead:lead});}
  warningAge(kind){return this.warnings[kind]===undefined?0:this.elapsed-this.warnings[kind];}
  phaseChanged(old,next){
    if(old==='crane'&&next!=='crane'){if(!this.segmentHits.crane)this.notice('机械区通过','已安全通过扫顶区域');this.director.recover(this,'crane_cleared');}
    if(old==='tunnel'&&next!=='tunnel'){if(!this.segmentHits.tunnel)this.notice('隧道通过','安全抵达出口');this.director.recover(this,'tunnel_cleared');}
    this.phase=next;this.tell('route_segment_enter',{segment:next,routeT:this.t});
    this.event=next==='crane'?'机械臂预警：黄色梯子下车内，离开扫顶区域。':next==='approach'?'前方低净空：提前找到黄色梯子，回车内。':next==='tunnel'?'隧道中：应急灯保底照明，车顶封闭。':next==='return'?'机库就在前方。回站后有安全结算时间。':phaseLabel(next,this.route);
  }
  routeStep(dt){
    if(this.elapsed<V11.turntableSeconds&&this.t===0)return;
    const config=V11.routes[this.route]||V11.routes.industrial;
    let nt=clamp(this.t+dt*this.speed/DURATION,0,1);
    for(const kind of ['crane','tunnel']){const h=config[kind];if(!h)continue;
      const lead=kind==='crane'?B.craneLead:B.tunnelLead;
      if(nt>=h[0]&&this.t<h[2])this.warn(kind,lead);
      if(this.t<=h[1]&&nt>=h[1]&&this.warningAge(kind)<lead)nt=h[1]-1e-7;
    }
    this.t=nt;const next=phaseAt(nt,this.route);if(next!==this.phase)this.phaseChanged(this.phase,next);
    const p=this.player,c=config.crane;
    if(c&&this.phase==='crane'&&this.t>=c[1]&&this.t<=c[2]&&p.roof&&Math.abs(p.x-this.craneX)<1.25&&!this.craneHits.has('player')){this.craneHits.add('player');this.inc('hazardHits');this.segmentHits.crane++;this.hurt(32,'crane');this.tell('hazard_hit',{hazard:'crane',x:p.x,craneX:this.craneX});}
    if(this.phase==='tunnel'&&p.roof){p.roof=false;p.y=FLOOR;this.inc('hazardHits');this.segmentHits.tunnel++;this.hurt(30,'tunnel');this.tell('hazard_hit',{hazard:'tunnel'});}
    this.drainBattery(dt);
  }
  systemTarget(e){
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
      if(e.wind===0){e.face=Math.sign(target-e.x)||e.face;this.tell('enemy_windup',{id:e.id,enemy_type:e.type,target:kind,car:carIndex,seconds:spec.windup});}
      e.state=e.type==='saboteur'?'system_windup':e.type==='bruiser'?'heavy_windup':'attack_windup';e.wind+=dt;
      if(e.wind+1e-8>=spec.windup){
        e.wind=0;e.recovery=spec.recovery;e.state='recover';
        if(targetPlayer){if(this.alive&&this.playerLayer!==LAYER.DEPOT&&e.roof===p.roof&&Math.abs(e.x-p.x)<=spec.reach&&(p.x-e.x)*e.face>=-.3)this.hurt(spec.damage,e.type);}
        else if(Math.abs(e.x-stationX(carIndex))<=spec.reach+.1)this.damageCar(carIndex,spec.systemDamage,e.type);
      }
    }
  }
  effectsStep(dt){this.effects.forEach(f=>f.life-=dt);this.effects=this.effects.filter(f=>f.life>0);this.notices.forEach(n=>n.life-=dt);this.notices=this.notices.filter(n=>n.life>0);}
  step(dt,input={}){
    dt=Number.isFinite(dt)?clamp(dt,0,.05):0;if(dt<=0||this.paused)return;
    if(this.status==='arriving'){this.arrivalElapsed+=dt;this.elapsed+=dt;this.lifeStep(dt);this.effectsStep(dt);if(this.arrivalElapsed+1e-8>=B.arrivalTime)this.completeArrival();return;}
    // The four-second dock does not erase a remaining death countdown.
    if(['complete','cashed'].includes(this.status)){this.elapsed+=dt;this.lifeStep(dt);this.effectsStep(dt);return;}
    if(this.status!=='running')return;
    this.syncSystems();const p=this.player;if(p.hp<=0&&this.alive)this.killPlayer('hp_zero');this.elapsed+=dt;this.lifeStep(dt);this.effectsStep(dt);
    if(['critical','stalled'].includes(this.engineState)||p.hp<=20)this.inc('criticalSeconds',dt);
    this.repCd=Math.max(0,this.repCd-dt);this.engineShield=Math.max(0,this.engineShield-dt);this.throttle=Math.max(0,this.throttle-dt);p.cooldown=Math.max(0,p.cooldown-dt);p.rangedCooldown=Math.max(0,p.rangedCooldown-dt);p.rangedFlash=Math.max(0,p.rangedFlash-dt);p.invul=Math.max(0,p.invul-dt);p.stun=Math.max(0,p.stun-dt);
    const dir=this.alive?clamp(Number(input.move)||0,-1,1):0;
    if(dir){this.cancelRepair('move');if(p.stun<=0){if(this.playerLayer===LAYER.DEPOT){p.depotX=clamp(p.depotX+dir*dt*(p.carry?B.carrySpeed:B.walk),-V11.depot.width/2+.4,V11.depot.width/2-.4);}else p.x=clamp(p.x+dir*dt*(p.carry?B.carrySpeed:B.walk*(p.roof?B.roofSpeed:1)),.4,this.length-.4);p.face=dir;}}
    if(input.attack)this.attack();if(input.ranged)this.rangedAttack();this.meleeStep(dt);
    this.director.step(this,dt);this.enemyStep(dt);
    if(this.status!=='running')return;
    if(input.repair&&!input.attack&&!input.ranged&&!dir)this.repair(dt);else if(!input.repair)this.cancelRepair('released');
    if(this.status!=='running')return;
    this.projectileStep(dt);this.enemies=this.enemies.filter(e=>e.hp>0);
    this.syncSystems();
    if(this.rescue){this.rescue.remaining=Math.max(0,this.rescue.remaining-dt);if(this.rescue.remaining<=1e-8){this.tell('engine_failed',{rescueId:this.rescue.id});this.fail('engine_timeout');return;}}
    this.routeStep(dt);this.syncDepotPlayer();if(!this.atConsole)this.consoleOpen=false;if(!this.atArmory)this.armoryOpen=false;if(this.status!=='running')return;
    if(p.hp<=0&&this.alive)this.killPlayer('hp_zero');
    if(this.t>=1&&this.engineState!=='stalled')this.finish();
  }
  finish(){
    if(this.status!=='running'||this.cars[0].hp<=0||this.engineState==='stalled')return false;
    this.armoryOpen=false;this.consoleOpen=false;this.cancelRepair('arrival');this.status='arriving';this.phase='dock';this.arrivalElapsed=0;this.throttle=0;
    if(this.heldCargo&&this.playerLayer!==LAYER.DEPOT){const c=this.heldCargo;c.location='stored';c.carIndex=this.cars.findIndex(c=>c.type==='cargo');if(!c.secured){c.secured=true;this.money+=c.value;}this.player.carry=false;}
    // Cargo still on the train (including a thief's hands) is secured on reaching the depot.
    for(const e of this.enemies)if(e.hp>0&&e.carry){const c=this.cargoCrates.find(c=>c.id===e.carry);if(c)c.location='stored';e.carry=false;this.syncCargo();this.tell('cargo_secured_at_dock',{enemy:e.id});}
    this.syncCargo();this.enemies=[];this.projectiles=[];this.event='你回来了。列车正在锁定转盘，损伤与货物正在核对。';this.tell('route_arrived',{engineHP:this.cars[0].hp,playerHP:this.player.hp});return true;
  }
  completeArrival(){
    if(this.status!=='arriving')return;this.refillBattery();this.status='complete';const reward=Math.round((900+this.round*500)*Math.pow(1.22,this.round-1));this.money+=reward;
    this.lastRound={...this.lap,reward,engineHP:this.cars[0].hp,playerHP:this.player.hp};this.tell('round_complete',{money:this.money,...this.lastRound});this.event='回站完成。现在可以放心兑现，也可以带着当前车况继续。';
  }
  more(){
    if(this.status!=='complete'||this.practice||!this.alive)return false;
    this.turntableFrom=this.routeAngle;this.previousRoute=this.route;this.route=null;this.hubStage='route';this.selectedCar=null;this.routeIntel=null;this.intelPrepared=false;this.carOffers=[];this.carRerolled=false;this.round++;this.t=0;this.speedMode='CRUISE';this.consoleOpen=false;this.armoryOpen=false;this.phase='dock';this.status='ready';this.craneHits.clear();
    Object.assign(this.player,{hp:Math.min(100,this.player.hp+25),roof:false,layer:LAYER.INTERIOR,lifeState:LIFE.ALIVE,protection:0,respawnRemaining:0,z:.65,y:FLOOR,x:3,swing:0,carry:false,stun:0,invul:0,cooldown:0,rangedCooldown:0,rangedFlash:0,meleeAttack:null});
    this.speedMode='CRUISE';this.consoleOpen=false;this.throttle=0;this.refillBattery();
    this.director=new Director();this.lap=stats();this.warnings={};this.segmentHits={crane:0,tunnel:0};this.clutchRepairAwarded=false;this.engineShield=0;this.repCd=0;this.repairJob=null;this.rescue=null;this.syncSystems();
    this.tell('one_more_round',{cars:this.cars.length,risk:this.risk()});return true;
  }
  cashout(){if(this.status!=='complete'||this.settled||this.practice)return false;this.settled=true;this.settledAmount=Math.round(this.money);this.bank+=this.settledAmount;for(const c of this.cargoCrates)if(c.secured)c.location='banked';this.syncCargo();this.money=0;this.resetCombat();this.status='cashed';this.tell('cashout',{bank:this.bank,amount:this.settledAmount});this.tell('cash_out',{bank:this.bank,stats:this.total});return true;}
  fail(reason='engine_timeout'){if(this.status!=='running')return;this.cancelRepair('failure');if(this.player.lifeState===LIFE.DEAD)this.tell('respawn_cancel_engine_failure',{remaining:this.player.respawnRemaining});this.terminalDestroyed=true;this.player.lifeState=LIFE.FAILED;this.player.respawnRemaining=0;this.status='lost';this.failReason=reason;this.lostAmount=this.money;this.tell('run_failed',{lost:this.money,reason,lastDamage:this.lastDamageSource,stats:this.total});this.money=0;this.resetCombat();}
  risk(){const score=this.round+1+(1-this.cars[0].hp/this.cars[0].max)*4+(1-this.player.hp/100)*2+Math.max(0,this.cars.length-4)*.25;return score<3?'LOW':score<5?'MEDIUM':score<8?'HIGH':'EXTREME';}
  hazardInfo(){const c=V11.routes[this.route]||V11.routes.industrial;for(const kind of ['crane','tunnel']){const h=c[kind];if(h&&this.t>=h[0]&&this.t<h[1])return {kind,seconds:Math.max((kind==='crane'?B.craneLead:B.tunnelLead)-this.warningAge(kind),(h[1]-this.t)*DURATION/Math.max(.1,this.speed))};}return null;}
  snapshot(){return{build:BUILD,prep:{...this.prep},runRepairKit:this.runRepairKit,routeIntel:this.routeIntel?{...this.routeIntel}:null,carOffers:[...this.carOffers],carRerolled:this.carRerolled,dev:this.dev,timeScale:this.timeScale,repairSpeed:this.repairSpeed,batterySupply:this.batterySupply,combatTier:this.combatTier,meleeWeapon:this.melee.id,rangedWeapon:this.ranged?.id||null,armoryOpen:this.armoryOpen,armoryOffers:{melee:this.armoryOffer('melee'),ranged:this.armoryOffer('ranged')},rewardEncounters:Object.fromEntries(this.rewardEncounters),scrap:this.scrap,meleeTier:this.meleeTier,rangedTier:this.rangedTier,deathReason:this.player.deathReason,deathLayer:this.player.deathLayer,deathCount:this.player.deathCount,playerLayer:this.playerLayer,playerLifeState:this.player.lifeState,respawnRemaining:this.player.respawnRemaining,spawnProtection:this.player.protection,terminalDestroyed:this.terminalDestroyed,cargoUsed:this.cargoUsed,cargoCapacity:this.cargoCapacity,cargoValue:this.cargoValue,heldCargo:this.heldCargo?{id:this.heldCargo.id,value:this.heldCargo.value}:null,route:this.route,speedMode:this.speedMode,routeProgress:this.t,batteryCharge:this.batteryCharge,batteryCapacity:this.batteryCapacity,hubStage:this.hubStage,repeatPressure:this.repeatPressure,turntableAngle:this.turntableAngle,seed:this.initialSeed,mode:this.practice?'practice':'run',round:this.round,phase:this.phase,status:this.status,running:this.status==='running',paused:this.paused,routeT:this.t,elapsed:this.elapsed,px:this.player.x,playerY:this.player.y,roof:this.player.roof,facing:this.player.face,playerHp:this.player.hp,engineHp:this.cars[0].hp,engineState:this.engineState,rescue:this.rescue?{...this.rescue}:null,repair:this.repairJob?{...this.repairJob}:null,cars:this.cars.map(c=>c.type),batteryState:this.batteryBand,enemyCount:this.enemies.length,enemyStates:this.enemies.map(e=>({id:e.id,type:e.type,state:e.state,targetKind:e.targetKind,targetCar:e.targetCar,wind:e.wind,hp:e.hp,x:e.x,y:e.y,roof:e.roof})),projectileCount:this.projectiles.length,weapon:this.weapon,range:this.range,money:this.money,bank:this.bank,craneX:this.craneX,lastMuzzle:this.lastMuzzle,threatCurrent:this.director.snapshot(this).actual,threatCap:this.director.snapshot(this).cap,threat:this.director.snapshot(this),stats:{...this.total},lap:{...this.lap},hazard:this.hazardInfo(),risk:this.risk(),failReason:this.failReason,arrivalElapsed:this.arrivalElapsed};}
}
