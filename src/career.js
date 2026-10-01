import {B,V11} from './balance.js';
export const CAREER={boots:{name:'搬运靴',cost:350,max:3,description:'永久：首级搬运 +0.8 米/秒；后续每级 +0.4'},hull:{name:'机车加固',cost:600,max:3,description:'永久：下局机车上限每级 +30 HP'},kit:{name:'射手执照',cost:900,max:1,description:'永久：下局带 HANDGUN 和 6 Scrap 出发'}};
export function carryBonus(level){return level>0?.4+.4*Math.min(3,level):0;}
export function careerEffect(id,level){return id==='boots'?(B.carrySpeed+carryBonus(level)).toFixed(1)+' 米/秒':id==='hull'?(V11.carHP.engine+level*30)+' HP':level?'HANDGUN + 6 Scrap':'扳手开局';}
export function careerComparison(id,level){return careerEffect(id,level)+' → '+careerEffect(id,Math.min(CAREER[id].max,level+1));}
export function cleanCareer(value={}){return Object.fromEntries(Object.entries(CAREER).map(([id,s])=>[id,Math.min(s.max,Math.max(0,Number.isFinite(Number(value?.[id]))?Math.floor(Number(value?.[id])):0))]));}
