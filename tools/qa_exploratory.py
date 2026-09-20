"""Recorded browser exploration. Normal URL runs use real input and read-only
snapshots, never game-state writes. Probe runs are TEST FIXTURES, not human QA.
"""
import asyncio,base64,json,math,os,subprocess,sys,time
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path('qa-evidence');OUT.mkdir(exist_ok=True)
CASE=os.environ.get('QA_CASE','normal-freight')
BROWSER=os.environ.get('QA_BROWSER','chromium')
PUBLIC='https://lys20001205.github.io/m1ce/'
LOCAL='http://127.0.0.1:8780/'
class Session:
    def __init__(self,page):
        self.p=page;self.keys=set();self.log=[];self.checks={};self.errors=[];self.start=time.monotonic()
        page.on('pageerror',lambda e:self.errors.append(str(e)))
    async def state(self):return await self.p.evaluate('__RH_DEBUG.snapshot()')
    async def record(self,label,screenshot=True):
        s=await self.state();s['wallSeconds']=round(time.monotonic()-self.start,3)
        self.log.append({'label':label,'state':s})
        (OUT/f'{CASE}-{BROWSER}-actions.json').write_text(json.dumps(self.log,ensure_ascii=False,indent=2))
        if screenshot:await self.p.screenshot(path=str(OUT/f'{CASE}-{BROWSER}-{len(self.log):02d}-{label}.png'))
        print(label,s['status'],round(s['elapsed'],2),flush=True)
        return s
    async def held(self,keys=()):
        keys=set(keys)
        for k in self.keys-keys:await self.p.keyboard.up(k)
        for k in keys-self.keys:await self.p.keyboard.down(k)
        self.keys=keys
    async def tap(self,key):
        await self.p.keyboard.press(key);await self.p.wait_for_timeout(80)
    async def walk(self,x,limit=8):
        end=time.monotonic()+limit
        while time.monotonic()<end:
            s=await self.state()
            if s['status']!='running' or s['playerLifeState']=='DEAD_WAITING_RESPAWN':break
            if abs(s['px']-x)<.28:break
            await self.held(['KeyD' if s['px']<x else 'KeyA']);await self.p.wait_for_timeout(45)
        await self.held()
    async def speed(self,mode):
        await self.walk(5.8)
        s=await self.state()
        if s['roof']:await self.tap('KeyW')
        if await self.p.locator('#speedPanel').is_hidden():await self.tap('KeyF')
        if await self.p.locator('#speedPanel').is_visible():await self.p.locator(f'[data-speed={mode}]').click()
        return (await self.state())['speedMode']==mode
    async def fixture(self,js,arg=None):
        if not CASE.startswith('probe'):raise RuntimeError('No fixtures in normal runs')
        return await self.p.evaluate(js,arg)
    async def check(self,name,value):
        self.checks[name]=bool(value);print('CHECK',name,bool(value),flush=True)
async def start(s,route,car):
    await s.p.locator(f'[data-route={route}]').click();await s.record('car-choice')
    await s.p.locator(f'[data-car={car}]').click();await s.p.locator('#start').click();await s.record('depart')
async def cargo_stop(s):
    await s.held();await s.tap('KeyB');await s.record('depot-stop')
    d=(await s.state())['depots'][0]
    await s.walk(12.45);await s.tap('KeyW');await s.walk(d['x']);await s.tap('KeyF')
    await s.record('depot-entry-attempt')
    for offset in [1,-3,5,-7]:
        q=await s.state()
        if q['playerLayer']!='DEPOT':
            if q['playerLayer']!='ROOF':break
            await s.walk(d['x']);await s.tap('KeyF')
        if (await s.state())['playerLayer']!='DEPOT':break
        await s.walk(d['x']+offset);await s.tap('KeyF');q=await s.record('cargo-pickup-attempt')
        if not q['heldCargo']:break
        await s.walk(d['x']);await s.tap('KeyF');await s.walk(12.45);await s.tap('KeyF');await s.record('cargo-load-attempt')
    q=await s.state()
    if q['playerLayer']=='DEPOT':await s.walk(d['x']);await s.tap('KeyW')
    if (await s.state())['playerLayer']=='ROOF':await s.walk(12.45);await s.tap('KeyW')
    await s.speed('CRUISE');await s.record('leave-depot')
async def pilot_step(s):
    q=await s.state()
    if q['playerLifeState']=='DEAD_WAITING_RESPAWN':await s.held();return
    if q['paused']:await s.held();await s.p.locator('#pause').click();return
    same=[e for e in q['enemyStates'] if e['hp']>0 and e['roof']==q['roof']]
    e=min(same,key=lambda e:abs(e['x']-q['px'])) if same else None
    if q['roof'] and (not e or q['hazard']):
        await s.walk(math.floor(q['px']/8.3)*8.3+8.3*.52);await s.tap('KeyW');return
    if e:
        dist=abs(e['x']-q['px']);direction=1 if e['x']>q['px'] else -1;keys=[]
        if dist>1.25 or q['facing']!=direction:keys.append('KeyD' if direction>0 else 'KeyA')
        if dist<2.3:keys.append('KeyJ')
        if q['rangedWeapon']:keys.append('KeyK')
        await s.held(keys);return
    if q['engineHp']<140 or q['engineState']=='stalled':
        if abs(q['px']-5.8)>.35:await s.held(['KeyD' if q['px']<5.8 else 'KeyA'])
        else:await s.held(['KeyE'])
        return
    offer=next((o for o in q['armoryOffers'].values() if o and not o['locked'] and o['cost']<=q['scrap']),None)
    if offer and not q['roof']:
        await s.held();await s.walk(1.7);await s.tap('KeyF');button=s.p.locator('[data-armory='+offer['slot']+']')
        if await button.is_visible() and await button.is_enabled():await button.click();await s.record('upgrade-'+offer['weapon'])
        if await s.p.locator('#closeArmory').is_visible():await s.p.locator('#closeArmory').click()
        return
    roofs=[e for e in q['enemyStates'] if e['roof'] and e['hp']>0]
    if roofs and not q['roof'] and q['phase'] not in ['crane','approach','tunnel'] and not q['hazard']:
        await s.walk(math.floor(q['px']/8.3)*8.3+8.3*.52);await s.tap('KeyW');return
    await s.held()
async def normal(s):
    route=CASE.split('-',1)[1];car={'freight':'cargo','industrial':'workshop','tunnel':'battery'}[route]
    await s.check('no_mutable_test_api',await s.p.evaluate('typeof __RH_TEST==="undefined"'))
    await s.record('initial');await start(s,route,car)
    end=time.monotonic()+330;depot=False;seen=set();last_death=0;last_sample=0
    while time.monotonic()<end:
        q=await s.state()
        if q['status'] not in ['running','arriving']:break
        if q['phase'] not in seen:seen.add(q['phase']);await s.record('phase-'+q['phase'])
        if q['deathCount']!=last_death:last_death=q['deathCount'];await s.record('death-'+str(last_death));await s.held()
        if q['elapsed']-last_sample>15:last_sample=q['elapsed'];await s.record('travel-sample',False)
        if route=='freight' and not depot and .259<=q['routeProgress']<.264:depot=True;await cargo_stop(s)
        elif q['status']=='running':await pilot_step(s)
        await s.p.wait_for_timeout(120)
    await s.held();q=await s.record('route-end');await s.check('normal_round_completed',q['status']=='complete')
    if q['status']=='complete':
        await s.p.locator('#cash').click();q=await s.record('cashout')
        await s.check('cashout_bank_increased',q['status']=='cashed' and q['bank']>0)
        if await s.p.locator('[data-prep=reroll]').is_enabled():
            await s.p.locator('[data-prep=reroll]').click();await s.record('legitimate-reroll-purchase')
            await s.p.locator('#restart').click();await s.p.locator(f'[data-route={route}]').click()
            if await s.p.locator('[data-reroll=car]').count():await s.p.locator('[data-reroll=car]').click();await s.record('legitimate-reroll-use')
    await s.check('no_runtime_errors',not s.errors)
async def probe(s):
    await start(s,'freight','cargo')
    audio_mime=await s.fixture('''() => {const a=__RH_TEST.audio();if(!window.MediaRecorder||!a.context)return null;
        const d=a.context.createMediaStreamDestination();a.master.connect(d);const r=new MediaRecorder(d.stream);
        window.qaAudio={r,chunks:[],d};r.ondataavailable=e=>{if(e.data.size)qaAudio.chunks.push(e.data);};r.start();return r.mimeType;}''')
    await s.fixture('() => {__RH_TEST.game().director.rest=9999;}')
    await s.held(['KeyA','KeyD','KeyJ']);await s.p.wait_for_timeout(400)
    q=await s.record('opposed-keys');await s.check('opposed_move_cancels',abs(q['px']-3)<.05)
    await s.held(['KeyD','KeyJ']);await s.p.wait_for_timeout(450);await s.held()
    q=await s.record('move-and-attack');await s.check('move_with_attack',q['px']>4)
    await s.p.set_viewport_size({'width':390,'height':844});await s.p.wait_for_timeout(200);await s.check('portrait_pauses',(await s.state())['paused'])
    await s.p.set_viewport_size({'width':844,'height':390});await s.p.wait_for_timeout(200);await s.check('landscape_requires_resume',(await s.state())['paused'])
    await s.p.locator('#pause').click();await s.record('orientation-restored')
    await s.walk(1.7);await s.tap('KeyF');await s.record('armory-open');await s.walk(5.8)
    await s.check('armory_closes_on_leave',await s.p.locator('#armoryPanel').is_hidden())
    await s.tap('KeyB');await s.walk(12.45);await s.tap('KeyW');await s.tap('KeyF')
    await s.check('remote_acceleration_not_open',await s.p.locator('#speedPanel').is_hidden() and (await s.state())['speedMode']=='STOP')
    await s.fixture('''() => {const a=__RH_TEST,g=a.game();a.forceRoute(.26);a.forcePlayer(5.8);g.setSpeed('SLOW');a.forcePlayer(12.45,true);g.interact();}''')
    await s.tap('KeyF');await s.record('slow-carry')
    await s.p.wait_for_function('__RH_DEBUG.snapshot().deathReason==="train_lost"',timeout=25000)
    q=await s.record('train-lost');await s.check('train_lost_cargo_removed',q['heldCargo'] is None and q['respawnRemaining']>0)
    await s.p.wait_for_function('__RH_DEBUG.snapshot().playerLifeState==="ALIVE_PROTECTED"',timeout=7000)
    q=await s.record('respawn');await s.check('respawn_engine_hp60',q['playerHp']==60 and q['playerLayer']=='INTERIOR' and q['px']==3)
    await s.fixture('''() => {const a=__RH_TEST,g=a.game();g.enemies=[];g.director.rest=9999;g.engineShield=0;a.forcePlayer(5.8);g.runRepairKit=1;g.damageCar(0,g.cars[0].hp);}''')
    await s.record('stall');await s.held(['KeyE']);await s.p.wait_for_timeout(1850);await s.held()
    await s.check('held_input_repairs_stall',(await s.state())['engineState']!='stalled');await s.record('restart')
    await s.fixture('''() => {const a=__RH_TEST,g=a.game();g.engineShield=0;g.cars[0].hp=180;g.syncSystems();a.forcePlayer(12.45);g.damageCar(0,180);g.killPlayer();}''')
    await s.record('death-during-stall')
    await s.p.wait_for_function('__RH_DEBUG.snapshot().playerLifeState==="ALIVE_PROTECTED" || __RH_DEBUG.snapshot().status==="lost"',timeout=8000)
    q=await s.record('stall-respawn-or-terminal');await s.check('death_does_not_reset_rescue',q['rescue'] is not None and q['rescue']['remaining']<8)
    await s.p.wait_for_function('__RH_DEBUG.snapshot().status==="lost"',timeout=18000);await s.record('engine-terminal')
    await s.fixture('''() => {const a=__RH_TEST;a.reset();const g=a.game();g.director.rest=9999;g.engineShield=0;a.forcePlayer(5.8);g.damageCar(0,180);a.step(6);g.killPlayer();}''')
    await s.p.wait_for_function('__RH_DEBUG.snapshot().status==="lost"',timeout=6000)
    q=await s.record('terminal-before-respawn');await s.check('terminal_cancels_respawn',q['terminalDestroyed'] and q['respawnRemaining']==0)
    await s.fixture('''() => {const a=__RH_TEST;a.reset();const g=a.game();g.director.rest=9999;g.scrap=200;a.forcePlayer(1.7);}''')
    await s.p.locator('#sound').click();await s.p.wait_for_timeout(500);await s.check('mute_output_zero',(await s.state())['audio']['outputRMS']<.00001)
    await s.p.locator('#sound').click();await s.p.wait_for_timeout(500);await s.check('unmute_output_nonzero',(await s.state())['audio']['outputRMS']>.00001)
    for weapon,slot in [('wrench',None),('knife','melee'),('axe','melee'),('handgun','ranged'),('smg','ranged'),('rifle','ranged')]:
        if slot:
            await s.tap('KeyF');await s.p.locator('[data-armory='+slot+']').click()
            if await s.p.locator('#closeArmory').is_visible():await s.p.locator('#closeArmory').click()
        await s.fixture('''() => {const g=__RH_TEST.game();g.enemies=[];g.spawn('boarder',3,false);g.player.face=1;}''')
        await s.held(['KeyK' if slot=='ranged' else 'KeyJ']);await s.p.wait_for_timeout(1900);await s.held();await s.record('weapon-'+weapon)
    for enemy in ['boarder','clinger','thief','saboteur','bruiser']:
        await s.fixture('''type => {const a=__RH_TEST,g=a.game();g.enemies=[];g.projectiles=[];g.round=3;g.cars[0].hp=180;g.syncSystems();g.player.hp=100;a.forcePlayer(3);if(type==='thief'){g.cargoCrates=[];g.createCargo(450,'stored',{carIndex:1,secured:true});}g.spawn(type,type==='thief'?12.45:6,false);}''',enemy)
        for delay in [350,900,1300]:await s.p.wait_for_timeout(delay);await s.record('enemy-'+enemy+'-'+str(delay))
    await s.fixture('''() => {const a=__RH_TEST;a.reset();const g=a.game();g.director.rest=9999;g.bank=16000;g.finish();g.completeArrival();g.cashout();a.step(.025);}''')
    for item in ['reroll','repairKit','intel']:await s.p.locator('[data-prep='+item+']').click()
    await s.record('prep-purchased');await s.p.locator('#restart').click();await s.record('intel-revealed')
    await s.p.locator('[data-route=freight]').click();await s.p.locator('[data-reroll=car]').click();await s.record('reroll-used')
    await s.p.locator('[data-car=cargo]').click();await s.p.locator('#start').click()
    await s.check('kit_equipped',(await s.state())['runRepairKit']==1);await s.record('kit-equipped')
    await s.fixture('''() => {const a=__RH_TEST,g=a.game();g.director.rest=9999;a.forceCars(12);a.forcePlayer(95,true);}''')
    for width,height in [(812,332),(844,390),(932,430),(1280,720)]:
        await s.p.set_viewport_size({'width':width,'height':height});await s.p.wait_for_timeout(250);await s.record('long-train-'+str(width));q=await s.state()
        await s.check('camera-'+str(width),0<=q['playerScreenX']<=width)
    await s.fixture('''() => {const a=__RH_TEST,g=a.game();g.round=8;g.enemies=[];g.director.rest=9999;a.forcePlayer(5.8);g.spawn('thief',12.45);g.spawn('saboteur',8);g.spawn('bruiser',3);}''')
    await s.p.wait_for_timeout(1500);await s.record('mixed-enemies')
    if audio_mime:
        encoded=await s.fixture('''async () => {const {r,chunks}=qaAudio;await new Promise(resolve=>{r.onstop=resolve;r.stop();});const b=new Uint8Array(await new Blob(chunks).arrayBuffer());let text='';for(let i=0;i<b.length;i++)text+=String.fromCharCode(b[i]);return btoa(text);}''')
        (OUT/f'{CASE}-{BROWSER}-audio.bin').write_bytes(base64.b64decode(encoded));(OUT/f'{CASE}-{BROWSER}-audio-mime.txt').write_text(audio_mime)
    await s.check('no_runtime_errors',not s.errors)
async def main():
    server=subprocess.Popen([sys.executable,'-m','http.server','8780','--directory','dist','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    context=browser=None;s=None;report={'case':CASE,'browser':BROWSER,'humanPlaytest':False,'realDevice':False,'subjectiveAudio':'NOT_ASSESSED'}
    try:
        async with async_playwright() as p:
            kw={'headless':True}
            if BROWSER=='chromium':kw['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
            browser=await getattr(p,BROWSER).launch(**kw)
            context=await browser.new_context(viewport={'width':844,'height':390},has_touch=True,is_mobile=True,record_video_dir=str(OUT/'video'),record_video_size={'width':844,'height':390})
            page=await context.new_page();page.set_default_timeout(10000);s=Session(page)
            url=PUBLIC if CASE.startswith('normal') else LOCAL+'?test=1';report['url']=url;report['browserVersion']=browser.version
            await page.goto(url,wait_until='networkidle');await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
            try:report['siteBuild']=await (await context.request.get(url.split('?')[0]+'build.json')).json()
            except Exception as e:report['buildReadError']=str(e)
            await (normal(s) if CASE.startswith('normal') else probe(s));report['completedScript']=True
            await context.close();context=None;await browser.close();browser=None
    except Exception as e:
        report['exception']=str(e);report['completedScript']=False
        if s:
            try:await s.record('exception')
            except Exception:pass
    finally:
        if context:
            try:await context.close()
            except Exception:pass
        if browser:
            try:await browser.close()
            except Exception:pass
        server.terminate();server.wait(timeout=5)
        if s:report.update({'checks':s.checks,'errors':s.errors,'wallSeconds':time.monotonic()-s.start})
        (OUT/f'{CASE}-{BROWSER}-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False),flush=True)
    if not report.get('completedScript') or not all(report.get('checks',{}).values()):raise SystemExit(1)
if __name__=='__main__':asyncio.run(main())
