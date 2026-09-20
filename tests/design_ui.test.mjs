// Presentation tests: rule fixtures and DOM doubles are not human play or mobile signoff.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Game,car,LENGTH} from '../src/sim.js';
import {V11,B} from '../src/balance.js';
import {DesignUI,RunReadout,carPreview,routeReason,upgradeGoal,depotGuide} from '../src/design_ui.js';
function setup(type='cargo',route='freight'){
  const r=new RunReadout();let g;g=new Game({seed:314159,emit:(t,d)=>r.observe(g,t,d)});
  r.ensure(g);g.chooseRoute(route);g.chooseCar(type);g.start();g.director.rest=9999;return {g,r};
}
function dom(){const nodes=new Map();const create=()=>({textContent:'',hidden:false,open:false,style:{},children:[],append(n){this.children.push(n);},replaceChildren(){this.children=[];}});
  return {nodes,createElement:create,getElementById(id){if(!nodes.has(id))nodes.set(id,create());return nodes.get(id);}};}
for(const types of [[],['cargo'],['battery'],['workshop'],['workshop','battery'],['workshop','workshop']]){
  for(const choice of ['cargo','battery','workshop'])test('preview reads actual projected getters: '+types.join('+')+' -> '+choice,()=>{
    const g=new Game();g.cars.push(...types.map(car));const before=JSON.stringify(g.snapshot()),p=carPreview(g,choice);
    const projected=new Game();projected.cars=g.cars.concat(car(choice));
    assert.equal(p.capacity,projected.cargoCapacity);assert.equal(p.repairAfter,B.repairTime/projected.repairSpeed);
    assert.equal(p.fastAfter,projected.batteryCapacity/V11.fastDrain);assert.equal(JSON.stringify(g.snapshot()),before);
    assert(p.lines.length>=2);if(choice!=='cargo'&&g.cargoCapacity===0)assert(p.lines.some(s=>s.includes('0 货位')));
  });
}
test('damaged and exhausted cells are reflected without optimistic global stacking',()=>{
  const g=new Game();g.cars.push(car('battery'),car('workshop'));g.cars[1].charge=0;
  assert.equal(carPreview(g,'workshop').repairAfter,1.8/1.25);
  assert(carPreview(g,'workshop').lines.some(s=>s.includes('不再叠加')));
  g.cars[2].hp=0;assert(!carPreview(g,'workshop').lines.some(s=>s.includes('不再叠加')));
  g.cars[1].hp=0;assert.equal(carPreview(g,'battery').fastAfter,200/12);
});
test('full trains and invalid car identities do not advertise phantom growth',()=>{
  const g=new Game();assert.equal(carPreview(g,'engine'),null);while(!g.trainFull)g.cars.push(car('cargo'));
  assert.equal(carPreview(g,'cargo'),null);
});
test('first-route recommendation does not pretend every later empty train is first-time',()=>{
  const g=new Game();assert.match(routeReason(g,'freight'),/首次/);g.round=3;assert.doesNotMatch(routeReason(g,'freight'),/首次/);
  g.cars.push(car('cargo'));assert.match(routeReason(g,'freight'),/已有货位/);
});
for(const route of ['industrial','freight','tunnel'])test('route reason is nonempty and read-only: '+route,()=>{
  const g=new Game();const s=JSON.stringify(g.snapshot());assert(routeReason(g,route));assert.equal(s,JSON.stringify(g.snapshot()));
});
test('upgrade goal shows the actual one-scrap gap and does not unlock Handgun early',()=>{
  const {g}=setup();g.meleeTier=3;g.rangedTier=1;g.scrap=23;assert.match(upgradeGoal(g).text,/1 Scrap.*SMG/);
  g.meleeTier=1;g.rangedTier=0;g.scrap=100;assert.equal(upgradeGoal(g).offer.weapon,'knife');
});
test('max gear gets a truthful no-upgrade goal',()=>{
  const {g}=setup();g.meleeTier=3;g.rangedTier=3;assert.equal(upgradeGoal(g).offer,null);assert.match(upgradeGoal(g).text,/顶级/);
});
test('first lap displays only new income and excludes initial funds',()=>{
  const {g,r}=setup();g.inc('kills',28);g.finish();g.completeArrival();const s=r.summary(g);
  assert.equal(s.net,1400);assert.equal(s.opening,1000);assert.equal(s.rewards,1400);assert.equal(s.amount,2400);assert.equal(s.kills,28);assert.equal(s.other,0);
});
test('actual cargo load notification does not reward re-loading a secured box',()=>{
  const {g,r}=setup();g.t=.26;g.speedMode='STOP';g.player.x=12.45;g.setPlayerLayer('ROOF');assert(g.enterDepot());
  g.player.depotX=1;g.syncDepotPlayer();assert(g.interact());assert.match(depotGuide(g).text,/尚未装车/);
  assert(g.exitDepot());g.player.x=12.45;assert(g.loadCargo());assert.equal(g.money,1450);assert.match(r.notice.text,/\+450/);
  g.setPlayerLayer('INTERIOR');assert(g.interact());assert.match(depotGuide(g).text,/已计未兑现/);
  assert(g.loadCargo());assert.equal(g.money,1450);assert.match(r.notice.text,/不重复/);
});
test('cargo loss and paid Workshop service reconcile without inventing new income',()=>{
  const {g,r}=setup();g.cars.push(car('workshop'));
  const c=g.createCargo(450,'player');g.player.carry=c.id;g.player.x=12.45;g.loadCargo();
  g.player.x=2.5*LENGTH;g.player.hp=70;assert(g.interact());assert.equal(g.creditsSpent,120);
  g.loseCargo(c,'test');g.finish();g.completeArrival();const s=r.summary(g);
  assert.equal(s.amount,2280);assert.equal(s.net,1280);assert.equal(s.spent,120);assert.equal(s.cargoValue,0);assert.equal(s.other,0);
});
test('second lap carries previous funds without counting them twice',()=>{
  const {g,r}=setup();g.finish();g.completeArrival();g.more();g.chooseRoute('freight');g.chooseCar('cargo');g.start();
  const c=g.createCargo(450,'player');g.player.carry=c.id;g.player.x=12.45;g.loadCargo();g.finish();g.completeArrival();
  const s=r.summary(g);assert.equal(s.net,2768);assert.equal(s.amount,5168);assert.equal(s.rewards,3718);assert.equal(s.other,0);
});
test('purchase counts survive Cash Out clearing combat and later prep spending',()=>{
  const {g,r}=setup();g.player.x=1.7;g.scrap=100;g.openArmory();g.buyWeapon('melee');g.buyWeapon('melee');g.buyWeapon('ranged');
  g.finish();g.completeArrival();const s=r.summary(g);assert.equal(s.upgrades,3);assert.equal(s.totalUpgrades,3);
  g.cashout();assert.equal(g.meleeTier,1);assert.equal(r.terminal.weapon,s.weapon);assert.equal(r.terminal.amount,2400);
  g.bank=10000;g.buyPrep('reroll');assert.equal(r.terminal.amount,2400);assert.equal(r.terminal.totalUpgrades,3);
});
test('loss captures pre-clear money, ordinary death does not create a new ledger',()=>{
  const {g,r}=setup();g.killPlayer();assert.equal(r.opening,1000);g.fail('engine_timeout');
  assert.equal(g.money,0);assert.equal(r.terminal.amount,1000);assert.equal(r.terminal.net,0);
});
test('replacement/practice/test games get separate presentation sessions',()=>{
  const {g,r}=setup();g.finish();g.completeArrival();r.ensure(new Game({practice:true}));
  assert.equal(r.rewards,0);assert.equal(r.upgrades,0);assert.equal(r.terminal,null);assert.equal(r.lastRound,null);
});
test('unaccounted fixture money is labelled rather than disguised as rewards',()=>{
  const {g,r}=setup();g.money+=17;assert.equal(r.summary(g).other,17);
});
for(const type of ['workshop','battery'])test('zero-cargo objective remains achievable with '+type,()=>{
  const {g}=setup(type,type==='battery'?'tunnel':'industrial');assert.match(depotGuide(g).text,/无货位/);
});
for(const mode of ['CRUISE','FAST','STOP','SLOW'])test('Depot speed instructions follow actual speed '+mode,()=>{
  const {g}=setup();g.t=.26;g.player.x=12.45;g.setPlayerLayer('ROOF');g.speedMode=mode;
  const text=depotGuide(g).text;
  assert.match(text,/2,250.*空位 3/);
  assert.match(text,['STOP','SLOW'].includes(mode)?/DEPOT 进入/:/STOP 后/);
});
for(const side of [-1,1])test('Depot cargo guides use the correct bridge side '+side,()=>{
  const {g}=setup();g.t=.26;g.speedMode='STOP';g.player.x=12.45;g.setPlayerLayer('ROOF');g.enterDepot();
  g.player.depotX=1;g.syncDepotPlayer();g.interact();g.player.depotX=side*7;g.syncDepotPlayer();
  assert(depotGuide(g).text.includes((side>0?'←':'→')+' 回中央连接桥'));
});
test('full cargo and empty Depot point back to the train',()=>{
  const {g}=setup();g.t=.26;g.speedMode='STOP';g.player.x=12.45;g.setPlayerLayer('ROOF');g.enterDepot();
  for(let i=0;i<3;i++)g.createCargo(450,'stored',{carIndex:1,secured:true});
  assert.match(depotGuide(g).text,/CARGO FULL.*RETURN/);
  g.cargoCrates=[];assert.match(depotGuide(g).text,/本站已无货.*RETURN/);
});
test('cargo carried away from its hatch directs LOAD before climbing',()=>{
  const {g}=setup();const c=g.createCargo(450,'player');g.player.carry=c.id;g.setPlayerLayer('ROOF');g.player.x=3;
  assert.match(depotGuide(g).text,/→ 回货车 LOAD.*不能爬梯/);
});
test('touch guidance names the actual controls rather than requiring a keyboard',()=>{
  const {g}=setup();g.t=.26;g.speedMode='STOP';g.player.x=12.45;g.setPlayerLayer('ROOF');
  assert.match(depotGuide(g,true).text,/DEPOT 进入/);assert.doesNotMatch(depotGuide(g,true).text,/F ·/);
});
test('optional shop folds only with no funds/inventory, and respects manual reopening',()=>{
  const d=dom(),ui=new DesignUI(d),g=new Game();ui.hub(g);assert.equal(d.getElementById('prepDisclosure').open,false);
  d.getElementById('prepDisclosure').open=true;ui.hub(g);assert.equal(d.getElementById('prepDisclosure').open,true);
  const rich=new Game({bank:3000});ui.hub(rich);assert.equal(d.getElementById('prepDisclosure').open,true);
  const stocked=new Game({prep:{reroll:1}});ui.hub(stocked);assert.equal(d.getElementById('prepDisclosure').open,true);
});
test('normal completion emphasizes accomplishments and hides zero special incidents',()=>{
  const d=dom(),ui=new DesignUI(d);let g;g=new Game({emit:(t,v)=>ui.observe(g,t,v)});ui.hub(g);
  g.chooseRoute('freight');g.chooseCar('cargo');g.start();g.inc('kills',28);g.finish();g.completeArrival();ui.end(g);
  assert.equal(d.getElementById('killsStat').textContent,'28 / 0');assert.equal(d.getElementById('gainStat').textContent,'+1,400');
  assert(d.getElementById('resultHighlights').hidden);assert(!d.getElementById('outcomeStats').hidden);
  g.more();ui.hub(g);assert.equal(d.getElementById('upgradesDetail').textContent,'');
});
for(const danger of ['dead','stall','critical','hazard','fault','repair','notice'])test('new guidance cannot displace danger/repair feedback: '+danger,()=>{
  const d=dom(),ui=new DesignUI(d),{g}=setup();d.getElementById('centerHint').textContent='existing urgent instruction';
  if(danger==='dead')g.killPlayer();if(danger==='stall')g.damageCar(0,180);if(danger==='critical'){g.cars[0].hp=30;g.syncSystems();}
  if(danger==='hazard'){g.t=.45;g.phase='crane';}if(danger==='fault')g.director.fault={};if(danger==='repair')g.repairJob={};if(danger==='notice')g.notices.push({});
  ui.frame(g);assert.equal(d.getElementById('centerHint').textContent,'existing urgent instruction');
});
test('one-time upgrade nudge is presentation-only and resets with a new game',()=>{
  const d=dom(),ui=new DesignUI(d),{g}=setup();g.scrap=10;const before=JSON.stringify(g.snapshot());ui.frame(g);
  assert.match(d.getElementById('centerHint').textContent,/ARMORY.*KNIFE/);assert.equal(before,JSON.stringify(g.snapshot()));
  g.elapsed+=4;ui.frame(g);assert.doesNotMatch(d.getElementById('centerHint').textContent,/ARMORY.*KNIFE/);
});
test('normal entry order and core clickable IDs are preserved in the document',()=>{
  const s=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');assert(s.indexOf('id="routeChoices"')<s.indexOf('id="prepDisclosure"'));
  assert(s.indexOf('id="routeChoices"')<s.indexOf('id="practice"'));assert(s.includes('id="helpSettings"'));
  for(const id of ['start','more','cash','practice','telemetry','reduced'])assert.equal((s.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
});
