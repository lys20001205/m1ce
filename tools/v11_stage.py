"""Readable source migration. Exact baseline/output hashes; work-branch validation only."""
from pathlib import Path
import hashlib
checks={'package.json': ['8f02680bf0f1480285751140c4eb63b968f0f3152dce97d22064db7e38917c92', '84f24921758d42979ef7f6673f3e2749d7c7902c0dd0bf90f71e4ddaa2e38022'], 'src/balance.js': ['0a0130f2a07ef4f4a8d06272a2eea8b91c2c91c58712713e3d66950d2b9d44a5', '37cf9a37cc35483f7fe0c09f15553c3402fdf59f1c243d4e06fae5131d9a990b'], 'src/main.js': ['d04d53f0cc97178b80183c6242586eaf8061b01daf62cf0516c5ab1599743deb', '463d43e44edc7ef1705351025fb5a4807dc545194f9edb952b4781190e73b17f']}
for n,(a,b) in checks.items():assert hashlib.sha256(Path(n).read_bytes()).hexdigest()==a,'BASE MISMATCH '+n
p=Path('src/main.js');s=p.read_text().replace('const pressed=new Map(),audio=new AudioCues();',"const pressed=new Map(),audio=new AudioCues({emit:(type,data)=>telemetry?.log(type,data)});\ntry{audio.enabled=localStorage.getItem('roundhouse_sound')!=='no';}catch{}")
s=s.replace('session:telemetry?.session,','audio:audio.snapshot(),session:telemetry?.session,')
s=s.replace("$('sound').onclick=async()=>{$('sound').textContent=await audio.toggle()?'声音开':'静音';};", "$('sound').onclick=()=>{const on=audio.toggle();$('sound').textContent=on?'声音开':'静音';try{localStorage.setItem('roundhouse_sound',on?'yes':'no');}catch{}};")
s=s.replace("audio.unlock();if(game.start())", "audio.unlock('start');if(game.start())").replace("lastStatus='running';audio.active=true;audio.unlock();", "lastStatus='running';audio.active=true;")
s=s.replace("b.onclick=()=>{if(game.chooseRoute(r.id))showHub();};", "b.onclick=()=>{audio.unlock('route_gesture');if(game.chooseRoute(r.id))showHub();};")
s=s.replace("window.__RH_DEBUG={snapshot,", "addEventListener('pageshow',()=>audio.restore('pageshow'));\ndocument.addEventListener('visibilitychange',()=>{if(!document.hidden)audio.restore('visible');});\nfor(const type of ['pointerdown','keydown'])addEventListener(type,()=>{if(audio.context&&audio.context.state!=='running')audio.unlock('recovery_gesture');},{capture:true});\nwindow.__RH_DEBUG={snapshot,")
s=s.replace('game:()=>game,view:()=>view,input:', 'game:()=>game,view:()=>view,audio:()=>audio,input:')
p.write_text(s)
p=Path('src/balance.js');p.write_text(p.read_text().replace('V11-H-TRAIN-20260914','V11-I-AUDIO-20260914'))
p=Path('package.json');p.write_text(p.read_text().replace('tests/train_build.test.mjs','tests/train_build.test.mjs tests/audio.test.mjs'))
for n,(a,b) in checks.items():assert hashlib.sha256(Path(n).read_bytes()).hexdigest()==b,'OUTPUT MISMATCH '+n
