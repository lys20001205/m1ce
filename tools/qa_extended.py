"""Continuation of recorded QA, with bounded live-UI interactions and independent
fixture sections. Never claims human first-time play, listening or real devices.
The initial failed explorations remain in their original Actions artifacts.
"""
import asyncio,base64,json,math,time
from playwright.async_api import TimeoutError as PWTimeout
import qa_exploratory as q

async def click_live(s,selector,timeout=500):
    try:
        await s.p.locator(selector).click(timeout=timeout)
        return True
    except PWTimeout:
        return False

async def resume(s):
    await s.p.bring_to_front()
    await s.p.wait_for_timeout(900)
    attempts=0
    while (await s.state())['paused'] and attempts<3:
        attempts+=1
        await s.p.locator('#pause').click()
        await s.p.wait_for_timeout(900)
    await s.record('resume-'+str(attempts),False)
    await s.check('resume_succeeds',not (await s.state())['paused'])
    return not (await s.state())['paused']

async def pilot(s):
    v=await s.state()
    if v['playerLifeState']=='DEAD_WAITING_RESPAWN':await s.held();return
    if v['paused']:await s.held();await resume(s);return
    foes=[e for e in v['enemyStates'] if e['hp']>0 and e['roof']==v['roof']]
    e=min(foes,key=lambda e:abs(e['x']-v['px'])) if foes else None
    if v['roof'] and (not e or v['hazard']):
        await s.walk(math.floor(v['px']/8.3)*8.3+4.316);await s.tap('KeyW');return
    if e:
        d=abs(e['x']-v['px']);direction=1 if e['x']>v['px'] else -1;keys=[]
        if d>1.25 or v['facing']!=direction:keys.append('KeyD' if direction>0 else 'KeyA')
        if d<2.3:keys.append('KeyJ')
        if v['rangedWeapon']:keys.append('KeyK')
        await s.held(keys);return
    if v['engineHp']<140 or v['engineState']=='stalled':
        await s.held(['KeyD' if v['px']<5.8 else 'KeyA'] if abs(v['px']-5.8)>.35 else ['KeyE']);return
    offer=next((o for o in v['armoryOffers'].values() if o and not o['locked'] and o['cost']<=v['scrap']),None)
    if offer and not v['roof']:
        await s.held();await s.walk(1.7);await s.tap('KeyF')
        if await click_live(s,'[data-armory='+offer['slot']+']'):
            await s.record('upgrade-'+offer['weapon'])
        await click_live(s,'#closeArmory',200)
        return
    if any(e['roof'] and e['hp']>0 for e in v['enemyStates']) and not v['roof'] and v['phase'] not in ['crane','approach','tunnel'] and not v['hazard']:
        await s.walk(math.floor(v['px']/8.3)*8.3+4.316);await s.tap('KeyW');return
    await s.held()

async def normal(s):
    route=q.CASE.split('-',1)[1];car={'freight':'cargo','industrial':'workshop','tunnel':'battery'}[route]
    await s.check('no_mutable_test_api',await s.p.evaluate('typeof __RH_TEST==="undefined"'))
    await s.record('initial');await q.start(s,route,car)
    for lap in [1,2]:
        end=time.monotonic()+280;depot=False;seen=set();last_death=0;last_sample=0
        while time.monotonic()<end:
            v=await s.state()
            if v['status'] not in ['running','arriving']:break
            if v['phase'] not in seen:seen.add(v['phase']);await s.record('lap'+str(lap)+'-phase-'+v['phase'])
            if v['deathCount']!=last_death:last_death=v['deathCount'];await s.record('death-'+str(last_death));await s.held()
            if v['elapsed']-last_sample>15:last_sample=v['elapsed'];await s.record('travel-sample',False)
            if route=='freight' and not depot and .259<=v['routeProgress']<.264:depot=True;await q.cargo_stop(s)
            elif v['status']=='running':await pilot(s)
            await s.p.wait_for_timeout(100)
        await s.held();v=await s.record('lap'+str(lap)+'-end')
        await s.check('normal_round_'+str(lap)+'_completed',v['status']=='complete')
        if v['status']!='complete':return
        if lap==1:
            await s.p.locator('#more').click();await s.record('one-more-round');await q.start(s,route,car)
            await s.check('repeat_route_pressure',(await s.state())['repeatPressure']==1)
    await s.p.locator('#cash').click();v=await s.record('cashout')
    await s.check('cashout_bank_increased',v['status']=='cashed' and v['bank']>0)
    if await s.p.locator('[data-prep=reroll]').is_enabled():
        await s.p.locator('[data-prep=reroll]').click();await s.record('legitimate-reroll-purchase')
        await s.p.locator('#restart').click();await s.p.locator(f'[data-route={route}]').click()
        if await s.p.locator('[data-reroll=car]').count():await s.p.locator('[data-reroll=car]').click();await s.record('legitimate-reroll-use')
    await s.check('no_runtime_errors',not s.errors)

async def reset(s):
    await s.held();await s.fixture('''() => {const a=__RH_TEST;a.reset();const g=a.game();g.route='freight';g.prepareDepots();g.director.rest=9999;}''')
    await s.p.wait_for_timeout(500)
    if (await s.state())['paused']:await resume(s)

async def section(s,name,fn):
    try:
        await reset(s);await fn(s);await s.record(name+'-end')
        await s.check(name+'_script_completed',True)
    except Exception as e:
        await s.held();await s.check(name+'_script_completed',False)
        s.log.append({'section':name,'exception':str(e),'classification':'TEST_FAILURE_REQUIRES_REVIEW'})
        (q.OUT/f'{q.CASE}-{q.BROWSER}-actions.json').write_text(json.dumps(s.log,ensure_ascii=False,indent=2))
        try:await s.p.screenshot(path=str(q.OUT/f'{q.CASE}-{q.BROWSER}-{name}-failure.png'))
        except Exception:pass

async def inputs(s):
    await s.held(['KeyA','KeyD','KeyJ']);await s.p.wait_for_timeout(450);v=await s.state();await s.check('opposed_move_cancels',abs(v['px']-3)<.05)
    await s.held(['KeyD','KeyJ']);await s.p.wait_for_timeout(450);await s.held();await s.record('move-and-attack')
    await s.check('move_with_attack',(await s.state())['px']>4)
    # Pointer capture: held pointer outside must release without sticky movement.
    box=await s.p.locator('#R').bounding_box();await s.p.mouse.move(box['x']+20,box['y']+20);await s.p.mouse.down();await s.p.wait_for_timeout(250)
    await s.p.mouse.move(300,120);await s.p.mouse.up();await s.p.wait_for_timeout(250)
    x=(await s.state())['px'];await s.p.wait_for_timeout(250);await s.check('pointer_release_stops',abs((await s.state())['px']-x)<.01)
    await s.p.set_viewport_size({'width':390,'height':844});await s.p.wait_for_timeout(1200);await s.check('portrait_pauses',(await s.state())['paused'])
    await s.p.set_viewport_size({'width':844,'height':390});await s.p.wait_for_timeout(1200);await s.check('landscape_requires_resume',(await s.state())['paused'])
    await resume(s);await s.record('orientation-restored')
    before=(await s.state())['px'];await s.held(['KeyD']);await s.p.wait_for_timeout(350);await s.held();await s.check('post_rotate_input_moves',(await s.state())['px']>before)
    # Dispatched blur is a synthetic event check, not OS app switching.
    await s.p.evaluate('window.dispatchEvent(new Event("blur"))');await s.p.wait_for_timeout(200);await s.check('synthetic_blur_pauses',(await s.state())['paused'])
    await resume(s);await s.walk(1.7);await s.tap('KeyF');await s.record('armory-open')
    await s.check('armory_opened',await s.p.locator('#armoryPanel').is_visible());await s.walk(5.8)
    await s.check('armory_closes_on_leave',await s.p.locator('#armoryPanel').is_hidden())
    await s.tap('KeyB');await s.walk(12.45);await s.tap('KeyW');await s.tap('KeyF');await s.record('remote-console-attempt')
    await s.check('remote_acceleration_not_open',await s.p.locator('#speedPanel').is_hidden() and (await s.state())['speedMode']=='STOP')

async def life(s):
    await s.fixture('''() => {const a=__RH_TEST,g=a.game();a.forceRoute(.26);a.forcePlayer(5.8);g.setSpeed('SLOW');a.forcePlayer(12.45,true);g.interact();}''')
    await s.tap('KeyF');v=await s.record('slow-carry');await s.check('carrying_before_lost',v['heldCargo'] is not None)
    await s.p.wait_for_function('__RH_DEBUG.snapshot().deathReason==="train_lost"',timeout=30000)
    v=await s.record('train-lost');await s.check('train_lost_cargo_removed',v['heldCargo'] is None and v['respawnRemaining']>0)
    await s.p.wait_for_function('__RH_DEBUG.snapshot().playerLifeState==="ALIVE_PROTECTED"',timeout=9000)
    v=await s.record('respawn');await s.check('respawn_engine_hp60',v['playerHp']==60 and v['playerLayer']=='INTERIOR' and v['px']==3)
    hp=await s.fixture('''() => {const g=__RH_TEST.game();g.hurt(25);return g.player.hp;}''');await s.check('respawn_blocks_immediate_damage',hp==60)
    await s.fixture('''() => {const a=__RH_TEST,g=a.game();g.enemies=[];g.director.rest=9999;g.engineShield=0;a.forcePlayer(5.8);g.runRepairKit=1;g.damageCar(0,g.cars[0].hp);}''')
    await s.record('stall');await s.held(['KeyE']);await s.p.wait_for_function('__RH_DEBUG.snapshot().engineState!=="stalled"',timeout=5000);await s.held();await s.record('restart')
    await s.check('held_input_repairs_stall',(await s.state())['engineState']!='stalled')
    await s.fixture('''() => {const a=__RH_TEST,g=a.game();g.engineShield=0;g.cars[0].hp=180;g.syncSystems();a.forcePlayer(12.45);g.damageCar(0,180);g.killPlayer();}''');await s.record('death-during-stall')
    await s.p.wait_for_function('__RH_DEBUG.snapshot().playerLifeState==="ALIVE_PROTECTED" || __RH_DEBUG.snapshot().status==="lost"',timeout=9000)
    v=await s.record('stall-respawn');await s.check('death_does_not_reset_rescue',v['rescue'] is not None and v['rescue']['remaining']<8)
    await s.p.wait_for_function('__RH_DEBUG.snapshot().status==="lost"',timeout=18000);await s.record('engine-terminal')
    await reset(s);await s.fixture('''() => {const a=__RH_TEST,g=a.game();g.engineShield=0;a.forcePlayer(5.8);g.damageCar(0,180);a.step(6);g.killPlayer();}''')
    await s.p.wait_for_function('__RH_DEBUG.snapshot().status==="lost"',timeout=6000);v=await s.record('terminal-before-respawn')
    await s.check('terminal_cancels_respawn',v['terminalDestroyed'] and v['respawnRemaining']==0)

async def cargo(s):
    await s.fixture('''() => {const a=__RH_TEST,g=a.game();a.forceRoute(.26);a.forcePlayer(5.8);g.setSpeed('FAST');a.forcePlayer(12.45,true);}''')
    await s.tap('KeyF');v=await s.record('fast-entry-blocked');await s.check('fast_cannot_board',v['playerLayer']=='ROOF')
    await s.fixture('''() => {const a=__RH_TEST,g=a.game();a.forceRoute(.26);a.forcePlayer(5.8);g.setSpeed('STOP');for(let i=0;i<3;i++)g.createCargo(450,'stored',{carIndex:1,secured:true});a.forcePlayer(12.45,true);g.interact();}''')
    await s.tap('KeyF');v=await s.record('cargo-full');await s.check('full_pickup_rejected',v['heldCargo'] is None and v['cargoUsed']==3)
    await s.check('full_message_visible','CARGO FULL' in await s.p.locator('#event').inner_text())
    await reset(s);await s.fixture('''() => {const a=__RH_TEST,g=a.game();a.forceRoute(.26);a.forcePlayer(5.8);g.setSpeed('STOP');a.forcePlayer(12.45,true);g.interact();}''')
    await s.tap('KeyF');await s.record('carrying-death-start');await s.fixture('() => __RH_TEST.game().killPlayer()');await s.record('carrying-death-depot')
    await s.check('depot_death_loses_cargo',(await s.state())['heldCargo'] is None)
    await reset(s);await s.fixture('''() => {const a=__RH_TEST,g=a.game();g.round=3;g.director.rest=0;a.forceRoute(.26);a.forcePlayer(5.8);g.setSpeed('STOP');}''')
    for n in range(3):await s.p.wait_for_timeout(12000);await s.record('stop-idle-'+str(n))
    v=await s.state();await s.check('stop_has_real_pressure',v['engineHp']<180 or v['playerHp']<100 or v['deathCount']>0)

async def weapons(s):
    await s.fixture('''() => {const a=__RH_TEST,g=a.game();g.scrap=200;a.forcePlayer(1.7);}''')
    for weapon,slot in [('wrench',None),('knife','melee'),('axe','melee'),('handgun','ranged'),('smg','ranged'),('rifle','ranged')]:
        # Isolate upgrade UI from the previous enemy's stun; this is a comparison fixture.
        await s.fixture('''() => {const a=__RH_TEST,g=a.game();g.enemies=[];g.projectiles=[];g.player.stun=0;g.player.hp=100;g.armoryOpen=false;a.forcePlayer(1.7);}''')
        if slot:
            await s.tap('KeyF');await s.p.locator('[data-armory='+slot+']').click();await click_live(s,'#closeArmory',200)
        await s.fixture('''() => {const g=__RH_TEST.game();g.spawn('boarder',3,false);g.player.face=1;}''')
        await s.held(['KeyK' if slot=='ranged' else 'KeyJ']);await s.p.wait_for_timeout(2100);await s.held();await s.record('weapon-'+weapon)
    await s.check('rifle_reached',(await s.state())['rangedWeapon']=='rifle')
    await s.fixture('''() => {const a=__RH_TEST,g=a.game();g.enemies=[];g.player.stun=0;a.forcePlayer(1.7);g.openArmory();}''');await s.record('armory-before-hit')
    await s.fixture('() => __RH_TEST.game().hurt(5)');await s.p.wait_for_timeout(150);await s.check('armory_closes_on_hit',await s.p.locator('#armoryPanel').is_hidden())

async def enemies(s):
    for enemy in ['boarder','clinger','thief','saboteur','bruiser']:
        await reset(s)
        await s.fixture('''type => {const a=__RH_TEST,g=a.game();g.round=3;g.cars[0].hp=180;g.syncSystems();g.player.hp=100;a.forcePlayer(type==='thief'?12.45:3);if(type==='thief')g.createCargo(450,'stored',{carIndex:1,secured:true});const e=g.spawn(type,type==='thief'?12.45:6,false);if(!e)throw Error('Enemy not spawned');}''',enemy)
        for delay in [350,1000,2200,3500]:await s.p.wait_for_timeout(delay);await s.record('enemy-'+enemy+'-'+str(delay))
    await reset(s);await s.fixture('''() => {const a=__RH_TEST,g=a.game();g.round=8;g.createCargo(450,'stored',{carIndex:1,secured:true});a.forcePlayer(5.8);g.spawn('thief',12.45);g.spawn('saboteur',8);g.spawn('bruiser',3);}''')
    await s.p.wait_for_timeout(2000);await s.record('mixed-enemies')

async def meta(s):
    await s.fixture('''() => {const a=__RH_TEST,g=a.game();g.bank=16000;g.finish();g.completeArrival();g.cashout();a.step(.025);}''')
    for item in ['reroll','repairKit','intel']:await s.p.locator('[data-prep='+item+']').click()
    await s.record('prep-purchased');await s.p.locator('#restart').click();await s.record('intel-revealed')
    await s.p.locator('[data-route=freight]').click();await s.p.locator('[data-reroll=car]').click();await s.record('reroll-used')
    await s.p.locator('[data-car=cargo]').click();await s.p.locator('#start').click();await s.check('kit_equipped',(await s.state())['runRepairKit']==1)
    await s.record('kit-equipped')
    await s.fixture('''() => {const a=__RH_TEST,g=a.game();g.director.rest=9999;a.forceCars(12);a.forcePlayer(95,true);}''')
    for width,height in [(812,332),(844,390),(932,430),(1280,720)]:
        await s.p.set_viewport_size({'width':width,'height':height});await s.p.wait_for_timeout(650);await s.record('long-train-'+str(width));v=await s.state()
        await s.check('camera-'+str(width),0<=v['playerScreenX']<=width)
    await s.p.reload(wait_until='networkidle');await s.p.wait_for_function('__RH_DEBUG.snapshot().modelsLoaded===3');await s.record('reload-save')
    await s.check('reload_no_runtime_errors',not s.errors)

async def audio_begin(s):
    return await s.fixture('''() => {const a=__RH_TEST.audio();if(!window.MediaRecorder||!a.context)return null;const d=a.context.createMediaStreamDestination();a.master.connect(d);const r=new MediaRecorder(d.stream);window.qaAudio={r,chunks:[],d};r.ondataavailable=e=>{if(e.data.size)qaAudio.chunks.push(e.data);};r.start();return true;}''')
async def audio_end(s):
    result=await s.fixture('''async () => {if(!window.qaAudio)return null;const {r,chunks}=qaAudio;await new Promise(resolve=>{r.onstop=resolve;r.stop();});const blob=new Blob(chunks,{type:r.mimeType});const b=new Uint8Array(await blob.arrayBuffer());let text='';for(let i=0;i<b.length;i++)text+=String.fromCharCode(b[i]);return {data:btoa(text),mime:r.mimeType};}''')
    if result:
        (q.OUT/f'{q.CASE}-{q.BROWSER}-audio.bin').write_bytes(base64.b64decode(result['data']));(q.OUT/f'{q.CASE}-{q.BROWSER}-audio-mime.txt').write_text(result['mime'])
async def probe(s):
    await q.start(s,'freight','cargo');recording=await audio_begin(s)
    await section(s,'inputs',inputs);await section(s,'life',life);await section(s,'cargo',cargo)
    await section(s,'weapons',weapons);await section(s,'enemies',enemies)
    await s.p.locator('#sound').click();await s.p.wait_for_timeout(500);await s.check('mute_output_zero',(await s.state())['audio']['outputRMS']<.00001)
    await s.p.locator('#sound').click();await s.p.wait_for_timeout(700);await s.check('unmute_output_nonzero',(await s.state())['audio']['outputRMS']>.00001)
    if recording:await audio_end(s)
    await section(s,'meta',meta);await s.check('no_runtime_errors',not s.errors)

q.normal=normal;q.pilot_step=pilot;q.probe=probe
if __name__=='__main__':asyncio.run(q.main())
