import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,FLOOR,ROOF} from '../src/sim.js';
import {V11} from '../src/balance.js';
import {LIFE,LAYER} from '../src/content.js';
const tick=(g,t,controls={})=>{for(let left=t;left>1e-8;left-=.025)g.step(Math.min(.025,left),controls);};
const close=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function run(){const events=[];const g=new Game({bank:9876,seed:314159,emit:(type,data)=>events.push({type,...data})});g.chooseRoute('freight');g.chooseCar('cargo');g.start();g.elapsed=3;g.t=.1;g.phase='yard';g.player.x=5.8;return {g,events};}
test('HP zero starts exactly one countdown and blocks all player actions',()=>{
 const {g,events}=run();g.hurt(100,'boarder');const deadline=g.player.respawnAt;
 assert.equal(g.player.lifeState,LIFE.DEAD);assert.equal(g.player.respawnRemaining,5);
 assert(!g.attack());assert(!g.repair(.025));assert(!g.interact());assert(!g.layer());assert(!g.setSpeed('FAST'));assert(!g.emergencyStop());assert(!g.killPlayer());
 tick(g,1,{move:1,attack:true,repair:true});close(g.player.x,5.8);close(g.player.respawnRemaining,4);assert.equal(g.player.respawnAt,deadline);
 assert.equal(events.filter(e=>e.type==='player_death').length,1);assert.equal(events.filter(e=>e.type==='respawn_start').length,1);
});
test('direct HP zero is processed before movement or attacks in the next simulation step',()=>{
 const {g}=run();g.player.hp=0;g.step(.025,{move:1,attack:true});assert.equal(g.player.lifeState,LIFE.DEAD);close(g.player.x,5.8);assert.equal(g.player.swing,0);
});
test('alive engine respawns after five seconds in Engine Interior at sixty percent HP',()=>{
 const {g,events}=run();g.player.x=14;g.player.roof=true;g.player.layer=LAYER.ROOF;g.player.y=ROOF;g.hurt(100,'crane');
 tick(g,4.975);assert.equal(g.player.lifeState,LIFE.DEAD);assert.equal(g.player.hp,0);
 tick(g,.025);assert.equal(g.player.lifeState,LIFE.PROTECTED);assert.equal(g.player.x,V11.respawnX);assert.equal(g.playerLayer,LAYER.INTERIOR);assert.equal(g.player.y,FLOOR);assert.equal(g.player.z,.65);assert.equal(g.player.hp,60);assert.equal(g.player.protection,2);
 assert.equal(events.filter(e=>e.type==='respawn_complete').length,1);
});
test('spawn protection lasts two seconds and protects Player only',()=>{
 const {g}=run();g.killPlayer();tick(g,5);g.hurt(99,'bruiser');assert.equal(g.player.hp,60);
 const hp=g.cars[0].hp;g.damageCar(0,15,'saboteur');assert.equal(g.cars[0].hp,hp-15);
 tick(g,1.975);g.hurt(99,'bruiser');assert.equal(g.player.hp,60);assert(g.player.protection>0);
 tick(g,.025);assert.equal(g.player.lifeState,LIFE.ALIVE);assert.equal(g.player.protection,0);g.hurt(10,'boarder');assert.equal(g.player.hp,50);
});
test('normal death preserves run Scrap, both weapon slots and Bank',()=>{
 const {g}=run();g.scrap=83;g.meleeTier=3;g.rangedTier=2;g.killPlayer();tick(g,5);
 assert.equal(g.scrap,83);assert.equal(g.meleeTier,3);assert.equal(g.rangedTier,2);assert.equal(g.bank,9876);
});
test('death on train drops the held crate on the same floor with the same identity and value',()=>{
 const {g}=run();g.player.x=12;const crate=g.createCargo(450,'stored',{carIndex:1,secured:true});assert(g.pickupCargo(crate));g.killPlayer();
 assert.equal(crate.location,'floor');assert.equal(crate.carIndex,1);assert.equal(crate.x,12);assert.equal(crate.value,450);assert.equal(g.player.carry,false);assert.equal(g.cargoValue,450);
 tick(g,5);g.player.x=12;assert(g.interact());assert.equal(g.heldCargo.id,crate.id);assert(g.interact());assert.equal(g.cars[1].cargo,1);assert.equal(g.cargoValue,450);
});
test('HP death on a Depot permanently loses only the hand crate, not stored cargo',()=>{
 const {g}=run();g.t=.26;g.player.x=5.8;g.setSpeed('STOP');g.player.x=12.45;assert(g.layer());assert(g.interact());assert(g.interact());const hand=g.heldCargo;
 const stored=g.createCargo(450,'stored',{carIndex:1,secured:true});const bank=g.bank;g.hurt(100,'future_depot_hazard');
 assert.equal(g.player.lifeState,LIFE.DEAD);assert.equal(hand.location,'lost');assert.equal(stored.location,'stored');assert.equal(g.player.carry,false);assert.equal(g.bank,bank);
});
test('world movement, existing enemy system damage and director timers continue while dead',()=>{
 const {g}=run();const enemy=g.spawn('boarder',4.1,false);enemy.climb=0;g.killPlayer();const t=g.t,hp=g.cars[0].hp;
 tick(g,2);assert(g.t>t);assert(g.cars[0].hp<hp);assert(g.enemies.some(e=>e.id===enemy.id));assert(g.director.rest<8);assert(g.player.respawnRemaining<5);assert.equal(g.status,'running');
});
test('a stalled nonterminal Engine permits ordinary respawn without resetting its rescue clock',()=>{
 const {g}=run();g.damageCar(0,180);const rescue=g.rescue,entered=rescue.entered;g.killPlayer();tick(g,5);
 assert.equal(g.engineState,'stalled');assert.equal(g.terminalDestroyed,false);assert.equal(g.player.lifeState,LIFE.PROTECTED);assert.equal(g.player.hp,60);assert.equal(g.rescue,rescue);assert.equal(g.rescue.entered,entered);close(g.rescue.remaining,3);
});
test('Engine rescue deadline before respawn cancels respawn and fails the run once',()=>{
 const {g,events}=run();g.damageCar(0,180);tick(g,6);const entered=g.rescue.entered;g.killPlayer();tick(g,2);
 assert.equal(g.status,'lost');assert.equal(g.player.lifeState,LIFE.FAILED);assert.equal(g.terminalDestroyed,true);assert.equal(g.player.respawnRemaining,0);assert.equal(g.rescue.entered,entered);assert.equal(g.bank,9876);
 tick(g,10);assert.equal(events.filter(e=>e.type==='respawn_cancel_engine_failure').length,1);assert.equal(events.filter(e=>e.type==='respawn_complete').length,0);assert.equal(events.filter(e=>e.type==='run_failed').length,1);
});
test('a simultaneous Engine deadline wins over respawn; no transient resurrection event',()=>{
 const {g,events}=run();g.damageCar(0,180);tick(g,3);g.killPlayer();tick(g,5);
 assert.equal(g.status,'lost');assert.equal(g.player.lifeState,LIFE.FAILED);assert.equal(events.filter(e=>e.type==='respawn_complete').length,0);assert.equal(events.filter(e=>e.type==='respawn_cancel_engine_failure').length,1);
});
test('repeated death requests during waiting never extend Engine or Player deadlines',()=>{
 const {g}=run();g.damageCar(0,180);g.killPlayer();const deadline=g.player.respawnAt,entered=g.rescue.entered;
 for(let i=0;i<120;i++){g.killPlayer('train_lost');g.hurt(100,'test');g.step(.025);}
 assert.equal(g.player.respawnAt,deadline);assert.equal(g.rescue.entered,entered);close(g.rescue.remaining,5);close(g.player.respawnRemaining,2);
});
test('arrival and summary do not erase or freeze a remaining respawn countdown',()=>{
 const {g}=run();g.killPlayer();g.finish();tick(g,4);assert.equal(g.status,'complete');assert.equal(g.player.lifeState,LIFE.DEAD);close(g.player.respawnRemaining,1);assert(!g.more());
 tick(g,1);assert.equal(g.player.lifeState,LIFE.PROTECTED);assert.equal(g.player.hp,60);assert.equal(g.playerLayer,LAYER.INTERIOR);assert(g.more());
});
test('a second ordinary death after protection starts a new five-second countdown',()=>{
 const {g}=run();g.killPlayer();tick(g,7);g.hurt(100,'bruiser');assert.equal(g.player.deathCount,2);assert.equal(g.player.lifeState,LIFE.DEAD);assert.equal(g.player.respawnRemaining,5);
});
