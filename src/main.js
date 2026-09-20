import {Game,BUILD,B,DEFS,LENGTH,FLOOR,ROOF,phaseAt,phaseLabel,clamp,stationX} from './sim.js?v=11';
import {View} from './view.js?v=11';
import {Telemetry} from './telemetry.js?v=11';
import {runtimeMode,SimulationClock} from './runtime.js';
import {SaveStore} from './save.js';
import {DevTools} from './devtools.js';
import {AudioCues} from './audio.js?v=11';
import {ROUTES,SPEED_MODES,INPUT_BINDINGS_SSOT,PREP_ITEMS} from './content.js';
import {V11} from './balance.js';
const $=id=>document.getElementById(id);
const mode=runtimeMode(location.search),save=new SaveStore({mode}),clock=new SimulationClock();let devtools=null;
let game,view,telemetry,input={move:0,attack:false,ranged:false,repair:false},last=0,lastStatus='',selected='battery',frameError=false,bankWritable=true;
const pressed=new Map(),audio=new AudioCues({emit:(type,data)=>telemetry?.log(type,data)});
try{audio.enabled=save.storage.getItem('roundhouse_sound')!=='no';}catch{}
const active=()=>['running','arriving'].includes(game.status);
function readSave(){return save.read();}
function seed(){const a=new Uint32Array(1);try{crypto.getRandomValues(a);return a[0];}catch{return Date.now()>>>0;}}
function snapshot(){return{...game?.snapshot(),...(view?.loaded===3?view.snapshot():{modelsLoaded:0}),audio:audio.snapshot(),clock:clock.snapshot(),test:mode.test,session:telemetry?.session,standalone:!!navigator.standalone||matchMedia('(display-mode: standalone)').matches,errors:telemetry?.errors||0};}
function emit(type,data){if(type==='player_death')clearInput();telemetry?.log(type,data);audio.event(type,data);}
const initialSave=readSave();telemetry=new Telemetry(snapshot,{...mode,storage:save.storage});game=new Game({bank:initialSave.bank,prep:initialSave.prep,seed:seed(),emit,dev:mode.dev});
function clearInput(){input={move:0,attack:false,ranged:false,repair:false};pressed.clear();document.querySelectorAll('.active').forEach(e=>e.classList.remove('active'));}
function fatal(error){clearInput();game.pause(true);audio.silence();frameError=true;$('modal').hidden=true;$('portrait').hidden=true;telemetry.log('runtime_error',{message:String(error?.message||error).slice(0,150)});$('fatal').hidden=false;$('fatal').textContent='3D 运行暂停：'+String(error?.message||error)+'\n日志已保留。请重新载入；此版本不会切回二维画面。';}
const actions={climb:()=>game.layer(),interact:()=>game.interact(),brake:()=>game.emergencyStop()};
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
for(const slot of ['melee','ranged'])document.querySelector('[data-armory='+slot+']').onclick=()=>{game.buyWeapon(slot);ui();};
$('closeArmory').onclick=()=>game.closeArmory();
for(const type of ['contextmenu','selectstart','dragstart'])$('app').addEventListener(type,e=>{if(!e.target.closest('pre'))e.preventDefault();});
for(const mode of SPEED_MODES){const b=document.createElement('button');b.dataset.speed=mode;b.textContent=mode;b.onclick=()=>game.setSpeed(mode);$('speedChoices').append(b);}
$('angle').onclick=()=>{if(!view)return;view.inspect=!view.inspect;$('angle').textContent=view.inspect?'侧视':'斜视';};
$('sound').textContent=audio.enabled?'声音开':'静音';$('sound').onclick=()=>{const on=audio.toggle();$('sound').textContent=on?'声音开':'静音';try{save.storage.setItem('roundhouse_sound',on?'yes':'no');}catch{}};
$('reduced').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;try{$('reduced').checked=save.storage.getItem('roundhouse_reduced_motion')==='yes'||$('reduced').checked;}catch{}
$('reduced').onchange=e=>{if(view)view.reducedMotion=e.target.checked;try{save.storage.setItem('roundhouse_reduced_motion',e.target.checked?'yes':'no');}catch{}};
$('pause').onclick=()=>{if(!active())return;clearInput();game.pause(!game.paused);if(game.paused)audio.silence();else audio.unlock();};
$('telemetry').checked=telemetry.enabled;$('telemetry').onchange=e=>telemetry.consent(e.target.checked);
$('start').onclick=()=>{audio.unlock('start');if(game.start()){bankWritable=save.write(game);$('modal').hidden=true;last=0;lastStatus='running';audio.active=true;}};
function replaceGame(practice=false){
  clearInput();game=new Game({bank:game.bank,prep:game.prep,seed:seed(),practice,emit,dev:mode.dev});view.game=game;view.rebuildCars();view.cameraX=game.player.x;lastStatus='';last=0;$('modal').hidden=true;if(practice){game.chooseRoute('industrial');game.chooseCar('cargo');game.start();}else showHub();audio.active=true;audio.unlock();
  if(practice){game.phase='yard';game.t=.2;game.player.x=stationX(0);game.damageCar(0,game.cars[0].hp,'practice');game.event='抢修演练：你已站在控制柜旁，长按修理 3 秒。演练不结算、不写存款。';}
  view.render(0);ui();
}
$('practice').onclick=()=>replaceGame(true);$('restart').onclick=()=>replaceGame(false);
function choices(){
  const root=$('choices');root.replaceChildren();if(game.trainFull)return;
  const descriptions={cargo:'+3 个空货位 · Freight 搬货 · 额外货车增加盗贼权重',battery:'FAST 储能 · 隧道照明 · 供电维修',workshop:'维修加速 · 工业故障处理 · 本地维修站'};
  if(!game.carOffers.includes(selected))selected=game.carOffers[0];
  for(const type of game.carOffers){const b=document.createElement('button');b.textContent=DEFS[type].name;const small=document.createElement('small');small.textContent=descriptions[type];b.appendChild(small);b.className=type===selected?'selected':'';b.dataset.car=type;b.onclick=()=>{selected=type;if(game.chooseCar(type)){view.rebuildCars();showHub();}};root.appendChild(b);}
  if(game.prep.reroll>0&&!game.carRerolled){const b=document.createElement('button');b.dataset.reroll='car';b.textContent='REROLL OFFER · '+game.prep.reroll+' TOKEN';b.onclick=()=>{if(game.rerollCars()){bankWritable=save.write(game);choices();}};root.appendChild(b);}
}
function renderPrep(){
  const panel=$('prepShop'),visible=!game.practice&&(game.status==='cashed'||(game.status==='ready'&&game.hubStage==='route'));panel.hidden=!visible;if(!visible)return;
  $('prepBank').textContent='BANK '+Math.round(game.bank).toLocaleString();const root=$('prepItems');root.replaceChildren();
  for(const [id,item] of Object.entries(PREP_ITEMS)){const spec=V11.prep[id],count=game.prep[id]||0,b=document.createElement('button');b.dataset.prep=id;b.disabled=count>=spec.max||game.bank<spec.cost;b.innerHTML='<b>'+item.name+'</b><small>'+item.description+' · '+spec.cost.toLocaleString()+' BANK · '+count+' / '+spec.max+'</small>';b.onclick=()=>{if(!game.buyPrep(id))return;bankWritable=save.write(game);if(id==='intel'){game.prepareRouteIntel();bankWritable=save.write(game);}if(game.status==='cashed')showEnd();else showHub();};root.appendChild(b);}
}
$('more').onclick=()=>{if(game.more()){clearInput();showHub();view.cameraX=game.player.x;view.render(0);last=0;lastStatus='ready';}};
$('cash').onclick=()=>{if(game.cashout()){bankWritable=save.write(game);showEnd();}};

function showHub(){
  if(game.hubStage==='route'){const before=game.prep.intel;game.prepareRouteIntel();if(game.prep.intel!==before)bankWritable=save.write(game);}
  $('modal').hidden=false;$('brief').hidden=true;$('endTitle').textContent='ROUNDHOUSE';
  $('intro').textContent=game.hubStage==='route'?(game.trainFull?'列车已满编，本圈不接新车。请选择路线。':'先选路线，再决定需要哪种车厢。'):game.hubStage==='car'?'路线已确定。推荐仅作参考；当前两项车厢都允许出发。':game.trainFull?'列车已满编，本圈不接新车。点击 START 发车。':'转盘准备完毕。点击 START 发车。';
  $('summary').textContent='ROUND '+game.round+' · BANK '+Math.round(game.bank)+' · '+(ROUTES[game.route]?.name||'CHOOSE ROUTE');
  $('resultStats').hidden=true;$('riskPanel').hidden=true;$('cash').hidden=true;$('more').hidden=true;$('restart').hidden=true;
  $('start').hidden=game.hubStage!=='depart';$('start').textContent='START · '+(ROUTES[game.route]?.name||'');
  $('choices').hidden=game.hubStage!=='car';$('routeChoices').hidden=game.hubStage!=='route';
  const root=$('routeChoices');root.replaceChildren();
  for(const r of Object.values(ROUTES)){
    const b=document.createElement('button');b.dataset.route=r.id;const title=document.createElement('b');title.textContent=r.name;
    const info=document.createElement('small');info.textContent=r.theme+' · Cargo: '+r.cargo+' · Threat: '+r.threat+' · Recommended: '+r.recommended.toUpperCase()+(game.previousRoute===r.id?' · REPEAT PRESSURE +1':'')+(game.routeIntel?.route===r.id?' · INTEL: '+game.routeIntel.text:'');
    b.append(title,info);b.onclick=()=>{audio.unlock('route_gesture');if(game.chooseRoute(r.id))showHub();};root.append(b);
  }
  if(game.hubStage==='car')choices();else $('choices').replaceChildren();renderPrep();
}
const riskName={LOW:'低',MEDIUM:'中',HIGH:'高',EXTREME:'极高'};
function showEnd(){
  clearInput();const complete=game.status==='complete',practice=game.practice;
  $('modal').hidden=false;$('start').hidden=true;$('brief').hidden=true;
  $('cash').hidden=!complete||practice;$('more').hidden=!complete||practice;$('restart').hidden=complete&&!practice;$('practice').hidden=complete&&!practice;$('practice').disabled=false;
  $('choices').hidden=true;$('routeChoices').hidden=true;$('riskPanel').hidden=!complete||practice;$('resultStats').hidden=false;
  $('endTitle').textContent=practice?(game.status==='practice_complete'?'抢修成功':'演练结束'):complete?'你回来了':game.status==='cashed'?'收益已入库':'本局结束';
  const failure=game.failReason==='engine_timeout'?'动力停机后未能在倒计时内完成重启。':'乘员生命耗尽；此前存入银行的收益保留。';
  $('intro').textContent=practice?'这是隔离的抢修演练。没有增加或扣除你的银行存款。':complete?'转盘已锁定。当前损伤会带入下一圈；选择兑现可以安全结束。':game.status==='cashed'?'这次主动结束，收益已经存入机库银行。':failure;
  $('summary').textContent=(practice?'演练不结算':game.status==='cashed'?'本局兑现 '+Math.round(game.settledAmount||0).toLocaleString():game.status==='lost'?'未兑现损失 '+Math.round(game.lostAmount||0).toLocaleString():'第 '+game.round+' 圈 · 未兑现 '+Math.round(game.money).toLocaleString())+' · 银行 '+Math.round(game.bank).toLocaleString()+(bankWritable?'':'（存储失败，本次仅在内存保留）');
  const s=complete?game.lap:game.total;for(const [id,value] of [['saved',s.clutchSaves],['recovered',s.cargoSaved.toLocaleString()],['critical',s.criticalSeconds.toFixed(1)+'s'],['repaired',s.repairs]])$(id).textContent=value;
  $('riskPanel').textContent='下一圈风险：'+riskName[game.risk()]+' · 动力 '+Math.ceil(game.cars[0].hp/game.cars[0].max*100)+'% · 生命 '+Math.ceil(game.player.hp)+' · '+game.cars.length+' 节车厢 · 下一倍率 ×'+Math.pow(1.22,game.round).toFixed(2)+'（风险为车况提示，非成功率预测）';
  $('cash').textContent='安全兑现 '+Math.round(game.money).toLocaleString();$('more').textContent=game.cars.length>=12?'继续 · 列车已达上限':'接车 · 再来一圈';renderPrep();
  
}
function debugOpen(){clearInput();if(active())game.pause(true);audio.silence();$('debug').hidden=false;debugRefresh();}
function debugRefresh(){$('remote').textContent=telemetry.status+' · SESSION '+telemetry.session;$('debugText').textContent=JSON.stringify(telemetry.report(),null,2);}
$('log').onclick=debugOpen;$('closeLog').onclick=()=>{$('debug').hidden=true;};$('upload').onclick=async()=>{await telemetry.flush(true);debugRefresh();};$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(telemetry.report()));$('remote').textContent='日志已复制';}catch{$('remote').textContent='复制不可用，可长按下方日志选取。';}};
let resizeTimer;function resize(){clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{const height=Math.min(innerHeight,window.visualViewport?.height||innerHeight);if(height>=100)$('app').style.height=height+'px';view?.resize();const portrait=innerHeight>innerWidth;$('portrait').hidden=!portrait;if(portrait&&active()){clearInput();game.pause(true);audio.silence();}},80);}
addEventListener('resize',resize);addEventListener('orientationchange',resize);window.visualViewport?.addEventListener('resize',resize);addEventListener('pageshow',resize);
addEventListener('blur',()=>{clearInput();if(active())game.pause(true);audio.silence();});
document.addEventListener('visibilitychange',()=>{clearInput();if(document.hidden){if(active())game.pause(true);audio.silence();telemetry.log('hidden');telemetry.flush(true);}else{last=0;resize();telemetry.log('visible');}});
$('game').addEventListener('webglcontextlost',e=>{e.preventDefault();fatal(new Error('WebGL context lost，请重新载入'));});addEventListener('error',e=>fatal(new Error(e.message)));addEventListener('unhandledrejection',e=>fatal(e.reason));
function ui(){
  const engine=game.engineState,job=game.repairJob,warn=game.hazardInfo(),threat=game.director.snapshot(game),stolen=game.enemies.filter(e=>e.hp>0&&e.carry);
  $('cargoHud').textContent='CARGO '+game.cargoUsed+' / '+game.cargoCapacity;
  $('lifePanel').hidden=game.alive||!['running','arriving','complete'].includes(game.status);$('lifePanel').textContent=(game.player.deathReason==='train_lost'?'TRAIN LOST':'PLAYER DOWN')+' · RESPAWN '+game.player.respawnRemaining.toFixed(1);
  $('more').disabled=!game.alive;
  $('round').textContent=String(game.round).padStart(2,'0');$('money').textContent=Math.round(game.money).toLocaleString();$('health').textContent=Math.ceil(game.cars[0].hp/game.cars[0].max*100)+'% / '+Math.ceil(game.player.hp);$('health').dataset.state=engine;
  $('weapon').textContent=game.weapon;$('scrapHud').textContent=String(game.scrap);$('attack').textContent=game.melee.name;$('ranged').textContent=game.ranged?.name==='HIGH-DAMAGE RIFLE'?'RIFLE':game.ranged?.name||'LOCKED';$('ranged').disabled=!game.ranged;$('phase').textContent=game.practice?'抢修演练 / 不结算':game.status==='arriving'?'安全回站 / 转盘锁定':game.engineState==='stalled'?'动力停机 / 路线暂停':({dock:'机库准备',depart:'出库 / 转盘对轨',yard:phaseLabel(game.phase,game.route),crane:'机械臂',approach:'隧道预告',tunnel:'低净空隧道',return:'返回机库'}[game.phase]||game.phase);
  $('fill').style.width=game.t*100+'%';$('pause').textContent=game.paused?'继续':'暂停';
  $('progress').textContent=game.rescue?'抢救剩余 '+game.rescue.remaining.toFixed(1)+' 秒':warn?(warn.kind==='crane'?'扫顶':'入隧道')+'约 '+warn.seconds.toFixed(1)+' 秒':threat.rest>0?'新威胁暂停 '+threat.rest.toFixed(1)+'s':threat.relief?'危急减压中':(ROUTES[game.route]?.name||'ROUNDHOUSE')+' · '+game.speedMode+' · CHARGE '+Math.round(game.batteryCharge)+' / '+game.batteryCapacity;
  let message=game.event;
  if(game.status==='running'){
    if(game.rescue){const d=game.player.x-stationX(0);message='动力停机 · '+game.rescue.remaining.toFixed(1)+'s ｜ '+(Math.abs(d)>B.repairRadius?(d>0?'← ':'→ ')+'前往 01 控制柜，长按修理':'控制柜已在身旁：长按修理 '+game.emergencyRepairTime.toFixed(1)+' 秒'+(game.runRepairKit?' · 维修包加速':''));}
    else if(engine==='critical')message='01 动力车危急：'+Math.ceil(game.cars[0].hp/game.cars[0].max*100)+'% ｜ 回到控制柜持续维修';
    else if(stolen.length)message='货物有风险 '+stolen.reduce((n,e)=>n+(game.cargoCrates.find(c=>c.id===e.carry)?.value||0),0)+' ｜ 盗贼正往车尾逃离，击败可追回';
    else if(warn)message=(warn.kind==='crane'?'机械臂将扫过车顶':'前方低净空隧道')+' ｜ 找黄色梯子提前下车内';
    else if(game.director.fault)message=game.director.fault.active?'01 冷却故障正在损伤动力车：完成一次维修可停止':'01 冷却故障预警：'+Math.max(0,B.faultLead-game.director.fault.time).toFixed(1)+' 秒后开始损伤';
  }
  $('event').textContent=message;$('event').dataset.state=game.rescue?'stalled':engine;$('viewport').dataset.health=game.player.hp<=20?'critical':'normal';
  $('speedPanel').hidden=game.status!=='running'||!game.atConsole||!game.consoleOpen;document.querySelectorAll('[data-speed]').forEach(b=>{b.classList.toggle('selected',b.dataset.speed===game.speedMode);b.disabled=game.engineState==='stalled'||b.dataset.speed==='FAST'&&game.batteryCharge<=0;});
  $('layer').textContent=game.playerLayer==='DEPOT'?'RETURN':game.player.roof?'下车内':'上车顶';$('interact').textContent=game.playerLayer==='DEPOT'?(game.player.carry?'RETURN':'PICKUP'):game.player.roof?(game.player.carry?'LOAD':'DEPOT'):game.player.carry?'放货':game.cars[game.currentCar].type==='engine'?(game.atArmory?'ARMORY':'SPEED'):game.cars[game.currentCar].type==='cargo'?'搬货':'交互';
  $('armoryPanel').hidden=!game.armoryOpen||!game.atArmory||!game.alive||game.status!=='running';
  $('armoryScrap').textContent=game.scrap+' SCRAP · WORLD RUNNING';
  for(const slot of ['melee','ranged']){const b=document.querySelector('[data-armory='+slot+']'),offer=game.armoryOffer(slot);const text=slot.toUpperCase()+' · '+(offer?(offer.locked?'LOCKED UNTIL COMBAT TIER 3':offer.name+' · '+offer.cost+' SCRAP'):'MAX TIER');if(b.textContent!==text)b.textContent=text;b.disabled=!offer||offer.locked||game.scrap<offer.cost;}
  $('repairPanel').hidden=!job;$('repairFill').style.width=job?Math.min(100,job.progress/job.duration*100)+'%':'0%';$('repairText').textContent=job?(job.emergency?'紧急重启':job.localFault?'本地故障检修':'维修 '+String(job.car+1).padStart(2,'0'))+' · '+Math.min(100,Math.floor(job.progress/job.duration*100))+'%':'';
  const notice=game.notices.at(-1);$('success').hidden=!notice;$('centerStack').dataset.repair=job?'true':'false';$('successTitle').textContent=notice?.title||'';$('successDetail').textContent=notice?.detail||'';
  $('centerHint').hidden=!!job||!!notice;$('centerHint').textContent=game.status==='arriving'?'安全回站 · '+Math.max(0,B.arrivalTime-game.arrivalElapsed).toFixed(1)+'s':input.repair?game.repairHint:game.player.roof?'车顶移动 +25% · 提前留意净空':'近设备长按修理 · 黄梯切层';
  if(game.status!==lastStatus){lastStatus=game.status;if(['complete','lost','cashed','practice_complete'].includes(game.status))showEnd();if(game.status==='arriving')clearInput();}
}
function frame(ts){if(frameError)return;try{const raw=last?ts-last:0,dt=Math.min(.05,raw/1000);last=ts;view.recordFrame(raw);clock.advance(game,raw/1000,input);audio.update(game);view.render(dt);ui();devtools?.update(ts);requestAnimationFrame(frame);}catch(e){fatal(e);}}
try{view=new View($('game'),game,(t,d)=>telemetry.log(t,d));view.reducedMotion=$('reduced').checked;await view.init();$('start').disabled=false;$('practice').disabled=false;$('start').textContent='从机库发车';showHub();$('event').textContent=game.event;resize();requestAnimationFrame(frame);}catch(e){fatal(e);}
addEventListener('pageshow',()=>audio.restore('pageshow'));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)audio.restore('visible');});
for(const type of ['pointerdown','keydown'])addEventListener(type,()=>{if(audio.context&&audio.context.state!=='running')audio.unlock('recovery_gesture');},{capture:true});
devtools=mode.dev?new DevTools({game:()=>game,audio,view:()=>view,clock,start:()=>{audio.unlock('dev_start');if(['lost','cashed','practice_complete'].includes(game.status))replaceGame(false);if(game.devCommand('start')){$('modal').hidden=true;lastStatus='';clock.reset();return true;}return false;},changed:()=>{clearInput();if(view.carCount!==game.cars.length)view.rebuildCars();if(game.status==='ready')showHub();ui();}}):null;
window.__RH_DEBUG={snapshot,logs:()=>telemetry.events,renderer:()=>view.snapshot(),occlusion:()=>view.occlusion(),pixels:()=>view.pixels()};
if(mode.test)window.__RH_TEST={
  game:()=>game,view:()=>view,audio:()=>audio,clock:()=>clock,save:()=>save,input:()=>({...input}),
  step:(seconds,controls={})=>{for(let left=seconds;left>1e-8;left-=.025)game.step(Math.min(.025,left),controls);view.render(.016);ui();},
  forceRoute:t=>{game.t=t;game.elapsed=Math.max(game.elapsed,3);game.phase=phaseAt(t,game.route);},
  forceCars:n=>{while(game.cars.length<Math.min(12,n)){const d=DEFS.cargo;game.cars.push({type:'cargo',hp:d.hp,max:d.hp,cargo:3});}view.rebuildCars();},
  forcePlayer:(x,roof=false)=>{game.player.x=clamp(x,.4,game.length-.4);game.player.roof=roof;game.player.y=roof?ROOF:FLOOR;game.player.layer=roof?'ROOF':'INTERIOR';game.player.z=.65;view.cameraX=game.player.x;view.render(.016);},
  reset:()=>{clearInput();game=new Game({seed:314159,emit,dev:mode.dev});view.game=game;view.rebuildCars();view.cameraX=3;lastStatus='';last=0;$('modal').hidden=true;game.chooseRoute('industrial');game.chooseCar('cargo');game.start();view.render(0);ui();return true;}
};
