import {Game,BUILD,B,DEFS,LENGTH,FLOOR,ROOF,phaseAt,clamp,stationX} from './sim.js?v=10';
import {View} from './view.js?v=10';
import {Telemetry} from './telemetry.js?v=10';
import {AudioCues} from './audio.js?v=10';
const $=id=>document.getElementById(id);
let game,view,telemetry,input={move:0,attack:false,repair:false},last=0,lastStatus='',selected='battery',frameError=false,bankWritable=true;
const pressed=new Map(),audio=new AudioCues();
const active=()=>['running','arriving'].includes(game.status);
function readBank(){try{const n=Number(localStorage.getItem('roundhouse_bank')||0);return Number.isFinite(n)&&n>=0?n:0;}catch{return 0;}}
function seed(){const a=new Uint32Array(1);try{crypto.getRandomValues(a);return a[0];}catch{return Date.now()>>>0;}}
function snapshot(){return{...game?.snapshot(),...(view?.loaded===3?view.snapshot():{modelsLoaded:0}),session:telemetry?.session,standalone:!!navigator.standalone||matchMedia('(display-mode: standalone)').matches,errors:telemetry?.errors||0};}
function emit(type,data){telemetry?.log(type,data);audio.event(type);}
telemetry=new Telemetry(snapshot);game=new Game({bank:readBank(),seed:seed(),emit});
function clearInput(){input={move:0,attack:false,repair:false};pressed.clear();document.querySelectorAll('.active').forEach(e=>e.classList.remove('active'));}
function fatal(error){clearInput();game.pause(true);audio.silence();frameError=true;$('modal').hidden=true;$('portrait').hidden=true;telemetry.log('runtime_error',{message:String(error?.message||error).slice(0,150)});$('fatal').hidden=false;$('fatal').textContent='3D 运行暂停：'+String(error?.message||error)+'\n日志已保留。请重新载入；此版本不会切回二维画面。';}
function refreshInputs(){let move=0,attack=false,repair=false;for(const key of pressed.values()){if(key==='L')move=-1;if(key==='R')move=1;if(key==='attack')attack=true;if(key==='fix')repair=true;}if(input.repair&&!repair)game.cancelRepair('released');input={move,attack,repair};}
for(const id of ['L','R','attack','fix']){
  const el=$(id);
  el.addEventListener('pointerdown',e=>{e.preventDefault();if(game.paused||game.status!=='running')return;el.setPointerCapture(e.pointerId);pressed.set(e.pointerId,id);el.classList.add('active');refreshInputs();telemetry.log('input_down',{key:id,x:game.player.x});});
  const release=e=>{e.preventDefault();pressed.delete(e.pointerId);if(![...pressed.values()].includes(id))el.classList.remove('active');refreshInputs();telemetry.log('input_up',{key:id,x:game.player.x});};
  el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',()=>{for(const [k,v] of pressed)if(v===id)pressed.delete(k);refreshInputs();el.classList.remove('active');});
}
const keys={a:'L',ArrowLeft:'L',d:'R',ArrowRight:'R',j:'attack',' ':'attack',e:'fix'};
addEventListener('keydown',e=>{if(e.target?.tagName==='INPUT'||game.paused||game.status!=='running')return;const k=keys[e.key];if(k){e.preventDefault();pressed.set('key'+e.key,k);refreshInputs();}if(e.key==='w'&&!e.repeat)game.layer();if(e.key==='f'&&!e.repeat)game.interact();});
addEventListener('keyup',e=>{pressed.delete('key'+e.key);refreshInputs();});
for(const type of ['contextmenu','selectstart','dragstart'])$('app').addEventListener(type,e=>{if(!e.target.closest('pre'))e.preventDefault();});
$('layer').onclick=()=>game.layer();$('interact').onclick=()=>game.interact();
$('angle').onclick=()=>{if(!view)return;view.inspect=!view.inspect;$('angle').textContent=view.inspect?'侧视':'斜视';};
$('sound').textContent=audio.enabled?'声音开':'静音';$('sound').onclick=async()=>{$('sound').textContent=await audio.toggle()?'声音开':'静音';};
$('reduced').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;try{$('reduced').checked=localStorage.getItem('roundhouse_reduced_motion')==='yes'||$('reduced').checked;}catch{}
$('reduced').onchange=e=>{if(view)view.reducedMotion=e.target.checked;try{localStorage.setItem('roundhouse_reduced_motion',e.target.checked?'yes':'no');}catch{}};
$('pause').onclick=()=>{if(!active())return;clearInput();game.pause(!game.paused);if(game.paused)audio.silence();else audio.unlock();};
$('telemetry').checked=telemetry.enabled;$('telemetry').onchange=e=>telemetry.consent(e.target.checked);
$('start').onclick=()=>{if(game.start()){$('modal').hidden=true;last=0;lastStatus='running';audio.active=true;audio.unlock();}};
function replaceGame(practice=false){
  clearInput();game=new Game({bank:game.bank,seed:seed(),practice,emit});view.game=game;view.rebuildCars();view.cameraX=game.player.x;lastStatus='';last=0;$('modal').hidden=true;game.start();audio.active=true;audio.unlock();
  if(practice){game.phase='yard';game.t=.2;game.player.x=stationX(0);game.damageCar(0,game.cars[0].hp,'practice');game.event='抢修演练：你已站在控制柜旁，长按修理 3 秒。演练不结算、不写存款。';}
  view.render(0);ui();
}
$('practice').onclick=()=>replaceGame(true);$('restart').onclick=()=>replaceGame(false);
function choices(){
  const root=$('choices');root.replaceChildren();
  const descriptions={cargo:'新增实体货物；额外货车提高盗贼占比，不突破威胁上限',battery:'隧道照明、增压储能；完好时加快维修车作业',workshop:'维修更快；电池完好时再快 20%；可花本局钱治疗'};
  for(const type of ['battery','workshop','cargo']){const b=document.createElement('button');b.textContent=DEFS[type].name;const small=document.createElement('small');small.textContent=descriptions[type];b.appendChild(small);b.className=type===selected?'selected':'';b.onclick=()=>{selected=type;choices();};root.appendChild(b);}
}
$('more').onclick=()=>{if(game.more(selected)){clearInput();$('modal').hidden=true;game.start();view.cameraX=game.player.x;view.render(0);last=0;lastStatus='running';audio.unlock();}};
$('cash').onclick=()=>{if(game.cashout()){try{localStorage.setItem('roundhouse_bank',String(game.bank));bankWritable=true;}catch{bankWritable=false;}showEnd();}};
const riskName={LOW:'低',MEDIUM:'中',HIGH:'高',EXTREME:'极高'};
function showEnd(){
  clearInput();const complete=game.status==='complete',practice=game.practice;
  $('modal').hidden=false;$('start').hidden=true;$('brief').hidden=true;
  $('cash').hidden=!complete||practice;$('more').hidden=!complete||practice;$('restart').hidden=complete&&!practice;$('practice').hidden=complete&&!practice;$('practice').disabled=false;
  $('choices').hidden=!complete||practice;$('riskPanel').hidden=!complete||practice;$('resultStats').hidden=false;
  $('endTitle').textContent=practice?(game.status==='practice_complete'?'抢修成功':'演练结束'):complete?'你回来了':game.status==='cashed'?'收益已入库':'本局结束';
  const failure=game.failReason==='engine_timeout'?'动力停机后未能在倒计时内完成重启。':'乘员生命耗尽；此前存入银行的收益保留。';
  $('intro').textContent=practice?'这是隔离的抢修演练。没有增加或扣除你的银行存款。':complete?'转盘已锁定。当前损伤会带入下一圈；选择兑现可以安全结束。':game.status==='cashed'?'这次主动结束，收益已经存入机库银行。':failure;
  $('summary').textContent=(practice?'演练不结算':game.status==='cashed'?'本局兑现 '+Math.round(game.settledAmount||0).toLocaleString():game.status==='lost'?'未兑现损失 '+Math.round(game.lostAmount||0).toLocaleString():'第 '+game.round+' 圈 · 未兑现 '+Math.round(game.money).toLocaleString())+' · 银行 '+Math.round(game.bank).toLocaleString()+(bankWritable?'':'（存储失败，本次仅在内存保留）');
  const s=complete?game.lap:game.total;for(const [id,value] of [['saved',s.clutchSaves],['recovered',s.cargoSaved.toLocaleString()],['critical',s.criticalSeconds.toFixed(1)+'s'],['repaired',s.repairs]])$(id).textContent=value;
  $('riskPanel').textContent='下一圈风险：'+riskName[game.risk()]+' · 动力 '+Math.ceil(game.cars[0].hp/game.cars[0].max*100)+'% · 生命 '+Math.ceil(game.player.hp)+' · '+game.cars.length+' 节车厢 · 下一倍率 ×'+Math.pow(1.22,game.round).toFixed(2)+'（风险为车况提示，非成功率预测）';
  $('cash').textContent='安全兑现 '+Math.round(game.money).toLocaleString();$('more').textContent=game.cars.length>=12?'继续 · 列车已达上限':'接车 · 再来一圈';
  if(complete&&!practice)choices();
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
  $('round').textContent=String(game.round).padStart(2,'0');$('money').textContent=Math.round(game.money).toLocaleString();$('health').textContent=Math.ceil(game.cars[0].hp/game.cars[0].max*100)+'% / '+Math.ceil(game.player.hp);$('health').dataset.state=engine;
  $('weapon').textContent=game.weapon;$('attack').textContent=game.round>=3?'射击':'挥击';$('phase').textContent=game.practice?'抢修演练 / 不结算':game.status==='arriving'?'安全回站 / 转盘锁定':game.engineState==='stalled'?'动力停机 / 路线暂停':({dock:'机库准备',depart:'出库 / 转盘对轨',yard:'工业装卸区',crane:'机械臂',approach:'隧道预告',tunnel:'低净空隧道',return:'返回机库'}[game.phase]||game.phase);
  $('fill').style.width=game.t*100+'%';$('pause').textContent=game.paused?'继续':'暂停';
  $('progress').textContent=game.rescue?'抢救剩余 '+game.rescue.remaining.toFixed(1)+' 秒':warn?(warn.kind==='crane'?'扫顶':'入隧道')+'约 '+warn.seconds.toFixed(1)+' 秒':threat.rest>0?'新威胁暂停 '+threat.rest.toFixed(1)+'s':threat.relief?'危急减压中':'机库 → 工业区 → 隧道 → 返回';
  let message=game.event;
  if(game.status==='running'){
    if(game.rescue){const d=game.player.x-stationX(0);message='动力停机 · '+game.rescue.remaining.toFixed(1)+'s ｜ '+(Math.abs(d)>B.repairRadius?(d>0?'← ':'→ ')+'前往 01 控制柜，长按修理':'控制柜已在身旁：长按修理 3 秒');}
    else if(engine==='critical')message='01 动力车危急：'+Math.ceil(game.cars[0].hp/game.cars[0].max*100)+'% ｜ 回到控制柜持续维修';
    else if(stolen.length)message='货物有风险 '+(stolen.length*B.cargoValue)+' ｜ 盗贼正往车尾逃离，击败可追回';
    else if(warn)message=(warn.kind==='crane'?'机械臂将扫过车顶':'前方低净空隧道')+' ｜ 找黄色梯子提前下车内';
    else if(game.director.fault)message=game.director.fault.active?'01 冷却故障正在损伤动力车：完成一次维修可停止':'01 冷却故障预警：'+Math.max(0,B.faultLead-game.director.fault.time).toFixed(1)+' 秒后开始损伤';
  }
  $('event').textContent=message;$('event').dataset.state=game.rescue?'stalled':engine;$('viewport').dataset.health=game.player.hp<=20?'critical':'normal';
  $('layer').textContent=game.player.roof?'下车内':'上车顶';$('interact').textContent=game.player.carry?'放货':game.cars[game.currentCar].type==='engine'?'增压':game.cars[game.currentCar].type==='cargo'?'搬货':'交互';
  $('repairPanel').hidden=!job;$('repairFill').style.width=job?Math.min(100,job.progress/job.duration*100)+'%':'0%';$('repairText').textContent=job?(job.emergency?'紧急重启':'维修 '+String(job.car+1).padStart(2,'0'))+' · '+Math.min(100,Math.floor(job.progress/job.duration*100))+'%':'';
  const notice=game.notices.at(-1);$('success').hidden=!notice;$('centerStack').dataset.repair=job?'true':'false';$('successTitle').textContent=notice?.title||'';$('successDetail').textContent=notice?.detail||'';
  $('centerHint').hidden=!!job||!!notice;$('centerHint').textContent=game.status==='arriving'?'安全回站 · '+Math.max(0,B.arrivalTime-game.arrivalElapsed).toFixed(1)+'s':input.repair?game.repairHint:game.player.roof?'车顶移动 +25% · 提前留意净空':'近设备长按修理 · 黄梯切层';
  if(game.status!==lastStatus){lastStatus=game.status;if(['complete','lost','cashed','practice_complete'].includes(game.status))showEnd();if(game.status==='arriving')clearInput();}
}
function frame(ts){if(frameError)return;try{const dt=last?Math.min(.05,(ts-last)/1000):0;last=ts;audio.update(game);game.step(dt,input);view.render(dt);ui();requestAnimationFrame(frame);}catch(e){fatal(e);}}
try{view=new View($('game'),game,(t,d)=>telemetry.log(t,d));view.reducedMotion=$('reduced').checked;await view.init();$('start').disabled=false;$('practice').disabled=false;$('start').textContent='从机库发车';$('event').textContent=game.event;resize();requestAnimationFrame(frame);}catch(e){fatal(e);}
window.__RH_DEBUG={snapshot,logs:()=>telemetry.events,renderer:()=>view.snapshot(),occlusion:()=>view.occlusion(),pixels:()=>view.pixels()};
if(new URLSearchParams(location.search).has('test'))window.__RH_TEST={
  game:()=>game,view:()=>view,input:()=>({...input}),
  step:(seconds,controls={})=>{for(let left=seconds;left>1e-8;left-=.025)game.step(Math.min(.025,left),controls);view.render(.016);ui();},
  forceRoute:t=>{game.t=t;game.phase=phaseAt(t);},
  forceCars:n=>{while(game.cars.length<Math.min(12,n)){const d=DEFS.cargo;game.cars.push({type:'cargo',hp:d.hp,max:d.hp,cargo:3});}view.rebuildCars();},
  forcePlayer:(x,roof=false)=>{game.player.x=clamp(x,.4,game.length-.4);game.player.roof=roof;game.player.y=roof?ROOF:FLOOR;view.cameraX=game.player.x;view.render(.016);},
  reset:()=>{clearInput();game=new Game({seed:314159,emit});view.game=game;view.rebuildCars();view.cameraX=3;lastStatus='';last=0;$('modal').hidden=true;game.start();view.render(0);ui();return true;}
};
