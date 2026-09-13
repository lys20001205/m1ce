// V10 playtest values, not measured completion-rate claims. One source for tuning.
export const BUILD = 'V10-RECOVERY-20260913';
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
