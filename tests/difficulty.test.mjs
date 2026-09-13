import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/sim.js';
function tick(g,seconds){for(let i=0;i<Math.round(seconds/.025);i++)g.step(.025);}
test('staying critical never becomes permanent spawn immunity',()=>{
 const g=new Game({seed:314159});g.start();g.round=5;g.t=.121;g.phase='yard';g.cars[0].hp=20;g.player.roof=true;g.player.y=4.12;
 tick(g,.025);assert(g.director.rest>7);assert.equal(g.enemies.length,0);
 tick(g,7);assert.equal(g.enemies.length,0);
 tick(g,7);assert.equal(g.director.rest,0);assert(g.enemies.length>0);
 assert(g.director.load(g)<=g.director.effectiveCap(g));
});
test('healing and redropping health cannot farm repeated distress windows',()=>{
 const g=new Game();g.start();g.round=4;g.t=.12;g.cars[0].hp=20;tick(g,.025);
 g.director.rest=0;g.cars[0].hp=180;tick(g,.025);g.cars[0].hp=20;tick(g,.025);
 assert.equal(g.director.rest,0);assert.equal(g.director.distressOffered,true);
});
