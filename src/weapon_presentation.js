import {V11} from './balance.js';
import {WEAPONS} from './content.js';

const names={wrench:'扳手',knife:'短刀',axe:'重斧',handgun:'手枪',smg:'冲锋枪',rifle:'穿透步枪',shotgun:'霰弹枪'};
// Presentation only: both menus describe the same authoritative weapon rules.
export function weaponSummary(id){
  const spec=V11.weapons[id],weapon=[...WEAPONS.melee,...WEAPONS.ranged].find(w=>w.id===id);
  const role={wrench:'均衡挥击 · 重甲会减伤',knife:'快速近战 · 触及距离短',axe:'重击打断重甲 · 出手较慢',
    handgun:'近距点射',smg:'快速连射',rifle:`最多穿透 ${spec.pierce} 名敌人 · 逐个减伤`,
    shotgun:`${spec.pellets} 弹丸散射 · ${spec.falloffStart}m 后减伤`}[id];
  const stats=spec.magazine?`${spec.range}m · ${spec.magazine} 发 / 自动装填 ${spec.reload}s`:
    `${spec.range}m · 攻击间隔 ${spec.cooldown}s`;
  return {name:`${names[id]} ${weapon.name}`,detail:`${role}\n${stats}`};
}
