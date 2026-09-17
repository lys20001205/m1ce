import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,car} from '../src/sim.js';
import {Telemetry} from '../src/telemetry.js';
import {networkSnapshot,networkEvent,V11_FINAL_SNAPSHOT_FIELDS,V11_TELEMETRY_EVENTS} from '../src/telemetry_contract.js';

function largeSnapshot(){
  const g=new Game();g.chooseRoute('freight');g.chooseCar('cargo');g.start();
  for(let i=2;i<12;i++)g.cars.push(car('cargo'));
  return {...g.snapshot(),drawCalls:125,triangles:45000,activeMeshes:200,routeSegmentsVisible:30,pooledEnemies:8,DPR:1.5,frameDeltaP50:16.7,frameDeltaP95:28.4,
    landmarks:Array.from({length:200},()=>({world:[100,200,300],screen:[0,0,0]})),enemyStates:Array(100).fill({debug:'local only'}),
    message:'PRIVATE_SENTINEL',url:'https://private.invalid/?credential=PRIVATE_SENTINEL',credentials:'PRIVATE_SENTINEL',userText:'PRIVATE_SENTINEL'};
}
const storage={getItem:()=>null,setItem:()=>{}};

test('network snapshot preserves every frozen V11 field and fits a worst-case twelve-car scene',()=>{
  const raw=largeSnapshot();assert(JSON.stringify(raw).length>8000);
  const compact=networkSnapshot(raw);for(const key of V11_FINAL_SNAPSHOT_FIELDS)assert(Object.hasOwn(compact,key),key);
  assert(JSON.stringify(compact).length<1600);assert.equal(compact.drawCalls,125);assert.equal(compact.cargoCapacity,33);
  assert(!JSON.stringify(compact).includes('PRIVATE_SENTINEL'));assert(!Object.hasOwn(compact,'landmarks'));
});
test('network events strip arbitrary text, credentials, unknown enums and nested renderer data',()=>{
  const e=networkEvent({type:'enemy_spawn',seq:4,ms:100,enemy_type:'saboteur',damage:20,message:'PRIVATE_SENTINEL',credentials:'PRIVATE_SENTINEL',route:'PRIVATE_SENTINEL',debug:{text:'PRIVATE_SENTINEL'}});
  assert.equal(e.type,'enemy_spawn');assert.equal(e.enemy_type,'saboteur');assert.equal(e.damage,20);assert(!JSON.stringify(e).includes('PRIVATE_SENTINEL'));
  assert.equal(networkEvent({type:'PRIVATE_SENTINEL'}).type,'other');
  assert(!Object.hasOwn(networkSnapshot({scrap:Infinity,bank:'PRIVATE_SENTINEL'}),'bank'));
});
test('previously missing blocking/death/spawn events are in the release contract',()=>{
  for(const e of ['cargo_full_block','respawn_cancel_engine_failure','enemy_spawn'])assert(V11_TELEMETRY_EVENTS.includes(e));
});
test('explicit opt-in sends a bounded batch with a receipt instead of silently refusing an oversized snapshot',async()=>{
  const original=globalThis.fetch,requests=[];
  globalThis.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({id:'synthetic_test_receipt'})};};
  const t=new Telemetry(largeSnapshot,{storage});
  try{
    t.live=true;t.log('runtime_error',{message:'PRIVATE_SENTINEL'});
    assert.equal(await t.flush(true),false);assert.equal(requests.length,0);
    t.consent(true);await new Promise(r=>setImmediate(r));
    assert.equal(requests.length,1);assert(new TextEncoder().encode(requests[0].options.body).length<=3500);
    const body=JSON.parse(requests[0].options.body);
    assert(body.events.length>=2);assert(t.acked>0);assert.equal(body.state.cargoCapacity,33);
    assert(!requests[0].options.body.includes('PRIVATE_SENTINEL'));assert.equal(requests[0].options.credentials,'omit');
    t.consent(false);t.lastSend=0;t.log('cargo_loaded',{value:450});assert.equal(await t.flush(true),false);assert.equal(requests.length,1);
  }finally{t.dispose();globalThis.fetch=original;}
});
test('failed transport retains unacknowledged events and retry backoff',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('synthetic offline');};
  const t=new Telemetry(largeSnapshot,{storage});
  try{t.live=true;t.enabled=true;assert.equal(await t.flush(true),false);assert.equal(t.acked,0);assert.equal(t.failures,1);assert(t.events.length>0);assert(t.nextSend>Date.now());}
  finally{t.dispose();globalThis.fetch=original;}
});
