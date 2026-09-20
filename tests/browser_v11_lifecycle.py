"""C05-C07 fixtures with trusted keyboard/mouse input and real AudioContext recreation.
Not physical iPhone testing, audible review, or blind gameplay. No autoplay bypass.
"""
import asyncio
import json
import subprocess
import sys
from pathlib import Path
from playwright.async_api import async_playwright
ART = Path('artifacts')
ART.mkdir(exist_ok=True)
MINIMUM = 40
RESET = '''() => {const a=__RH_TEST;a.reset();const g=a.game();g.director.rest=9999;
 g.elapsed=5;g.t=.1;g.phase='yard';g.rangedTier=1;a.forcePlayer(4.8);a.step(0);}'''

async def run(p, name):
    report = {'browser': name, 'checks': {}, 'scope': 'C05-C07 test fixtures; trusted keyboard/mouse, actual Web Audio graph; no physical device claims', 'samples': []}
    errors = []
    browser = context = page = None
    def check(key, value):
        report['checks'][key] = bool(value)
        if not value:
            raise AssertionError(key)
    try:
        kw = {'headless': True}
        if name == 'chromium':
            kw['args'] = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
        browser = await getattr(p, name).launch(**kw)
        context = await browser.new_context(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True,
                                           record_video_dir=str(ART/f'{name}-lifecycle-video'))
        page = await context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto('http://127.0.0.1:8783/?test=1', wait_until='networkidle')
        await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
        await page.locator('[data-route=freight]').click()
        await page.locator('[data-car=cargo]').click()
        await page.locator('#start').click()
        await page.evaluate('''() => {window.captureProof=[];for(const type of ['pointerdown','pointerup','lostpointercapture'])
          document.addEventListener(type,e=>captureProof.push({type,id:e.pointerId,trusted:e.isTrusted}),true);}''')
        for action, button, key, field, value in [('left','L','KeyA','move',-1),('right','R','KeyD','move',1),
                ('melee','attack','KeyJ','attack',True),('ranged','ranged','KeyK','ranged',True),('repair','fix','KeyE','repair',True)]:
            await page.evaluate(RESET)
            box = await page.locator('#'+button).bounding_box()
            await page.keyboard.down(key)
            await page.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2)
            await page.mouse.down()
            await page.wait_for_timeout(30)
            await page.mouse.up()
            await page.mouse.move(box['x']+box['width']/2+1, box['y']+box['height']/2)
            await page.wait_for_timeout(30)
            held = await page.evaluate('__RH_TEST.input()')
            check(action+'_keyboard_survives_pointer_release', held[field] == value)
            if action == 'right':
                before = await page.evaluate('__RH_TEST.game().player.x')
                await page.wait_for_timeout(160)
                after = await page.evaluate('__RH_TEST.game().player.x')
                check('movement_continues_after_capture_loss', after-before > .25)
            await page.keyboard.up(key)
            check(action+'_last_release_clears_input_and_highlight', await page.evaluate(
                '''({button,field})=>!__RH_TEST.input()[field]&&!document.getElementById(button).classList.contains('active')''',
                {'button':button,'field':field}))
        proof = await page.evaluate('window.captureProof')
        report['captureProof'] = proof
        check('trusted_capture_loss_events', sum(e['type']=='lostpointercapture' and e['trusted'] for e in proof) >= 5)
        await page.evaluate(RESET)
        await page.keyboard.down('KeyD')
        await page.keyboard.down('KeyJ')
        await page.evaluate('window.dispatchEvent(new Event("blur"))')
        check('blur_clears_and_pauses', await page.evaluate('''__RH_TEST.game().paused&&Object.values(__RH_TEST.input()).every(v=>!v)'''))
        await page.keyboard.up('KeyD')
        await page.keyboard.up('KeyJ')
        await page.evaluate(RESET)
        await page.keyboard.down('KeyD')
        await page.set_viewport_size({'width':390,'height':844})
        await page.wait_for_timeout(250)
        check('portrait_pauses_without_stuck_input', await page.evaluate('''__RH_TEST.game().paused&&!__RH_TEST.input().move'''))
        await page.keyboard.up('KeyD')
        await page.set_viewport_size({'width':844,'height':390})
        await page.wait_for_timeout(250)
        for state, expected in [('roof','黄色梯子下车内'),('depot','RETURN 回列车'),('carry','货物放回货车'),('roof-carry','货车舱口 LOAD 放货'),('dead','等待复活')]:
            await page.evaluate(RESET)
            await page.evaluate('''state=>{const a=__RH_TEST,g=a.game();g.pause(true);a.forcePlayer(5.8);
              g.damageCar(0,g.cars[0].hp);if(state==='roof')g.setPlayerLayer('ROOF');
              if(state==='depot'){g.setPlayerLayer('DEPOT');g.player.depotId=g.depots[0].id;}
              if(state==='carry'||state==='roof-carry'){const c=g.createCargo(450,'player',{carIndex:1,secured:true});g.player.carry=c.id;if(state==='roof-carry')g.setPlayerLayer('ROOF');}
              if(state==='dead')g.killPlayer('boarder');a.step(0);}''', state)
            text = await page.locator('#event').inner_text()
            report['samples'].append({'case': state, 'text': text})
            check('stall_'+state+'_action_matches_state', expected in text and '控制柜已在身旁' not in text)
            await page.screenshot(path=str(ART/f'{name}-lifecycle-stall-{state}.png'))
        check('dead_center_hint_hidden', await page.locator('#centerHint').is_hidden())
        for w,h in [(812,332),(844,390),(932,430)]:
            await page.set_viewport_size({'width':w,'height':h})
            await page.wait_for_timeout(160)
            fit = await page.locator('#event').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
            check(f'dead_hint_fits_{w}x{h}', fit and await page.locator('#lifePanel').is_visible())
            await page.screenshot(path=str(ART/f'{name}-lifecycle-dead-{w}x{h}.png'))
        await page.set_viewport_size({'width':844,'height':390})
        await page.evaluate(RESET)
        await page.evaluate('''()=>{const a=__RH_TEST,g=a.game();g.pause(true);a.forcePlayer(5.8);g.runRepairKit=1;g.damageCar(0,g.cars[0].hp);a.step(0);}''')
        check('eligible_restart_duration_unchanged', '长按修理 1.5 秒' in await page.locator('#event').inner_text())
        for side in [-1, 1]:
            await page.evaluate(RESET)
            await page.evaluate("""side=>{const a=__RH_TEST,g=a.game();g.pause(true);g.route='freight';g.prepareDepots();
              g.t=.26;g.elapsed=5;g.phase='yard';g.setPlayerLayer('DEPOT');g.player.depotId=g.depots[0].id;
              g.player.depotX=side*7;g.syncDepotPlayer();g.damageCar(0,g.cars[0].hp);g.pause(false);a.step(0);}""", side)
            await page.locator('#layer').click()
            text = await page.locator('#event').inner_text()
            direction = '← ' if side > 0 else '→ '
            check(f'depot_{side}_blocked_return_keeps_bridge_guidance', direction+'回到 Depot 中央连接桥' in text
                  and await page.evaluate('__RH_TEST.game().playerLayer==="DEPOT"'))
            await page.screenshot(path=str(ART/f'{name}-lifecycle-depot-bridge-{side}.png'))
            key = 'KeyA' if side > 0 else 'KeyD'
            await page.keyboard.down(key)
            await page.wait_for_function('Math.abs(__RH_TEST.game().player.depotX)<=2', timeout=2500)
            await page.keyboard.up(key)
            check(f'depot_{side}_walking_reaches_return_instruction', '先 RETURN 回列车' in await page.locator('#event').inner_text())
            await page.locator('#layer').click()
            # Input changes the layer synchronously; the HUD is painted by the next RAF.
            # Wait for both observable outcomes instead of reading the previous frame.
            returned = "__RH_TEST.game().playerLayer===\"ROOF\"&&document.getElementById('event').textContent.includes('黄色梯子')"
            await page.wait_for_function(returned, timeout=1500)
            check(f'depot_{side}_return_succeeds_after_following_hint', await page.evaluate(returned))
        # Observe actual play() calls while leaving all real nodes and signal paths intact.
        await page.evaluate('''()=>{window.lifecycleCues=[];const a=__RH_TEST.audio(),original=a.play;
          a.play=function(name,options){const result=original.call(this,name,options);lifecycleCues.push({name,result,time:this.context?.currentTime});return result;};}''')
        for kind,cue in [('rail','cargo_drop'),('repair','repair'),('alarm','engine_warning')]:
            await page.evaluate(RESET)
            await page.evaluate('''async kind=>{const a=__RH_TEST,g=a.game(),audio=a.audio();g.pause(true);a.forcePlayer(5.8);
              if(kind==='repair'){g.cars[0].hp-=20;g.syncSystems();g.repairJob={car:0,progress:0,duration:99,emergency:false};}
              if(kind==='alarm')g.damageCar(0,g.cars[0].hp);
              // Controlled stand-in for a long-lived old clock; closing itself is a real API call.
              audio.nextRail=audio.nextRepair=audio.nextAlarm=audio.context.currentTime+90;
              await audio.context.close();window.lifecycleCues.length=0;}''',kind)
            await page.keyboard.press('ShiftLeft') # trusted recovery gesture; not a gameplay action
            await page.wait_for_function('__RH_TEST.audio().context.state==="running"')
            # Keep the world frozen; call the production audio updater once with its actual game.
            sample = await page.evaluate('''kind=>{const a=__RH_TEST,g=a.game(),audio=a.audio();const t=audio.context.currentTime;
              const timers=[audio.nextRail,audio.nextRepair,audio.nextAlarm];g.pause(false);audio.update(g);g.pause(true);
              return {kind,t,timers,cues:lifecycleCues.slice(),audio:audio.snapshot()};}''',kind)
            report['samples'].append(sample)
            check('recreated_'+kind+'_old_deadlines_cleared', all(timer <= sample['t']+.001 for timer in sample['timers']))
            check('recreated_'+kind+'_actual_cue_scheduled', any(c['name']==cue and c['result'] for c in sample['cues']))
        await page.evaluate(RESET)
        await page.locator('#sound').click()
        await page.evaluate('''async()=>{const a=__RH_TEST.audio();await a.context.close();}''')
        await page.keyboard.press('ShiftLeft')
        await page.wait_for_function('__RH_TEST.audio().context.state==="running"')
        check('mute_preference_preserved_after_recreation', await page.evaluate('__RH_TEST.audio().enabled===false&&__RH_TEST.audio().master.gain.value===0'))
        await page.locator('#sound').click()
        await page.wait_for_function('__RH_DEBUG.snapshot().audio.outputRMS>0.00005',timeout=5000)
        check('unmute_actual_output_restored', await page.evaluate('__RH_TEST.audio().enabled&&__RH_TEST.audio().firstSound'))
        await page.screenshot(path=str(ART/f'{name}-lifecycle-final.png'))
        check('no_page_errors', not errors)
        check('completed_suite', True)
    except Exception as exc:
        report['exception'] = str(exc)
        report['checks']['completed_suite'] = False
        if page and not page.is_closed():
            try:
                report['failureState'] = await page.evaluate('__RH_DEBUG.snapshot()')
                await page.screenshot(path=str(ART/f'{name}-lifecycle-failure.png'))
            except Exception:
                pass
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
    report['errors'] = errors
    report['passed'] = len(report['checks']) >= MINIMUM and all(report['checks'].values()) and not errors
    (ART/f'{name}-lifecycle-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report),flush=True)
    return report['passed']

async def main():
    server=subprocess.Popen([sys.executable,'-m','http.server','8783','--directory','dist','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(.5)
        async with async_playwright() as p:
            results=[await run(p,name) for name in ['chromium','webkit']]
        if not all(results):
            raise SystemExit(1)
    finally:
        server.terminate()
        server.wait(timeout=5)

if __name__=='__main__':
    asyncio.run(main())
