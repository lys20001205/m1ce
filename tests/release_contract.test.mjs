import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/sim.js';
import {V11_FINAL_SNAPSHOT_FIELDS,V11_TELEMETRY_EVENTS} from '../src/telemetry.js';
import fs from 'node:fs';
import {BUILD} from '../src/balance.js';
import {assetURL} from '../src/cache_identity.js';

test('built game graph has one versioned URL per module, with no stale unversioned alias',()=>{
  const seen=new Map();
  for(const file of fs.readdirSync('dist/src').filter(f=>f.endsWith('.js'))){
    const source=fs.readFileSync('dist/src/'+file,'utf8');
    for(const m of source.matchAll(/(['"])(\.[^'"]*\.js(?:\?[^'"]*)?)\1/g)){
      const url=new URL(m[2],'https://example.test/m1ce/src/'+file);
      if(!url.pathname.startsWith('/m1ce/src/'))continue;
      assert.equal(url.searchParams.get('build'),BUILD,url.href);
      if(seen.has(url.pathname))assert.equal(url.href,seen.get(url.pathname),'duplicate module identity');
      seen.set(url.pathname,url.href);
    }
  }
  assert(seen.size>=20,'actual compiled graph must be inspected');
});
test('compiled HTML entry, styles and manifest use the authored revision cache key',()=>{
  const html=fs.readFileSync('dist/index.html','utf8');let count=0;
  for(const m of html.matchAll(/(?:src|href)=['"](\.\/(?:src\/[^'"]+|style\.css[^'"]*|manifest\.webmanifest[^'"]*))['"]/g)){
    assert.equal(new URL(m[1],'https://example.test/m1ce/').searchParams.get('build'),BUILD);count++;
  }
  assert(count>=6,'entry and all stylesheet/manifest links must be checked');
});
test('asset versioning preserves independent palettes and embedded resources',()=>{
  const base='https://example.test/m1ce/src/view.js?build=legacy';
  const train=new URL(assetURL('../assets/kenney/train/Textures/colormap.png',base));
  const factory=new URL(assetURL('../assets/kenney/factory/Textures/colormap.png',base));
  assert.notEqual(train.pathname,factory.pathname);assert.equal(train.searchParams.get('build'),BUILD);
  const object=new URL(assetURL('../assets/crew-robot.json?v=11',base));assert.equal(object.search,'?build='+BUILD);
  for(const uri of ['data:image/png;base64,aA==','blob:https://example.test/123'])assert.equal(assetURL(uri,base),uri);
});

const stepFor=(g,seconds,input={})=>{for(let t=0;t<seconds-1e-8;t+=.025)g.step(Math.min(.025,seconds-t),input);};

test('V11 final snapshot exposes the frozen release fields with threat aliases',()=>{
  const g=new Game({seed:41});
  assert.equal(g.chooseRoute('freight'),true);
  assert.equal(g.chooseCar('cargo'),true);
  assert.equal(g.start(),true);
  const s=g.snapshot();
  for(const field of V11_FINAL_SNAPSHOT_FIELDS)assert.ok(Object.hasOwn(s,field),`missing final snapshot field ${field}`);
  assert.equal(s.threatCurrent,s.threat.actual);
  assert.equal(s.threatCap,s.threat.cap);
  assert.equal(s.route,'freight');
  assert.equal(s.speedMode,'CRUISE');
  assert.equal(s.dev,false);
});

test('V11 telemetry contract names every frozen gameplay and audio event family',()=>{
  const required=['route_select','route_repeat','car_select','speed_change','emergency_stop','depot_enter','depot_exit','cargo_pickup','cargo_loaded','cargo_lost','cargo_recovered','train_lost','player_death','respawn_start','respawn_complete','enemy_hit','enemy_kill','scrap_gain','armory_open','armory_purchase','engine_state','engine_stalled','engine_recovered','repair_started','repair_complete','audio_unlock_attempt','audio_context_state','audio_first_sound','round_complete','cashout','one_more_round'];
  for(const type of required)assert.ok(V11_TELEMETRY_EVENTS.includes(type),`missing telemetry contract event ${type}`);
});

test('stitched release rules emit the critical non-audio event chain from real Game methods',()=>{
  const seen=[];const emit=type=>seen.push(type);const g=new Game({seed:314159,emit});
  assert.equal(g.chooseRoute('freight'),true);assert.equal(g.chooseCar('cargo'),true);assert.equal(g.start(),true);
  g.elapsed=3;g.player.x=5.8;assert.equal(g.setSpeed('FAST'),true);assert.equal(g.emergencyStop(),true);
  g.t=.26;g.phase='yard';g.speedMode='STOP';g.setPlayerLayer('ROOF');g.player.x=12.45;
  assert.equal(g.interact(),true);assert.equal(g.playerLayer,'DEPOT');assert.equal(g.interact(),true);assert.ok(g.heldCargo);assert.equal(g.interact(),true);assert.equal(g.playerLayer,'INTERIOR');assert.equal(g.cargoUsed,1);
  g.setPlayerLayer('DEPOT');g.player.depotId=g.depots[0].id;assert.equal(g.killPlayer('train_lost'),true);stepFor(g,5.05);assert.ok(g.alive);
  g.setPlayerLayer('INTERIOR');g.player.x=3;const e=g.spawn('boarder',3.7,false);e.hp=1;g.hitEnemy(e,99);assert.ok(g.scrap>0);
  g.scrap=100;g.player.x=1.7;assert.equal(g.openArmory(),true);assert.equal(g.buyWeapon('melee'),true);
  g.player.x=5.8;g.damageCar(0,g.cars[0].hp,'release_contract');assert.equal(g.engineState,'stalled');assert.equal(g.repair(3.05),true);assert.notEqual(g.engineState,'stalled');
  assert.equal(g.finish(),true);g.completeArrival();assert.equal(g.status,'complete');assert.equal(g.more(),true);assert.equal(g.chooseRoute('freight'),true);
  const g2=new Game({seed:7,emit});assert.equal(g2.chooseRoute('industrial'),true);assert.equal(g2.chooseCar('cargo'),true);assert.equal(g2.start(),true);assert.equal(g2.finish(),true);g2.completeArrival();assert.equal(g2.cashout(),true);
  const critical=['route_select','route_repeat','car_select','speed_change','emergency_stop','depot_enter','depot_exit','cargo_pickup','cargo_loaded','train_lost','player_death','respawn_start','respawn_complete','enemy_hit','enemy_kill','scrap_gain','armory_open','armory_purchase','engine_state','engine_stalled','engine_recovered','repair_started','repair_complete','round_complete','one_more_round','cashout'];
  for(const type of critical)assert.ok(seen.includes(type),`critical event was not emitted: ${type}`);
});
