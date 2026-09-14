// Declarative content identities. Numbers live in balance.js; state writes live in sim.js.
const freeze = value => { for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child); return Object.freeze(value); };
export const LIFE = freeze({ALIVE:'ALIVE',DEAD:'DEAD_WAITING_RESPAWN',RESPAWNING:'RESPAWNING',PROTECTED:'ALIVE_PROTECTED',FAILED:'RUN_FAILED'});
export const LAYER = freeze({INTERIOR:'INTERIOR',ROOF:'ROOF',DEPOT:'DEPOT'});
export const SPEED_MODES = freeze(['STOP','SLOW','CRUISE','FAST']);
export const ROUTES = freeze({
  industrial:{id:'industrial',name:'INDUSTRIAL LOOP',gate:'INDUSTRIAL GATE',theme:'Machinery / Saboteurs',cargo:'Medium',threat:'Medium',recommended:'workshop',firstEnemies:['boarder','saboteur'],intel:'CRANE SWEEP AT 40% · DEPOT AT 66%'},
  freight:{id:'freight',name:'FREIGHT LOOP',gate:'FREIGHT GATE',theme:'Cargo / Thieves',cargo:'High',threat:'Medium',recommended:'cargo',firstEnemies:['boarder','thief'],intel:'TWO HIGH-VALUE DEPOTS · 26% AND 66%'},
  tunnel:{id:'tunnel',name:'TUNNEL LOOP',gate:'TUNNEL GATE',theme:'Low Clearance / Power',cargo:'Low-Medium',threat:'High',recommended:'battery',firstEnemies:['boarder','clinger'],intel:'DEPOT AT 20% · LOW CLEARANCE 38%–76%'}
});
export const CARS = freeze({engine:{name:'ENGINE',utility:'console / armory / respawn'},cargo:{name:'CARGO',utility:'+3 slots · freight loot'},battery:{name:'BATTERY',utility:'FAST storage · lighting · powered repair'},workshop:{name:'WORKSHOP',utility:'faster repair · local fault recovery'}});
export const ENEMIES = freeze({boarder:{name:'BOARDER',behavior:'pursue_player'},clinger:{name:'CLINGER',behavior:'attach_climb_roof'},thief:{name:'THIEF',behavior:'steal_then_escape'},saboteur:{name:'SABOTEUR',behavior:'windup_system_damage'},bruiser:{name:'BRUISER',behavior:'armored_heavy_windup'}});
export const WEAPONS = freeze({
  melee:[{id:'wrench',name:'WRENCH'},{id:'knife',name:'KNIFE'},{id:'axe',name:'AXE'}],
  ranged:[{id:'handgun',name:'HANDGUN'},{id:'smg',name:'SMG'},{id:'rifle',name:'HIGH-DAMAGE RIFLE'}]
});
export const PREP_ITEMS = freeze({reroll:{name:'REROLL TOKEN',description:'Reroll the next car offer once'},repairKit:{name:'EMERGENCY REPAIR KIT',description:'One faster emergency restart next run'},intel:{name:'ROUTE INTEL',description:'Reveal one actual route event at the next route choice'}});
export const INPUT_BINDINGS_SSOT = freeze({
  left:{label:'MOVE LEFT',keys:['KeyA','ArrowLeft'],display:'A / ←',button:'L',hold:true},
  right:{label:'MOVE RIGHT',keys:['KeyD','ArrowRight'],display:'D / →',button:'R',hold:true},
  climb:{label:'CLIMB / RETURN',keys:['KeyW','ArrowUp'],display:'W / ↑',button:'layer'},
  interact:{label:'INTERACT',keys:['KeyF'],display:'F',button:'interact'},
  melee:{label:'MELEE',keys:['KeyJ','Space'],display:'J / SPACE',button:'attack',hold:true},
  ranged:{label:'RANGED',keys:['KeyK'],display:'K',button:'ranged',hold:true},
  repair:{label:'REPAIR',keys:['KeyE'],display:'E',button:'fix',hold:true},
  brake:{label:'EMERGENCY BRAKE',keys:['KeyB'],display:'B',button:'brake'}
});
