import {V11} from './balance.js';
import {LIFE,ROUTES,SPEED_MODES,WEAPONS} from './content.js';
export const cargoCapacity = cars => cars.filter(c=>c.type==='cargo').length*V11.cargoSlots;
export const threatCap = (round,repeat=false) => V11.caps[Math.min(V11.caps.length-1,Math.max(0,Math.floor(round)-1))]+(repeat?1:0);
export const weaponAt = (slot,tier) => WEAPONS[slot]?.[tier-1] || null;
export const weaponStats = (slot,tier) => V11.weapons[weaponAt(slot,tier)?.id] || null;
export const isAlive = state => state===LIFE.ALIVE || state===LIFE.PROTECTED;
export const canRespawn = terminal => !terminal;
export const scrapReward = (type,priorKills=0) => Math.max(1,Math.floor(V11.enemies[type].scrap*(priorKills>=V11.stopQuota?V11.reinforcementReward:1)));
export function cleanPrep(value={}) {return Object.fromEntries(Object.entries(V11.prep).map(([k,v])=>[k,Math.max(0,Math.min(v.max,Math.floor(Number(value?.[k])||0)))]));}
export function validateChoice(route,speed){return !!ROUTES[route]&&SPEED_MODES.includes(speed);}
// Shared simulation/rendering rail frame. Forward is -X, camera side is +Z.
export function ringPose(progress,marker,radialOffset=0){
  const angle=(marker-progress)*Math.PI*2,r=V11.world.radius;
  return {x:-(r+radialOffset)*Math.sin(angle),z:(r+radialOffset)*Math.cos(angle)-r,angle};
}
export function depotPose(progress,marker){
  const p=ringPose(progress,marker);
  return {x:V11.depot.anchorX+p.x,z:V11.depot.z+p.z,connection:Math.hypot(p.x,p.z)};
}
