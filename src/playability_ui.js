import {CAREER} from './career.js';
import {V11} from './balance.js';
const amount=n=>Math.round(n).toLocaleString();
export function hazardETA(h){const name=h.kind==='crane'?'扫顶':'入隧道';return name+(h.motion==='paused'?' · 已暂停，无倒计时':h.motion==='stopped'?' · 已停，无倒计时':h.motion==='away'?' · 倒车远离，无接近倒计时':'约 '+h.seconds.toFixed(1)+' 秒');}

export function cargoNotice(g,l=g.cargoLedger){
  if(!['running','arriving','complete'].includes(g.status))return '';
  if(l.atRisk>0)return '被抱走 '+amount(l.atRisk)+' · 在盗贼逃离前追回';
  const change=l.change,age=change?g.elapsed-change.at:Infinity;
  if(change&&change.kind!=='theft'&&age>=0&&age<6)return change.text;
  return '回库 CASH OUT 才计入 Bank';
}
export class PlayabilityUI{
  constructor(doc,onSave){this.doc=doc;this.onSave=onSave;this.signature='';this.armorySignature='';
    this.ledger=doc.createElement('div');this.ledger.id='cargoLedger';doc.getElementById('app').insertBefore(this.ledger,doc.getElementById('controls'));
    this.hazardTag=doc.createElement('b');this.hazardTag.id='hazardTag';this.hazardTag.hidden=true;doc.getElementById('viewport').append(this.hazardTag);
    this.targets=doc.createElement('div');this.targets.id='thiefLabels';doc.getElementById('viewport').append(this.targets);
    this.career=doc.createElement('details');this.career.id='careerShop';doc.querySelector('#modal article').insertBefore(this.career,doc.getElementById('prepDisclosure'));
    this.weapons=doc.createElement('div');this.weapons.id='weaponChoices';doc.getElementById('armoryPanel').append(this.weapons);
  }
  update(g,view){const l=g.cargoLedger,live=['running','arriving','complete'].includes(g.status);this.ledger.hidden=!live;
    const guard=g.cargoCrates.reduce((n,c)=>Math.max(n,c.location==='stored'?(c.protectedUntil||0)-g.elapsed:0),0);
    const stationGuard=Math.max(0,(g.depotGuardUntil||0)-g.elapsed),personal=g.dockingPlayerRemaining;
    this.ledger.innerHTML=`<div><b>装车 ${g.storedCargo}/${g.cargoCapacity}</b><span>携带 ${amount(l.held)}</span><span class="warning">被抱走 ${amount(l.atRisk)}</span></div><div><span>货物 ${amount(l.loaded+l.held+l.floor+l.atRisk)} 待结算</span><span>累计丢失 −${amount(l.lost)}</span><span class="bank">Bank余额 ${amount(l.bank)}（已结算）</span></div><small>${personal>0?'接站护盾 '+personal.toFixed(1)+'s · 玩家挡住旧敌攻击（不刷新） · ':''}${stationGuard>0?'设备防线 '+stationGuard.toFixed(1)+'s · 设备减伤75%（不刷新） · ':''}${l.atRisk>0?cargoNotice(g,l):guard>0?'首箱封签保护 '+guard.toFixed(1)+'s · 可以再取一箱':cargoNotice(g,l)} · 本局新增 ${amount(g.money-1000)} · 待结算总额 ${amount(g.money)}</small>`;
    const tag=this.doc.getElementById('cargoHud');tag.textContent=`装 ${g.storedCargo}/${g.cargoCapacity}`;
    const thieves=g.enemies.filter(e=>e.hp>0&&e.type==='thief'&&['steal','escape','seek_cargo'].includes(e.state));this.targets.replaceChildren();
    for(const e of thieves){const p=view.project(e.x,e.y+2.25,.65);if(p.x<0||p.x>view.w)continue;const n=this.doc.createElement('b');n.className='thiefLabel';n.style.left=p.x+'px';n.style.top=p.y+'px';n.textContent=e.carry?`追回! ${(e.escapeDelay+(g.length-.2-e.x)/V11.enemies.thief.escapeSpeed).toFixed(1)}s`:e.state==='steal'?`偷取倒计时 ${Math.max(0,3-e.wind).toFixed(1)}s`:'盗贼 → 货舱';this.targets.append(n);}
    const a=this.doc.getElementById('interact'),depot=g.nearestDepot();if(g.playerLayer==='DEPOT')a.textContent=g.player.carry?'回桥装车':'取箱 / 回车';else if(g.cars[g.currentCar]?.type==='cargo'&&g.depotConnected(depot))a.textContent='进站取箱';
    const mark=view.project(g.craneX,6.8,.65);this.hazardTag.hidden=g.phase!=='crane'||mark.x<0||mark.x>view.w;this.hazardTag.style.left=Math.min(view.w-85,Math.max(85,mark.x))+'px';this.hazardTag.style.top=Math.max(32,mark.y)+'px';this.hazardTag.textContent=g.player.roof?'↓ 红边横栏 · 下车内':'红边横栏 · 车内安全';
    const hp=this.doc.getElementById('playerTag');if(g.alive)hp.textContent=(g.player.face<0?'◀ ':'▶ ')+(g.playerLayer==='DEPOT'?'你 · 货站':(g.player.roof?'你 · 车顶':'你 · 车内')+(g.player.carry?' · 搬运':''));
    const direction=this.doc.getElementById('reverse');direction.textContent=g.lastDirection==='REVERSE'?'前进':'倒车';direction.title='B 刹停 0.5 秒 → V 换向（倒车 28%）';
    this.doc.getElementById('versionTag').textContent='V12 R4 · '+(g.elapsed<3&&g.t===0?'转盘对轨 · 0%':(g.speed<0?'→ 倒车 ':g.speed>0?'← 前进 ':'■ 停车 ')+Math.round(Math.abs(g.speed)*100)+'%');
    const age=g.director.stopAge(g);if(['STOP','REVERSE'].includes(g.speedMode)&&age>=25&&age<35)this.doc.getElementById('centerHint').textContent='停站警戒升级 · '+Math.ceil(35-age)+'秒后增援 · 可回车防守或前进';
    const progress=g.combatProgress;this.doc.getElementById('scrapHud').textContent=g.scrap+' · '+progress.kills+'击杀';
    this.doc.getElementById('engineVital').textContent=Math.ceil(g.cars[0].hp)+'/'+g.cars[0].max;
    if(g.playerLayer==='DEPOT'&&!g.rescue)this.doc.getElementById('centerHint').textContent=g.player.carry?'携带 '+amount(l.held)+' 尚未装车 · 回中央桥按 F / 返回装车':g.cargoUsed>=g.cargoCapacity?'CARGO FULL · '+g.cargoUsed+'/'+g.cargoCapacity+'；回中央桥按 F / RETURN 回车':'靠近箱子自动拾取 · 回中央桥 F / W 离站';
    else if(g.cars[g.currentCar]?.type==='cargo'&&g.depotConnected(depot)&&!g.rescue)this.doc.getElementById('centerHint').textContent=g.cargoUsed>=g.cargoCapacity?'货舱已满：保护货物回站兑现':'本站余货 '+amount(g.cargoCrates.filter(c=>c.depotId===depot.id&&c.location==='depot').reduce((n,c)=>n+c.value,0))+' · F / 进站取箱 · 首箱保护18秒';
    if(personal>0)this.doc.getElementById('centerHint').textContent=(personal<=5?'护盾即将结束 · ':'接站观察护盾 · ')+Math.ceil(personal)+'s · 旧敌仍在车上，准备 J 防守 / W 下车内';
    else if(['STOP','REVERSE'].includes(g.speedMode)&&age>=25&&age<35)this.doc.getElementById('centerHint').textContent='玩家护盾已结束 · 旧敌可攻击；'+Math.ceil(35-age)+'s 后增援 · J 防守 / 回车开动';
    else if(g.player.roof&&['crane','approach','tunnel'].includes(g.phase))this.doc.getElementById('centerHint').textContent='你在车顶 · 红边横栏危险区 · 到黄色梯子 W 下车内躲避';
    if(g.armoryOpen){const sig=JSON.stringify([g.weaponInventory,g.scrap,g.melee.id,g.ranged?.id]);if(sig!==this.armorySignature){this.armorySignature=sig;this.weapons.replaceChildren();for(const slot of ['melee','ranged'])for(const w of g.weaponChoices(slot)){const b=this.doc.createElement('button');b.dataset.weapon=w.id;b.className=w.selected?'selected':'';b.textContent=`${w.name} · ${w.owned?(w.selected?'已装备':'切换'):w.cost+' Scrap'}\n${w.description||w.role}`;b.disabled=w.selected||!w.owned&&g.scrap<w.cost;b.onclick=()=>{g.buyWeapon(slot,w.id);this.armorySignature='';};this.weapons.append(b);}}}
    const visible=!g.practice&&(g.status==='ready'&&g.round===1||['cashed','lost'].includes(g.status));this.career.hidden=!visible;
    const sig=JSON.stringify([g.career,g.bank,g.status]);if(visible&&sig!==this.signature){this.signature=sig;this.career.open=g.bank>0||Object.values(g.career).some(v=>v>0);this.career.replaceChildren();const title=this.doc.createElement('summary');title.textContent='车队成长 · 永久 '+Object.values(g.career).reduce((n,v)=>n+v,0)+'/7 · BANK '+amount(g.bank);this.career.append(title);for(const [id,s]of Object.entries(CAREER)){const b=this.doc.createElement('button');b.dataset.career=id;b.textContent=`${s.name} ${g.career[id]}/${s.max} · ${s.cost} Bank\n${s.description}`;b.disabled=g.career[id]>=s.max||g.bank<s.cost;b.onclick=()=>{if(g.buyCareer(id)){this.onSave();this.signature='';this.update(g,view);}};this.career.append(b);}const note=this.doc.createElement('small');note.textContent='升级在下一次出发应用。旧存档保留 Bank；射手执照改变开局武器。';this.career.append(note);}
  }
}
