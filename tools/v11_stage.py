"""V11-K Prep Shop migration. Readable, deterministic, and validation-branch only."""
from pathlib import Path

def change(path, old, new, count=1):
    p=Path(path); s=p.read_text()
    if old not in s: raise SystemExit(f'MISSING PATTERN {path}: {old[:80]!r}')
    p.write_text(s.replace(old,new,count))

change('src/balance.js',"export const BUILD = 'V11-J-DEV-20260914';","export const BUILD = 'V11-K-PREP-20260916';")

p=Path('src/sim.js');s=p.read_text()
s=s.replace("constructor({emit=()=>{},bank=0,seed=314159,practice=false,dev=false}={}){","constructor({emit=()=>{},bank=0,seed=314159,practice=false,dev=false,prep={}}={}){")
s=s.replace("this.dev=!!dev;this.timeScale=1;this.emit=emit;this.seed=seed>>>0;this.initialSeed=this.seed;this.bank=bank;this.practice=practice;",
"this.dev=!!dev;this.timeScale=1;this.emit=emit;this.seed=seed>>>0;this.initialSeed=this.seed;this.bank=bank;this.practice=practice;\n    this.prep=Object.fromEntries(Object.entries(V11.prep).map(([id,spec])=>[id,Math.min(spec.max,Math.max(0,Math.floor(Number(prep?.[id])||0)))]));this.runRepairKit=0;this.runPrepLoaded=false;this.routeIntel=null;this.intelPrepared=false;this.carOffers=[];this.carRerolled=false;")
marker="  chooseRoute(id){\n"
insert="""  buyPrep(id){
    const spec=V11.prep[id],atShop=!this.practice&&(this.status==='cashed'||(this.status==='ready'&&this.hubStage==='route'));
    if(!spec||!atShop||this.bank<spec.cost||this.prep[id]>=spec.max)return false;
    this.bank-=spec.cost;this.prep[id]++;if(id==='intel')this.intelPrepared=false;
    this.tell('prep_purchase',{item:id,cost:spec.cost,count:this.prep[id],bank:this.bank});return true;
  }
  prepareRouteIntel(){
    if(this.status!=='ready'||this.hubStage!=='route'||this.intelPrepared)return this.routeIntel;
    this.intelPrepared=true;if(this.prep.intel<=0)return null;
    const ids=Object.keys(ROUTES),route=ids[Math.floor(this.rand()*ids.length)];this.prep.intel--;this.routeIntel={route,text:ROUTES[route].intel};
    this.tell('prep_use',{item:'intel',route,text:this.routeIntel.text});return this.routeIntel;
  }
  prepareCarOffers(rerolled=false){
    if(!this.route)return[];const recommended=ROUTES[this.route].recommended;
    const normal={industrial:'cargo',freight:'battery',tunnel:'cargo'},redraw={industrial:'battery',freight:'workshop',tunnel:'workshop'};
    const alt=(rerolled?redraw:normal)[this.route];this.carOffers=[recommended,alt].filter((v,i,a)=>a.indexOf(v)===i);return this.carOffers;
  }
  rerollCars(){
    if(this.status!=='ready'||this.hubStage!=='car'||this.carRerolled||this.prep.reroll<=0)return false;
    const before=[...this.carOffers];this.prep.reroll--;this.carRerolled=true;this.prepareCarOffers(true);
    this.tell('prep_use',{item:'reroll',before,after:[...this.carOffers]});return true;
  }
  get emergencyRepairTime(){return B.restartTime/(this.repairSpeed*(this.runRepairKit?V11.kitSpeed:1));}
"""
if marker not in s: raise SystemExit('chooseRoute marker missing')
s=s.replace(marker,insert+marker,1)
s=s.replace("this.route=id;this.prepareDepots();this.repeatPressure=this.previousRoute===id?1:0;this.hubStage='car';",
"this.route=id;this.prepareDepots();this.repeatPressure=this.previousRoute===id?1:0;this.hubStage='car';this.carRerolled=false;this.prepareCarOffers(false);")
s=s.replace("if(this.status!=='ready'||this.hubStage!=='car'||!['cargo','battery','workshop'].includes(type))return false;",
"if(this.status!=='ready'||this.hubStage!=='car'||!this.carOffers.includes(type))return false;")
s=s.replace("start(){if(this.status!=='ready'||this.hubStage!=='depart')return false;this.status='running';",
"start(){if(this.status!=='ready'||this.hubStage!=='depart')return false;if(!this.practice&&!this.runPrepLoaded){this.runPrepLoaded=true;if(this.prep.repairKit>0){this.prep.repairKit--;this.runRepairKit=1;this.tell('prep_equip',{item:'repairKit'});}}this.status='running';")
s=s.replace("const window=Math.max(B.rescueMinimum,Math.ceil(travel+B.restartTime+B.rescueMargin));",
"const restartTime=this.emergencyRepairTime,window=Math.max(B.rescueMinimum,Math.ceil(travel+restartTime+B.rescueMargin));")
s=s.replace("this.tell('engine_stalled',{window,travel,repairTime:B.restartTime,x:this.player.x});",
"this.tell('engine_stalled',{window,travel,repairTime:restartTime,x:this.player.x});")
s=s.replace("duration:(emergency?B.restartTime:localFault?V11.workshopFaultTime:B.repairTime)/this.repairSpeed,emergency,localFault,low:c.hp/c.max<=.10",
"duration:emergency?this.emergencyRepairTime:(localFault?V11.workshopFaultTime:B.repairTime)/this.repairSpeed,emergency,localFault,low:c.hp/c.max<=.10")
s=s.replace("job.duration=(emergency?B.restartTime:localFault?V11.workshopFaultTime:B.repairTime)/this.repairSpeed;",
"job.duration=emergency?this.emergencyRepairTime:(localFault?V11.workshopFaultTime:B.repairTime)/this.repairSpeed;")
s=s.replace("this.feedback('restart',stationX(0),2.5);this.director.recover(this,'engine_restarted');",
"this.feedback('restart',stationX(0),2.5);if(this.runRepairKit){this.runRepairKit=0;this.tell('prep_use',{item:'repairKit',reason:'emergency_repair'});}this.director.recover(this,'engine_restarted');")
s=s.replace("this.turntableFrom=this.routeAngle;this.previousRoute=this.route;this.route=null;this.hubStage='route';this.selectedCar=null;this.round++;",
"this.turntableFrom=this.routeAngle;this.previousRoute=this.route;this.route=null;this.hubStage='route';this.selectedCar=null;this.routeIntel=null;this.intelPrepared=false;this.carOffers=[];this.carRerolled=false;this.round++;")
s=s.replace("snapshot(){return{build:BUILD,",
"snapshot(){return{build:BUILD,prep:{...this.prep},runRepairKit:this.runRepairKit,routeIntel:this.routeIntel?{...this.routeIntel}:null,carOffers:[...this.carOffers],carRerolled:this.carRerolled,")
p.write_text(s)

p=Path('src/main.js');s=p.read_text()
s=s.replace("import {ROUTES,SPEED_MODES,INPUT_BINDINGS_SSOT} from './content.js';","import {ROUTES,SPEED_MODES,INPUT_BINDINGS_SSOT,PREP_ITEMS} from './content.js';\nimport {V11} from './balance.js';")
s=s.replace("function readBank(){return save.read().bank;}","function readSave(){return save.read();}")
s=s.replace("telemetry=new Telemetry(snapshot,{...mode,storage:save.storage});game=new Game({bank:readBank(),seed:seed(),emit,dev:mode.dev});",
"const initialSave=readSave();telemetry=new Telemetry(snapshot,{...mode,storage:save.storage});game=new Game({bank:initialSave.bank,prep:initialSave.prep,seed:seed(),emit,dev:mode.dev});")
s=s.replace("$('start').onclick=()=>{audio.unlock('start');if(game.start()){$('modal').hidden=true;last=0;lastStatus='running';audio.active=true;}};",
"$('start').onclick=()=>{audio.unlock('start');if(game.start()){bankWritable=save.write(game);$('modal').hidden=true;last=0;lastStatus='running';audio.active=true;}};")
s=s.replace("game=new Game({bank:game.bank,seed:seed(),practice,emit,dev:mode.dev})","game=new Game({bank:game.bank,prep:game.prep,seed:seed(),practice,emit,dev:mode.dev})")
old="""function choices(){
  const root=$('choices');root.replaceChildren();
  const descriptions={cargo:'+3 个空货位 · Freight 搬货 · 额外货车增加盗贼权重',battery:'FAST 储能 · 隧道照明 · 供电维修',workshop:'维修加速 · 工业故障处理 · 本地维修站'};
  for(const type of ['battery','workshop','cargo']){const b=document.createElement('button');b.textContent=DEFS[type].name;const small=document.createElement('small');small.textContent=descriptions[type];b.appendChild(small);b.className=type===selected?'selected':'';b.dataset.car=type;b.onclick=()=>{selected=type;if(game.chooseCar(type)){view.rebuildCars();showHub();}};root.appendChild(b);}
}
"""
new="""function choices(){
  const root=$('choices');root.replaceChildren();
  const descriptions={cargo:'+3 个空货位 · Freight 搬货 · 额外货车增加盗贼权重',battery:'FAST 储能 · 隧道照明 · 供电维修',workshop:'维修加速 · 工业故障处理 · 本地维修站'};
  if(!game.carOffers.includes(selected))selected=game.carOffers[0];
  for(const type of game.carOffers){const b=document.createElement('button');b.textContent=DEFS[type].name;const small=document.createElement('small');small.textContent=descriptions[type];b.appendChild(small);b.className=type===selected?'selected':'';b.dataset.car=type;b.onclick=()=>{selected=type;if(game.chooseCar(type)){view.rebuildCars();showHub();}};root.appendChild(b);}
  if(game.prep.reroll>0&&!game.carRerolled){const b=document.createElement('button');b.dataset.reroll='car';b.textContent='REROLL OFFER · '+game.prep.reroll+' TOKEN';b.onclick=()=>{if(game.rerollCars()){bankWritable=save.write(game);choices();}};root.appendChild(b);}
}
function renderPrep(){
  const panel=$('prepShop'),visible=!game.practice&&(game.status==='cashed'||(game.status==='ready'&&game.hubStage==='route'));panel.hidden=!visible;if(!visible)return;
  $('prepBank').textContent='BANK '+Math.round(game.bank).toLocaleString();const root=$('prepItems');root.replaceChildren();
  for(const [id,item] of Object.entries(PREP_ITEMS)){const spec=V11.prep[id],count=game.prep[id]||0,b=document.createElement('button');b.dataset.prep=id;b.disabled=count>=spec.max||game.bank<spec.cost;b.innerHTML='<b>'+item.name+'</b><small>'+item.description+' · '+spec.cost.toLocaleString()+' BANK · '+count+' / '+spec.max+'</small>';b.onclick=()=>{if(!game.buyPrep(id))return;bankWritable=save.write(game);if(id==='intel'){game.prepareRouteIntel();bankWritable=save.write(game);}if(game.status==='cashed')showEnd();else showHub();};root.appendChild(b);}
}
"""
if old not in s: raise SystemExit('choices block missing')
s=s.replace(old,new,1)
s=s.replace("function showHub(){\n  $('modal').hidden=false;","function showHub(){\n  if(game.hubStage==='route'){const before=game.prep.intel;game.prepareRouteIntel();if(game.prep.intel!==before)bankWritable=save.write(game);}\n  $('modal').hidden=false;")
s=s.replace("game.hubStage==='car'?'路线已确定。推荐仅作参考，三种车厢都允许出发。'","game.hubStage==='car'?'路线已确定。推荐仅作参考；当前两项车厢都允许出发。'")
s=s.replace("+(game.previousRoute===r.id?' · REPEAT PRESSURE +1':'');",
"+(game.previousRoute===r.id?' · REPEAT PRESSURE +1':'')+(game.routeIntel?.route===r.id?' · INTEL: '+game.routeIntel.text:'');")
s=s.replace("  if(game.hubStage==='car')choices();\n}","  if(game.hubStage==='car')choices();renderPrep();\n}")
s=s.replace("  $('cash').textContent='安全兑现 '+Math.round(game.money).toLocaleString();$('more').textContent=game.cars.length>=12?'继续 · 列车已达上限':'接车 · 再来一圈';\n  \n}",
"  $('cash').textContent='安全兑现 '+Math.round(game.money).toLocaleString();$('more').textContent=game.cars.length>=12?'继续 · 列车已达上限':'接车 · 再来一圈';renderPrep();\n  \n}")
p.write_text(s)

change('src/audio.js',"armory_purchase:'armory_buy',cashout:'cashout'","armory_purchase:'armory_buy',prep_purchase:'armory_buy',cashout:'cashout'")

p=Path('index.html');s=p.read_text();anchor='<p id="riskPanel" hidden></p><div id="routeChoices"></div>'
if anchor not in s: raise SystemExit('index prep anchor missing')
s=s.replace(anchor,'<p id="riskPanel" hidden></p><section id="prepShop" hidden><div class="prepHead"><b>PREP SHOP</b><span id="prepBank">BANK 0</span></div><div id="prepItems"></div><small>Bank upgrades are run preparation only; no permanent damage bonuses.</small></section><div id="routeChoices"></div>',1);p.write_text(s)

p=Path('style.css');p.write_text(p.read_text()+"""
#prepShop{margin:10px 0;padding:9px;border:1px solid #5d7f7c;background:#10262c;border-radius:6px}.prepHead{display:flex;justify-content:space-between;align-items:center;color:#d8e8c9;margin-bottom:6px}#prepItems{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}#prepItems button{min-height:56px;text-align:left;padding:7px}#prepItems button b,#prepItems button small{display:block}#prepItems button small{font-size:9px;margin-top:4px;color:#adc5c0}#prepShop>small{display:block;margin-top:6px;color:#8fa8a7;font-size:9px}@media(max-width:720px){#prepItems{grid-template-columns:1fr 1fr 1fr}#prepItems button{padding:5px;font-size:9px}}
""")

p=Path('package.json');s=p.read_text();
if 'tests/prep.test.mjs' not in s:s=s.replace('tests/dev.test.mjs','tests/dev.test.mjs tests/prep.test.mjs')
p.write_text(s)
print('V11-K migration applied')
