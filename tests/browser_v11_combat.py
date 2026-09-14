"""G: production input, independent slots, six models and live Armory. No renderer mocks."""
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
        await page.goto('http://127.0.0.1:8770/?test=1',wait_until='networkidle')
        await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
        await page.click('[data-route=freight]');await page.click('[data-car=cargo]');await page.click('#start')
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();a.forceRoute(.1);a.forcePlayer(3);const e=g.spawn("boarder",4,false);e.climb=0;g.pause(true)})()')
        # One held pointer drives the normal input map and repeated production attacks.
        box=await page.locator('#attack').bounding_box()
        await page.evaluate('__RH_TEST.game().pause(false)')
        await page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);await page.mouse.down()
        await page.wait_for_function('__RH_TEST.input().attack===true')
        await page.evaluate('__RH_TEST.step(1.5,__RH_TEST.input())');await page.mouse.up()
        await page.evaluate('__RH_TEST.game().pause(true);__RH_TEST.view().render(0)')
        report['checks']['button_kill_grants_scrap']=await page.evaluate('__RH_TEST.game().scrap===2&&__RH_TEST.game().money===1000&&__RH_TEST.game().totalKills===1')
        report['checks']['scrap_hud_and_visual_pop']=await page.evaluate('document.getElementById("scrapHud").textContent==="2"&&[...document.querySelectorAll(".combatPop")].some(e=>!e.hidden&&e.textContent==="+2 SCRAP")')
        await page.screenshot(path=str(ART/f'{name}-scrap-kill.png'))
        # Fixture funds purchases; location admission, costs, buttons and unlocks are production code.
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();a.forcePlayer(1.7);g.scrap=106;g.pause(false)})()')
        await page.click('#interact');await page.wait_for_selector('#armoryPanel:not([hidden])')
        report['checks']['ranged_initially_locked']=await page.locator('[data-armory=ranged]').is_disabled()
        start=await page.evaluate('__RH_TEST.game().t');await page.wait_for_timeout(150)
        report['checks']['armory_world_not_paused']=await page.evaluate(f'!__RH_TEST.game().paused&&__RH_TEST.game().t>{start}')
        report['models']=[]
        for slot,weapon in [('melee','knife'),('melee','axe'),('ranged','handgun'),('ranged','smg'),('ranged','rifle')]:
            await page.locator('[data-armory='+slot+']').tap()
            await page.wait_for_function("__RH_TEST.game()["+json.dumps(slot)+"]?.id==="+json.dumps(weapon),timeout=3000)
            await page.evaluate('__RH_TEST.view().render(0)')
            state=await page.evaluate('(()=>{const g=__RH_TEST.game(),d=__RH_TEST.view().playerRig.userData;return {melee:g.melee.id,ranged:g.ranged?.id||null,scrap:g.scrap,meleeModels:Object.entries(d.meleeModels).filter(([k,m])=>m.visible).map(([k])=>k),rangedModels:Object.entries(d.rangedModels).filter(([k,m])=>m.visible).map(([k])=>k)}})()')
            report['models'].append(state)
            report['checks']['purchase_'+weapon]=state[slot]==weapon and state[slot+'Models']==[weapon]
            if weapon=='axe':report['checks']['tier3_unlock_is_not_free_gun']=state['ranged'] is None and not await page.locator('[data-armory=ranged]').is_disabled()
            await page.screenshot(path=str(ART/f'{name}-armory-{weapon}.png'))
        report['checks']['exact_cost_and_dual_final_slots']=state['scrap']==0 and state['melee']=='axe' and state['ranged']=='rifle' and state['meleeModels']==['axe'] and state['rangedModels']==['rifle']
        await page.click('#closeArmory')
        sockets=await page.evaluate('(()=>{const a=__RH_TEST,g=a.game(),v=a.view();g.pause(true);return [-1,1].map(face=>{g.player.face=face;v.render(0);return {face,actual:v.muzzle(),sim:g.muzzle()}})})()')
        report['sockets']=sockets;report['checks']['model_socket_matches_real_projectile_both_facings']=all(abs(s['actual'][k]-s['sim'][k])<.002 for s in sockets for k in ['x','y','z'])
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();a.forcePlayer(3);g.pause(false)})()')
        await page.keyboard.down('j');await page.keyboard.down('k')
        report['checks']['independent_keyboard_actions']=await page.evaluate('__RH_TEST.input().attack&&__RH_TEST.input().ranged')
        await page.evaluate('__RH_TEST.step(.025,__RH_TEST.input())')
        report['checks']['both_weapon_actions_run']=await page.evaluate('__RH_TEST.game().player.swing>0&&__RH_TEST.game().player.rangedCooldown>0&&__RH_TEST.game().projectiles.length>0')
        await page.keyboard.up('j');await page.keyboard.up('k');await page.evaluate('__RH_TEST.game().pause(true)')
        await page.screenshot(path=str(ART/f'{name}-dual-weapon-fire.png'))
        report['checks']['mobile_keyboard_legend_hidden']=not await page.locator('#keyboardLegend').is_visible()
        desktop=await browser.new_page(viewport={'width':1280,'height':720})
        await desktop.goto('http://127.0.0.1:8770/?test=1',wait_until='networkidle');await desktop.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
        report['checks']['desktop_legend_matches_bindings']=await desktop.evaluate('(()=>{const text=document.getElementById("keyboardLegend").textContent;return !document.getElementById("keyboardLegend").hidden&&text.includes("MELEE J / SPACE")&&text.includes("RANGED K")&&text.includes("EMERGENCY BRAKE B")})()')
        await desktop.close();report['checks']['no_page_errors']=not errors
    except Exception as e:
        report['exception']=str(e);report['checks']['completed_suite']=False
        try:report['failureState']=await page.evaluate('__RH_DEBUG.snapshot()');report['failureEvents']=await page.evaluate('__RH_DEBUG.logs().slice(-40)');await page.screenshot(path=str(ART/f'{name}-combat-failure.png'))
        except Exception:pass
    finally:await browser.close()
    report['errors']=errors;report['passed']=all(report['checks'].values());(ART/f'{name}-combat-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True);return report['passed']
async def main():
    server=subprocess.Popen([sys.executable,'-m','http.server','8770','--directory','dist','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(.5)
        async with async_playwright() as p:results=[await run(p,n) for n in ['chromium','webkit']]
        if not all(results):raise SystemExit(1)
    finally:server.terminate();server.wait(timeout=5)
asyncio.run(main())
