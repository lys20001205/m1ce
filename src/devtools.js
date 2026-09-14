import {ROUTES,ENEMIES,SPEED_MODES} from './content.js';
import {V11} from './balance.js';
// DEV UI only. All simulation mutations pass through the explicit Game.devCommand gate.
export class DevTools {
  constructor(host){
    this.host=host;this.last=0;this.flags={threat:false,audio:false,renderer:false};
    const mount=document.getElementById('viewport');
    this.badge=document.createElement('button');this.badge.id='devBadge';this.badge.textContent='DEV ×1';mount.append(this.badge);
    this.panel=document.createElement('aside');this.panel.id='devPanel';this.panel.hidden=true;this.panel.setAttribute('aria-label','DEV quick test controls');mount.append(this.panel);
    this.badge.onclick=()=>{this.panel.hidden=!this.panel.hidden;};
    this.threat=document.createElement('div');this.threat.id='devThreat';this.threat.hidden=true;mount.append(this.threat);
    this.notice=document.createElement('div');this.notice.id='devNotice';this.notice.textContent='DEV · SEPARATE SAVE · NO BALANCE UPLOAD';this.panel.append(this.notice);
    const start=this.row('SESSION');this.button(start,'DEV START','start');
    const times=this.row('TIME · SIMULATION ONLY');for(const x of [1,2,4])this.button(times,'×'+x,'time',x);
    const round=this.row('ROUND / ROUTE');this.select(round,'round',Array.from({length:8},(_,i)=>[i+1,'Round '+(i+1)]));this.select(round,'route',Object.entries(ROUTES).map(([id,r])=>[id,r.name]));
    const jump=this.row('ROUTE JUMP');for(const x of ['depot','crane','tunnel','return'])this.button(jump,x.toUpperCase(),'jump',x);
    const cars=this.row('CARS');for(const x of ['cargo','battery','workshop'])this.button(cars,'ADD '+x.toUpperCase(),'car',x);
    const cargo=this.row('CARGO');for(const x of ['fill','clear'])this.button(cargo,x.toUpperCase(),'cargo',x);
    const economy=this.row('COMBAT ECONOMY');this.button(economy,'+100 SCRAP','scrap');this.button(economy,'UNLOCK COMBAT TIER 3','tier');
    const enemies=this.row('ENEMIES · THREAT ADMISSION STILL APPLIES');for(const x of Object.keys(ENEMIES))this.button(enemies,'SPAWN '+x.toUpperCase(),'spawn',x);
    const speed=this.row('SPEED · DEV OVERRIDE');for(const x of SPEED_MODES)this.button(speed,x,'speed',x);
    const engine=this.row('ENGINE');this.button(engine,'20%','engine','20');this.button(engine,'STALL','engine','stall');
    const life=this.row('PLAYER');this.button(life,'KILL PLAYER','kill');this.button(life,'FORCE TRAIN LOST','trainLost');
    const debug=this.row('DEBUG');
    for(const [id,title] of [['threat','Threat Overlay'],['audio','Audio Debug'],['renderer','Renderer Stats']]){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.debug=id;input.onchange=()=>this.flags[id]=input.checked;label.append(input,document.createTextNode(title));debug.append(label);}
    this.button(debug,'PLAY TEST SFX','testSfx');
    this.audio=document.createElement('pre');this.audio.id='devAudio';this.panel.append(this.audio);
    this.renderer=document.createElement('pre');this.renderer.id='devRenderer';this.panel.append(this.renderer);
  }
  row(title){const row=document.createElement('div');row.className='devRow';const b=document.createElement('b');b.textContent=title;row.append(b);this.panel.append(row);return row;}
  button(row,label,action,value=''){const b=document.createElement('button');b.textContent=label;b.dataset.dev=action;b.dataset.value=String(value);b.onclick=()=>this.act(action,value);row.append(b);return b;}
  select(row,action,options){const s=document.createElement('select');s.dataset.dev=action;for(const [value,label] of options){const o=document.createElement('option');o.value=value;o.textContent=label;s.append(o);}s.onchange=()=>this.act(action,s.value);row.append(s);}
  act(action,value){
    if(this.host.view()?.loaded!==3){this.notice.textContent='LOADING 3D MODELS';return;}
    let ok;
    if(action==='testSfx'){this.host.audio.unlock('dev_test_sfx');ok=this.host.audio.play('test');}
    else if(action==='start')ok=this.host.start();
    else ok=this.host.game().devCommand(action,value);
    this.notice.textContent=ok?'DEV · '+action.toUpperCase()+' '+String(value||''):'NOT AVAILABLE · CHECK STATE / THREAT CAP';
    this.host.changed();this.update(0,true);
  }
  update(time,force=false){
    if(!force&&time-this.last<200)return;this.last=time;
    const g=this.host.game(),a=this.host.audio.snapshot();this.badge.textContent='DEV ×'+g.timeScale;
    for(const b of this.panel.querySelectorAll('button[data-dev=time]'))b.classList.toggle('selected',Number(b.dataset.value)===g.timeScale);
    this.panel.querySelector('select[data-dev=round]').value=String(g.round);this.panel.querySelector('select[data-dev=route]').value=g.route||'industrial';
    for(const b of this.panel.querySelectorAll('button[data-dev=jump]'))b.disabled=g.status!=='running'||['crane','tunnel'].includes(b.dataset.value)&&!V11.routes[g.route]?.[b.dataset.value];
    this.threat.hidden=!this.flags.threat;if(this.flags.threat){const t=g.director.snapshot(g);this.threat.textContent='THREAT '+t.load+' / '+t.cap+'\nPressure ×'+t.pressure+' · Recovery '+t.rest.toFixed(1)+'s';}
    this.audio.hidden=!this.flags.audio;if(this.flags.audio)this.audio.textContent='AUDIO\nContext: '+a.context+'\nMaster: '+a.master.toFixed(2)+'\nMuted: '+a.muted+'\nEngineLoop: '+a.engineLoop+'\nLast SFX: '+(a.lastSfx||'—')+'\nOutput RMS: '+a.outputRMS.toFixed(5);
    this.renderer.hidden=!this.flags.renderer;if(this.flags.renderer){const s=this.host.view().snapshot();this.renderer.textContent='RENDERER\nDraw calls: '+s.drawCalls+'\nTriangles: '+s.triangles+'\nActive meshes: '+s.activeMeshes+'\nSegments: '+s.routeSegmentsVisible+'\nPooled enemies: '+s.pooledEnemies+'\nDPR: '+s.DPR+'\nFrame p50 / p95: '+s.frameDeltaP50.toFixed(1)+' / '+s.frameDeltaP95.toFixed(1)+' ms';}
  }
}
