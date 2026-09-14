// V10 playtest values, not measured completion-rate claims. One source for tuning.
export const BUILD = 'V11-E-LIFE-20260914';
export const B = Object.freeze({
  walk: 5.1, roofSpeed: 1.25, carrySpeed: 2.8,
  repairTime: 1.8, repairHP: 28, repairRadius: 1.9, repairCooldown: .3,
  restartTime: 3, rescueMinimum: 8, rescueMargin: 1.5, restartFraction: .20,
  restartShield: 4, workshopSpeed: 1.25, poweredWorkshopSpeed: 1.20,
  damagedSpeed: .92, criticalSpeed: .80,
  recoveryTime: 8, arrivalTime: 4,
  craneLead: 4, tunnelLead: 6,
  caps: [2, 3, 4, 5, 6], spawnIntervals: [8.5, 8, 7, 6, 5.2],
  faultLead: 3, faultTime: 6, faultDPS: 6,
  boostTime: 4, boostScale: 1.65, boostCost: 35,
  cargoValue: 250
});
export const stationX = (index, length=8.3) => index*length + (index===0 ? 5.8 : 4.15);
export const engineBand = c => c.hp<=0 ? 'stalled' : c.hp/c.max<=.25 ? 'critical' : c.hp/c.max<=.50 ? 'damaged' : 'normal';
export const capFor = round => B.caps[Math.min(4,Math.max(0,round-1))] + Math.min(2,Math.max(0,round-5));
export const reserveFor = round => round===1 ? 1 : 2;
export const intervalFor = round => B.spawnIntervals[Math.min(4,Math.max(0,round-1))];

// V11 contract tuning. Kept separate during the validated V10 -> V11 handover.
export const V11 = Object.freeze({
  duration:140,turntableSeconds:3,maxCars:12,step:.025,maxFrame:.10,
  speeds:Object.freeze({STOP:{speed:0,pressure:1.8},SLOW:{speed:.35,pressure:1.35},CRUISE:{speed:1,pressure:1},FAST:{speed:1.5,pressure:.8}}),
  caps:[3,4,5,6,7,8],spawnIntervals:[4.8,4.5,4.1,3.8,3.5,3.2],
  routeWeights:{industrial:{boarder:5,clinger:3,thief:1,saboteur:5,bruiser:1},freight:{boarder:5,clinger:2,thief:6,saboteur:2,bruiser:1},tunnel:{boarder:4,clinger:5,thief:1,saboteur:2,bruiser:5}},
  firstSpecialWeight:.28,cargoThiefWeight:.6,enemyLimit:16,
  cargoSlots:3,playerMaxHP:100,respawnSeconds:5,respawnFraction:.6,spawnProtection:2,hitProtection:.6,
  engineCharge:100,batteryCharge:100,fastDrain:12,consoleX:5.8,consoleRadius:1.9,armoryX:1.7,armoryRadius:1.35,respawnX:3,
  stopQuota:6,reinforcementReward:.25,workshopHeal:20,workshopCost:120,kitSpeed:2,
  prep:{reroll:{cost:3000,max:3},repairKit:{cost:5000,max:1},intel:{cost:4000,max:1}},
  world:{radius:220,segments:40,nearCull:105,farCull:400,lod:65,dpr:1.6},
  depot:{anchorX:12.45,z:-5.8,width:24,depth:4,boardRadius:2.4,connectionLimit:28,crateRadius:1.2,bridgeRadius:2.5,crateXs:[-7,-3,1,5,9]},
  routes:{
    industrial:{gateAngle:-.42,depots:[.66],crates:4,value:300,crane:[.34,.40,.48],fault:.15},
    freight:{gateAngle:0,depots:[.26,.66],crates:5,value:450,crane:[.43,.49,.55],fault:null},
    tunnel:{gateAngle:.42,depots:[.20],crates:4,value:275,tunnel:[.31,.38,.76],fault:null}
  },
  enemies:{
    boarder:{hp:45,scrap:2,speed:1.75,damage:9,windup:.65,recovery:.9,reach:1.2,knockback:1,stun:1},
    clinger:{hp:35,scrap:3,speed:1.95,damage:8,windup:.7,recovery:1,reach:1.2,knockback:1,stun:1,attach:.65,climb:1.3},
    thief:{hp:30,scrap:3,speed:2.1,escapeSpeed:2.8,damage:6,windup:.8,recovery:1,reach:1.1,knockback:1,stun:1},
    saboteur:{hp:40,scrap:4,speed:1.6,damage:20,windup:1.4,recovery:1.3,reach:1.2,knockback:.8,stun:1},
    bruiser:{hp:140,scrap:6,speed:.85,damage:24,windup:1.5,recovery:1.4,reach:1.65,knockback:.15,stun:.3,wrenchArmor:.45}
  },
  weapons:{
    wrench:{cost:0,damage:22,cooldown:.52,active:.16,duration:.36,range:1.85,knockback:.45},
    knife:{cost:10,damage:16,cooldown:.25,active:.07,duration:.20,range:1.6,knockback:.20},
    axe:{cost:20,damage:54,cooldown:.88,active:.32,duration:.66,range:2.25,knockback:1.10},
    handgun:{cost:12,damage:23,cooldown:.42,range:12,velocity:35,knockback:.25},
    smg:{cost:24,damage:12,cooldown:.12,range:13,velocity:42,knockback:.10},
    rifle:{cost:40,damage:80,cooldown:1.05,range:24,velocity:60,knockback:.65}
  }
});
