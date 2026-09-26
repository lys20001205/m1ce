import {V11} from './balance.js';

// Presentation and pointer geometry only. Game remains the authority for actions.
export function steeringDirection(x,y,rect,deadZone=8){
  if(!Number.isFinite(x)||!Number.isFinite(y)||rect.width<=0||rect.height<=0)return 'neutral';
  if(y<rect.top-28||y>rect.top+rect.height+28||x<rect.left-36||x>rect.left+rect.width+36)return 'neutral';
  const delta=x-(rect.left+rect.width/2);
  return Math.abs(delta)<=deadZone?'neutral':delta<0?'left':'right';
}
export function depotActionLabel(g){
  if(g.playerLayer!=='DEPOT')return null;
  if(g.player.carry)return 'RETURN';
  const p=g.player;
  const nearby=g.cargoCrates.some(c=>c.location==='depot'&&c.depotId===p.depotId&&Math.abs(c.x-p.depotX)<=V11.depot.crateRadius);
  return nearby?'PICKUP':'RETURN';
}
export function controlStatus(g){
  const live=g.status==='running'&&!g.paused&&g.alive;
  const free=live&&!g.player.carry&&g.player.stun<=0;
  return {live,attack:free,ranged:free&&!!g.ranged,fix:free&&g.playerLayer==='INTERIOR',
    layer:live&&g.player.stun<=0&&(g.playerLayer==='DEPOT'||(!g.player.carry&&g.phase!=='tunnel')),
    interact:live&&g.player.stun<=0,brake:live};
}
const attr=(node,key,value)=>{if(node.getAttribute?.(key)!==value)node.setAttribute(key,value);};
const text=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
export class ControlUI{
  constructor(doc){this.doc=doc;this.levels=new Map();}
  update(g){
    const d=this.doc,live=controlStatus(g),percent=Math.max(0,Math.min(100,Math.ceil(100*g.cars[0].hp/g.cars[0].max))),hp=Math.max(0,Math.ceil(g.player.hp));
    text(d.getElementById('engineVital'),percent+'%');text(d.getElementById('playerVital'),String(hp));
    for(const [id,value] of [['engineMeter',percent],['playerMeter',hp]]){
      const n=d.getElementById(id);if(n){if(this.levels.get(id)!==value){n.style.setProperty('--level',Math.min(100,value)+'%');this.levels.set(id,value);}n.dataset.band=value<=25?'critical':value<=50?'damaged':'normal';attr(n,'aria-valuenow',String(value));}
    }
    for(const id of ['L','R','attack','ranged','fix','layer','interact','brake']){
      const n=d.getElementById(id);if(!n)continue;
      const ready=(id==='L'||id==='R')?live.live:live[id];
      // Keep rejected taps available to the game's explanatory feedback, not silent disabled buttons.
      n.dataset.ready=String(!!ready);attr(n,'aria-label',n.textContent+(id==='attack'||id==='ranged'||id==='fix'?'，按住':'')+(!ready?'，当前状态不可用':''));
    }
    const tag=d.getElementById('playerTag');if(tag)tag.dataset.layer=g.playerLayer;
    const app=d.getElementById('app');if(app){app.dataset.worldRoute=g.route||'hub';app.dataset.play=live.live?'active':g.paused?'paused':'idle';}
  }
}
