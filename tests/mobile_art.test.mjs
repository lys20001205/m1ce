import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Game} from '../src/sim.js';
import {V11} from '../src/balance.js';
import {INPUT_BINDINGS_SSOT} from '../src/content.js';
import {steeringDirection,depotActionLabel,controlStatus,ControlUI} from '../src/control_ui.js';
const rect={left:10,top:100,width:126,height:56};
for(const [x,y,want] of [[25,125,'left'],[120,125,'right'],[73,125,'neutral'],[73,126,'neutral'],[5,130,'left'],[160,130,'right'],[-30,130,'neutral'],[180,130,'neutral'],[25,65,'neutral'],[25,190,'neutral'],[NaN,120,'neutral']])test(`steering ${x}/${y} => ${want}`,()=>assert.equal(steeringDirection(x,y,rect),want));
function game(){const g=new Game({seed:314159});g.chooseRoute('freight');g.chooseCar('cargo');g.start();g.t=.26;g.elapsed=5;g.phase='yard';g.speedMode='STOP';g.player.x=12.45;g.setPlayerLayer('ROOF');assert(g.enterDepot());return g;}
for(const [x,want] of [[0,'PICKUP'],[2.4,'RETURN'],[-9,'RETURN'],[-7,'PICKUP']])test(`Depot context at ${x} matches actual interaction ${want}`,()=>{
 const g=game();g.player.depotX=x;g.syncDepotPlayer();const label=depotActionLabel(g);assert.equal(label,want);
 const before=g.playerLayer;g.interact();assert.equal(label==='PICKUP',!!g.player.carry);if(x===2.4)assert.notEqual(g.playerLayer,before);
});
test('carried cargo offers RETURN; interior delegates to existing labels',()=>{const g=game();g.player.carry=true;assert.equal(depotActionLabel(g),'RETURN');g.setPlayerLayer('INTERIOR');assert.equal(depotActionLabel(g),null);});
test('empty Depot no longer says PICKUP while F would return',()=>{const g=game();for(const c of g.cargoCrates)c.location='lost';assert.equal(depotActionLabel(g),'RETURN');assert(g.interact());assert.equal(g.playerLayer,'ROOF');});
for(const kind of ['paused','dead','carry','roof','stun'])test('unavailable '+kind+' is presentation-only',()=>{const g=game();g.setPlayerLayer('INTERIOR');if(kind==='paused')g.paused=true;if(kind==='dead')g.killPlayer();if(kind==='carry')g.player.carry=1;if(kind==='roof')g.setPlayerLayer('ROOF');if(kind==='stun')g.player.stun=1;const before=JSON.stringify(g.snapshot());assert.equal(controlStatus(g).fix,false);assert.equal(JSON.stringify(g.snapshot()),before);});
// Execute actual production handlers against DOM doubles. Browser gestures are separate.
function inputs(){
 const nodes=new Map(),events=new Map();const el=id=>{if(!nodes.has(id)){const handlers={};nodes.set(id,{handlers,addEventListener:(k,f)=>handlers[k]=f,setPointerCapture(){},getBoundingClientRect:()=>rect,classList:{toggle(){}}});}return nodes.get(id);};
 const game={status:'running',paused:false,alive:true,player:{x:3},cancelRepair(){}};
 const ctx=vm.createContext({game,$:el,INPUT_BINDINGS_SSOT,steeringDirection,telemetry:{log(){}},document:{querySelectorAll:()=>[]},addEventListener:(k,f)=>events.set(k,f),pressed:new Map(),input:{move:0,attack:false,ranged:false,repair:false}});
 const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');vm.runInContext(source.slice(source.indexOf('const actions='),source.indexOf('const mobileInput=')),ctx);
 return {read:()=>ctx.input,event:(id,type,pointerId,x=25,y=125)=>el(id).handlers[type]({pointerId,clientX:x,clientY:y,preventDefault(){}}),key:(type,code)=>events.get(type)({code,target:{tagName:'BODY'},preventDefault(){}})};
}
test('same captured pointer slides left to right and releases after changing action',()=>{const c=inputs();c.event('L','pointerdown',1);assert.equal(c.read().move,-1);c.event('L','pointermove',1,125);assert.equal(c.read().move,1);c.event('L','pointerup',1);assert.equal(c.read().move,0);c.event('L','lostpointercapture',1);assert.equal(c.read().move,0);});
test('neutral steering preserves other held keys and attack pointer',()=>{const c=inputs();c.key('keydown','KeyD');c.event('L','pointerdown',1);c.event('attack','pointerdown',2);c.event('L','pointermove',1,73);assert.equal(c.read().move,1);assert.equal(c.read().attack,true);c.event('L','pointercancel',1);assert.equal(c.read().move,1);c.event('attack','pointerup',2);assert.equal(c.read().attack,false);c.key('keyup','KeyD');assert.equal(c.read().move,0);});
test('moving outside pad neutralizes only its pointer, then release cannot stick',()=>{const c=inputs();c.event('R','pointerdown',3);c.event('R','pointermove',3,130,250);assert.equal(c.read().move,0);c.event('R','pointerup',3);assert.equal(c.read().move,0);});
test('UI updates expose separate engine and player meters without changing simulation',()=>{const nodes=new Map();const doc={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{textContent:id,style:{setProperty(){}},dataset:{},setAttribute(){}});return nodes.get(id);}};const g=game();g.cars[0].hp=90;g.player.hp=34;const before=JSON.stringify(g.snapshot());new ControlUI(doc).update(g);assert.equal(nodes.get('engineVital').textContent,'50%');assert.equal(nodes.get('playerVital').textContent,'34');assert.equal(JSON.stringify(g.snapshot()),before);});

test('root cosmetic route does not collide with route-choice selectors',()=>{const nodes=new Map();const doc={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{textContent:id,style:{setProperty(){}},dataset:{},setAttribute(){}});return nodes.get(id);}};new ControlUI(doc).update(game());assert.equal(nodes.get('app').dataset.worldRoute,'freight');assert.equal(nodes.get('app').dataset.route,undefined);});
