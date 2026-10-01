import {B,V11} from './balance.js';
export const CAREER={boots:{name:'搬运靴',cost:350,max:3,description:'永久：首级搬运 +0.8 米/秒；后续每级 +0.4'},hull:{name:'机车加固',cost:600,max:3,description:'永久：新局机车生命每级 +30 HP'},kit:{name:'启程武器库',cost:900,max:3,description:'每局出发前任选一把；其余武器仍需本局 Scrap。1 手枪 / 2 霰弹枪 / 3 冲锋枪、步枪'}};
export const CAREER_MAX=Object.values(CAREER).reduce((n,s)=>n+s.max,0);
export function careerCost(id,level){return id==='kit'?[900,1400,2400][level]??Infinity:CAREER[id]?.cost??Infinity;}
export function starterOptions(level){return level>=3?['handgun','shotgun','smg','rifle']:level===2?['handgun','shotgun']:level===1?['handgun']:[];}
export function cleanStarter(id,level){return starterOptions(level).includes(id)?id:'handgun';}
export function carryBonus(level){return level>0?.4+.4*Math.min(3,level):0;}
export function careerEffect(id,level){return id==='boots'?(B.carrySpeed+carryBonus(level)).toFixed(1)+' 米/秒':id==='hull'?(V11.carHP.engine+level*30)+' HP':level>=3?'任选四种枪械':level===2?'可选手枪 / 霰弹枪':level===1?'HANDGUN + 6 Scrap':'扳手开局';}
export function careerComparison(id,level){return careerEffect(id,level)+' → '+careerEffect(id,Math.min(CAREER[id].max,level+1));}
export function cleanCareer(value={}){return Object.fromEntries(Object.entries(CAREER).map(([id,s])=>[id,Math.min(s.max,Math.max(0,Number.isFinite(Number(value?.[id]))?Math.floor(Number(value?.[id])):0))]));}
