import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/sim.js';
import {V11_FINAL_SNAPSHOT_FIELDS,V11_TELEMETRY_EVENTS} from '../src/telemetry.js';

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
  assert.equal(g.interact(),true);assert.equal(g.playerLayer,'DEPOT');assert.equal(g.interact(),true);assert.ok(g.heldCargo);assert.equal(g.interact(),true);assert.equal(g.playerLayer,'ROOF');assert.equal(g.interact(),true);assert.equal(g.cargoUsed,1);
  g.setPlayerLayer('DEPOT');g.player.depotId=g.depots[0].id;assert.equal(g.killPlayer('train_lost'),true);stepFor(g,5.05);assert.ok(g.alive);
  g.setPlayerLayer('INTERIOR');g.player.x=3;const e=g.spawn('boarder',3.7,false);e.hp=1;g.hitEnemy(e,99);assert.ok(g.scrap>0);
  g.scrap=100;g.player.x=1.7;assert.equal(g.openArmory(),true);assert.equal(g.buyWeapon('melee'),true);
  g.player.x=5.8;g.damageCar(0,g.cars[0].hp,'release_contract');assert.equal(g.engineState,'stalled');assert.equal(g.repair(3.05),true);assert.notEqual(g.engineState,'stalled');
  assert.equal(g.finish(),true);g.completeArrival();assert.equal(g.status,'complete');assert.equal(g.more(),true);assert.equal(g.chooseRoute('freight'),true);
  const g2=new Game({seed:7,emit});assert.equal(g2.chooseRoute('industrial'),true);assert.equal(g2.chooseCar('cargo'),true);assert.equal(g2.start(),true);assert.equal(g2.finish(),true);g2.completeArrival();assert.equal(g2.cashout(),true);
  const critical=['route_select','route_repeat','car_select','speed_change','emergency_stop','depot_enter','depot_exit','cargo_pickup','cargo_loaded','train_lost','player_death','respawn_start','respawn_complete','enemy_hit','enemy_kill','scrap_gain','armory_open','armory_purchase','engine_state','engine_stalled','engine_recovered','repair_started','repair_complete','round_complete','one_more_round','cashout'];
  for(const type of critical)assert.ok(seen.includes(type),`critical event was not emitted: ${type}`);
});
