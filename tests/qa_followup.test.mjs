// Focused regression coverage for the V11 Senior QA candidates C01-C03.
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as sim from '../src/sim.js';
import {ROUTES} from '../src/content.js';
import {V11} from '../src/balance.js';
import {SaveStore} from '../src/save.js';
import {runtimeMode} from '../src/runtime.js';
const {Game,car,MAX_CARS,B,stationX}=sim;
// Run the actual HUD function against a minimal DOM double. This verifies text bindings,
// not browser layout, WebGL rendering, input latency or gameplay quality.
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const hudSource=main.slice(main.indexOf('function ui(){'),main.indexOf('function frame('));
function hud(g){
  const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},dataset:{},classList:{toggle(){}},textContent:''});return nodes.get(id);};
  vm.runInNewContext(hudSource+'\nui();',{game:g,$:node,document:{querySelector:node,querySelectorAll:()=>[]},
    input:{repair:false},lastStatus:g.status,B,ROUTES,stationX,phaseLabel:sim.phaseLabel});
  return Object.fromEntries([...nodes].map(([id,value])=>[id,value.textContent]));
}
const tick=(g,seconds,input={})=>{for(let left=seconds;left>1e-8;left-=.025)g.step(Math.min(.025,left),input);};
function ready(count,prep={reroll:1}){
  const events=[];const g=new Game({seed:314159,prep,emit:(type,data)=>events.push({name:type,data})});
  while(g.cars.length<count)g.cars.push(car('cargo'));
  return {g,events};
}
function stalled(types=[],kit=false){
  const {g}=ready(1,{repairKit:kit?1:0});
  g.chooseRoute('industrial');g.chooseCar('cargo');g.cars.push(...types.map(car));g.start();
  g.elapsed=3;g.player.x=stationX(0);g.damageCar(0,g.cars[0].hp);
  return g;
}
for(const route of Object.keys(ROUTES))test(`C01: full train skips offers without spending a token on ${route}`,()=>{
  const {g,events}=ready(MAX_CARS);
  assert(g.chooseRoute(route));assert.equal(g.hubStage,'depart');assert.deepEqual(g.carOffers,[]);
  assert.equal(g.selectedCar,null);assert(!g.rerollCars());assert(!g.chooseCar('cargo'));
  assert.equal(g.prep.reroll,1);assert.equal(g.carRerolled,false);assert.equal(g.cars.length,MAX_CARS);
  assert(!events.some(e=>e.name==='car_select'||e.name==='prep_use'));
  assert(!g.chooseRoute(route));assert(g.start());assert(!g.start());
  assert.equal(events.filter(e=>e.name==='depart').length,1);
});
test('C01: stale full-train UI requests cannot reroll or accept a nonexistent new car',()=>{
  const {g,events}=ready(MAX_CARS);g.chooseRoute('industrial');
  // Model a stale caller that still presents the old car-choice stage.
  g.hubStage='car';g.carOffers=['workshop','cargo'];
  assert(!g.rerollCars());assert(!g.rerollCars());assert(!g.chooseCar('cargo'));
  assert.equal(g.prep.reroll,1);assert.equal(g.carRerolled,false);assert.equal(g.selectedCar,null);
  assert.equal(g.cars.length,MAX_CARS);assert(!events.some(e=>e.name==='car_select'||e.name==='prep_use'));
  assert.deepEqual(g.prepareCarOffers(),[]);assert.deepEqual(g.carOffers,[]);
});
test('C01: the last legal 11-to-12 car choice can still reroll exactly once',()=>{
  const {g,events}=ready(MAX_CARS-1,{reroll:2});g.chooseRoute('industrial');
  assert.equal(g.hubStage,'car');assert(g.rerollCars());assert.equal(g.prep.reroll,1);
  assert(!g.rerollCars());assert(g.chooseCar('battery'));assert(!g.chooseCar('battery'));
  assert.equal(g.cars.length,MAX_CARS);assert.equal(g.selectedCar,'battery');assert(g.start());
  assert.equal(events.filter(e=>e.name==='car_select').length,1);
  assert.equal(events.filter(e=>e.name==='prep_use'&&e.data.item==='reroll').length,1);
});
test('C01: One More Round still advances, repeats route pressure and cashes out after the cap',()=>{
  const {g}=ready(1,{reroll:2});
  for(let lap=1;lap<=14;lap++){
    assert(g.chooseRoute('freight'));assert.equal(g.repeatPressure,lap>1?1:0);
    if(g.cars.length<MAX_CARS)assert(g.chooseCar('cargo'));
    else{assert.equal(g.hubStage,'depart');assert(!g.rerollCars());}
    assert(g.start());assert.equal(g.cars.length,Math.min(lap+1,MAX_CARS));
    assert(g.finish());g.completeArrival();assert.equal(g.status,'complete');
    if(lap<14)assert(g.more());else assert(g.cashout());
  }
  assert.equal(g.round,14);assert.equal(g.prep.reroll,2);assert.equal(g.status,'cashed');
});
test('C01: skipped full-train choice preserves tokens in a save roundtrip and leaves DEV untouched',()=>{
  const data=new Map();const backend={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const normal=new SaveStore({mode:runtimeMode(''),backend}),dev=new SaveStore({mode:runtimeMode('?dev=1'),backend});
  assert(dev.write({bank:999,prep:{reroll:3}}));const beforeDev=JSON.stringify(dev.read());
  const {g}=ready(MAX_CARS,{reroll:2});g.chooseRoute('tunnel');g.rerollCars();assert(normal.write(g));
  assert.equal(normal.read().prep.reroll,2);assert.equal(JSON.stringify(dev.read()),beforeDev);
});
for(const types of [[],['workshop'],['battery'],['workshop','battery']])for(const kit of [false,true]){
  test(`C02: restart channel matches authoritative duration (${types.join('+')||'base'}, kit=${kit})`,()=>{
    const g=stalled(types,kit);const duration=B.restartTime/(g.repairSpeed*(kit?V11.kitSpeed:1));
    assert.equal(g.emergencyRepairTime,duration);g.repair(.01);assert.equal(g.repairJob.duration,duration);
    assert(hud(g).event.includes(`长按修理 ${duration.toFixed(1)} 秒`));
    assert.equal(hud(g).event.includes('维修包加速'),kit);
    tick(g,duration-.035,{repair:true});assert.equal(g.engineState,'stalled');assert.equal(g.runRepairKit,kit?1:0);
    tick(g,.025,{repair:true});assert.notEqual(g.engineState,'stalled');assert.equal(g.runRepairKit,0);
  });
}
test('C02: interrupted kit channel restarts at zero and does not consume the kit early',()=>{
  const g=stalled([],true);tick(g,.5,{repair:true});g.cancelRepair('released');
  assert.equal(g.runRepairKit,1);assert.equal(g.repairJob,null);assert.equal(g.emergencyRepairTime,1.5);
  tick(g,1.475,{repair:true});assert.equal(g.engineState,'stalled');tick(g,.025,{repair:true});
  assert.notEqual(g.engineState,'stalled');assert.equal(g.runRepairKit,0);assert.equal(g.emergencyRepairTime,3);
});
test('C02: losing Battery power updates the same live restart duration without extending the deadline',()=>{
  const g=stalled(['workshop','battery'],true);const remaining=g.rescue.remaining;
  g.repair(.1);assert.equal(g.repairJob.duration,1);g.cars.at(-1).charge=0;g.repair(.1);
  assert.equal(g.emergencyRepairTime,1.2);assert.equal(g.repairJob.duration,1.2);
  assert.equal(g.rescue.remaining,remaining);assert.equal(g.runRepairKit,1);
});
for(const [route,label] of Object.entries({industrial:'工业装卸区',freight:'货运堆场',tunnel:'地下连接段'})){
  test(`C03: ${route} event and HUD label use route content`,()=>{
    const {g}=ready(1);g.chooseRoute(route);g.chooseCar('cargo');g.start();g.t=.1;
    g.phaseChanged('depart','yard');assert.equal(g.event,label);assert.equal(hud(g).phase,label);assert.equal(hud(g).event,label);
    assert.equal(sim.phaseLabel('yard',route),label);assert.equal(ROUTES[route].travelLabel,label);
  });
}
test('C03: special hazard text remains unchanged and unknown phases have a safe fallback',()=>{
  const {g}=ready(1);g.chooseRoute('industrial');g.chooseCar('cargo');g.start();
  const events={crane:'机械臂预警：黄色梯子下车内，离开扫顶区域。',approach:'前方低净空：提前找到黄色梯子，回车内。',tunnel:'隧道中：应急灯保底照明，车顶封闭。',return:'机库就在前方。回站后有安全结算时间。'};
  for(const [phase,label] of Object.entries(events)){g.phaseChanged('depart',phase);assert.equal(g.event,label);}
  assert.equal(sim.phaseLabel('dock','freight'),sim.LABELS.dock);
  assert.equal(sim.phaseLabel('yard',null),'工业装卸区');assert.equal(sim.phaseLabel('unknown','freight'),'unknown');
});
