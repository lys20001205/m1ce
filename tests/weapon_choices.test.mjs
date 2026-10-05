import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/sim.js';
import {V11} from '../src/balance.js';
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function run(seed=11){const events=[],g=new Game({seed,emit:(type,data)=>events.push({type,...data})});g.chooseRoute('freight');g.chooseCar('cargo');g.start();g.round=8;g.director.rest=999;return {g,events};}
function arm(g,scrap=200){g.player.x=V11.armoryX;g.scrap=scrap;assert(g.openArmory());}
function enemy(g,x,type='bruiser',roof=false){const e=g.spawn(type,x,roof);assert(e);e.climb=0;return e;}
function flight(g,seconds=.8){for(let t=0;t<seconds;t+=.025)g.projectileStep(.025);}

test('a kit equipped after pre-run HUD initialization becomes owned without a purchase',()=>{
 const g=new Game();assert.deepEqual(g.weaponInventory.ranged,[]);g.rangedTier=1;assert.deepEqual(g.weaponInventory.ranged,['handgun']);assert.equal(g.scrap,0);
});

test('a player can choose shotgun first, retain it and switch without paying twice',()=>{
 const {g,events}=run();arm(g,26);assert.equal(g.melee.id,'wrench');assert(g.buyWeapon('ranged','shotgun'));assert.equal(g.scrap,12);assert.equal(g.ranged.id,'shotgun');
 assert(g.buyWeapon('ranged','handgun'));assert.equal(g.scrap,0);assert.deepEqual(g.weaponInventory.ranged,['shotgun','handgun']);
 assert(g.equipWeapon('ranged','shotgun'));assert.equal(g.ranged.id,'shotgun');assert(g.buyWeapon('ranged','handgun'));assert.equal(g.scrap,0);
 assert.equal(events.filter(e=>e.type==='armory_purchase').length,2);assert(!g.equipWeapon('ranged','rifle'));assert(!g.buyWeapon('ranged','axe'));
 const inventory=g.weaponInventory;inventory.ranged.push('rifle');assert(!g.weaponInventory.ranged.includes('rifle'));
 assert.equal(g.armoryOffer('ranged').weapon,'smg');assert.equal(g.combatProgress.ownedCount,3);assert.equal(g.combatProgress.next.find(o=>o.slot==='ranged').remaining,24);
});

test('switching requires an open live armory and cannot bypass carry, death or travel',()=>{
 const {g}=run();arm(g);assert(g.buyWeapon('ranged','handgun'));assert(g.buyWeapon('ranged','shotgun'));g.closeArmory();assert(!g.equipWeapon('ranged','handgun'));
 assert(g.openArmory());g.player.carry=999;assert(!g.equipWeapon('ranged','handgun'));g.player.carry=false;g.player.x=8;assert(!g.equipWeapon('ranged','handgun'));
 g.player.x=V11.armoryX;g.killPlayer();assert(!g.equipWeapon('ranged','handgun'));
});

test('death and next round retain all owned choices; ending the run clears inventory',()=>{
 const {g}=run();arm(g);g.buyWeapon('ranged','shotgun');g.buyWeapon('ranged','handgun');const owned=g.weaponInventory;
 g.killPlayer();for(let t=0;t<5.1;t+=.025)g.step(.025);assert.deepEqual(g.weaponInventory,owned);
 g.finish();for(let t=0;t<4.1;t+=.025)g.step(.025);assert(g.more());assert.deepEqual(g.weaponInventory,owned);
 g.chooseRoute('industrial');g.chooseCar('cargo');g.start();g.fail();assert.deepEqual(g.weaponInventory,{melee:['wrench'],ranged:[]});
});

for(const face of [-1,1])test(`rifle pierces exactly three targets nearest first and never re-hits, face ${face}`,()=>{
 const {g,events}=run();arm(g);assert(g.buyWeapon('ranged','rifle'));g.closeArmory();g.player.x=face===1?3:13;g.player.face=face;
 // Reverse spawn order verifies that ordering is spatial, not enemy array order.
 const targets=[4,3,2,1].map(distance=>enemy(g,g.player.x+distance*face));assert(g.rangedAttack());flight(g);
 const byDistance=[...targets].reverse();near(byDistance[0].hp,60);near(byDistance[1].hp,76);near(byDistance[2].hp,88.8);assert.equal(byDistance[3].hp,140);
 assert.deepEqual(events.filter(e=>e.type==='enemy_hit').map(e=>e.id),byDistance.slice(0,3).map(e=>e.id));assert.equal(g.projectiles.length,0);
});

test('piercing rifle still excludes boarding, different-layer and behind-player enemies',()=>{
 const {g}=run();arm(g);g.buyWeapon('ranged','rifle');g.closeArmory();g.player.x=3;g.player.face=1;
 const behind=enemy(g,2.5),roof=enemy(g,4,'bruiser',true),boarding=enemy(g,4.5),valid=enemy(g,5);boarding.climb=1;
 g.rangedAttack();flight(g);assert.equal(behind.hp,140);assert.equal(roof.hp,140);assert.equal(boarding.hp,140);assert.equal(valid.hp,60);
});

test('shotgun emits five visible trajectories, kills a close light pair, and awards each kill once',()=>{
 const {g:visual}=run();arm(visual);visual.buyWeapon('ranged','shotgun');visual.closeArmory();visual.rangedAttack();visual.projectileStep(.025);assert.equal(new Set(visual.projectiles.map(p=>p.y)).size,5);
 const {g,events}=run();arm(g);g.buyWeapon('ranged','shotgun');g.closeArmory();g.player.x=3;g.player.face=1;
 const a=enemy(g,4,'thief'),b=enemy(g,4.7,'thief');g.rangedAttack();assert.equal(g.projectiles.length,5);g.projectileStep(.025);
 flight(g);assert.equal(a.hp,0);assert.equal(b.hp,0);assert.equal(g.scrap,200-14+6);
 assert.equal(events.filter(e=>e.type==='scrap_gain').length,2);assert.equal(events.filter(e=>e.type==='projectile_spawn')[0].pellets,5);
});

test('shotgun has useful near burst, weaker distant burst and finite range',()=>{
 function damage(distance){const {g}=run();arm(g);g.buyWeapon('ranged','shotgun');g.closeArmory();g.player.x=2;const m=g.muzzle(),e=enemy(g,m.x+distance);g.rangedAttack();flight(g);return 140-e.hp;}
 const close=damage(2),far=damage(7);assert(close>=64);assert(far>0&&far<close*.65,`${close} / ${far}`);assert.equal(damage(8.5),0);
});

test('six natural full-health boarder kills can buy a first gun without mandatory melee purchases',()=>{
 const {g}=run();g.round=1;g.t=.1;g.player.x=3;g.player.face=1;
 for(let n=0;n<6;n++){const e=enemy(g,3.8,'boarder');for(let t=0;t<2;t+=.025)g.step(.025,{attack:true});assert.equal(e.hp,0);g.player.x=3;g.player.face=1;}
 assert.equal(g.scrap,12);g.player.x=V11.armoryX;assert(g.openArmory());assert(g.buyWeapon('ranged','handgun'));assert.equal(g.melee.id,'wrench');assert.equal(g.ranged.id,'handgun');assert.equal(g.scrap,0);
});


test('both menu summaries describe the actual ranged limits and reload costs',async()=>{
 const {weaponSummary}=await import('../src/weapon_presentation.js');
 for(const id of ['handgun','smg','rifle','shotgun']){
   const {name,detail}=weaponSummary(id),spec=V11.weapons[id];
   assert(name.includes(id==='rifle'?'PIERCING RIFLE':id.toUpperCase()));
   assert(detail.includes(`${spec.range}m`));assert(detail.includes(`${spec.magazine} 发`));
   assert(detail.includes(`自动装填 ${spec.reload}s`));
 }
 assert(weaponSummary('shotgun').detail.includes(`${V11.weapons.shotgun.falloffStart}m 后减伤`));
 assert(weaponSummary('shotgun').detail.includes(`${V11.weapons.shotgun.pellets} 弹丸`));
 assert(weaponSummary('rifle').detail.includes(`穿透 ${V11.weapons.rifle.pierce} 名敌人 · 逐个减伤`));
 assert(weaponSummary('smg').detail.includes('快速连射'));
 for(const id of ['wrench','knife','axe'])assert(weaponSummary(id).detail.includes(`攻击间隔 ${V11.weapons[id].cooldown}s`));
});
