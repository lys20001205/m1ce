"""Actual browser presentation regression. TEST fixtures, not blind gameplay/device QA."""
import asyncio,json,subprocess,sys
from pathlib import Path
from playwright.async_api import async_playwright
ART=Path('artifacts');ART.mkdir(exist_ok=True)
BASE='http://127.0.0.1:8789/?test=1'
VIEWPORTS=[(812,332),(844,390),(932,430),(1280,720)]
VIEW_CHECKS=['css_size','routes_in_first_screen','zero_bank_folded','practice_secondary','shop_native_toggle',
             'cargo_preview','battery_preview','departure_objective','start_visible','depot_markers','reserved_footer']
OTHER_CHECKS=['armory_unlock_explained','three_native_purchases','one_scrap_goal','net_excludes_starting_funds',
 'kills_upgrades_visible','zero_incidents_secondary','ledger_reconciles','cashout_keeps_history','cashout_shop',
 'restart_clears_history','depot_stock','depot_pickup_unsecured','loaded_delta','reload_no_duplicate_credit',
 'full_return_guidance','stall_wins','death_hides_ordinary_guide','inventory_zero_bank_opens','formal_save_untouched',
 'no_page_errors','completed_suite']
MINIMUM=len(VIEW_CHECKS)*len(VIEWPORTS)+len(OTHER_CHECKS)
async def run(p,name):
    kw={'headless':True}
    if name=='chromium':kw['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
    browser=None;page=None;errors=[]
    report={'browser':name,'checks':{},'fixtures':True,'humanPlaytest':False,'realDevice':False,'samples':[]}
    def check(k,v):report['checks'][k]=bool(v)
    try:
        browser=await getattr(p,name).launch(**kw);report['browserVersion']=browser.version
        for width,height in VIEWPORTS:
            context=await browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
            page=await context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            await page.goto(BASE,wait_until='networkidle');await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
            await page.wait_for_timeout(180)
            key=f'{width}x{height}_'
            check(key+'css_size',await page.evaluate('[innerWidth,innerHeight]')==[width,height])
            # The original first-screen complaint is geometric, not simply DOM visibility.
            rect=await page.evaluate('''() => {const r=n=>{const b=n.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right};};
              return {cards:[...document.querySelectorAll('[data-route]')].map(r),article:r(document.querySelector('#modal article')),
                scroll:document.querySelector('#modal article').scrollTop,practice:r(document.getElementById('practice'))};}''')
            report['samples'].append({'viewport':[width,height],'entryRects':rect})
            check(key+'routes_in_first_screen',len(rect['cards'])==3 and rect['scroll']==0 and
                all(c['top']>=rect['article']['top'] and c['bottom']<=rect['article']['bottom'] and c['right']<=width for c in rect['cards']))
            check(key+'zero_bank_folded',not await page.evaluate('document.getElementById("prepDisclosure").open')
                  and await page.locator('#prepShop').is_hidden())
            check(key+'practice_secondary',rect['practice']['top']>=max(c['bottom'] for c in rect['cards'])
                  and await page.evaluate('!document.getElementById("runActions").contains(document.getElementById("practice"))'))
            await page.screenshot(path=str(ART/f'{name}-design-entry-{width}x{height}.png'))
            await page.locator('#prepSummary').click()
            opened=await page.locator('#prepShop').is_visible()
            await page.locator('#prepSummary').click()
            check(key+'shop_native_toggle',opened and await page.locator('#prepShop').is_hidden())
            await page.locator('[data-route=freight]').click()
            check(key+'cargo_preview','货位 0 → 3' in await page.locator('[data-car=cargo]').inner_text())
            battery=await page.locator('[data-car=battery]').inner_text()
            check(key+'battery_preview','8.3 → 16.7 秒' in battery and '0 货位' in battery)
            await page.screenshot(path=str(ART/f'{name}-design-car-{width}x{height}.png'))
            await page.locator('[data-car=cargo]').click()
            check(key+'departure_objective','空货位 3' in await page.locator('#hubObjective').inner_text())
            await page.locator('#start').scroll_into_view_if_needed()
            box=await page.locator('#start').bounding_box()
            check(key+'start_visible',box is not None and box['y']>=0 and box['y']+box['height']<=height)
            await page.locator('#start').click()
            await page.wait_for_function('__RH_TEST.game().status==="running"')
            await page.evaluate('__RH_TEST.game().pause(true);__RH_TEST.step(0)')
            check(key+'depot_markers',await page.evaluate('[...document.querySelectorAll(".depotMarker")].map(n=>n.style.left)')==['26%','66%'])
            check(key+'reserved_footer',await page.evaluate('''() => {const r=id=>document.getElementById(id).getBoundingClientRect();
                return r('controls').top>=r('viewport').bottom && r('hud').bottom<=r('viewport').top && r('centerHint').bottom<=r('controls').bottom;}'''))
            await context.close()
        context=await browser.new_context(viewport={'width':844,'height':390},is_mobile=True,has_touch=True)
        page=await context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto(BASE,wait_until='networkidle');await page.wait_for_function('window.__RH_TEST')
        await page.locator('[data-route=freight]').click();await page.locator('[data-car=cargo]').click();await page.locator('#start').click()
        # Fixture provides upgrade resources, real F and purchase buttons exercise the UI.
        await page.evaluate('''()=>{const a=__RH_TEST,g=a.game();g.director.rest=9999;g.enemies=[];g.scrap=42;a.forcePlayer(1.7);}''')
        await page.keyboard.press('KeyF');await page.locator('#armoryPanel').wait_for(state='visible')
        check('armory_unlock_explained','AXE（COMBAT TIER 3）' in await page.locator('#armoryHelp').inner_text())
        for slot in ['melee','melee','ranged']:
            await page.locator(f'[data-armory={slot}]').click();await page.wait_for_timeout(120)
        check('three_native_purchases',await page.evaluate('__RH_TEST.game().meleeTier===3&&__RH_TEST.game().rangedTier===1&&__RH_TEST.game().scrap===0'))
        await page.locator('#closeArmory').click()
        await page.evaluate('''()=>{const a=__RH_TEST,g=a.game();g.scrap=23;g.inc('kills',28);g.finish();g.completeArrival();a.step(0);}''')
        await page.locator('#outcomeStats').wait_for(state='visible')
        check('one_scrap_goal','1 Scrap' in await page.locator('#riskPanel').inner_text() and 'SMG' in await page.locator('#riskPanel').inner_text())
        check('net_excludes_starting_funds',await page.locator('#gainStat').inner_text()=='+1,400')
        check('kills_upgrades_visible',await page.locator('#killsStat').inner_text()=='28 / 3')
        check('zero_incidents_secondary',await page.locator('#resultHighlights').is_hidden())
        await page.screenshot(path=str(ART/f'{name}-design-clean-victory.png'))
        await page.locator('#economyDetails > summary').click()
        ledger=await page.locator('#economyBreakdown').inner_text();report['samples'].append({'ledger':ledger})
        check('ledger_reconciles',all(v in ledger for v in ['初始未兑现 1,000','完成奖励 +1,400','当前未兑现 2,400']) and '其他变动' not in ledger)
        await page.screenshot(path=str(ART/f'{name}-design-ledger.png'))
        await page.locator('#cash').click();await page.wait_for_function('__RH_TEST.game().status==="cashed"')
        check('cashout_keeps_history',await page.locator('#killsStat').inner_text()=='28 / 3'
              and await page.evaluate('__RH_TEST.game().meleeTier===1&&__RH_TEST.game().bank===2400'))
        check('cashout_shop',await page.locator('#prepShop').is_visible())
        await page.locator('#restart').click()
        check('restart_clears_history',await page.locator('#outcomeStats').is_hidden() and await page.locator('#upgradesDetail').inner_text()=='')
        await page.locator('[data-route=freight]').click();await page.locator('[data-car=cargo]').click();await page.locator('#start').click()
        await page.evaluate('''()=>{const a=__RH_TEST,g=a.game();g.director.rest=9999;g.t=.26;g.elapsed=5;g.phase='yard';g.speedMode='STOP';a.forcePlayer(12.45,true);a.step(0);}''')
        check('depot_stock','本站余货 2,250' in await page.locator('#centerHint').inner_text())
        await page.keyboard.press('KeyF');await page.wait_for_function('__RH_TEST.game().playerLayer==="DEPOT"')
        await page.keyboard.press('KeyF');await page.wait_for_function('!!__RH_TEST.game().heldCargo')
        await page.wait_for_function('document.getElementById("centerHint").textContent.includes("尚未装车")')
        check('depot_pickup_unsecured',await page.evaluate('__RH_TEST.game().money===1000'))
        await page.screenshot(path=str(ART/f'{name}-design-carry.png'))
        await page.keyboard.press('KeyW');await page.wait_for_function('__RH_TEST.game().playerLayer==="ROOF"')
        await page.keyboard.press('KeyF');await page.wait_for_function('__RH_TEST.game().storedCargo===1')
        await page.wait_for_function('document.getElementById("centerHint").textContent.includes("新增未兑现 +450")')
        check('loaded_delta',await page.evaluate('__RH_TEST.game().money===1450'))
        await page.screenshot(path=str(ART/f'{name}-design-loaded.png'))
        await page.keyboard.press('KeyW');await page.wait_for_function('__RH_TEST.game().playerLayer==="INTERIOR"')
        await page.keyboard.press('KeyF');await page.wait_for_function('!!__RH_TEST.game().heldCargo')
        await page.keyboard.press('KeyF');await page.wait_for_function('!__RH_TEST.game().heldCargo')
        await page.wait_for_function('document.getElementById("centerHint").textContent.includes("不重复")')
        check('reload_no_duplicate_credit',await page.evaluate('__RH_TEST.game().money===1450'))
        await page.evaluate('''()=>{const a=__RH_TEST,g=a.game();g.createCargo(450,'stored',{carIndex:1,secured:true});g.createCargo(450,'stored',{carIndex:1,secured:true});
          g.elapsed+=3;a.forcePlayer(12.45,true);g.enterDepot();a.step(0);}''')
        check('full_return_guidance','CARGO FULL' in await page.locator('#centerHint').inner_text() and 'RETURN' in await page.locator('#centerHint').inner_text())
        await page.evaluate('''()=>{const a=__RH_TEST,g=a.game();g.engineShield=0;g.damageCar(0,g.cars[0].hp);a.step(0);}''')
        check('stall_wins','动力停机' in await page.locator('#event').inner_text() and 'RETURN' in await page.locator('#event').inner_text())
        await page.evaluate('__RH_TEST.game().killPlayer();__RH_TEST.step(0)')
        check('death_hides_ordinary_guide',await page.locator('#centerHint').is_hidden() and '等待复活' in await page.locator('#event').inner_text())
        await page.screenshot(path=str(ART/f'{name}-design-danger-priority.png'))
        await page.evaluate('''()=>{localStorage.setItem('roundhouse_save_v11',JSON.stringify({version:11,bank:7777,prep:{}}));
          localStorage.setItem('roundhouse_test_save_v11',JSON.stringify({version:11,bank:0,prep:{reroll:1}}));}''')
        await page.reload(wait_until='networkidle');await page.wait_for_function('window.__RH_TEST')
        check('inventory_zero_bank_opens',await page.locator('#prepShop').is_visible() and await page.evaluate('__RH_TEST.game().prep.reroll===1'))
        check('formal_save_untouched',await page.evaluate('JSON.parse(localStorage.getItem("roundhouse_save_v11")).bank===7777'))
        check('no_page_errors',not errors);check('completed_suite',True)
        await context.close()
    except Exception as e:
        report['exception']=str(e);report['checks']['completed_suite']=False
        if page and not page.is_closed():
            try:
                report['failureState']=await page.evaluate('__RH_DEBUG.snapshot()')
                await page.screenshot(path=str(ART/f'{name}-design-failure.png'))
            except Exception:pass
    finally:
        if browser:await browser.close()
    expected={f'{w}x{h}_{k}' for w,h in VIEWPORTS for k in VIEW_CHECKS}|set(OTHER_CHECKS)
    report['missingChecks']=sorted(expected-set(report['checks']))
    report['errors']=errors;report['passed']=not report.get('exception') and not errors and not report['missingChecks'] and all(report['checks'].values())
    (ART/f'{name}-design-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False),flush=True);return report['passed']
async def main():
    server=subprocess.Popen([sys.executable,'-m','http.server','8789','--directory','dist','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(.5)
        async with async_playwright() as p:results=[await run(p,n) for n in ['chromium','webkit']]
        if not all(results):raise SystemExit(1)
    finally:server.terminate();server.wait(timeout=5)
if __name__=='__main__':asyncio.run(main())
