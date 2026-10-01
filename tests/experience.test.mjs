import test from 'node:test';import assert from 'node:assert/strict';
import {Game} from '../src/sim.js';import {V11} from '../src/balance.js';
import {shipmentMessage} from '../src/playability_ui.js';
import {carryBonus,careerComparison} from '../src/career.js';
const tick=(g,n,input={})=>{for(let t=0;t<n-1e-8;t+=.025)g.step(.025,input);};
function armed(id='handgun'){const g=new Game({career:{kit:1}});g.chooseRoute('freight');g.chooseCar('cargo');g.start();g.director.rest=999;g.player.x=V11.armoryX;g.scrap=200;g.openArmory();g.buyWeapon('ranged',id);g.closeArmory();return g;}
test('handgun empty magazine creates a readable response window, permits movement and reloads automatically',()=>{
 const g=armed();for(let i=0;i<6;i++){assert(g.rangedAttack());if(i<5)tick(g,V11.weapons.handgun.cooldown+.005);}
 assert.equal(g.rangedMagazine.rounds,0);assert(g.rangedMagazine.reloadRemaining>1);assert(!g.rangedAttack());const x=g.player.x;tick(g,.5,{move:1});assert(g.player.x>x);assert(!g.rangedAttack());tick(g,.675);assert.equal(g.rangedMagazine.rounds,6);assert(g.rangedAttack());
});
test('weapon switches, manual pause and armory comparisons cannot refill or accelerate a magazine',()=>{
 const g=armed();assert(g.rangedAttack());assert.equal(g.rangedMagazine.rounds,5);g.player.x=V11.armoryX;g.openArmory();g.buyWeapon('ranged','shotgun');g.equipWeapon('ranged','handgun');assert.equal(g.rangedMagazine.rounds,5);const time=g.elapsed;tick(g,20);assert.equal(g.elapsed,time);assert.equal(g.rangedMagazine.rounds,5);g.closeArmory();g.pause(true);tick(g,20);assert.equal(g.rangedMagazine.rounds,5);g.pause(false);g.fail();assert.equal(Object.keys(g.magazines).length,0);
});
test('each firearm retains its own distinct magazine and reload specification',()=>{
 for(const id of ['handgun','smg','rifle','shotgun']){const g=armed(id);assert.equal(g.rangedMagazine.max,V11.weapons[id].magazine);for(let i=0;i<V11.weapons[id].magazine;i++){assert(g.rangedAttack());if(i<V11.weapons[id].magazine-1)tick(g,V11.weapons[id].cooldown+.005);}assert.equal(g.rangedMagazine.rounds,0);assert(Math.abs(g.rangedMagazine.reloadRemaining-V11.weapons[id].reload)<1e-8);}
});
test('cargo receipt celebrates value without pretending it is banked or double crediting a recovery',()=>{
 const g=armed();g.cargoChange={kind:'recovered',value:450,at:g.elapsed};g.money=1900;g.bank=550;const message=shipmentMessage(g);assert.match(message.title,/450/);assert.match(message.detail,/1,900/);assert.match(message.detail,/550/);assert.match(message.detail,/保住货物/);assert.equal(g.money,1900);tick(g,4.6);assert.equal(shipmentMessage(g),null);g.fail();assert.equal(shipmentMessage(g),null);
});
test('first carrying upgrade changes speed substantially and further levels remain bounded',()=>{assert.equal(carryBonus(0),0);assert.equal(carryBonus(1),.8);assert.equal(carryBonus(3),1.6);assert.equal(carryBonus(30),1.6);assert.match(careerComparison('boots',0),/2.8.*3.6/);});
test('entering the next route rebases unfinished reload without granting extra rounds',()=>{
 const g=armed('shotgun');g.elapsed=170;assert(g.rangedAttack());tick(g,.875);assert(g.rangedAttack());g.finish();g.completeArrival();assert(g.more());g.chooseRoute('industrial');g.chooseCar('cargo');assert(g.start());assert.equal(g.elapsed,0);assert.equal(g.rangedMagazine.rounds,0);assert(Math.abs(g.rangedMagazine.reloadRemaining-1.3)<1e-8);tick(g,1.325);assert.equal(g.rangedMagazine.rounds,2);assert(g.rangedAttack());
});
test('affordable handgun cannot defend the entire train from the armory; moving to cargo restores useful damage',()=>{
 const g=armed();g.player.face=1;const e=g.spawn('thief',12.8,false);e.climb=0;g.rangedAttack();for(let i=0;i<32;i++)g.projectileStep(.025);assert.equal(e.hp,V11.enemies.thief.hp);tick(g,.5);g.player.x=9;g.player.face=1;assert(g.rangedAttack());for(let i=0;i<32;i++)g.projectileStep(.025);assert(e.hp<V11.enemies.thief.hp);assert(V11.weapons.rifle.range>V11.weapons.handgun.range*2);
});
