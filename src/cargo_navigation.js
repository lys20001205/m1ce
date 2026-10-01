import {LENGTH,ROOF} from './sim.js';
import {V11} from './balance.js';
// Navigation reflects the actual bridge landing; returning on the engine side
// cannot promise an automatic load at a cargo hatch further along the roof.
export function cargoNavigation(g){
  if(g.status!=='running'||!g.alive)return null;
  const p=g.player;
  if(!g.heldCargo){
    const d=g.nearestDepot();if(g.playerLayer==='DEPOT'||g.cargoUsed>=g.cargoCapacity||!g.depotConnected(d)||!g.cargoCrates.some(c=>c.location==='depot'&&c.depotId===d.id))return null;
    const stock=g.cargoCrates.filter(c=>c.location==='depot'&&c.depotId===d.id).reduce((n,c)=>n+c.value,0),stockGuide=o=>({...o,text:'站内库存 '+Math.round(stock).toLocaleString()+' · '+o.text});
    const cargoHere=g.cars[g.currentCar]?.type==='cargo',cargoBridge=g.cars[Math.floor(d.x/LENGTH)]?.type==='cargo';
    if(g.playerLayer==='INTERIOR'&&!cargoHere)return null;
    if(g.playerLayer==='INTERIOR'&&cargoHere&&!cargoBridge){const ladder=(g.currentCar+.52)*LENGTH,near=Math.abs(p.x-ladder)<=1.8;return stockGuide({text:near?'W 上车顶 · 然后 '+(d.x<p.x?'←':'→')+' 去中央桥 '+Math.abs(d.x-p.x).toFixed(1)+'m · F 入站':(ladder<p.x?'←':'→')+' 去黄色梯 '+Math.abs(ladder-p.x).toFixed(1)+'m · W 上车顶后去中央桥',action:'接桥在机车侧',goal:{x:ladder,y:2.8,z:-1.15,label:'黄色梯 W'}});}
    const near=cargoHere&&cargoBridge&&g.playerLayer==='INTERIOR'||Math.abs(p.x-d.x)<=V11.depot.boardRadius;
    return stockGuide({text:near?'接桥可用 · F 入站自动取箱':(d.x<p.x?'←':'→')+' 去中央桥 '+Math.abs(d.x-p.x).toFixed(1)+'m · F 入站',action:near?'入站取箱':'去中央桥',goal:near?null:{x:d.x,y:ROOF+.25,z:d.z,label:'中央桥'}});
  }
  const cargos=g.cars.map((c,i)=>({c,i,x:(i+.5)*LENGTH})).filter(o=>o.c.type==='cargo'&&o.c.hp>0).sort((a,b)=>Math.abs(a.x-g.player.x)-Math.abs(b.x-g.player.x));
  const target=cargos[0];if(!target)return {text:'货车已损毁 · 寻找可用货车',action:'寻找货车',goal:null};
  const value=Math.round(g.heldCargo.value),carrying='携带 '+value+' · 尚未装车 · ';
  if(g.playerLayer==='DEPOT'){const d=g.depotState(),distance=Math.abs(p.depotX),arrow=p.depotX>0?'←':'→';
    if(!d)return {text:'接桥暂不可用 · 确认列车停靠',action:'寻找接桥',goal:null};
    return {text:carrying+(distance>V11.depot.bridgeRadius?arrow+' 回中央桥 '+distance.toFixed(1)+'m · 然后 F 回车':'可以回车 · F 回车'+(g.cars[Math.floor(d.x/LENGTH)]?.type==='cargo'?'并装载 '+value:'；再去货车 LOAD 装载 '+value)),action:distance>V11.depot.bridgeRadius?'回中央桥':'返回货车',goal:distance>V11.depot.bridgeRadius?{x:d.x,y:ROOF+.25,z:d.z,label:'中央桥'}:null};
  }
  const onCargo=g.cars[g.currentCar]?.type==='cargo',direction=target.x>p.x?'→':'←';
  return {text:onCargo?'已到货车 · F / LOAD 装载 '+value+' · 装载后 W 下车内':direction+' 去货车 '+Math.abs(target.x-p.x).toFixed(1)+'m · 到达后 F / LOAD 装载 '+value+'（携货不能爬梯）',action:onCargo?'LOAD 装载':'去货车装载',goal:onCargo?null:{x:target.x,y:ROOF+.25,z:.65,label:'货车 LOAD'}};
}
