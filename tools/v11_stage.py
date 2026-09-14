"""Readable source migration. Exact baseline/output hashes; work-branch validation only."""
from pathlib import Path
import hashlib
checks={'package.json':['84f24921758d42979ef7f6673f3e2749d7c7902c0dd0bf90f71e4ddaa2e38022','9bc37e0f7645fc049578a902ee680b53916fa34e3d3ceaceba9058b4a0994942'],'src/balance.js':['37cf9a37cc35483f7fe0c09f15553c3402fdf59f1c243d4e06fae5131d9a990b','edc3d5fc5ea38e2fbcdfb75c52ccadc57fd54d4e2afe20fdffd7615618a69b67'],'src/main.js':['463d43e44edc7ef1705351025fb5a4807dc545194f9edb952b4781190e73b17f','98512ebde036daad91e190a614411283fa4a79fc274572f4121cdd1225efdfc4'],'src/sim.js':['7e3e98d0acbb1b61602fb3438db5e479b6fa100c12991b6de3e2d479e968f218','008fb31b1eebddf4ea290a05ccf533bad80e37defda247af01aa32397e722146'],'src/telemetry.js':['273ef903cf5adb7befa9b91fb3f99073e10926b132d15f0b5b2e5f64ffaa211b','fe035aa372c36e67ac7fbc21b3acfcf643ba91d1619e6ff5a0434457125f6a83'],'style.css':['88cd72b4a6d58547d0a70fae11c584de84295cad6336152661c706bae4b7cbc2','f0370c8cbfc55eddded5d0043cbfa480e36b06eff388f2c3c08377ad24b263cf']}
for n,(a,b) in checks.items():assert hashlib.sha256(Path(n).read_bytes()).hexdigest()==a,'BASE MISMATCH '+n
p=Path('src/sim.js');s=p.read_text().replace('seed=314159,practice=false','seed=314159,practice=false,dev=false')
s=s.replace('    this.emit=emit;','    this.dev=!!dev;this.timeScale=1;this.emit=emit;',1)
i=s.index('  get alive()')
s=s[:i]+'''  // Explicit DEV-only commands. No normal URL has a mutable reference or access to this gate.
  devCommand(action,value){
    if(!this.dev)return false;
    const n=Number(value);
    if(action==='start'){
      if(this.status==='running'){this.pause(false);return true;}
      if(this.status!=='ready')return false;
      if(this.hubStage==='route')this.chooseRoute('industrial');
      if(this.hubStage==='car')this.chooseCar(ROUTES[this.route].recommended);
      return this.start();
    }
    if(action==='time'){if(![1,2,4].includes(n))return false;this.timeScale=n;}
    else if(action==='round'){if(!Number.isInteger(n)||n<1||n>8)return false;this.round=n;}
    else if(action==='route'){
      if(!ROUTES[value]||!['ready','running'].includes(this.status))return false;
      if(this.status==='ready'){this.hubStage='route';this.chooseRoute(value);}
      else{this.route=value;this.prepareDepots();this.t=0;this.phase=phaseAt(0,value);this.elapsed=Math.max(3,this.elapsed);this.director=new Director();this.warnings={};this.craneHits.clear();this.tell('route_select',{route:value});}
    }
    else if(action==='jump'){
      if(this.status!=='running')return false;const c=V11.routes[this.route];
      const marker={depot:c.depots[0],crane:c.crane?.[0],tunnel:c.tunnel?.[0],return:.98}[value];if(marker===undefined)return false;
      if(this.heldCargo&&this.playerLayer===LAYER.DEPOT)this.loseCargo(this.heldCargo,'dev_jump');
      this.setPlayerLayer(LAYER.INTERIOR);this.player.x=V11.consoleX;this.t=marker;this.elapsed=Math.max(3,this.elapsed);this.phase=phaseAt(marker,this.route);this.warnings={};this.craneHits.clear();
    }
    else if(action==='car'){if(!['cargo','battery','workshop'].includes(value)||this.cars.length>=MAX_CARS)return false;this.cars.push(car(value));this.syncSystems();}
    else if(action==='cargo'){
      if(value==='fill'){
        const amount=V11.routes[this.route||'industrial'].value;
        for(let i=0;i<this.cars.length;i++){if(this.cars[i].type!=='cargo')continue;let count=this.cargoCrates.filter(c=>c.carIndex===i&&['stored','thief'].includes(c.location)).length;
          while(count<V11.cargoSlots&&this.cargoUsed<this.cargoCapacity){this.createCargo(amount,'stored',{carIndex:i,secured:true});this.money+=amount;count++;}}
      }else if(value==='clear'){for(const c of this.cargoCrates)if(['stored','player','floor','thief'].includes(c.location))this.loseCargo(c,'dev_clear');for(const e of this.enemies)e.carry=false;this.player.carry=false;this.syncCargo();}else return false;
    }
    else if(action==='scrap')this.scrap+=100;
    else if(action==='tier'){this.meleeTier=3;this.tell('combat_tier_unlock',{tier:3});this.tell('ranged_unlock',{weapon:'handgun'});}
    else if(action==='spawn'){if(!ENEMIES[value]||!this.spawn(value))return false;}
    else if(action==='speed'){
      if(!V11.speeds[value]||this.status!=='running'||this.engineState==='stalled')return false;
      const from=this.speedMode;this.speedMode=value;this.rewardEncounter();this.tell('speed_change',{from,to:value,reason:'dev_console_override'});
    }
    else if(action==='engine'){
      if(this.status!=='running'||!['20','stall'].includes(String(value)))return false;
      this.engineShield=0;this.cars[0].hp=value==='stall'?0:this.cars[0].max*.2;this.syncSystems();
    }
    else if(action==='kill'){if(!this.killPlayer())return false;}
    else if(action==='trainLost'){if(this.status!=='running'||!this.alive)return false;this.setPlayerLayer(LAYER.DEPOT);this.player.depotId=this.depots[0]?.id;this.killPlayer('train_lost');}
    else return false;
    this.tell('dev_action',{action,value:typeof value==='string'||typeof value==='number'?value:null});return true;
  }
''' +s[i:]
s=s.replace('time:this.elapsed,...data','time:this.elapsed,...data,dev:this.dev')
s=s.replace('snapshot(){return{build:BUILD,','snapshot(){return{build:BUILD,dev:this.dev,timeScale:this.timeScale,')
p.write_text(s)
p=Path('src/main.js');s=p.read_text().replace("import {AudioCues}","import {runtimeMode,SimulationClock} from './runtime.js';\nimport {SaveStore} from './save.js';\nimport {DevTools} from './devtools.js';\nimport {AudioCues}")
s=s.replace('const $=id=>document.getElementById(id);', "const $=id=>document.getElementById(id);\nconst mode=runtimeMode(location.search),save=new SaveStore({mode}),clock=new SimulationClock();let devtools=null;")
s=s.replace('localStorage','save.storage')
s=s.replace('audio:audio.snapshot(),session:', 'audio:audio.snapshot(),clock:clock.snapshot(),test:mode.test,session:')
s=s.replace("new Game({seed:314159,emit})", "new Game({seed:314159,emit,dev:mode.dev})")
s=s.replace('audio.update(game);game.step(dt,input);view.render(dt);ui();', 'clock.advance(game,raw/1000,input);audio.update(game);view.render(dt);ui();devtools?.update(ts);')
s=s.replace("window.__RH_DEBUG={snapshot,", "devtools=mode.dev?new DevTools({game:()=>game,audio,view:()=>view,clock,start:()=>{audio.unlock('dev_start');if(['lost','cashed','practice_complete'].includes(game.status))replaceGame(false);if(game.devCommand('start')){$('modal').hidden=true;lastStatus='';clock.reset();return true;}return false;},changed:()=>{clearInput();if(view.carCount!==game.cars.length)view.rebuildCars();if(game.status==='ready')showHub();ui();}}):null;\nwindow.__RH_DEBUG={snapshot,")
s=s.replace('game:()=>game,view:()=>view,audio:()=>audio,input:', 'game:()=>game,view:()=>view,audio:()=>audio,clock:()=>clock,save:()=>save,input:')
s=s.replace("function readBank(){try{const n=Number(save.storage.getItem('roundhouse_bank')||0);return Number.isFinite(n)&&n>=0?n:0;}catch{return 0;}}", "function readBank(){return save.read().bank;}")
s=s.replace("telemetry=new Telemetry(snapshot);game=new Game({bank:readBank(),seed:seed(),emit});", "telemetry=new Telemetry(snapshot,{...mode,storage:save.storage});game=new Game({bank:readBank(),seed:seed(),emit,dev:mode.dev});")
s=s.replace("new Game({bank:game.bank,seed:seed(),practice,emit})", "new Game({bank:game.bank,seed:seed(),practice,emit,dev:mode.dev})")
s=s.replace("try{save.storage.setItem('roundhouse_bank',String(game.bank));bankWritable=true;}catch{bankWritable=false;}", "bankWritable=save.write(game);")
p.write_text(s)
p=Path('src/telemetry.js');s=p.read_text().replace('constructor(snapshot){this.snapshot=snapshot;', "constructor(snapshot,{dev=false,test=false,storage=globalThis.localStorage}={}){this.dev=!!dev;this.test=!!test;this.storage=storage;this.snapshot=snapshot;")
s=s.replace("this.live=location.hostname==='lys20001205.github.io';", "this.live=globalThis.location?.hostname==='lys20001205.github.io'&&!this.dev&&!this.test;")
s=s.replace('localStorage.getItem','this.storage?.getItem').replace('localStorage.setItem','this.storage?.setItem')
s=s.replace('performance.now()),type};', 'performance.now()),type,dev:!!this.dev,test:!!this.test};')
s=s.replace('report(){return{v:BUILD,', 'dispose(){clearInterval(this.timer);clearTimeout(this.saveTimer);}\n report(){return{dev:this.dev,test:this.test,v:BUILD,')
p.write_text(s)
p=Path('src/balance.js');p.write_text(p.read_text().replace('V11-I-AUDIO-20260914','V11-J-DEV-20260914'))
p=Path('package.json');p.write_text(p.read_text().replace('tests/audio.test.mjs','tests/audio.test.mjs tests/dev.test.mjs'))
p=Path('style.css');p.write_text(p.read_text()+'''\n#devBadge{position:absolute;right:8px;top:7px;z-index:25;background:#633d12;border:1px solid #ecc477;color:#fff1be;font-size:11px;padding:5px 10px}#devPanel{position:absolute;right:8px;top:38px;width:290px;max-height:calc(100% - 46px);overflow:auto;z-index:25;background:#10242df5;border:1px solid #d8b56c;padding:9px;font-size:11px;border-radius:5px;touch-action:pan-y}#devPanel .devRow{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:7px;align-items:center}#devPanel .devRow>b{width:100%;color:#d9bc88;font-size:10px}#devPanel button,#devPanel select{font-size:10px;padding:5px 7px;background:#274650;color:#eaf4e9;border:1px solid #628781;border-radius:4px}#devPanel button.selected{border-color:#ffe8a5;background:#70551f}#devPanel pre{font-size:10px;white-space:pre-wrap;line-height:1.35;margin:5px 0;padding:6px;background:#09202a}#devNotice{color:#eace93;line-height:1.5}#devThreat{position:absolute;left:8px;top:7px;font-size:10px;z-index:13;pointer-events:none;background:#08202ce3;color:#ffe2a6;padding:6px;white-space:pre-line}\n''')
for n,(a,b) in checks.items():assert hashlib.sha256(Path(n).read_bytes()).hexdigest()==b,'OUTPUT MISMATCH '+n
