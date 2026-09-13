// Deterministic, renderer-independent rules. Distances are metres, time is seconds.
export const BUILD='V9R1-WEBGL-20260913';
export const LENGTH=8.3, FLOOR=1.12, ROOF=4.12, DURATION=100, MAX_CARS=12;
export const DEFS={engine:{name:'动力车',hp:180},cargo:{name:'货车',hp:110},battery:{name:'电池车',hp:100},workshop:{name:'维修车',hp:120}};
export function clamp(v,a,b){return Math.min(b,Math.max(a,v))}
export function car(type){return {type,hp:DEFS[type].hp,max:DEFS[type].hp,cargo:type==='cargo'?3:0}}
export function phaseAt(t){return t<.12?'depart':t<.30?'yard':t<.46?'crane':t<.56?'approach':t<.80?'tunnel':'return'}
export const LABELS={dock:'机库 / 准备',depart:'转盘对轨 / 出库',yard:'工业装卸区',crane:'机械臂区域',approach:'隧道预告',tunnel:'低净空隧道',return:'回库',complete:'回站完成',lost:'列车失守',cashed:'收益入库'};
export class Game {
 constructor({emit=()=>{},bank=0,seed=314159}={}){this.emit=emit;this.seed=seed;this.bank=bank;this.round=1;this.money=1000;this.cars=[car('engine'),car('cargo')];this.player={x:3,y:FLOOR,roof:false,hp:100,face:1,carry:false,swing:0,swingHit:false,cooldown:0,stun:0,invul:0};this.phase='dock';this.status='ready';this.t=0;this.enemies=[];this.projectiles=[];this.effects=[];this.nextId=1;this.spawnClock=0;this.craneHits=new Set();this.throttle=0;this.repCd=0;this.elapsed=0;this.paused=false;this.settled=false;this.lastMuzzle=null;this.totalKills=0;this.creditsSpent=0;this.event='扳手已就绪。点击发车，亲自守住这一圈。'}
 get length(){return this.cars.length*LENGTH}
 get currentCar(){return clamp(Math.floor(this.player.x/LENGTH),0,this.cars.length-1)}
 get weapon(){return this.round>=3?'SIDEARM':this.round===2?'HEAVY WRENCH':'WRENCH'}
 get range(){return this.round>=3?9:this.round===2?2.2:1.85}
 get craneX(){return this.length+3-clamp((this.t-.34)/.10,0,1)*(this.length+6)}
 get battery(){return this.cars.some(c=>c.type==='battery'&&c.hp>0)}
 rand(){this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296}
 tell(type,data={}){this.emit(type,{round:this.round,phase:this.phase,...data})}
 feedback(type,x,y,text=''){this.effects.push({type,x,y,text,life:.45,max:.45});if(this.effects.length>48)this.effects.shift()}
 start(){if(this.status!=='ready')return false;this.status='running';this.phase='depart';this.t=0;this.elapsed=0;this.settled=false;this.paused=false;this.event='机库锁定解除：转盘正在对轨。';this.tell('depart');return true}
 pause(value){this.paused=value;this.tell(value?'pause':'resume')}
 layer(){if(this.status!=='running'||this.paused||this.player.stun>0)return false;if(this.phase==='tunnel'){this.event='低净空：隧道内不能登上车顶。';return false}const p=this.player;if(p.carry){this.event='先放下货箱，再爬梯。';return false}const ladder=this.currentCar*LENGTH+LENGTH*.52;if(Math.abs(p.x-ladder)>1.8){this.event='走近车厢中央的黄色梯子，再切换车顶。';return false}p.roof=!p.roof;p.y=p.roof?ROOF:FLOOR;this.tell('layer',{roof:p.roof});return true}
 attack(){if(this.status!=='running'||this.paused)return false;const p=this.player;if(p.cooldown>0||p.stun>0||p.carry)return false;p.cooldown=this.round>=3?.43:.50;p.swing=.36;p.swingHit=false;
  if(this.round>=3){const m=this.muzzle();this.lastMuzzle={...m};this.projectiles.push({id:this.nextId++,x:m.x,y:m.y,z:m.z,origin:m.x,dir:p.face,roof:p.roof,life:.7});this.feedback('muzzle',m.x,m.y);this.tell('projectile_spawn',{...m,roof:p.roof})}this.tell('attack',{x:p.x,roof:p.roof,weapon:this.weapon});return true}
 muzzle(){return{x:this.player.x+this.player.face*1.08605,y:this.player.y+1.1235,z:.65+this.player.face*.2354}}
 hitEnemy(e,damage){if(e.hp<=0)return;e.hp-=damage;e.stun=.32;e.flash=.18;e.x=clamp(e.x+this.player.face*.45,.3,this.length-.3);this.feedback('hit',e.x,e.y+.8);if(e.hp<=0){this.totalKills++;this.money+=50;if(e.carry){const c=this.cars[e.cargoCar];if(c)c.cargo++;e.carry=false;this.tell('cargo_recovered')}this.tell('enemy_killed',{enemy:e.type});this.feedback('kill',e.x,e.y+.9,'+50')}}
 hurt(amount,source){const p=this.player;if(p.invul>0)return;p.hp=Math.max(0,p.hp-amount);p.invul=.6;p.stun=.12;this.feedback('damage',p.x,p.y+.9,'-'+amount);this.tell('player_damage',{amount,source});if(p.hp<=0)this.fail()}
 repair(dt){if(this.status!=='running'||this.paused||this.player.roof||this.player.carry||this.repCd>0)return;const i=this.currentCar,c=this.cars[i];if(c.hp>=c.max)return;this.repCd=.45;const hasWork=this.cars.some(c=>c.type==='workshop'&&c.hp>0);const amount=Math.min(hasWork?9:5,c.max-c.hp);c.hp+=amount;this.feedback('repair',this.player.x,FLOOR+1,'+'+amount);this.tell('repair',{car:i,amount})}
 interact(){if(this.status!=='running'||this.paused||this.player.roof)return;const p=this.player,c=this.cars[this.currentCar];if(p.carry){if(c.type==='cargo'){c.cargo++;p.carry=false;this.tell('cargo_drop',{car:this.currentCar});this.event='货箱已放入本节货车。'}else this.event='携带货箱时，前往货车放下。';return}
  if(c.hp<=0){this.event='设备损坏，先修理本节车厢。';return}
  if(c.type==='engine'){if(this.throttle>0)return;this.throttle=4;this.event='动力增压：加速四秒，下一处危险会更早到达。';this.tell('boost');return}
  if(c.type==='cargo'&&c.cargo>0){c.cargo--;p.carry=true;this.event='正在携带货箱：移动变慢；再次交互放下。';this.tell('cargo_pickup',{car:this.currentCar});return}
  if(c.type==='workshop'){const gain=Math.min(20,100-p.hp);if(!gain||this.money<120)return;this.money-=120;p.hp+=gain;this.event='使用工作台：花费本局 120，恢复 '+gain+' 生命。';this.tell('workshop_heal',{gain});return}
  this.event='这节车厢暂无可操作设备。'}
 spawn(type=null,x=null,roof=null){if(this.enemies.length>=16)return;type??=this.rand()<.28?'thief':'boarder';roof??=(type!=='thief'&&this.phase!=='tunnel'&&this.rand()<.23);x??=(this.rand()<.5?.5:this.length-.5);const e={id:this.nextId++,type,x,y:roof?ROOF:FLOOR,roof,hp:type==='thief'?3:2,wind:0,recovery:0,stun:0,flash:0,climb:.7,carry:false,cargoCar:1};this.enemies.push(e);this.tell('spawn',{id:e.id,type,x,roof});return e}
 step(dt,input={}){dt=clamp(dt,0,.05);if(this.status!=='running'||this.paused)return;const p=this.player;this.elapsed+=dt;this.repCd=Math.max(0,this.repCd-dt);this.throttle=Math.max(0,this.throttle-dt);p.cooldown=Math.max(0,p.cooldown-dt);p.invul=Math.max(0,p.invul-dt);p.stun=Math.max(0,p.stun-dt);
  const dir=clamp(Number(input.move)||0,-1,1);if(dir&&p.stun<=0){p.x=clamp(p.x+dir*dt*(p.carry?2.8:5.1),.4,this.length-.4);p.face=dir}if(input.attack)this.attack();if(input.repair&&!input.attack)this.repair(dt);
  const oldSwing=p.swing;p.swing=Math.max(0,p.swing-dt);if(this.round<3&&!p.swingHit&&oldSwing>.20&&p.swing<=.20){p.swingHit=true;const targets=this.enemies.filter(e=>e.hp>0&&e.roof===p.roof&&e.climb<=0&&(e.x-p.x)*p.face>=-.3&&(e.x-p.x)*p.face<=this.range);targets.slice(0,2).forEach(e=>this.hitEnemy(e,this.round===2?2:1));this.feedback('swing',p.x,p.y+1)}
  this.t=clamp(this.t+dt*(this.throttle>0?1.65:1)/DURATION,0,1);const phase=phaseAt(this.t);if(phase!==this.phase){this.phase=phase;this.tell('phase',{routeT:this.t});this.event=phase==='crane'?'机械臂预警：头顶横扫，赶往黄色梯子下车内！':phase==='approach'?'前方隧道：低净空，提前离开车顶。':phase==='tunnel'?'进入隧道：车顶封闭。电池车为照明供电。':phase==='return'?'机库就在前方，守住最后一段。':LABELS[phase]}
  if(this.phase==='crane'&&this.t>=.34&&this.t<=.44&&p.roof&&Math.abs(p.x-this.craneX)<1.25&&!this.craneHits.has('player')){this.craneHits.add('player');this.hurt(32,'crane');this.tell('hazard_hit',{hazard:'crane',x:p.x,craneX:this.craneX})}
  if(this.phase==='tunnel'&&p.roof){p.roof=false;p.y=FLOOR;this.hurt(30,'tunnel');this.tell('hazard_hit',{hazard:'tunnel'})}
  this.spawnClock+=dt;if(['yard','crane','tunnel'].includes(this.phase)&&this.spawnClock>Math.max(3,7-this.round*.35)){this.spawnClock=0;this.spawn()}
  for(const e of this.enemies){e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);e.recovery=Math.max(0,e.recovery-dt);e.climb=Math.max(0,e.climb-dt);if(e.hp<=0||e.stun>0||e.climb>0)continue;
   if(e.roof&&this.phase==='tunnel'){e.roof=false;e.y=FLOOR}
   if(e.type==='thief'){if(e.carry){e.x+=dt*2.3;if(e.x>=this.length-.2){e.hp=0;this.money=Math.max(0,this.money-250);this.tell('cargo_stolen');this.event='一箱货物被带离列车：损失 250。'}continue}const ci=this.cars.findIndex(c=>c.type==='cargo'&&c.cargo>0);if(ci>=0){const tx=ci*LENGTH+4.2;if(Math.abs(e.x-tx)>.6){e.x+=Math.sign(tx-e.x)*dt*1.6;continue}e.wind+=dt;if(e.wind>.8){this.cars[ci].cargo--;e.carry=true;e.cargoCar=ci;e.wind=0;this.tell('thief_pickup',{car:ci})}continue}}
   const sameLane=e.roof===p.roof,near=sameLane&&Math.abs(e.x-p.x)<1.2;const target=sameLane?p.x:clamp(Math.floor(e.x/LENGTH),0,this.cars.length-1)*LENGTH+4.1;
   if(Math.abs(e.x-target)>1){e.x+=Math.sign(target-e.x)*dt*1.4;e.wind=0;continue}
   if(e.recovery>0)continue;e.wind+=dt;if(e.wind>=.65){e.wind=0;e.recovery=.9;if(near)this.hurt(9,'boarder');else{const i=clamp(Math.floor(e.x/LENGTH),0,this.cars.length-1),c=this.cars[i];c.hp=Math.max(0,c.hp-8);this.feedback('damage',e.x,e.y,'-8');this.tell('car_damage',{car:i,hp:c.hp})}}
  }
  for(const b of this.projectiles){const old=b.x;b.x+=b.dir*dt*24;b.life-=dt;const distance=Math.abs(b.x-b.origin);const hits=this.enemies.filter(e=>e.hp>0&&e.roof===b.roof&&e.climb<=0&&e.x>=Math.min(old,b.x)-.28&&e.x<=Math.max(old,b.x)+.28).sort((a,c)=>Math.abs(a.x-old)-Math.abs(c.x-old));if(hits.length&&distance<=this.range){this.hitEnemy(hits[0],1);b.life=0}if(distance>=this.range)b.life=0}
  this.projectiles=this.projectiles.filter(b=>b.life>0);this.enemies=this.enemies.filter(e=>e.hp>0);this.effects.forEach(f=>f.life-=dt);this.effects=this.effects.filter(f=>f.life>0);
  if(p.hp<=0||this.cars[0].hp<=0){this.fail();return}if(this.t>=1)this.finish();
 }
 finish(){if(this.status!=='running')return;this.status='complete';this.phase='dock';if(this.player.carry){const c=this.cars.find(c=>c.type==='cargo');if(c)c.cargo++;this.player.carry=false}this.money+=Math.round((900+this.round*500)*Math.pow(1.22,this.round-1));this.enemies=[];this.projectiles=[];this.tell('round_complete',{money:this.money});this.event='回到 Roundhouse：接车继续，或兑现收益。'}
 more(type){if(this.status!=='complete'||!['cargo','battery','workshop'].includes(type))return false;if(this.cars.length<MAX_CARS)this.cars.push(car(type));this.round++;this.t=0;this.phase='dock';this.status='ready';this.craneHits.clear();this.player.hp=Math.min(100,this.player.hp+25);this.player.roof=false;this.player.y=FLOOR;this.player.x=3;this.player.swing=0;this.player.carry=false;this.throttle=0;this.tell('one_more_round',{type,cars:this.cars.length});return true}
 cashout(){if(this.status!=='complete'||this.settled)return false;this.settled=true;this.bank+=Math.round(this.money);this.money=0;this.status='cashed';this.tell('cash_out',{bank:this.bank});return true}
 fail(){if(this.status!=='running')return;this.status='lost';this.tell('run_failed',{lost:this.money});this.money=0}
 snapshot(){return{build:BUILD,round:this.round,phase:this.phase,status:this.status,running:this.status==='running',paused:this.paused,routeT:this.t,px:this.player.x,playerY:this.player.y,roof:this.player.roof,facing:this.player.face,playerHp:this.player.hp,engineHp:this.cars[0].hp,cars:this.cars.map(c=>c.type),enemyCount:this.enemies.length,projectileCount:this.projectiles.length,weapon:this.weapon,range:this.range,money:this.money,bank:this.bank,craneX:this.craneX,lastMuzzle:this.lastMuzzle}}
}
