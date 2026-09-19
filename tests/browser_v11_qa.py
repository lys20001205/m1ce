"""C01-C03 browser regression. Test fixtures are not normal playthrough evidence."""
import asyncio
import json
import subprocess
import sys
from pathlib import Path
from playwright.async_api import async_playwright

ART = Path('artifacts')
ART.mkdir(exist_ok=True)
BASE = 'http://127.0.0.1:8778/?test=1'
SIZES = [(812, 332), (844, 390), (932, 430), (1280, 720)]

async def run(p, name):
    report = {'browser': name, 'checks': {}, 'scope': 'test-fixture regression, not playtest'}
    errors = []
    browser = None
    page = None
    def check(key, value):
        report['checks'][key] = bool(value)
        if not value:
            raise AssertionError(key)
    try:
        kw = {'headless': True}
        if name == 'chromium':
            kw['args'] = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
        browser = await getattr(p, name).launch(**kw)
        for width, height in SIZES:
            tag = f'{width}x{height}'
            context = await browser.new_context(viewport={'width': width, 'height': height},
                                                is_mobile=width < 1000, has_touch=width < 1000)
            page = await context.new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            await page.goto(BASE, wait_until='networkidle')
            await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
            check(tag+'_viewport', await page.evaluate('[innerWidth,innerHeight]') == [width, height])
            await page.evaluate('''() => {const a=__RH_TEST,g=a.game();
                g.prep.reroll=2;a.save().write(g);a.forceCars(12);g.pause(true);
                localStorage.setItem('roundhouse_save_v11',JSON.stringify({version:11,bank:9999,prep:{reroll:3}}));}''')
            await page.locator('[data-route=freight]').click()
            state = await page.evaluate('__RH_DEBUG.snapshot()')
            check(tag+'_full_hub', state['hubStage'] == 'depart' and len(state['cars']) == 12
                  and state['carOffers'] == [] and state['prep']['reroll'] == 2)
            check(tag+'_full_ui', await page.locator('#choices').is_hidden()
                  and await page.locator('[data-reroll=car]').count() == 0
                  and '已满编' in await page.locator('#intro').inner_text()
                  and await page.locator('#start').is_visible())
            await page.screenshot(path=str(ART/f'{name}-qa-full-{tag}.png'))
            await page.locator('#start').click()
            await page.evaluate('__RH_TEST.game().pause(true)')
            check(tag+'_full_starts', await page.evaluate('__RH_TEST.game().status==="running"&&__RH_TEST.game().cars.length===12'))
            await page.evaluate('''() => {const a=__RH_TEST,g=a.game();g.finish();g.completeArrival();a.step(0);}''')
            await page.locator('#more').click()
            await page.locator('[data-route=freight]').click()
            check(tag+'_full_next_lap', await page.evaluate('__RH_TEST.game().hubStage==="depart"&&__RH_TEST.game().repeatPressure===1&&__RH_TEST.game().prep.reroll===2'))
            await page.reload(wait_until='networkidle')
            await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
            check(tag+'_save_preserved', await page.evaluate('__RH_TEST.game().prep.reroll===2&&JSON.parse(localStorage.getItem("roundhouse_save_v11")).bank===9999'))
            await context.close()
        page = await browser.new_page(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True)
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(BASE, wait_until='networkidle')
        await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
        await page.evaluate('__RH_TEST.forceCars(11);__RH_TEST.game().prep.reroll=2')
        await page.locator('[data-route=industrial]').click()
        await page.locator('[data-reroll=car]').click()
        await page.locator('[data-car=battery]').click()
        check('last_legal_car', await page.evaluate('__RH_TEST.game().cars.length===12&&__RH_TEST.game().prep.reroll===1&&__RH_TEST.game().selectedCar==="battery"'))
        await page.locator('#start').click()
        for types in [[], ['workshop'], ['battery'], ['workshop', 'battery']]:
            for kit in [False, True]:
                spec = await page.evaluate('''async ({types,kit}) => {
                    const a=__RH_TEST;a.reset();const g=a.game(),{car}=await import('/src/sim.js?v=11');
                    g.pause(true);g.cars.push(...types.map(car));a.view().rebuildCars();
                    g.elapsed=3;a.forcePlayer(5.8);g.runRepairKit=kit?1:0;g.damageCar(0,g.cars[0].hp);a.step(0);
                    return {duration:g.emergencyRepairTime,text:g.emergencyRepairTime.toFixed(1)};
                }''', {'types': types, 'kit': kit})
                text = await page.locator('#event').inner_text()
                before = f"长按修理 {spec['text']} 秒" in text and ('维修包加速' in text) == kit
                await page.evaluate('''duration => {const a=__RH_TEST,g=a.game();
                    g.pause(false);a.step(duration-.025,{repair:true});g.pause(true);}''', spec['duration'])
                state = await page.evaluate('__RH_DEBUG.snapshot()')
                channel = state['engineState'] == 'stalled' and abs(state['repair']['duration']-spec['duration']) < 1e-7
                await page.evaluate('''() => {const a=__RH_TEST,g=a.game();g.pause(false);a.step(.025,{repair:true});g.pause(true);}''')
                check('repair_'+('-'.join(types) or 'base')+'_'+str(kit), before and channel
                      and await page.evaluate('__RH_TEST.game().engineState!=="stalled"&&__RH_TEST.game().runRepairKit===0'))
        for route, label in [('industrial', '工业装卸区'), ('freight', '货运堆场'), ('tunnel', '地下连接段')]:
            await page.evaluate('''route => {const a=__RH_TEST;a.reset();const g=a.game();
                g.pause(true);g.route=route;g.prepareDepots();g.t=.1;g.elapsed=3;
                g.phaseChanged('depart','yard');a.step(0);}''', route)
            check('route_'+route, await page.locator('#phase').inner_text() == label
                  and await page.locator('#event').inner_text() == label)
            await page.screenshot(path=str(ART/f'{name}-qa-route-{route}.png'))
        for route, phase, marker, word in [('industrial','crane',.4,'机械臂'),('tunnel','approach',.38,'低净空')]:
            await page.evaluate('''({route,phase,marker}) => {const a=__RH_TEST;a.reset();const g=a.game();
                g.pause(true);g.route=route;g.prepareDepots();g.t=marker;g.elapsed=3;g.phaseChanged('yard',phase);a.step(0);}
                ''', {'route': route, 'phase': phase, 'marker': marker})
            check('warning_'+route, word in await page.locator('#event').inner_text())
        await page.evaluate('''() => {const a=__RH_TEST,g=a.game();g.runRepairKit=1;
            a.forcePlayer(5.8);g.damageCar(0,g.cars[0].hp);a.step(0);}''')
        check('stall_priority', '动力停机' in await page.locator('#event').inner_text()
              and await page.locator('#phase').inner_text() == '动力停机 / 路线暂停')
        await page.screenshot(path=str(ART/f'{name}-qa-kit-stall.png'))
        check('no_page_errors', not errors)
        check('completed_suite', True)
    except Exception as exc:
        report['exception'] = str(exc)
        report['checks']['completed_suite'] = False
        if page and not page.is_closed():
            try:
                report['failureState'] = await page.evaluate('__RH_DEBUG.snapshot()')
                await page.screenshot(path=str(ART/f'{name}-qa-failure.png'))
            except Exception:
                pass
    finally:
        if browser:
            await browser.close()
    report['errors'] = errors
    report['passed'] = len(report['checks']) >= 41 and all(report['checks'].values()) and not errors
    (ART/f'{name}-qa-report.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report), flush=True)
    return report['passed']

async def main():
    server = subprocess.Popen([sys.executable, '-m', 'http.server', '8778', '--directory', 'dist', '--bind', '127.0.0.1'],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(.5)
        async with async_playwright() as p:
            results = [await run(p, name) for name in ['chromium', 'webkit']]
        if not all(results):
            raise SystemExit(1)
    finally:
        server.terminate()
        server.wait(timeout=5)

if __name__ == '__main__':
    asyncio.run(main())
