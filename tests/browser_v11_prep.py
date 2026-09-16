"""V11-K real Roundhouse Prep Shop, reroll/intel and emergency-kit browser gate."""
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
        base='http://127.0.0.1:8774/?test=1'
        await page.goto(base,wait_until='networkidle');await page.evaluate('localStorage.setItem("roundhouse_save_v11",JSON.stringify({version:11,bank:9999,prep:{}}));localStorage.setItem("roundhouse_test_save_v11",JSON.stringify({version:11,bank:20000,prep:{}}))');await page.reload(wait_until='networkidle')
        await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
        report['checks']['prep_shop_visible_with_isolated_bank']=await page.locator('#prepShop').is_visible() and await page.evaluate('__RH_DEBUG.snapshot().bank===20000')
        for item in ['reroll','repairKit','intel']:
            await page.locator('[data-prep='+item+']').tap()
        state=await page.evaluate('__RH_DEBUG.snapshot()');report['afterPurchase']=state
        report['checks']['exact_three_purchases_spend_bank']=state['bank']==8000
        report['checks']['intel_consumed_into_one_route_reveal']=state['prep']['intel']==0 and state['routeIntel'] is not None
        report['checks']['one_route_card_shows_intel']=await page.evaluate('[...document.querySelectorAll("#routeChoices small")].filter(e=>e.textContent.includes("INTEL:")).length===1')
        await page.locator('[data-route=industrial]').tap();before=await page.evaluate('__RH_DEBUG.snapshot().carOffers')
        report['checks']['default_offer_preserves_optional_cargo']='cargo' in before
        await page.locator('[data-reroll=car]').tap();after=await page.evaluate('__RH_DEBUG.snapshot()')
        report['checks']['reroll_changes_offer_and_consumes_token']=after['carOffers']!=before and after['prep']['reroll']==0 and after['carRerolled']
        await page.locator('#choices [data-car]').first.tap();await page.locator('#start').tap();await page.wait_for_function('__RH_DEBUG.snapshot().status==="running"')
        report['checks']['repair_kit_equipped_for_run']=await page.evaluate('__RH_DEBUG.snapshot().runRepairKit===1&&__RH_DEBUG.snapshot().prep.repairKit===0')
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();a.forcePlayer(5.8);g.elapsed=3;g.damageCar(0,g.cars[0].hp);g.pause(false);a.step(1.5,{repair:true});g.pause(true)})()')
        repaired=await page.evaluate('__RH_DEBUG.snapshot()');report['checks']['kit_real_emergency_repair_and_consumption']=repaired['engineState']!='stalled' and repaired['runRepairKit']==0
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);g.finish();a.step(4);g.pause(true)})()');await page.locator('#cash').tap();await page.wait_for_function('__RH_DEBUG.snapshot().status==="cashed"')
        report['checks']['cashout_returns_visible_prep_spend_point']=await page.locator('#prepShop').is_visible()
        saved=await page.evaluate('JSON.parse(localStorage.getItem("roundhouse_test_save_v11"))');formal=await page.evaluate('JSON.parse(localStorage.getItem("roundhouse_save_v11"))')
        report['checks']['prep_inventory_saved_in_test_namespace']=saved['prep']=={'reroll':0,'repairKit':0,'intel':0} and saved['bank']==await page.evaluate('__RH_DEBUG.snapshot().bank')
        report['checks']['formal_bank_untouched']=formal['bank']==9999
        await page.screenshot(path=str(ART/f'{name}-prep-shop-cashout.png'))
        report['checks']['no_page_errors']=not errors
    except Exception as e:
        report['exception']=str(e);report['checks']['completed_suite']=False
        try:report['failureState']=await page.evaluate('__RH_DEBUG.snapshot()');report['failureEvents']=await page.evaluate('__RH_DEBUG.logs().slice(-40)');await page.screenshot(path=str(ART/f'{name}-prep-failure.png'))
        except Exception:pass
    finally:await browser.close()
    report['errors']=errors;report['passed']=all(report['checks'].values());(ART/f'{name}-prep-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True);return report['passed']
async def main():
    server=subprocess.Popen([sys.executable,'-m','http.server','8774','--directory','dist','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(.5)
        async with async_playwright() as p:results=[await run(p,n) for n in ['chromium','webkit']]
        if not all(results):raise SystemExit(1)
    finally:server.terminate();server.wait(timeout=5)
asyncio.run(main())
