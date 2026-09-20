// Read-only presentation for the existing rules. No save writes, rewards or game-state edits.
import {B,V11} from './balance.js';
import {ROUTES,INPUT_BINDINGS_SSOT} from './content.js';
import {car,LENGTH} from './sim.js?v=11';
const money=n=>Math.round(n).toLocaleString('en-US');
const arrow=(from,to)=>to<from?'←':'→';
const cue=(action,label,touch)=>touch?label:`${INPUT_BINDINGS_SSOT[action].display} · ${label}`;
export function carPreview(g,type){
  if(g.trainFull||!['cargo','battery','workshop'].includes(type))return null;
  // Inherit read-only getters from Game, with an independent projected car list.
  const after=Object.create(g);after.cars=[...g.cars,car(type)];
  const repairBefore=B.repairTime/g.repairSpeed,repairAfter=B.repairTime/after.repairSpeed;
  const activeWorkshops=g.cars.filter(c=>c.type==='workshop'&&c.hp>0).length;
  const lines=type==='cargo'?
    [`货位 ${g.cargoCapacity} → ${after.cargoCapacity}（+${V11.cargoSlots}）`,'需离车取货，再回货车装载；额外货车提高盗贼权重']:
    type==='battery'?
    [`满电 FAST ${(g.batteryCapacity/V11.fastDrain).toFixed(1)} → ${(after.batteryCapacity/V11.fastDrain).toFixed(1)} 秒`,
     `按仍可工作的电池容量估算；隧道照明 / 供电维修`,
     `当前车况维修 ${repairBefore.toFixed(2)} → ${repairAfter.toFixed(2)} 秒`]:
    [`当前车况维修 ${repairBefore.toFixed(2)} → ${repairAfter.toFixed(2)} 秒`,
     activeWorkshops?'已有维修车：全局加速不再叠加，新增本地服务点':`维修加速 / 本地排故（工业故障第 3 圈起可能出现）`,
     `治疗最多 +${V11.workshopHeal} HP / ${V11.workshopCost} 未兑现（不花 Scrap）`];
  if(type!=='cargo'&&g.cargoCapacity===0)lines.push('本圈仍为 0 货位；可守车回站，不能运输货物');
  return {type,lines,capacity:after.cargoCapacity,repairBefore,repairAfter,
    fastBefore:g.batteryCapacity/V11.fastDrain,fastAfter:after.batteryCapacity/V11.fastDrain};
}
export function routeReason(g,id){
  if(id==='freight')return g.cargoCapacity===0?(g.round===1&&g.cars.length===1?'建议首次选择：搭配货车，装回一箱货再回站':'无货位：搭配货车才能运输货物'):'已有货位：可带货回站；离车期间注意盗贼';
  if(id==='industrial')return g.cars.some(c=>c.type==='workshop'&&c.hp>0)?'已有维修车：维修更快；注意机械臂与破坏者':'维修车可缩短维修；选它本圈仍需检查货位';
  return g.battery?'已有电池：留意储能，提前回车内':'电池提供 FAST 续航和照明；留意低净空';
}
export function upgradeGoal(g){
  const offers=['melee','ranged'].map(s=>g.armoryOffer(s)).filter(o=>o&&!o.locked);
  if(!offers.length)return {text:'装备已达顶级；继续可保留装备和 Scrap',offer:null};
  offers.sort((a,b)=>Math.max(0,a.cost-g.scrap)-Math.max(0,b.cost-g.scrap)||a.cost-b.cost);
  const o=offers[0],missing=Math.max(0,o.cost-g.scrap);
  return {offer:o,text:missing?`再获得 ${missing} Scrap 可购买 ${o.name}`:`可购买 ${o.name} · ${o.cost} Scrap`};
}
export function depotGuide(g,touch=false){
  const free=Math.max(0,g.cargoCapacity-g.cargoUsed),held=g.heldCargo;
  const d=g.playerLayer==='DEPOT'?g.depotState():g.nearestDepot();
  const nearby=d&&(g.playerLayer==='DEPOT'||d.connection<=V11.depotEncounterDistance);
  if(held){
    const accounting=held.secured?'已计未兑现，仍有丢失风险':`手持 ${money(held.value)} · 尚未装车`;
    if(g.playerLayer==='DEPOT')return {text:accounting+'；'+(Math.abs(g.player.depotX)>V11.depot.bridgeRadius?
      `${arrow(g.player.depotX,0)} 回中央连接桥，再 RETURN`:cue('climb','RETURN 回列车',touch)),nearby:true};
    if(g.cars[g.currentCar].type==='cargo')return {text:accounting+'；'+cue('interact','LOAD 装车',touch),nearby:true};
    const cargo=g.cars.map((c,i)=>({c,x:(i+.5)*LENGTH})).filter(v=>v.c.type==='cargo')
      .sort((a,b)=>Math.abs(a.x-g.player.x)-Math.abs(b.x-g.player.x))[0];
    return {text:accounting+'；'+(cargo?`${arrow(g.player.x,cargo.x)} 回货车 LOAD（携货不能爬梯）`:'无货车，无法装载'),nearby:true};
  }
  if(g.playerLayer==='DEPOT'&&d){
    const back=Math.abs(g.player.depotX)>V11.depot.bridgeRadius?`${arrow(g.player.depotX,0)} 回中央连接桥，再 RETURN`:cue('climb','RETURN 回车',touch);
    if(free===0)return {text:`CARGO FULL · ${g.cargoUsed}/${g.cargoCapacity}；${back}`,nearby:true};
    const crates=g.cargoCrates.filter(c=>c.depotId===d.id&&c.location==='depot').sort((a,b)=>Math.abs(a.x-g.player.depotX)-Math.abs(b.x-g.player.depotX));
    const c=crates[0];if(!c)return {text:'本站已无货；'+back,nearby:true};
    const pick=Math.abs(c.x-g.player.depotX)<=V11.depot.crateRadius?cue('interact',`PICKUP ${money(c.value)}`,touch):`${arrow(g.player.depotX,c.x)} 货箱 ${money(c.value)}`;
    return {text:pick+`；空位 ${free}`+(g.speedMode==='SLOW'?' · 列车正在驶离，及时回桥':' · STOP 增援持续'),nearby:true};
  }
  if(nearby){
    const crates=g.cargoCrates.filter(c=>c.depotId===d.id&&c.location==='depot'),value=crates.reduce((n,c)=>n+c.value,0);
    if(free===0)return {text:g.cargoCapacity===0?'本圈无货位：守住动力并回站；下圈可选货车':'货舱已满：继续保护货物回站',nearby:true};
    const stock=`本站余货 ${money(value)} · 空位 ${free}`;
    if(!crates.length)return {text:'本站余货 0；回 Engine 选择 CRUISE 离站',nearby:true};
    if(!g.depotConnected(d))return {text:stock+'；连接桥尚未对齐',nearby:true};
    if(!['STOP','SLOW'].includes(g.speedMode))return {text:stock+'；'+cue('brake','STOP 后从车顶进入',touch),nearby:true};
    if(g.playerLayer==='INTERIOR'){
      const x=g.currentCar*LENGTH+LENGTH*.52;
      return {text:stock+'；'+(Math.abs(g.player.x-x)>1.8?`${arrow(g.player.x,x)} 到本节黄梯`:cue('climb','上车顶',touch)),nearby:true};
    }
    return {text:stock+'；'+(Math.abs(g.player.x-d.x)>V11.depot.boardRadius?`${arrow(g.player.x,d.x)} 到连接桥`:cue('interact','DEPOT 进入',touch)),nearby:true};
  }
  const next=g.depots.filter(d=>d.marker>=g.t).sort((a,b)=>a.marker-b.marker)[0];
  return {text:g.cargoCapacity===0?'本圈无货位：守住动力回站，下一圈可选货车':
    free===0?'货舱已满：保护货物回站，仍未入 Bank':next?`目标：装回一箱货 · 下一 Depot ${Math.round(next.marker*100)}% · 空位 ${free}`:'本圈货站已过：守住动力并回站兑现',nearby:false};
}
export class RunReadout {
  constructor(){this.game=null;}
  ensure(g){
    if(!g||this.game===g)return;
    this.game=g;this.opening=g.money;this.lapOpening=g.money;this.rewards=0;this.upgrades=0;
    this.lastFunds=g.money;this.lapUpgrades=0;this.lastRound=null;this.terminal=null;this.notice=null;
  }
  observe(g,type,data){
    this.ensure(g);if(!g)return;
    if(type==='one_more_round'){this.lapOpening=g.money;this.lapUpgrades=0;this.notice=null;this.lastRound=null;}
    if(type==='armory_purchase'){this.upgrades++;this.lapUpgrades++;}
    if(type==='cargo_loaded'){
      const added=Math.max(0,g.money-this.lastFunds);
      this.notice={until:g.elapsed+2.5,text:added?`新增未兑现 +${money(added)} · 回站后才能入 Bank`:'货物重新归位 · 不重复增加收益'};
    }
    if(type==='round_complete'){this.rewards+=data.reward;this.lastRound=this.summary(g);}
    if(type==='cashout')this.terminal=this.lastRound||this.summary(g);
    if(type==='run_failed')this.terminal=this.summary(g);
    this.lastFunds=g.money;
  }
  summary(g){
    this.ensure(g);
    const cargo=g.cargoCrates.filter(c=>c.secured&&!['lost','banked'].includes(c.location));
    const value=cargo.reduce((n,c)=>n+c.value,0),spent=g.creditsSpent;
    return {round:g.round,amount:g.money,net:g.money-this.lapOpening,opening:this.opening,rewards:this.rewards,
      cargoValue:value,cargoCount:cargo.length,spent,other:g.money-(this.opening+this.rewards+value-spent),
      kills:g.lap.kills,totalKills:g.total.kills,upgrades:this.lapUpgrades,totalUpgrades:this.upgrades,
      engine:Math.ceil(g.cars[0].hp/g.cars[0].max*100),hp:Math.ceil(g.player.hp),weapon:g.weapon};
  }
}
export class DesignUI {
  constructor(doc){this.doc=doc;this.run=new RunReadout();this.touch=false;this.game=null;this.routeKey='';this.offerSeen=new Set();}
  node(id){return this.doc.getElementById(id);}
  text(id,text){const n=this.node(id);if(n.textContent!==text)n.textContent=text;}
  ensure(g){
    this.run.ensure(g);if(this.game===g)return;
    this.game=g;this.offerSeen.clear();this.upgradeNotice=null;this.shopKey='';this.routeKey='';
  }
  observe(g,type,data){this.ensure(g);this.run.observe(g,type,data);}
  hub(g){
    this.ensure(g);this.node('outcomeStats').hidden=true;this.node('economyDetails').hidden=true;this.node('resultHighlights').hidden=true;
    this.node('hubObjective').hidden=false;this.text('upgradesDetail','');
    const objective=g.hubStage==='route'?'选路线 → 选车厢 → START。带货回站，才能把未兑现存入 Bank。':
      g.hubStage==='car'?'本圈货位 '+g.cargoCapacity+'；选车可改变容量与服务。':
      g.cargoCapacity?(g.cargoUsed>=g.cargoCapacity?'货舱已满：保护现有货物回站兑现。':`本圈空货位 ${g.cargoCapacity-g.cargoUsed}：到 Depot 装回一箱货，并带回 Roundhouse。`):'本圈货位 0：守住动力回站；选货车后才能运输货物。';
    this.text('hubObjective',objective);this.node('practice').hidden=false;
    this.shop(g);this.node('runActions').hidden=g.hubStage!=='depart';
  }
  shop(g){
    const visible=!g.practice&&(g.status==='cashed'||g.status==='ready'&&g.hubStage==='route');
    const d=this.node('prepDisclosure');d.hidden=!visible;
    const key=g.status+':'+g.round;
    if(this.shopKey!==key){this.shopKey=key;d.open=visible&&(g.bank>0||Object.values(g.prep).some(n=>n>0)||g.status==='cashed');}
    this.text('prepSummary','局外准备 / PREP SHOP · BANK '+money(g.bank));
  }
  end(g){
    this.ensure(g);this.shop(g);this.node('runActions').hidden=false;this.node('hubObjective').hidden=true;
    this.node('outcomeStats').hidden=g.practice;this.node('economyDetails').hidden=g.practice;
    const s=g.status==='complete'?this.run.summary(g):this.run.terminal||this.run.summary(g);
    this.text('gainLabel',g.status==='complete'?'本圈净增':g.status==='lost'?'本局损失':'本局净增');
    this.text('gainStat',(g.status==='complete'?s.net:s.amount-s.opening)>=0?'+'+money(g.status==='complete'?s.net:s.amount-s.opening):money(g.status==='complete'?s.net:s.amount-s.opening));
    if(g.status==='lost')this.text('gainStat','−'+money(s.amount));
    this.text('cargoLabel',g.status==='lost'?'未带回货物':g.status==='cashed'?'已兑现货物':'留存货物');
    this.text('cargoStat',s.cargoCount+' 箱 / '+money(s.cargoValue));
    this.text('killsLabel',g.status==='complete'?'本圈击杀 / 升级':'本局击杀 / 升级');
    this.text('killsStat',(g.status==='complete'?s.kills:s.totalKills)+' / '+(g.status==='complete'?s.upgrades:s.totalUpgrades));
    this.text('conditionStat',s.engine+'% / '+s.hp);
    this.text('upgradesDetail',s.weapon+(g.status==='cashed'?' · 本局装备已结算清除':g.status==='lost'?' · 本局装备已失去':' · 继续保留装备和 Scrap；兑现将清除本局装备'));
    const items=[`初始未兑现 ${money(s.opening)}`,`完成奖励 +${money(s.rewards)}`,`留存货物 +${money(s.cargoValue)}`,`服务支出 −${money(s.spent)}`];
    if(Math.abs(s.other)>.001)items.push(`其他变动（含调试） ${s.other>=0?'+':''}${money(s.other)}`);
    items.push((g.status==='cashed'?'本局入 Bank ':g.status==='lost'?'未兑现损失 ':'当前未兑现 ')+money(s.amount));
    this.text('economyBreakdown',items.join('\n'));
    const v=g.status==='complete'?g.lap:g.total;
    this.node('resultHighlights').hidden=!(v.clutchSaves||v.cargoSaved||v.criticalSeconds||v.repairs)||g.practice;
    if(g.status==='complete')this.text('riskPanel',`继续押上 ${money(g.money)} 未兑现 · ${g.scrap} Scrap 保留 · ${upgradeGoal(g).text}。动力 ${s.engine}% 将带入下一圈；生命按现有规则恢复。`);
  }
  frame(g){
    this.ensure(g);
    if(this.routeKey!==g.route){
      this.routeKey=g.route;const root=this.node('depotMarkers');root.replaceChildren();
      for(const d of g.depots){const n=this.doc.createElement('span');n.className='depotMarker';n.style.left=(d.marker*100)+'%';n.textContent='◆';n.title=`Depot ${Math.round(d.marker*100)}%`;root.append(n);}
    }
    this.text('speedHelp',`FAST 剩余约 ${(g.batteryCharge/V11.fastDrain).toFixed(1)} 秒 · STOP 增援持续；重新加速需在 Engine`);
    this.text('armoryHelp',(g.combatTier<3?'远程解锁：先购买 AXE（COMBAT TIER 3）。':'近战 / 远程分别操作；升级后自动装备。')+' 商店不暂停。');
    this.text('kitStatus',g.runRepairKit?'维修包已携带 · 成功重启自动使用':'');
    this.node('kitStatus').hidden=!g.runRepairKit;
    const safe=g.status==='running'&&g.alive&&!g.rescue&&g.engineState!=='critical'&&!g.hazardInfo()&&!g.director.fault;
    if(!safe||g.repairJob||g.notices.length)return;
    const guide=depotGuide(g,this.touch);let text=guide.text;
    const service=g.playerLayer==='INTERIOR'&&g.cars[g.currentCar].type==='workshop'&&!g.player.carry;
    if(service){
      const gain=Math.min(V11.workshopHeal,V11.playerMaxHP-g.player.hp);
      text=g.cars[g.currentCar].hp<=0?'维修车损坏：先修理设备':!gain?'生命已满；无需付费治疗':
        g.money-g.cargoValue<V11.workshopCost?`治疗需 ${V11.workshopCost} 非货物未兑现；余额不足`:
        cue('interact',`治疗 +${gain} HP / ${V11.workshopCost} 未兑现`,this.touch);
    }
    const goal=upgradeGoal(g),o=goal.offer;
    if(o&&g.scrap>=o.cost&&!this.offerSeen.has(o.weapon)&&!guide.nearby&&!g.player.carry&&!g.armoryOpen&&!service){
      this.offerSeen.add(o.weapon);this.upgradeNotice={until:g.elapsed+3,text:`${arrow(g.player.x,V11.armoryX)} 01 ARMORY：${goal.text}`};
    }
    if(this.upgradeNotice?.until>g.elapsed&&!guide.nearby&&!service&&!g.player.carry)text=this.upgradeNotice.text;
    if(this.run.notice?.until>g.elapsed)text=this.run.notice.text;
    if(g.armoryOpen)text=goal.text;
    if(g.consoleOpen)text=g.speedMode==='STOP'?'STOP 保持停车；选择 CRUISE 可继续。增援不会停止。':`当前 ${g.speedMode}；离开控制柜后维持所选速度。`;
    const hint=this.node('centerHint');if(!hint.hidden)this.text('centerHint',text);
  }
}
