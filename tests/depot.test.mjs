import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,car,FLOOR,ROOF} from '../src/sim.js';
import {V11} from '../src/balance.js';
import {depotPose} from '../src/contracts.js';
const advance=(g,t,input={})=>{for(let remaining=t;remaining>1e-8;remaining-=.025)g.step(Math.min(.025,remaining),input);};
function depot(mode='STOP',route='freight'){
 const g=new Game();g.chooseRoute(route);g.chooseCar('cargo');g.start();advance(g,3);
 g.t=V11.routes[route].depots[0];g.player.x=V11.consoleX;assert(g.setSpeed(mode));
 g.player.x=V11.depot.anchorX;assert(g.layer());assert(g.interact());return g;
}
function moveLocal(g,x){const delta=x-g.player.depotX;advance(g,Math.abs(delta)/(g.player.carry?2.8:5.1),{move:Math.sign(delta)});}
function takeAndLoad(g,localX){moveLocal(g,localX);assert(g.interact());moveLocal(g,0);assert(g.interact());assert.equal(g.playerLayer,'ROOF');assert(g.interact());}
test('new cargo car provides three empty slots, not free loot',()=>{const g=new Game();g.chooseRoute('freight');g.chooseCar('cargo');assert.equal(g.cargoUsed,0);assert.equal(g.cargoCapacity,3);g.cars.push(car('cargo'));assert.equal(g.cargoCapacity,6);});
test('all routes contain physical depot content at roof height, behind the train',()=>{for(const route of ['industrial','freight','tunnel']){const g=new Game();g.chooseRoute(route);assert.equal(g.depots.length,route==='freight'?2:1);const d=g.depots[0],pose=depotPose(d.marker,d.marker);assert.equal(ROOF,4.12);assert(pose.z< -1.5);assert.equal(pose.x,V11.depot.anchorX);assert(g.cargoCrates.some(c=>c.location==='depot'));}});
test('STOP pickup -> bridge return -> roof loading hatch credits exact physical crate',()=>{const g=depot(),before=g.money;takeAndLoad(g,1);assert.equal(g.cargoUsed,1);assert.equal(g.cars[1].cargo,1);assert.equal(g.cargoValue,450);assert.equal(g.money,before+450);assert.equal(g.player.carry,false);assert.equal(g.t,.26);});
test('full cargo blocks fourth pickup without deleting the crate',()=>{const g=depot();for(const x of [1,-3,5]){takeAndLoad(g,x);assert(g.interact());}moveLocal(g,9);const count=g.cargoCrates.filter(c=>c.location==='depot').length;assert.equal(g.interact(),false);assert.equal(g.cargoUsed,3);assert.match(g.event,/CARGO FULL/);assert.equal(g.cargoCrates.filter(c=>c.location==='depot').length,count);});
test('CRUISE and FAST reject actual boarding interaction',()=>{for(const speed of ['CRUISE','FAST']){const g=new Game();g.chooseRoute('freight');g.chooseCar('cargo');g.start();g.elapsed=3;g.t=.26;g.player.x=5.8;g.setSpeed(speed);g.player.x=12.45;assert(g.layer());assert(!g.interact());assert.equal(g.playerLayer,'ROOF');assert.equal(g.event,'TOO FAST TO BOARD DEPOT');}});
test('SLOW moves the platform relative to train while the player stays platform-local',()=>{const g=depot('SLOW'),before=g.player.x;advance(g,1);assert(g.player.x>before+3);assert.equal(g.player.depotX,0);assert.equal(g.player.y,ROOF);assert.equal(g.playerLayer,'DEPOT');});
test('unattended SLOW causes TRAIN LOST and permanently loses hand cargo',()=>{const events=[];const g=depot('SLOW');g.emit=t=>events.push(t);assert(g.interact());const id=g.player.carry;advance(g,8.5);assert.equal(g.player.lifeState,'DEAD_WAITING_RESPAWN');assert.equal(g.cargoCrates.find(c=>c.id===id).location,'lost');assert.equal(g.player.carry,false);assert(events.includes('train_lost'));assert.equal(g.status,'running');});
test('STOP never auto-departs; acceleration at a depot is rejected',()=>{const g=depot(),t=g.t;assert(!g.setSpeed('SLOW'));advance(g,10);assert.equal(g.t,t);assert.equal(g.speedMode,'STOP');assert.equal(g.playerLayer,'DEPOT');});
test('loaded cargo survives rounds and cashout banks its value once',()=>{const g=depot();takeAndLoad(g,1);g.finish();advance(g,4);const amount=g.money;assert(g.cashout());assert.equal(g.bank,amount);assert.equal(g.cargoValue,0);assert.equal(g.cargoUsed,0);assert(!g.cashout());});
