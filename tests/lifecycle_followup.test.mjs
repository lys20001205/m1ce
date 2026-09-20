// C05-C07: production input/HUD slices with doubles, plus actual AudioCues graph lifecycle.
// These tests do not certify physical touch, audible quality, or normal blind gameplay.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Game, B, stationX, phaseLabel} from '../src/sim.js';
import {INPUT_BINDINGS_SSOT,ROUTES} from '../src/content.js';
import {AudioCues} from '../src/audio.js';
import {V11} from '../src/balance.js';
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function controls(){
  const nodes=new Map(),listeners=new Map(),calls=[];
  const el=id=>{if(!nodes.has(id)){const handlers=new Map(),classes=new Set();nodes.set(id,{handlers,classes,
    classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),toggle:(k,on)=>on?classes.add(k):classes.delete(k)},setPointerCapture(){},
    addEventListener:(type,fn)=>handlers.set(type,fn)});}return nodes.get(id);};
  const game={status:'running',paused:false,alive:true,player:{x:3},cancelRepair:r=>calls.push(r)};
  const ctx=vm.createContext({game,$:el,INPUT_BINDINGS_SSOT,telemetry:{log(){}},
    document:{querySelectorAll:()=>[...nodes.values()]},addEventListener:(type,fn)=>listeners.set(type,fn),
    input:{move:0,attack:false,ranged:false,repair:false},pressed:new Map()});
  const clear=source.slice(source.indexOf('function clearInput(){'),source.indexOf('function fatal('));
  const handlers=source.slice(source.indexOf('const actions='),source.indexOf('const mobileInput='));
  vm.runInContext(clear+'\n'+handlers,ctx);
  return {game,calls,read:()=>ctx.input,clear:()=>vm.runInContext('clearInput()',ctx),
    key:(type,code)=>listeners.get(type)({code,preventDefault(){},target:{tagName:'BODY'}}),
    pointer:(action,type,pointerId)=>el(INPUT_BINDINGS_SSOT[action].button).handlers.get(type)({pointerId,preventDefault(){}}),
    active:action=>el(INPUT_BINDINGS_SSOT[action].button).classes.has('active')};
}
const heldValue=(c,action)=>action==='left'?c.read().move===-1:action==='right'?c.read().move===1:c.read()[action==='melee'?'attack':action];
for(const action of ['left','right','melee','ranged','repair']){
  test(`C05: ${action} keyboard survives release of same-action pointer`,()=>{
    const c=controls(),code=INPUT_BINDINGS_SSOT[action].keys[0];c.key('keydown',code);c.pointer(action,'pointerdown',1);
    c.pointer(action,'pointerup',1);c.pointer(action,'lostpointercapture',1);assert(heldValue(c,action));
    c.key('keyup',code);assert(!heldValue(c,action));assert(!c.active(action));
  });
  test(`C05: ${action} second touch survives first touch's lost capture`,()=>{
    const c=controls();c.pointer(action,'pointerdown',11);c.pointer(action,'pointerdown',12);
    c.pointer(action,'pointerup',11);c.pointer(action,'lostpointercapture',11);
    assert(heldValue(c,action));assert(c.active(action));c.pointer(action,'pointerup',12);c.pointer(action,'lostpointercapture',12);
    assert(!heldValue(c,action));assert(!c.active(action));
  });
}
test('C05: cancellation releases one owner, then blur/death clearing releases every source',()=>{
  const c=controls();c.pointer('right','pointerdown',1);c.pointer('melee','pointerdown',2);
  c.key('keydown','KeyJ');c.pointer('melee','pointercancel',2);c.pointer('melee','lostpointercapture',2);
  assert.equal(c.read().move,1);assert(c.read().attack);c.clear();assert.deepEqual(JSON.parse(JSON.stringify(c.read())),{move:0,attack:false,ranged:false,repair:false});
});
test('C05: repair cancels once only when its final input owner releases',()=>{
  const c=controls();c.key('keydown','KeyE');c.pointer('repair','pointerdown',3);
  c.pointer('repair','pointerup',3);c.pointer('repair','lostpointercapture',3);assert.equal(c.calls.length,0);
  c.key('keyup','KeyE');assert.deepEqual(c.calls,['released']);c.pointer('repair','lostpointercapture',3);assert.equal(c.calls.length,1);
});
function stalled(){const g=new Game();g.chooseRoute('freight');g.chooseCar('cargo');g.start();g.player.x=stationX(0);g.elapsed=3;g.damageCar(0,g.cars[0].hp);return g;}
function hint(g){const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{style:{},dataset:{},classList:{toggle(){}},textContent:''});return nodes.get(id);};
  vm.runInNewContext(source.slice(source.indexOf('function ui(){'),source.indexOf('function frame('))+'\nui();',
    {game:g,$,document:{querySelector:$,querySelectorAll:()=>[]},input:{repair:false},lastStatus:g.status,B,ROUTES,stationX,phaseLabel,V11});return $('event').textContent;}
test('C06: vertically aligned roof does not claim the console is in reach',()=>{const g=stalled();g.setPlayerLayer('ROOF');const h=hint(g);assert.match(h,/黄色梯子.*车内/);assert(!h.includes('控制柜已在身旁'));assert.equal(g.repair(.1),false);});
test('C06: Depot position prioritizes returning to the train',()=>{const g=stalled();g.setPlayerLayer('DEPOT');const h=hint(g);assert.match(h,/RETURN.*列车/);assert(!h.includes('控制柜已在身旁'));});
test('C06: death during Stall shows respawn with the continuing engine deadline',()=>{const g=stalled();g.killPlayer('boarder');const h=hint(g);assert.match(h,/复活.*5\.0/);assert.match(h,/动力倒计时继续/);assert(!h.includes('长按修理'));assert.equal(g.rescue.remaining,8);});
test('C06: held cargo identifies the actual repair blocker',()=>{const g=stalled();g.player.carry=123;const h=hint(g);assert.match(h,/货物.*货车/);assert(!h.includes('控制柜已在身旁'));assert.equal(g.repair(.1),false);});
test('C06: roof cargo must be loaded before the blocked ladder action',()=>{const g=stalled();g.player.carry=123;g.setPlayerLayer('ROOF');assert.equal(g.layer(),false);const h=hint(g);assert.match(h,/货车舱口 LOAD 放货.*下车内/);assert(!h.includes('找到黄色梯子下车内'));});
test('C06: eligible cabinet instruction and directional guidance remain correct',()=>{const g=stalled();assert.match(hint(g),/控制柜已在身旁：长按修理 3\.0 秒/);g.player.x=1;assert.match(hint(g),/→ .*01 控制柜/);g.player.x=12;assert.match(hint(g),/← .*01 控制柜/);});
function audioFixture(){
  const contexts=[],heard=[],param=()=>({value:0,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){}});
  const node=()=>({gain:param(),frequency:param(),threshold:param(),knee:param(),ratio:param(),connect(){},disconnect(){},start(){},stop(){}});
  const factory=()=>{const c={state:'running',currentTime:contexts.length?0:180,sampleRate:48000,destination:node(),createGain:node,createOscillator:node,createBiquadFilter:node,createDynamicsCompressor:node,createBufferSource:node,
    createBuffer:(_ch,n)=>({getChannelData:()=>new Float32Array(n)}),createAnalyser:()=>({...node(),fftSize:1024,getFloatTimeDomainData:a=>a.fill(.01)}),resume(){this.state='running';return Promise.resolve();}};contexts.push(c);return c;};
  const audio=new AudioCues({contextFactory:factory,hidden:()=>false});const original=audio.play.bind(audio);audio.play=(name,opts)=>{heard.push(name);return original(name,opts);};
  const g={status:'running',paused:false,engineState:'normal',speedMode:'CRUISE',elapsed:5,phase:'yard'};
  return {audio,contexts,heard,g};
}
for(const [name,extra,cue] of [['rail',{},'cargo_drop'],['repair',{repairJob:{}},'repair'],['alarm',{engineState:'stalled'},'engine_warning']])test(`C07: ${name} reschedules on recreated AudioContext clock`,()=>{
  const f=audioFixture();Object.assign(f.g,extra);f.audio.unlock();f.audio.update(f.g);f.contexts[0].state='closed';f.heard.length=0;
  f.audio.unlock('recovery_gesture');f.audio.update(f.g);assert.equal(f.contexts.length,2);assert(f.heard.includes(cue),`${cue} must not wait for the old 180-second clock`);
});
test('C07: recreated graph removes closed-context voices, pending cues and stale output state',()=>{
  const f=audioFixture();f.audio.unlock();f.audio.update(f.g);assert(f.audio.firstSound);f.audio.play('rifle');
  f.contexts[0].state='suspended';f.audio.play('train_lost');assert(f.audio.pending.length);f.contexts[0].state='closed';
  f.audio.createGraph();assert.equal(f.audio.voices.size,0);assert.equal(f.audio.pending.length,0);assert.equal(f.audio.firstSound,false);assert.equal(f.audio.outputRMS,0);
});
test('C07: suspend/resume reuses its graph and recreation preserves mute preference',()=>{
  const f=audioFixture();f.audio.unlock();f.audio.update(f.g);const rail=f.audio.nextRail;
  f.contexts[0].state='suspended';f.audio.unlock();assert.equal(f.contexts.length,1);assert.equal(f.audio.nextRail,rail);
  f.audio.setEnabled(false);f.contexts[0].state='closed';f.audio.unlock();assert.equal(f.audio.enabled,false);assert.equal(f.audio.master.gain.value,0);
});

for(const side of [-1,1])test(`C06: Depot offset ${side} gives bridge direction before a rejected RETURN`,()=>{
  const g=stalled();g.t=.26;g.setPlayerLayer('DEPOT');g.player.depotId=g.depots[0].id;g.player.depotX=side*7;g.syncDepotPlayer();
  assert.equal(g.layer(),false);assert.equal(g.event,'RETURN TO THE CENTER BRIDGE');
  assert(hint(g).includes((side>0?'← ':'→ ')+'回到 Depot 中央连接桥，再按 RETURN'));
  g.player.depotX=side*V11.depot.bridgeRadius;g.syncDepotPlayer();assert.match(hint(g),/先 RETURN 回列车/);
  assert.equal(g.layer(),true);assert.equal(g.playerLayer,'ROOF');assert.match(hint(g),/黄色梯子.*车内/);
});
