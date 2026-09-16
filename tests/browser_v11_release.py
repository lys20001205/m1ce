"""V11-L final stitched mobile/browser regression. Production rules are never replaced."""
import asyncio,json,subprocess,sys
from pathlib import Path
from playwright.async_api import async_playwright
ART=Path('artifacts');ART.mkdir(exist_ok=True)
FINAL_FIELDS=['route','speedMode','routeProgress','playerLayer','playerLifeState','respawnRemaining','cargoUsed','cargoCapacity','cargoValue','scrap','meleeTier','rangedTier','batteryCharge','threatCurrent','threatCap','dev']

async def wait_state(page,expr,timeout=3000):
    await page.wait_for_function(expr,timeout=timeout)

async def tap(page,selector,expr=None):
    await page.locator(selector).tap()
    if expr: await wait_state(page,expr)

async def run(p,name):
    kw={'headless':True}
    if name=='chromium':kw['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
    browser=await getattr(p,name).launch(**kw);report={'browser':name,'checks':{}};errors=[]
    try:
        page=await browser.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,device_scale_factor=1.5)
        page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        base='http://127.0.0.1:8775/?test=1'
        await page.goto(base,wait_until='networkidle')
        await page.evaluate('localStorage.setItem("roundhouse_test_save_v11",JSON.stringify({version:11,bank:12000,prep:{reroll:0,repairKit:0,intel:0}}))')
        await page.reload(wait_until='networkidle');await wait_state(page,'window.__RH_DEBUG?.snapshot().modelsLoaded===3',30000)
        await tap(page,'[data-route=freight]');await tap(page,'[data-car=cargo]');await tap(page,'#start','__RH_DEBUG.snapshot().status==="running"')
        boot=await page.evaluate('__RH_DEBUG.snapshot()');report['boot']=boot
        report['checks']['final_snapshot_fields']=all(k in boot for k in FINAL_FIELDS) and boot['threatCurrent']==boot['threat']['actual'] and boot['threatCap']==boot['threat']['cap']

        for width,height in [(812,332),(844,390),(932,430)]:
            await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(220)
            s=await page.evaluate('__RH_DEBUG.snapshot()')
            rects=await page.evaluate("""()=>{const r=id=>{const b=document.getElementById(id).getBoundingClientRect();return{top:b.top,bottom:b.bottom,left:b.left,right:b.right}};return{scene:r('viewport'),hud:r('hud'),controls:r('controls')}}""")
            report['checks'][f'{width}x{height}_landscape_safe']=abs(s['canvasBacking'][0]/s['canvasBacking'][1]-s['canvasCss'][0]/s['canvasCss'][1])<.02 and 5<s['playerScreenY']<s['canvasCss'][1]-5 and rects['scene']['top']>=rects['hud']['bottom'] and rects['controls']['top']>=rects['scene']['bottom']
            await page.screenshot(path=str(ART/f'{name}-release-{width}x{height}.png'))

        await page.set_viewport_size({'width':390,'height':844});await page.wait_for_timeout(220)
        report['checks']['orientation_portrait_pauses']=await page.evaluate('__RH_TEST.game().paused') and await page.locator('#portrait').is_visible()
        await page.set_viewport_size({'width':844,'height':390});await page.wait_for_timeout(220)
        report['checks']['orientation_return_requires_resume']=await page.evaluate('__RH_TEST.game().paused') and not await page.locator('#portrait').is_visible()
        await tap(page,'#pause','!__RH_TEST.game().paused')

        x0=await page.evaluate('__RH_TEST.game().player.x')
        await page.keyboard.down('ArrowLeft');await wait_state(page,'__RH_TEST.input().move===-1');await page.evaluate('__RH_TEST.step(.18,__RH_TEST.input())');await page.keyboard.up('ArrowLeft')
        x1=await page.evaluate('__RH_TEST.game().player.x')
        await page.keyboard.down('ArrowRight');await wait_state(page,'__RH_TEST.input().move===1');await page.evaluate('__RH_TEST.step(.28,__RH_TEST.input())');await page.keyboard.up('ArrowRight')
        x2=await page.evaluate('__RH_TEST.game().player.x')
        report['checks']['direction_switch_real_input']=x1<x0 and x2>x1

        await page.keyboard.down('ArrowRight');await wait_state(page,'__RH_TEST.input().move===1');await page.evaluate('window.dispatchEvent(new Event("blur"))');await page.keyboard.up('ArrowRight');await page.wait_for_timeout(80)
        report['checks']['background_blur_clears_input_and_pauses']=await page.evaluate('__RH_TEST.input().move===0&&__RH_TEST.game().paused')
        await page.evaluate('window.dispatchEvent(new Event("pageshow"))');await page.wait_for_timeout(120)
        life=await page.evaluate('__RH_DEBUG.snapshot()');report['checks']['foreground_keeps_explicit_pause_and_audio_ready']=life['paused'] and not life['audio']['muted'] and life['audio']['master']>0
        await tap(page,'#pause','!__RH_TEST.game().paused')

        # Freight -> first Depot -> cargo load, using rendered INTERACT input.
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(true);a.forceRoute(.26);a.forcePlayer(5.8);g.pause(false);g.setSpeed("STOP");g.pause(true);a.forcePlayer(12.45,true);g.pause(false)})()')
        await tap(page,'#interact','__RH_TEST.game().playerLayer==="DEPOT"');await tap(page,'#interact','!!__RH_TEST.game().heldCargo');await tap(page,'#interact','__RH_TEST.game().playerLayer==="ROOF"');await tap(page,'#interact','__RH_TEST.game().cars[1].cargo===1')
        report['checks']['e2e_depot_load']=await page.evaluate('__RH_TEST.game().cargoValue===450&&__RH_TEST.game().cargoUsed===1')

        # Second SLOW boarding: one real boarding input, then no extra interaction. The platform must carry the player away until production TRAIN LOST fires naturally.
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(true);a.forceRoute(.26);a.forcePlayer(5.8);g.pause(false);g.setSpeed("SLOW");g.pause(true);a.forcePlayer(12.45,true);g.pause(false)})()')
        await tap(page,'#interact','__RH_TEST.game().playerLayer==="DEPOT"')
        report['checks']['e2e_slow_depot_board']=await page.evaluate('__RH_TEST.game().playerLayer==="DEPOT"&&__RH_TEST.game().speedMode==="SLOW"')
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();for(let i=0;i<520&&g.alive;i++)a.step(.025);})()')
        lost=await page.evaluate('__RH_DEBUG.snapshot()');report['checks']['e2e_train_lost']=lost['playerLifeState']=='DEAD_WAITING_RESPAWN' and lost['deathReason']=='train_lost' and lost['heldCargo'] is None
        await page.evaluate('__RH_TEST.step(5.05)');respawn=await page.evaluate('__RH_DEBUG.snapshot()');report['checks']['e2e_respawn']=respawn['playerLayer']=='INTERIOR' and respawn['playerHp']==60 and respawn['playerLifeState']=='ALIVE_PROTECTED'

        # Five actual melee inputs against one-hit fixtures earn the ten Scrap needed for Knife.
        for i in range(5):
            await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.enemies=[];g.player.cooldown=0;g.player.stun=0;g.pause(false);a.forcePlayer(3);const e=g.spawn("boarder",3.8,false);e.hp=1;})()')
            await page.keyboard.down('KeyJ');await wait_state(page,'__RH_TEST.input().attack===true');await page.evaluate('__RH_TEST.step(.22,__RH_TEST.input())');await page.keyboard.up('KeyJ')
        scrap=await page.evaluate('__RH_DEBUG.snapshot().scrap');report['checks']['e2e_scrap_from_kills']=scrap>=10
        await page.evaluate('__RH_TEST.game().enemies=[];__RH_TEST.forcePlayer(1.7)');await tap(page,'#interact','__RH_TEST.game().armoryOpen===true');await page.locator('[data-armory=melee]').tap();await wait_state(page,'__RH_DEBUG.snapshot().meleeWeapon==="knife"')
        report['checks']['e2e_armory_upgrade']=await page.evaluate('__RH_DEBUG.snapshot().meleeTier===2')
        await page.evaluate('__RH_TEST.forcePlayer(5.8)');await tap(page,'#interact');await page.locator('[data-speed=FAST]').tap();await wait_state(page,'__RH_DEBUG.snapshot().speedMode==="FAST"')
        report['checks']['e2e_fast']=await page.evaluate('__RH_DEBUG.snapshot().batteryCharge>0')

        await page.evaluate('__RH_TEST.forceRoute(.999);__RH_TEST.step(.5)');await wait_state(page,'__RH_DEBUG.snapshot().status==="arriving"');await page.evaluate('__RH_TEST.step(4.05)');await wait_state(page,'__RH_DEBUG.snapshot().status==="complete"')
        before_bank=await page.evaluate('__RH_DEBUG.snapshot().bank');await tap(page,'#cash','__RH_DEBUG.snapshot().status==="cashed"');after_bank=await page.evaluate('__RH_DEBUG.snapshot().bank')
        report['checks']['e2e_cashout']=after_bank>before_bank and await page.locator('#prepShop').is_visible()
        prep_before=after_bank;await page.locator('[data-prep=repairKit]').tap();await page.wait_for_timeout(80);prep=await page.evaluate('__RH_DEBUG.snapshot()')
        report['checks']['e2e_prep_spend']=prep['prep']['repairKit']==1 and prep['bank']==prep_before-5000

        await page.evaluate('__RH_TEST.forceCars(12);__RH_TEST.forcePlayer(97);__RH_TEST.view().render(.016)');long=await page.evaluate('__RH_DEBUG.snapshot()');report['longTrain']=long
        report['checks']['twelve_car_final_framing']=len(long['cars'])==12 and 20<long['playerScreenX']<long['canvasCss'][0]-20 and 5<long['playerScreenY']<long['canvasCss'][1]-5
        required=['train_lost','respawn_complete','scrap_gain','armory_purchase','speed_change','round_complete','cashout','prep_purchase']
        report['checks']['e2e_telemetry_chain']=await page.evaluate('(types)=>types.every(t=>__RH_DEBUG.logs().some(e=>e.type===t))',required)
        report['checks']['no_page_errors']=not errors
        await page.screenshot(path=str(ART/f'{name}-release-final.png'))
    except Exception as e:
        report['exception']=str(e);report['checks']['completed_suite']=False
        try:report['failureState']=await page.evaluate('__RH_DEBUG.snapshot()');report['failureEvents']=await page.evaluate('__RH_DEBUG.logs().slice(-60)');await page.screenshot(path=str(ART/f'{name}-release-failure.png'))
        except Exception:pass
    finally:await browser.close()
    report['errors']=errors;report['passed']=all(report['checks'].values());(ART/f'{name}-release-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True);return report['passed']

async def main():
    server=subprocess.Popen([sys.executable,'-m','http.server','8775','--directory','dist','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(.5)
        async with async_playwright() as p:results=[await run(p,n) for n in ['chromium','webkit']]
        if not all(results):raise SystemExit(1)
    finally:server.terminate();server.wait(timeout=5)
asyncio.run(main())
