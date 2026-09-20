"""C04: real held-fire input after isolated close-contact setup, both browsers.
Fixture comparisons are not blind playtests, subjective weapon feel or device FPS.
"""
import asyncio
import json
import subprocess
import sys
from pathlib import Path
from playwright.async_api import async_playwright
ART = Path('artifacts')
ART.mkdir(exist_ok=True)
MINIMUM = 39

async def run(p, name):
    report = {'browser': name, 'checks': {}, 'scope': 'C04 test-fixture with real held K input', 'samples': []}
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
        context = await browser.new_context(viewport={'width': 844, 'height': 390}, is_mobile=True,
                                           has_touch=True, record_video_dir=str(ART/f'{name}-muzzle-video'))
        page = await context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto('http://127.0.0.1:8782/?test=1', wait_until='networkidle')
        await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
        await page.click('[data-route=freight]')
        await page.click('[data-car=cargo]')
        await page.click('#start')
        for tier in [1, 2, 3]:
            for face in [-1, 1]:
                for distance in [.5, 1.3]:
                    tag = f't{tier}-f{face}-d{distance}'
                    await page.evaluate('''({tier,face,distance}) => {
                        const a=__RH_TEST;a.reset();const g=a.game();g.pause(true);
                        g.director.rest=9999;g.round=8;g.meleeTier=3;g.rangedTier=tier;
                        a.forcePlayer(5);g.player.face=face;g.lastMuzzle=null;
                        const front=g.spawn('bruiser',5+face*distance,false),back=g.spawn('bruiser',5-face*.5,false);
                        if(!front||!back)throw Error('fixture admission failed');front.climb=0;back.climb=0;
                        window.qaTargets={front,back};a.view().render(0);a.step(0);
                    }''', {'tier': tier, 'face': face, 'distance': distance})
                    await page.screenshot(path=str(ART/f'{name}-muzzle-{tag}-before.png'))
                    await page.evaluate('__RH_TEST.game().pause(false)')
                    await page.keyboard.down('KeyK')
                    await page.wait_for_function('__RH_TEST.game().lastMuzzle!==null', timeout=4000)
                    await page.keyboard.up('KeyK')
                    await page.evaluate('__RH_TEST.game().pause(true);__RH_TEST.view().render(0)')
                    v = await page.evaluate('''() => {const a=__RH_TEST,g=a.game();return {
                        frontHP:qaTargets.front.hp,backHP:qaTargets.back.hp,
                        projectileOrigin:g.lastMuzzle,modelMuzzle:a.view().muzzle(),
                        weapon:g.ranged.id,damage:g.rangedStats.damage,playerHP:g.player.hp,
                        px:g.player.x,face:g.player.face};}''')
                    report['samples'].append({'case': tag, **v})
                    # Browser action latency may admit >1 SMG shot. Exact single-shot damage
                    # is covered by the deterministic companion unit suite.
                    check(tag+'_front_hit', v['frontHP'] <= 140-v['damage'])
                    check(tag+'_back_untouched', v['backHP'] == 140)
                    check(tag+'_real_muzzle_preserved', all(abs(v['projectileOrigin'][k]-v['modelMuzzle'][k]) < .002 for k in ['x', 'y', 'z']))
                    await page.screenshot(path=str(ART/f'{name}-muzzle-{tag}-after.png'))
        # Reproduce the exact failed exploration layout, with a normal Boarder.
        await page.evaluate('''() => {const a=__RH_TEST;a.reset();const g=a.game();g.pause(true);
            g.director.rest=9999;g.meleeTier=3;g.rangedTier=3;a.forcePlayer(1.7);g.player.face=1;
            const e=g.spawn('boarder',3,false);e.climb=0;a.view().render(0);a.step(0);}''')
        await page.screenshot(path=str(ART/f'{name}-muzzle-rifle-repro-before.png'))
        await page.evaluate('__RH_TEST.game().pause(false)')
        await page.keyboard.down('KeyK')
        await page.wait_for_function('__RH_TEST.game().totalKills===1', timeout=4000)
        await page.keyboard.up('KeyK')
        await page.evaluate('__RH_TEST.game().pause(true);__RH_TEST.view().render(0)')
        report['rifleRepro'] = await page.evaluate('__RH_DEBUG.snapshot()')
        check('rifle_contact_kill_rewards_once', report['rifleRepro']['stats']['kills'] == 1 and report['rifleRepro']['scrap'] == 2)
        await page.screenshot(path=str(ART/f'{name}-muzzle-rifle-repro-after.png'))
        check('no_page_errors', not errors)
        check('completed_suite', True)
    except Exception as exc:
        report['exception'] = str(exc)
        report['checks']['completed_suite'] = False
        if page and not page.is_closed():
            try:
                report['failureState'] = await page.evaluate('__RH_DEBUG.snapshot()')
                await page.screenshot(path=str(ART/f'{name}-muzzle-failure.png'))
            except Exception:
                pass
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
    report['errors'] = errors
    report['passed'] = len(report['checks']) >= MINIMUM and all(report['checks'].values()) and not errors
    (ART/f'{name}-muzzle-report.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report), flush=True)
    return report['passed']

async def main():
    server = subprocess.Popen([sys.executable, '-m', 'http.server', '8782', '--directory', 'dist', '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
