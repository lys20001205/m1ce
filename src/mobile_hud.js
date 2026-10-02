import {cargoNavigation} from './cargo_navigation.js';
const amount=n=>Math.round(n).toLocaleString();
// Presentation only: all existing input targets and economy authorities remain intact.
export class MobileHUD {
 constructor(doc){
  this.doc=doc;const node=(tag,id,parent,text)=>{const n=doc.createElement(tag);n.id=id;if(text)n.textContent=text;parent.append(n);return n;};
  const app=doc.getElementById('app'),viewport=doc.getElementById('viewport');
  this.drawer=node('details','statusDrawer',app);
  const summary=node('summary','statusToggle',this.drawer,'☰');summary.setAttribute('aria-label','状态、账本与操作说明');
  const panel=node('section','statusBody',this.drawer);
  node('h2','statusTitle',panel,'行车状态');
  node('p','statusExplainer',panel,'货物未兑现前仍有风险；回库结算后才计入 Bank。');
  panel.append(doc.getElementById('cargoLedger'));
  node('h3','controlTitle',panel,'操作');panel.append(doc.getElementById('centerStack'));panel.append(doc.getElementById('keyboardLegend'));
  node('p','touchHelp',panel,'左下按住移动，可滑向另一方向；右下按住近战或射击。⇅ 上下车层，↗ 交互，⚒ 按住维修。错过货站可先刹停，再点倒车；换速需返回机车 SPEED。');
  const menu=node('div','statusMenu',panel);for(const id of ['angle','sound','log'])menu.append(doc.getElementById(id));
  const close=node('button','closeStatus',panel,'返回游戏');close.onclick=()=>{this.drawer.open=false;};
  this.drawer.addEventListener('toggle',()=>{this.drawer.querySelector('summary').setAttribute('aria-expanded',String(this.drawer.open));this.onToggle?.(this.drawer.open);});
  this.cargo=node('div','quickCargo',viewport);this.cargo.setAttribute('aria-label','货物状态');
  for(const [id,icon,label]of [['cargoHeld','◇','携带未装'],['cargoStored','▣','已装价值'],['cargoRisk','!','被抱走'],['cargoLoss','−','累计丢失']]){const n=node('span',id,this.cargo);n.dataset.icon=icon;n.title=label;n.setAttribute('aria-label',label);}
  this.guard=node('span','guardStatus',viewport);
  this.cue=node('div','contextCue',viewport);this.cue.setAttribute('role','status');
  this.bank=node('span','quickBank',viewport);this.bank.title='已结算 Bank';
  doc.getElementById('money').parentElement.title='待结算收益：回库 CASH OUT 后入账';
  doc.getElementById('scrapHud').parentElement.title='Scrap：购买本局武器';
  const icons={L:'◀',R:'▶',layer:'⇅',reverse:'↶',brake:'Ⅱ',interact:'↗',fix:'⚒',attack:'⚔',ranged:'⌖'};
  for(const[id,icon]of Object.entries(icons))doc.getElementById(id).dataset.icon=icon;
 }
 update(g){
  const d=this.doc,l=g.cargoLedger,live=['running','arriving'].includes(g.status),active=live&&!g.paused&&!g.armoryOpen;
  d.getElementById('app').dataset.hudMode=live?'run':'menu';
  for(const[id,value]of [['cargoHeld',l.held],['cargoStored',l.loaded],['cargoRisk',l.atRisk],['cargoLoss',l.lost]]){
   const n=d.getElementById(id);n.textContent=amount(value);n.hidden=id==='cargoRisk'||id==='cargoLoss'?value===0:false;n.setAttribute('aria-label',n.title+' '+amount(value));
  }
  this.bank.textContent='BANK '+amount(l.bank);
  const remaining=g.dockingPlayerRemaining;this.guard.hidden=remaining<=0;this.guard.textContent='◈ '+Math.ceil(remaining)+'s';this.guard.title='一次性靠站护盾；结束后旧敌恢复攻击';
  const names={layer:g.playerLayer==='DEPOT'?'回车':g.player.roof?'下车内':'上车顶',reverse:g.lastDirection==='REVERSE'?'前进':'倒车',brake:'刹停',interact:'交互',fix:'维修',attack:g.melee.name||g.melee.id,ranged:g.ranged?(g.rangedMagazine?.reloadRemaining>0?'装填':g.rangedMagazine?.rounds+'/'+g.rangedMagazine?.max):'未解锁'};
  const nav=cargoNavigation(g);if(nav?.action)names.interact=nav.action.replace(/F\s*[·/]?\s*/,'').slice(0,8);else names.interact=d.getElementById('interact').textContent.slice(0,8);
  for(const[id,label]of Object.entries(names))d.getElementById(id).dataset.short=label;
  let cue='';
  if(g.playerLayer==='DEPOT')cue=g.player.carry?(nav?.goal?'回中央桥 · '+nav.goal.label:'回车装货'):g.cargoUsed>=g.cargoCapacity?'货舱已满 · 回车':'靠近箱子自动拾取';
  else if(nav?.goal)cue=nav.goal.label;
  else if(g.player.carry)cue='携带 '+amount(l.held)+' · '+(nav?.action||'返回货车');
  else if(l.atRisk>0)cue='货物被抱走 · 追击！';
  else if(g.consoleOpen)cue='选择速度 · 倒车需先刹停';
  else if(g.player.roof&&['approach','crane','tunnel'].includes(g.phase))cue='低净空 · 下车内躲避';
  else if(g.cars[0].hp<g.cars[0].max*.3)cue='动力危急 · 返回机车维修';
  if(g.repairJob)cue=d.getElementById('repairText').textContent;
  if(nav?.goal){const distance=nav.text.match(/([0-9]+(?:\.[0-9]+)?)m/);if(distance)cue+=' · '+distance[1]+'m';}
  if(g.rescue)cue=g.alive?(g.playerLayer==='DEPOT'?'动力停机 · 回中央桥后 RETURN':g.player.carry?(g.player.roof?'动力停机 · 到货车 LOAD 放货':'动力停机 · 先放货再维修'):g.player.roof?'动力停机 · 下车内维修':'动力停机 · 返回机车按住维修'):'';
  if(!g.alive)cue='';
  const full=d.getElementById('centerHint').textContent;
  if(!cue&&full!==this.lastHint){this.hintUntil=g.elapsed+4;this.lastHint=full;}
  if(!cue&&g.elapsed<this.hintUntil&&/不可|无法|停机|离开|护盾结束/.test(full))cue=full.split(' · ')[0].slice(0,24);
  this.cue.textContent=cue;this.cue.hidden=!cue||!live||g.armoryOpen;
  const event=d.getElementById('event');if(event.textContent!==this.lastEvent){this.lastEvent=event.textContent;this.eventUntil=g.elapsed+4;}
  event.dataset.quiet=String(!active||!!cue||g.alive&&!g.rescue&&g.elapsed>this.eventUntil);event.title=event.textContent;
  d.getElementById('scrapHud').textContent=amount(g.scrap);
  d.getElementById('engineVital').title='动力 '+Math.ceil(g.cars[0].hp)+'/'+g.cars[0].max;
  d.getElementById('engineVital').textContent=Math.ceil(100*g.cars[0].hp/g.cars[0].max)+'%';
  if(!live)this.drawer.open=false;
 }
}
