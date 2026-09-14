"""E gate: actual enemy hit death, rendered drop/protection and Engine deadline authority."""
import asyncio,json,subprocess,sys
from pathlib import Path
from playwright.async_api import async_playwright
ART=Path('artifacts');ART.mkdir(exist_ok=True)
async def run(p,name):
    options={'headless':True}
    if name=='chromium':options['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
    browser=await getattr(p,name).launch(**options)
    report={'browser':name,'checks':{}};errors=[]
    try:
        page=await browser.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True)
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('http://127.0.0.1:8768/?test=1',wait_until='networkidle')
        await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
        await page.click('[data-route=freight]');await page.click('[data-car=cargo]');await page.click('#start')
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();a.forceRoute(.1);a.forcePlayer(12);g.player.hp=9;g.scrap=83;g.meleeTier=3;g.rangedTier=2;const c=g.createCargo(450,"stored",{carIndex:1,secured:true});g.pickupCargo(c);const e=g.spawn("boarder",12,false);e.climb=0;for(let i=0;i<80&&g.alive;i++)a.step(.025);g.pause(true);a.view().render(.016)})()')
        dead=await page.evaluate('__RH_DEBUG.snapshot()');report['death']=dead
        report['checks']['actual_enemy_hit_caused_death']=dead['playerLifeState']=='DEAD_WAITING_RESPAWN' and dead['deathReason']=='hp_zero' and dead['respawnRemaining']>4.95
        report['checks']['death_overlay_visible']=await page.locator('#lifePanel').is_visible()
        report['checks']['cargo_drop_model_on_floor']=await page.evaluate('(()=>{const g=__RH_TEST.game(),v=__RH_TEST.view();return !v.playerRig.visible&&g.cargoCrates.some(c=>c.location==="floor"&&c.value===450)&&v.floorCrates.some(m=>m.visible&&m.position.y===1.12)})()')
        await page.screenshot(path=str(ART/f'{name}-player-death-floor-cargo.png'))
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);a.step(5);g.pause(true);a.view().render(.016)})()')
        born=await page.evaluate('__RH_DEBUG.snapshot()');report['respawn']=born
        report['checks']['five_seconds_engine_respawn']=born['playerLifeState']=='ALIVE_PROTECTED' and born['playerHp']==60 and born['px']==3 and born['playerLayer']=='INTERIOR'
        report['checks']['progress_and_economy_survive']=born['routeProgress']>dead['routeProgress'] and born['scrap']==83 and born['meleeTier']==3 and born['rangedTier']==2 and born['bank']==dead['bank']
        report['checks']['protection_is_rendered']=await page.evaluate('__RH_TEST.view().playerRig.visible&&__RH_TEST.view().juice.spawnRing.visible')
        await page.screenshot(path=str(ART/f'{name}-respawn-protected.png'))
        report['checks']['protection_not_engine_invulnerability']=await page.evaluate('(()=>{const g=__RH_TEST.game(),hp=g.cars[0].hp;g.pause(false);g.hurt(99,"bruiser");g.damageCar(0,10,"saboteur");g.pause(true);return g.player.hp===60&&g.cars[0].hp===hp-10})()')
        await page.evaluate('(()=>{const a=__RH_TEST;a.reset();const g=a.game();a.forcePlayer(5.8);g.damageCar(0,g.cars[0].hp,"saboteur");a.step(3);g.hurt(100,"bruiser");g.pause(true);window.lifeEventsStart=__RH_DEBUG.logs().at(-1).seq})()')
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);a.step(5);g.pause(true);a.view().render(.016)})()')
        failed=await page.evaluate('__RH_DEBUG.snapshot()');report['failure']=failed
        report['checks']['engine_deadline_cancels_respawn']=failed['status']=='lost' and failed['playerLifeState']=='RUN_FAILED' and failed['terminalDestroyed'] and failed['respawnRemaining']==0
        report['checks']['no_false_respawn_at_deadline']=await page.evaluate('(()=>{const es=__RH_DEBUG.logs().filter(e=>e.seq>window.lifeEventsStart);return es.filter(e=>e.type==="respawn_cancel_engine_failure").length===1&&!es.some(e=>e.type==="respawn_complete")})()')
        await page.screenshot(path=str(ART/f'{name}-respawn-cancelled-engine.png'))
        await page.evaluate('(()=>{const a=__RH_TEST;a.reset();a.forceCars(12);a.forcePlayer(98);const g=a.game();g.hurt(100,"bruiser");g.pause(true);for(let i=0;i<80;i++)a.view().render(.025)})()')
        report['checks']['dead_long_train_engine_visible']=await page.evaluate('(()=>{const v=__RH_TEST.view();return Math.abs(v.cameraX-3)<.01&&v.cars[0].m.visible&&!v.playerRig.visible})()')
        await page.screenshot(path=str(ART/f'{name}-dead-long-train-camera.png'))
        report['checks']['no_page_errors']=not errors
    except Exception as e:report['exception']=str(e);report['checks']['completed_suite']=False
    finally:await browser.close()
    report['errors']=errors;report['passed']=all(report['checks'].values());(ART/f'{name}-life-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
    return report['passed']
async def main():
    server=subprocess.Popen([sys.executable,'-m','http.server','8768','--directory','dist','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(.5)
        async with async_playwright() as p:results=[await run(p,n) for n in ['chromium','webkit']]
        if not all(results):raise SystemExit(1)
    finally:server.terminate();server.wait(timeout=5)
asyncio.run(main())
