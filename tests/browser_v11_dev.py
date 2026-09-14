"""DEV UI, actual fixed-step multiplier and isolated saves. Normal URL has no DEV or mutable test API."""
import asyncio,json,subprocess,sys
from pathlib import Path
from playwright.async_api import async_playwright
ART=Path('artifacts');ART.mkdir(exist_ok=True)
async def run(p,name):
    kw={'headless':True}
    if name=='chromium':kw['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
    browser=await getattr(p,name).launch(**kw);report={'browser':name,'checks':{}};errors=[]
    try:
        page=await browser.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True)
        page.on('pageerror',lambda e:errors.append(str(e)))
        base='http://127.0.0.1:8773/'
        await page.goto(base,wait_until='networkidle');await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
        report['checks']['normal_url_has_no_dev_or_test_api']=await page.evaluate('!document.getElementById("devBadge")&&!document.getElementById("devPanel")&&!window.__RH_TEST&&!__RH_DEBUG.snapshot().dev')
        await page.evaluate('localStorage.setItem("roundhouse_bank","7777");localStorage.setItem("roundhouse_save_v11",JSON.stringify({version:11,bank:8888,prep:{reroll:2}}));localStorage.setItem("roundhouse_telemetry_consent","yes")')
        await page.goto(base+'?dev=1&test=1',wait_until='networkidle');await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
        report['checks']['dev_starts_with_separate_bank']=await page.evaluate('__RH_DEBUG.snapshot().dev&&__RH_DEBUG.snapshot().bank===0&&!document.getElementById("telemetry").checked')
        baseline=await page.evaluate('Object.fromEntries(["roundhouse_bank","roundhouse_save_v11","roundhouse_telemetry_consent","roundhouse_last_log"].map(k=>[k,localStorage.getItem(k)]))')
        await page.locator('#devBadge').tap();await page.locator('select[data-dev=route]').select_option('freight');await page.locator('button[data-dev=start]').tap()
        await page.wait_for_function('__RH_DEBUG.snapshot().status==="running"&&__RH_DEBUG.snapshot().audio.context==="running"')
        report['checks']['dev_start_real_game_and_audio']=await page.evaluate('__RH_DEBUG.snapshot().route==="freight"&&__RH_DEBUG.snapshot().cargoCapacity===3&&__RH_DEBUG.snapshot().audio.resumeRequested>0')
        await page.locator('button[data-dev=jump][data-value=depot]').tap();await page.wait_for_timeout(500)
        before=await page.evaluate('__RH_DEBUG.snapshot().audio.engineFrequency')
        await page.locator('button[data-dev=time][data-value="4"]').tap();await page.wait_for_timeout(350)
        after=await page.evaluate('__RH_DEBUG.snapshot().audio.engineFrequency')
        report['audioPitch']={'before':before,'after':after}
        report['checks']['x4_does_not_quadruple_audio_pitch']=abs(after-before)<2 and 130<after<150
        proof=await page.evaluate('(()=>{const a=__RH_TEST,g=a.game(),t=g.t,e=g.elapsed;g.pause(false);a.clock().reset();const steps=a.clock().advance(g,.1,a.input());g.pause(true);return {steps,elapsed:g.elapsed-e,progress:g.t-t,scale:g.timeScale}})()')
        report['clock']=proof;report['checks']['x4_advances_actual_simulation']=proof['steps']==16 and abs(proof['elapsed']-.4)<.0001 and abs(proof['progress']-.4/140)<.000001
        await page.locator('button[data-dev=time][data-value="1"]').tap()
        for kind in ['cargo','battery','workshop']:await page.locator('button[data-dev=car][data-value='+kind+']').tap()
        await page.locator('button[data-dev=cargo][data-value=fill]').tap()
        report['checks']['car_and_fill_buttons_mutate_real_slots']=await page.evaluate('__RH_DEBUG.snapshot().cargoUsed===6&&__RH_DEBUG.snapshot().cargoCapacity===6&&__RH_DEBUG.snapshot().batteryCapacity===200')
        await page.locator('button[data-dev=cargo][data-value=clear]').tap();await page.locator('button[data-dev=scrap]').tap();await page.locator('button[data-dev=tier]').tap()
        report['checks']['combat_shortcuts_work']=await page.evaluate('__RH_DEBUG.snapshot().cargoUsed===0&&__RH_DEBUG.snapshot().scrap===100&&__RH_DEBUG.snapshot().combatTier===3&&__RH_DEBUG.snapshot().rangedTier===0')
        for flag in ['audio','renderer','threat']:await page.locator('[data-debug='+flag+']').check()
        await page.locator('button[data-dev=testSfx]').tap();await page.wait_for_function('__RH_DEBUG.snapshot().audio.lastSfx==="test"')
        report['checks']['audio_debug_and_test_sfx']=await page.locator('#devAudio').is_visible() and await page.evaluate('__RH_DEBUG.snapshot().audio.master===1')
        report['checks']['renderer_and_threat_debug']=await page.locator('#devRenderer').is_visible() and await page.locator('#devThreat').is_visible()
        await page.screenshot(path=str(ART/f'{name}-dev-audio-renderer.png'))
        await page.locator('button[data-dev=engine][data-value=stall]').tap();await page.locator('button[data-dev=kill]').tap()
        report['checks']['dev_stall_and_death_use_real_states']=await page.evaluate('__RH_DEBUG.snapshot().engineState==="stalled"&&__RH_DEBUG.snapshot().playerLifeState==="DEAD_WAITING_RESPAWN"&&__RH_DEBUG.snapshot().rescue.remaining>0')
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);a.step(5);g.pause(true)})()')
        report['checks']['stalled_engine_still_allows_respawn']=await page.evaluate('__RH_DEBUG.snapshot().playerLifeState==="ALIVE_PROTECTED"&&__RH_DEBUG.snapshot().playerHp===60')
        await page.locator('button[data-dev=engine][data-value="20"]').tap();await page.locator('button[data-dev=trainLost]').tap()
        report['checks']['dev_force_train_lost_uses_production_death']=await page.evaluate('__RH_DEBUG.snapshot().deathReason==="train_lost"&&__RH_DEBUG.snapshot().playerLifeState==="DEAD_WAITING_RESPAWN"')
        await page.locator('#devBadge').tap();await page.screenshot(path=str(ART/f'{name}-dev-force-train-lost.png'))
        await page.evaluate('__RH_TEST.reset();__RH_TEST.game().pause(true)');await page.locator('#devBadge').tap();await page.locator('select[data-dev=round]').select_option('8')
        for kind in ['boarder','clinger','thief','saboteur','bruiser']:await page.locator('button[data-dev=spawn][data-value='+kind+']').tap()
        report['checks']['five_spawn_buttons_create_real_enemies']=await page.evaluate('__RH_TEST.game().enemies.length===5&&new Set(__RH_TEST.game().enemies.map(e=>e.type)).size===5')
        await page.locator('#devBadge').tap();await page.evaluate('__RH_TEST.view().render(0)');await page.screenshot(path=str(ART/f'{name}-dev-five-enemies.png'))
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);g.finish();a.step(4);g.pause(true)})()');await page.locator('#cash').tap()
        report['checks']['dev_cashout_saved_only_in_dev_namespace']=await page.evaluate('!!localStorage.getItem("roundhouse_dev_save_v11")&&JSON.parse(localStorage.getItem("roundhouse_dev_save_v11")).bank>0')
        await page.wait_for_timeout(1400)
        current=await page.evaluate('Object.fromEntries(["roundhouse_bank","roundhouse_save_v11","roundhouse_telemetry_consent","roundhouse_last_log"].map(k=>[k,localStorage.getItem(k)]))')
        report['checks']['formal_bank_preferences_logs_unchanged']=current==baseline
        report['checks']['every_dev_event_marked']=await page.evaluate('__RH_DEBUG.logs().every(e=>e.dev===true)')
        await page.goto(base+'?dev=1',wait_until='networkidle');await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
        report['checks']['pure_dev_url_has_panel_but_no_test_api']=await page.evaluate('!!document.getElementById("devBadge")&&!window.__RH_TEST&&__RH_DEBUG.snapshot().dev===true')
        await page.goto(base,wait_until='networkidle');await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
        report['checks']['normal_url_restores_untouched_formal_bank']=await page.evaluate('__RH_DEBUG.snapshot().bank===8888&&!__RH_DEBUG.snapshot().dev&&!document.getElementById("devBadge")')
        report['checks']['no_page_errors']=not errors
    except Exception as e:
        report['exception']=str(e);report['checks']['completed_suite']=False
        try:report['failureState']=await page.evaluate('__RH_DEBUG.snapshot()');report['failureEvents']=await page.evaluate('__RH_DEBUG.logs().slice(-30)');await page.screenshot(path=str(ART/f'{name}-dev-failure.png'))
        except Exception:pass
    finally:await browser.close()
    report['errors']=errors;report['passed']=all(report['checks'].values());(ART/f'{name}-dev-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True);return report['passed']
async def main():
    server=subprocess.Popen([sys.executable,'-m','http.server','8773','--directory','dist','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(.5)
        async with async_playwright() as p:results=[await run(p,n) for n in ['chromium','webkit']]
        if not all(results):raise SystemExit(1)
    finally:server.terminate();server.wait(timeout=5)
asyncio.run(main())
