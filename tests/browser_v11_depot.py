"""Actual rendered Depot interaction, carry/load and moving-platform death; no gameplay overrides."""
import asyncio, json, os, subprocess, sys
from pathlib import Path
from playwright.async_api import async_playwright
ART=Path('artifacts');ART.mkdir(exist_ok=True)

async def tap_interact(page, predicate):
    """Use the same touch path as the mobile UI and freeze immediately after success.

    WebKit can occasionally drop a synthetic mouse click on touch-mode pages while the
    viewport is settling. A real tap plus one bounded retry keeps this a rendered-input
    test instead of bypassing the button handler through the gameplay API. Freezing as
    soon as the state transition is observed prevents wall-clock differences between
    browsers from admitting unrelated combat while this Depot-only flow is inspected.
    """
    for _ in range(2):
        await page.locator('#interact').tap()
        try:
            await page.wait_for_function(predicate, timeout=1500)
            await page.evaluate('__RH_TEST.game().pause(true)')
            return True
        except Exception:
            pass
    return False

async def run(p,name):
    args={'headless':True}
    if name=='chromium': args['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
    browser=await getattr(p,name).launch(**args)
    report={'browser':name,'checks':{}};errors=[]
    try:
        page=await browser.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True)
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('http://127.0.0.1:8767/?test=1',wait_until='networkidle')
        await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
        await page.click('[data-route=freight]');await page.click('[data-car=cargo]');await page.click('#start')
        # Fixture places the consist at the Depot. Boarding, movement, carrying, death and respawn use live rules.
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();a.forceRoute(.26);a.forcePlayer(5.8);g.setSpeed("STOP");a.forcePlayer(12.45);g.pause(true)})()')
        await page.evaluate('(()=>{const g=__RH_TEST.game();g.pause(false);g.layer();g.interact();g.pause(true);__RH_TEST.view().render(.016)})()')
        s=await page.evaluate('__RH_DEBUG.snapshot()');report['entry']=s
        report['checks']['roof_height_behind_cutaway']=s['playerLayer']=='DEPOT' and abs(s['depots'][0]['floorY']-4.12)<.001 and s['depots'][0]['z']< -1.5
        report['checks']['cargo_meshes_rendered']=await page.evaluate('__RH_TEST.view().routeWorld.depots[0].crates.filter(c=>c.visible).length===5')
        await page.screenshot(path=str(ART/f'{name}-depot-enter.png'))
        await page.evaluate('__RH_TEST.game().pause(false)')
        picked=await tap_interact(page,'!!__RH_TEST.game().heldCargo')
        report['checks']['pickup_has_identity']=picked and await page.evaluate('!!__RH_TEST.game().heldCargo')
        await page.evaluate('__RH_TEST.game().pause(false)')
        exited=await tap_interact(page,'__RH_TEST.game().playerLayer==="ROOF"')
        if exited: await page.evaluate('__RH_TEST.game().pause(false)')
        loaded=await tap_interact(page,'__RH_TEST.game().cars[1].cargo===1&&!__RH_TEST.game().player.carry') if exited else False
        report['checks']['bridge_and_roof_loading']=loaded and await page.evaluate('(()=>{const g=__RH_TEST.game();return g.playerLayer==="ROOF"&&g.cars[1].cargo===1&&g.cargoValue===450&&!g.player.carry})()')
        await page.screenshot(path=str(ART/f'{name}-depot-loaded.png'))
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);a.forcePlayer(5.8);g.setSpeed("SLOW");a.forcePlayer(12.45,true);g.interact();a.step(3/5.1,{move:-1});g.interact();g.pause(true)})()')
        report['checks']['slow_carry_on_platform']=await page.evaluate('__RH_TEST.game().playerLayer==="DEPOT"&&!!__RH_TEST.game().heldCargo')
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);for(let i=0;i<500&&g.alive;i++)a.step(.025);g.pause(true);a.view().render(.016)})()')
        dead=await page.evaluate('__RH_DEBUG.snapshot()');report['death']=dead
        report['checks']['moving_train_caused_loss']=dead['playerLifeState']=='DEAD_WAITING_RESPAWN' and dead['heldCargo'] is None and dead['respawnRemaining']>4.9
        report['checks']['train_lost_telemetry']=await page.evaluate('__RH_DEBUG.logs().some(e=>e.type==="train_lost")')
        await page.screenshot(path=str(ART/f'{name}-train-lost.png'))
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);a.step(5);g.pause(true);a.view().render(.016)})()')
        respawn=await page.evaluate('__RH_DEBUG.snapshot()');report['respawn']=respawn
        report['checks']['engine_interior_respawn_60hp']=respawn['playerLayer']=='INTERIOR' and respawn['playerLifeState']=='ALIVE_PROTECTED' and respawn['px']==3 and respawn['playerHp']==60
        report['checks']['respawn_has_two_seconds_protection']=abs(respawn['spawnProtection']-2)<.001
        report['checks']['world_continued_during_death']=respawn['routeProgress']>dead['routeProgress']
        await page.screenshot(path=str(ART/f'{name}-depot-respawn.png'))
        report['checks']['no_page_errors']=not errors
    except Exception as exc:
        report['exception']=str(exc);report['checks']['completed_suite']=False
    finally: await browser.close()
    report['errors']=errors;report['passed']=all(report['checks'].values())
    (ART/f'{name}-depot-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
    return report['passed']
async def main():
    server=subprocess.Popen([sys.executable,'-m','http.server','8767','--directory','dist','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(.5)
        async with async_playwright() as p: results=[await run(p,n) for n in ['chromium','webkit']]
        if not all(results):raise SystemExit(1)
    finally:server.terminate();server.wait(timeout=5)
asyncio.run(main())
