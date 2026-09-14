"""V11-B source transport. Only the isolated work-branch CI applies and validates this stage."""
from pathlib import Path
import json
p=Path('.')
def edit(file,old,new):
 s=(p/file).read_text();assert old in s,(file,old[:80]);(p/file).write_text(s.replace(old,new))
edit('src/sim.js',"import {Director} from './director.js?v=10';","import {Director} from './director.js?v=10';\nimport {ROUTES} from './content.js';\nimport {V11} from './balance.js';")
edit('src/sim.js',"this.round=1;this.money=1000;this.cars=[car('engine'),car('cargo')];","this.round=1;this.money=1000;this.cars=[car('engine')];\n    this.route=null;this.previousRoute=null;this.hubStage='route';this.repeatPressure=0;this.turntableFrom=0;this.selectedCar=null;")
edit('src/sim.js',"  start(){if(this.status!=='ready')return false;", "  chooseRoute(id){\n    if(this.status!=='ready'||this.hubStage!=='route'||!ROUTES[id])return false;\n    this.route=id;this.repeatPressure=this.previousRoute===id?1:0;this.hubStage='car';\n    this.tell('route_select',{route:id});if(this.repeatPressure)this.tell('route_repeat',{route:id,extraCap:1});return true;\n  }\n  chooseCar(type){\n    if(this.status!=='ready'||this.hubStage!=='car'||!['cargo','battery','workshop'].includes(type))return false;\n    if(this.cars.length<MAX_CARS)this.cars.push(car(type));this.selectedCar=type;this.hubStage='depart';\n    this.tell('car_select',{route:this.route,type,cars:this.cars.length});return true;\n  }\n  get routeAngle(){return V11.routes[this.route]?.gateAngle||0;}\n  get turntableAngle(){const u=clamp(this.elapsed/V11.turntableSeconds,0,1);return this.status==='ready'?this.turntableFrom:this.turntableFrom+(this.routeAngle-this.turntableFrom)*u*u*(3-2*u);}\n  start(){if(this.status!=='ready'||this.hubStage!=='depart')return false;")
edit('src/sim.js',"  more(type){\n    if(this.status!=='complete'||this.practice||!['cargo','battery','workshop'].includes(type))return false;\n    if(this.cars.length<MAX_CARS)this.cars.push(car(type));this.round++;", "  more(){\n    if(this.status!=='complete'||this.practice)return false;\n    this.turntableFrom=this.routeAngle;this.previousRoute=this.route;this.route=null;this.hubStage='route';this.selectedCar=null;this.round++;")
edit('src/sim.js',"this.tell('one_more_round',{type,cars:this.cars.length,risk:this.risk()});", "this.tell('one_more_round',{cars:this.cars.length,risk:this.risk()});")
edit('src/sim.js',"snapshot(){return{build:BUILD,", "snapshot(){return{build:BUILD,route:this.route,hubStage:this.hubStage,repeatPressure:this.repeatPressure,turntableAngle:this.turntableAngle,")
edit('src/director.js',"capFor(g.round)-(weak?1:0)","capFor(g.round)+(g.repeatPressure||0)-(weak?1:0)")
edit('src/director.js',"cap:capFor(g.round),", "cap:capFor(g.round)+(g.repeatPressure||0),")
edit('src/view.js',"import {Feedback3D} from './feedback3d.js?v=10';","import {Feedback3D} from './feedback3d.js?v=10';\nimport {RouteWorld} from './routeworld.js';")
s=(p/'src/view.js').read_text();a=s.index('  this.dock=new T.Group();');b=s.index('  this.track=new T.Group();',a)
s=s[:a]+"  this.routeWorld=new RouteWorld(this);this.dock=this.routeWorld.hub;this.deck=this.routeWorld.deck;this.platform=this.routeWorld.platform;this.rim=this.routeWorld.rim;\n"+s[b:]
s=s.replace("const rotation=g.phase==='depart'?(.22*(1-clamp(g.t/.09,0,1))):g.phase==='dock'?.22*(g.status==='arriving'?clamp(g.arrivalElapsed/B.arrivalTime,0,1):1):0;", "const rotation=g.phase==='depart'?g.turntableAngle*(1-clamp((g.t-.04)/.06,0,1)):g.phase==='dock'?g.turntableAngle:0;")
s=s.replace("return{renderer:this.renderer", "return{...this.routeWorld.snapshot(),renderer:this.renderer")
(p/'src/view.js').write_text(s)
for f in ['tests/simulation.test.mjs','tests/difficulty.test.mjs']:
 s=(p/f).read_text();s=s.replace('g.start();',"g.chooseRoute('industrial');g.chooseCar('cargo');g.start();")
 s=s.replace("g.more('battery')","g.more()")
 s=s.replace("assert.equal(g.cars.length,3);", "g.chooseRoute('freight');g.chooseCar('battery');assert.equal(g.cars.length,3);")
 (p/f).write_text(s)
edit('src/main.js',"import {AudioCues} from './audio.js?v=10';", "import {AudioCues} from './audio.js?v=10';\nimport {ROUTES} from './content.js';")
edit('src/main.js',"$('start').onclick=()=>{if(game.start())", "$('start').onclick=()=>{audio.unlock();if(game.start())")
a=(p/'src/main.js').read_text();a=a.replace("game.start();audio.active=true;audio.unlock();\n  if(practice)","if(practice){game.chooseRoute('industrial');game.chooseCar('cargo');game.start();}else showHub();audio.active=true;audio.unlock();\n  if(practice)")
a=a.replace("b.onclick=()=>{selected=type;choices();};", "b.dataset.car=type;b.onclick=()=>{selected=type;if(game.chooseCar(type)){view.rebuildCars();showHub();}};")
start=a.index("$('more').onclick=");end=a.index("$('cash').onclick=",start)
a=a[:start]+"$('more').onclick=()=>{if(game.more()){clearInput();showHub();view.cameraX=game.player.x;view.render(0);last=0;lastStatus='ready';}};\n"+a[end:]
a=a.replace("$('choices').hidden=!complete||practice;", "$('choices').hidden=true;$('routeChoices').hidden=true;")
a=a.replace("if(complete&&!practice)choices();", "")
insert="""
function showHub(){
  $('modal').hidden=false;$('brief').hidden=true;$('endTitle').textContent='ROUNDHOUSE';
  $('intro').textContent=game.hubStage==='route'?'先选路线，再决定需要哪种车厢。':game.hubStage==='car'?'路线已确定。推荐仅作参考，三种车厢都允许出发。':'转盘准备完毕。点击 START 发车。';
  $('summary').textContent='ROUND '+game.round+' · BANK '+Math.round(game.bank)+' · '+(ROUTES[game.route]?.name||'CHOOSE ROUTE');
  $('resultStats').hidden=true;$('riskPanel').hidden=true;$('cash').hidden=true;$('more').hidden=true;$('restart').hidden=true;
  $('start').hidden=game.hubStage!=='depart';$('start').textContent='START · '+(ROUTES[game.route]?.name||'');
  $('choices').hidden=game.hubStage!=='car';$('routeChoices').hidden=game.hubStage!=='route';
  const root=$('routeChoices');root.replaceChildren();
  for(const r of Object.values(ROUTES)){
    const b=document.createElement('button');b.dataset.route=r.id;const title=document.createElement('b');title.textContent=r.name;
    const info=document.createElement('small');info.textContent=r.theme+' · Cargo: '+r.cargo+' · Threat: '+r.threat+' · Recommended: '+r.recommended.toUpperCase()+(game.previousRoute===r.id?' · REPEAT PRESSURE +1':'');
    b.append(title,info);b.onclick=()=>{if(game.chooseRoute(r.id))showHub();};root.append(b);
  }
  if(game.hubStage==='car')choices();
}
"""
pos=a.index("const riskName=");a=a[:pos]+insert+a[pos:]
a=a.replace("$('start').textContent='从机库发车';", "$('start').textContent='从机库发车';showHub();")
a=a.replace("$('modal').hidden=true;game.start();view.render(0);ui();return true;", "$('modal').hidden=true;game.chooseRoute('industrial');game.chooseCar('cargo');game.start();view.render(0);ui();return true;")
(p/'src/main.js').write_text(a)
edit('index.html','<div id="choices"></div>','<div id="routeChoices"></div><div id="choices"></div>')
for f in p.glob('src/*.js'):f.write_text(f.read_text().replace('?v=10','?v=11'))
s=(p/'index.html').read_text().replace('V10','V11').replace('?v=10','?v=11');(p/'index.html').write_text(s)
edit('src/balance.js',"'V10-RECOVERY-20260913'","'V11-B-HUB-20260914'")
with (p/'style.css').open('a') as f:f.write('\n#routeChoices{display:flex;gap:8px;margin:8px 0}#routeChoices button{flex:1;text-align:left}#routeChoices small{display:block;color:#adc1c8;font-size:10px;margin-top:5px;line-height:1.5}\n')
s=(p/'tests/browser_smoke.py').read_text().replace("checks['build_is_v10']=s['build'].startswith('V10-')", "checks['build_is_v11']=s['build'].startswith('V11-')")
s=s.replace("await page.click('#start');", "await page.click('[data-route=industrial]');await page.click('[data-car=cargo]');await page.click('#start');",1)
s=s.replace("await page.evaluate('window.__RH_TEST.game().fail(\"test\")');", "await page.click('[data-route=industrial]');await page.click('[data-car=cargo]');await page.click('#start');await page.evaluate('window.__RH_TEST.game().fail(\"test\")');")
(p/'tests/browser_smoke.py').write_text(s)
f=p/'package.json';v=json.loads(f.read_text());v['scripts']['test']='node --test tests/simulation.test.mjs tests/difficulty.test.mjs tests/contracts.test.mjs tests/hub.test.mjs';f.write_text(json.dumps(v)+'\n')
