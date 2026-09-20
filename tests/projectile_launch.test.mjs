import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/sim.js';
import {V11} from '../src/balance.js';
function setup(tier=3,face=1,roof=false){
 const events=[];const g=new Game({seed:1,emit:(type,data)=>events.push({type,...data})});
 g.chooseRoute('freight');g.chooseCar('cargo');g.start();g.round=8;g.director.rest=999;
 g.meleeTier=3;g.rangedTier=tier;g.player.x=5;g.player.face=face;g.setPlayerLayer(roof?'ROOF':'INTERIOR');
 return {g,events};
}
function enemy(g,x,roof=g.player.roof){const e=g.spawn('bruiser',x,roof);assert(e);e.climb=0;return e;}
for(const tier of [1,2,3])for(const face of [-1,1])for(const distance of [.5,1.3]){
 test(`launch sweep hits tier ${tier} face ${face} distance ${distance}`,()=>{
  const {g}=setup(tier,face);const e=enemy(g,5+face*distance),hp=e.hp,m=g.muzzle();
  assert(g.rangedAttack());const b=g.projectiles[0];assert.equal(b.x,m.x);assert.equal(b.origin,m.x);
  assert.equal(b.range,g.rangedStats.range);assert.equal(b.damage,g.rangedStats.damage);
  g.projectileStep(.025);assert.equal(e.hp,hp-g.rangedStats.damage);assert.equal(g.projectiles.length,0);
 });
}
for(const face of [-1,1])test(`launch rejects targets behind player face ${face}`,()=>{
 const {g}=setup(3,face),e=enemy(g,5-face*.1),hp=e.hp;g.rangedAttack();g.projectileStep(.025);assert.equal(e.hp,hp);
});
for(const face of [-1,1])test(`launch stops at nearest eligible target face ${face}`,()=>{
 const {g}=setup(3,face),far=enemy(g,5+face*1.2),close=enemy(g,5+face*.4);g.rangedAttack();g.projectileStep(.025);
 assert.equal(close.hp,140-80);assert.equal(far.hp,140);
});
for(const excluded of ['other-layer','boarding','layer-move'])test(`launch preserves ${excluded} immunity`,()=>{
 const {g}=setup(),e=enemy(g,5.5,excluded==='other-layer');if(excluded==='boarding')e.climb=.2;
 if(excluded==='layer-move')e.layerMove={};g.rangedAttack();g.projectileStep(.025);assert.equal(e.hp,140);
});
test('roof launch uses the same close-contact rule',()=>{const {g}=setup(3,1,true),e=enemy(g,5.5);g.rangedAttack();g.projectileStep(.025);assert.equal(e.hp,60);});
test('launch corridor is checked only once and never follows player movement',()=>{
 const {g}=setup();g.rangedAttack();const b=g.projectiles[0];g.projectileStep(.025);const e=enemy(g,5.5);g.player.x=9;g.player.face=-1;
 g.projectileStep(.025);assert.equal(e.hp,140);assert(b.x>b.origin);assert.equal(b.dir,1);
});
test('ordinary flight beyond the muzzle remains swept and range-limited',()=>{
 const {g}=setup(1);g.rangedAttack();const origin=g.projectiles[0].origin,e=enemy(g,origin+4);
 for(let n=0;n<20;n++)g.projectileStep(.025);assert.equal(e.hp,140-23);
 const {g:h}=setup(3);h.rangedAttack();const b=h.projectiles[0],distant=enemy(h,b.origin+b.range+.5);
 for(let n=0;n<40;n++)h.projectileStep(.025);assert.equal(distant.hp,140);assert.equal(h.projectiles.length,0);
});
test('point-blank lethal shot awards Scrap exactly once',()=>{
 const {g,events}=setup();const e=g.spawn('boarder',5.5,false);e.climb=0;g.rangedAttack();g.projectileStep(.025);g.projectileStep(.025);
 assert.equal(e.hp,0);assert.equal(g.scrap,V11.enemies.boarder.scrap);assert.equal(events.filter(e=>e.type==='scrap_gain').length,1);
});
