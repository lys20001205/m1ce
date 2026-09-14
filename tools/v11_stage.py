"""V11-E readable, exact-hash migration. Run only in the non-deploying validation branch."""
from pathlib import Path
import hashlib
root=Path('.')
checks={
'src/sim.js':('a6fdb1a04717ddeed9faa65e9536cdbba71b21bdb5403aeb330061974b2f0184','c89165461dad172caca72e9a73f99f5f468f414bc929be6e3a95af8a84b46f6a'),
'src/main.js':('a60a94208e55a8c6c9176f07893a38b2f2b99cd59638dca7838617e1e8ca3a21','412ddec66f36619f5ca9e5fe37bbd41e9d8c28ed3b0c2507e80f1c0f163ec764'),
'src/view.js':('6b7121fb6e233a0ab3630048881ca02dcd059ca8abeb0dff30d7f634e8695724','09ce67fbb68e77b2b33b28f66cfad2a7a875fb356d7efc5f6b636e1f55ddfae7'),
'src/feedback3d.js':('e810da7bef6407c30df3d531235c810d5b8946b111e590b2acd682bf9ac04d68','798ae5e0ade0a7a116f8c967f8a215bcad67ac5b1454d07c0b1769a1e2b5cb9d'),
'src/balance.js':('5385ca528f877c64d20b575f59ca08bad2a836dc1a26c4927e7a48cbeaf972a3','1cd190ff4d0f0bddf964a4cd52c35e2391cda80b6a3833f2527b1f8828c02aa4'),
'package.json':('772c666fa857a62787b3b2bfa6c025340108ffe5263374e90282cc720c1ee10d','8a19138df28e25bcc6cd6789b0e290a9f7106de08a98fa3c7fd009d91d8a62e0')}
for name,(before,after) in checks.items():
 assert hashlib.sha256((root/name).read_bytes()).hexdigest()==before,'BASE MISMATCH '+name
p=root/'src/sim.js';s=p.read_text()
s=s.replace("this.round=1;this.money=1000;", "this.round=1;this.scrap=0;this.meleeTier=1;this.rangedTier=0;this.money=1000;")
s=s.replace("respawnAt:0,protection:0,hp:100", "respawnAt:0,protection:0,deathReason:null,deathLayer:null,deathCount:0,hp:100")
s=s.replace("p.hp=0;p.lifeState=LIFE.DEAD;", "p.deathReason=reason;p.deathLayer=this.playerLayer;p.deathCount++;\n    p.hp=0;p.lifeState=LIFE.DEAD;")
s=s.replace("if(p.respawnRemaining<=1e-8){", "// A rescue expiry in this simulation step wins over a simultaneous respawn.\n      // Player death never creates, resets or extends the engine rescue clock.\n      const engineExpires=this.engineState==='stalled'&&this.rescue&&this.rescue.remaining<=dt+1e-8;\n      if(p.respawnRemaining<=1e-8&&!engineExpires){")
s=s.replace("this.syncSystems();const p=this.player;this.elapsed+=dt;this.lifeStep(dt);", "this.syncSystems();const p=this.player;if(p.hp<=0&&this.alive)this.killPlayer('hp_zero');this.elapsed+=dt;this.lifeStep(dt);")
s=s.replace("if(this.status!=='running')return;\n    this.syncSystems();const p=this.player;", "// The four-second dock does not erase a remaining death countdown.\n    if(['complete','cashed'].includes(this.status)){this.elapsed+=dt;this.lifeStep(dt);this.effectsStep(dt);return;}\n    if(this.status!=='running')return;\n    this.syncSystems();const p=this.player;")
s=s.replace("if(this.status!=='complete'||this.practice)return false;", "if(this.status!=='complete'||this.practice||!this.alive)return false;")
s=s.replace("snapshot(){return{build:BUILD,", "snapshot(){return{build:BUILD,scrap:this.scrap,meleeTier:this.meleeTier,rangedTier:this.rangedTier,deathReason:this.player.deathReason,deathLayer:this.player.deathLayer,deathCount:this.player.deathCount,")
p.write_text(s)
p=root/'src/main.js';s=p.read_text()
s=s.replace("function emit(type,data){telemetry?.log(type,data);audio.event(type);}", "function emit(type,data){if(type==='player_death')clearInput();telemetry?.log(type,data);audio.event(type);}")
s=s.replace("$('lifePanel').hidden=game.alive||game.status!=='running';$('lifePanel').textContent=(game.event==='TRAIN LOST'?", "$('lifePanel').hidden=game.alive||!['running','arriving','complete'].includes(game.status);$('lifePanel').textContent=(game.player.deathReason==='train_lost'?")
s=s.replace("$('round').textContent=String", "$('more').disabled=!game.alive;\n  $('round').textContent=String")
p.write_text(s)
p=root/'src/feedback3d.js';s=p.read_text()
s=s.replace("this.speedStreaks=new", "this.spawnRing=new T.Mesh(new T.TorusGeometry(.70,.035,6,28),view.mat(0x93e5ee));this.spawnRing.rotation.x=Math.PI/2;this.group.add(this.spawnRing);\n    this.speedStreaks=new")
s=s.replace("const color={normal", "this.spawnRing.visible=g.alive&&g.player.protection>0;this.spawnRing.position.set(g.player.x,g.player.y+.04,g.player.z??.65);this.spawnRing.scale.setScalar(reduced?1:1+.08*Math.sin(t*7));\n    const color={normal")
p.write_text(s)
p=root/'src/balance.js';p.write_text(p.read_text().replace("V11-C-RING-20260914","V11-E-LIFE-20260914"))
p=root/'package.json';p.write_text(p.read_text().replace('tests/depot.test.mjs','tests/depot.test.mjs tests/life.test.mjs'))
p=root/'src/main.js';s=p.read_text();s=s.replace("if(game.paused||game.status!=='running')return;", "if(game.paused||game.status!=='running'||!game.alive)return;")
s=s.replace("e.target?.tagName==='INPUT'||game.paused||game.status!=='running'", "e.target?.tagName==='INPUT'||game.paused||game.status!=='running'||!game.alive")
p.write_text(s)
p=root/'src/view.js';s=p.read_text()
s=s.replace("const g=this.game,p=g.player;this.moving", "const g=this.game,p=g.player,focus=g.alive?p.x:V11.respawnX;this.moving")
s=s.replace("this.ground.position.x=p.x", "this.ground.position.x=focus").replace("Math.abs(m.position.x-p.x)<42", "Math.abs(m.position.x-focus)<42")
s=s.replace("this.rangeLine.visible=g.status==='running'", "this.rangeLine.visible=g.status==='running'&&g.alive")
s=s.replace("this.lamps.position.x=p.x", "this.lamps.position.x=focus").replace("this.sun.position.set(p.x-8", "this.sun.position.set(focus-8").replace("this.sun.target.position.set(p.x,0,0)", "this.sun.target.position.set(focus,0,0)")
p.write_text(s)
p=root/'src/feedback3d.js';s=p.read_text().replace("scratch.position.set(g.player.x-17", "scratch.position.set((g.alive?g.player.x:V11.respawnX)-17").replace("this.station.visible=g.status==='running'&&", "this.station.visible=g.status==='running'&&g.alive&&");p.write_text(s)
for name,(before,after) in checks.items():
 actual=hashlib.sha256((root/name).read_bytes()).hexdigest()
 assert actual==after,'OUTPUT MISMATCH '+name+' '+actual
print('V11-E locally verified 89-unit source reproduced exactly; Chromium/WebKit gates still required.')
