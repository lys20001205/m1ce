"""G regression fixes: synchronous/stable UI, true touch input and stop anti-toggle quota."""
from pathlib import Path
import hashlib
checks={'src/sim.js': ['ea6208acddf2158631e7c16895e897c887d3b52daa9804dbb1cc2f7a2db9a6f3', 'd3fff2a895694016ea50f0e34699adfb5e46feaa95d7647f45bb4bc3b9b3e1f0'], 'src/main.js': ['367e8c95193db1decc9b978d2f64b844265f542eddc251fd2983e5b68f29e65c', '8dfe372e2aaf1775267a768ef652ab3dbdb971d9f3803689594621927b566f4b'], 'tests/combat.test.mjs': ['bbf6f1b4309c62512a6fee7a697c51f9cb8d1907dda343e98df72d5b36944b94', 'bb3f43e1bb4c95a6d4889c984f4f554eb53b3259f0d4539394ccd8ab91fd85e4'], 'tests/browser_v11_combat.py': ['d9fd8521644570382fe35e1fe98d91fc21f28c3253eae9be8277b53ee4b86d94', '173638f609d84854639ee03d296ee122f30dcc863934152d06d3548dbef7c48b']}
for n,(a,b) in checks.items():assert hashlib.sha256(Path(n).read_bytes()).hexdigest()==a,n
p=Path('src/sim.js');s=p.read_text().replace('this.armoryOpen=false;this.rewardEncounters=new Map();','this.armoryOpen=false;this.stopRewardRegion=null;this.rewardEncounters=new Map();')
s=s.replace("this.speedMode=mode;this.tell('speed_change'", "this.speedMode=mode;this.rewardEncounter();this.tell('speed_change'")
s=s.replace("this.speedMode='STOP';this.tell('emergency_stop'", "this.speedMode='STOP';this.rewardEncounter();this.tell('emergency_stop'")
s=s.replace("return ['STOP','SLOW'].includes(this.speedMode)||this.engineState==='stalled'?this.round+':stop:'+Math.floor(this.t/V11.stopRegionProgress):null;", "const region=this.round+':stop:'+Math.floor(this.t/V11.stopRegionProgress);\n    if(['STOP','SLOW'].includes(this.speedMode)||this.engineState==='stalled')this.stopRewardRegion=region;\n    return this.stopRewardRegion===region?region:null;")
s=s.replace('this.rewardEncounters.clear();}', 'this.rewardEncounters.clear();this.stopRewardRegion=null;}')
s=s.replace('  openArmory(){', "  closeArmory(){this.armoryOpen=false;}\n  openArmory(){")
p.write_text(s)
p=Path('src/main.js');s=p.read_text().replace("$('closeArmory').onclick=()=>{game.armoryOpen=false;};", "$('closeArmory').onclick=()=>game.closeArmory();").replace(".onclick=()=>game.buyWeapon(slot);", ".onclick=()=>{game.buyWeapon(slot);ui();};")
s=s.replace("b.textContent=slot.toUpperCase()+' · '+(offer?(offer.locked?'LOCKED UNTIL COMBAT TIER 3':offer.name+' · '+offer.cost+' SCRAP'):'MAX TIER');", "const text=slot.toUpperCase()+' · '+(offer?(offer.locked?'LOCKED UNTIL COMBAT TIER 3':offer.name+' · '+offer.cost+' SCRAP'):'MAX TIER');if(b.textContent!==text)b.textContent=text;")
p.write_text(s)
p=Path('tests/combat.test.mjs');p.write_text(p.read_text()+'''\ntest('stop quota remains attached to the rail region after accelerating before the next spawn',()=>{const {g}=run();g.player.x=5.8;g.setSpeed('STOP');for(let i=0;i<6;i++)kill(g,'bruiser');g.setSpeed('CRUISE');kill(g,'bruiser');assert.equal(g.scrap,37);g.t=.201;kill(g,'bruiser');assert.equal(g.scrap,43);});\n''')
p=Path('tests/browser_v11_combat.py');s=p.read_text().replace("'__RH_DEBUG?.snapshot()", "'window.__RH_DEBUG?.snapshot()")
s=s.replace("await page.click('[data-armory='+slot+']')", "await page.locator('[data-armory='+slot+']').tap()\n            await page.wait_for_function(\"__RH_TEST.game()[\"+json.dumps(slot)+\"]?.id===\"+json.dumps(weapon),timeout=3000)")
s=s.replace("report['failureState']=await page.evaluate('__RH_DEBUG.snapshot()');", "report['failureState']=await page.evaluate('__RH_DEBUG.snapshot()');report['failureEvents']=await page.evaluate('__RH_DEBUG.logs().slice(-40)');")
p.write_text(s)
for n,(a,b) in checks.items():assert hashlib.sha256(Path(n).read_bytes()).hexdigest()==b,n
