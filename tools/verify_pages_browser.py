"""Ordinary public entry on fresh and retained native browser profiles. No test API."""
import asyncio, json, os, sys, tarfile
from pathlib import Path
from playwright.async_api import async_playwright

URL = 'https://lys20001205.github.io/m1ce/'
OUT = Path('pages-browser-proof')
OUT.mkdir(exist_ok=True)

async def check(p, name, profile, expected=None):
    options = dict(headless=True, viewport={'width':844,'height':390}, has_touch=True)
    if name == 'chromium':
        options['args'] = ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
    context = await getattr(p, name).launch_persistent_context(str(OUT / profile), **options)
    errors=[]
    try:
        page=await context.new_page()
        page.on('pageerror',lambda e:errors.append(str(e)))
        response=await page.goto(URL, wait_until='networkidle', timeout=60000)
        navigation_headers=await response.all_headers()
        assert page.url==URL, 'Public entry redirected: '+page.url
        await page.wait_for_function('window.__RH_DEBUG?.snapshot().assetModelsLoaded===21',timeout=60000)
        s=await page.evaluate('__RH_DEBUG.snapshot()')
        initial_build=s['build'];ordinary_reload=False;save_preserved=None;reload_headers=None
        (OUT/(profile+'-'+sys.argv[1]+'-navigation.json')).write_text(json.dumps({'url':page.url,'build':initial_build,'expected':expected,'automaticUpgrade':initial_build==expected if expected else None,'headers':navigation_headers},indent=2)+'\n')
        # A fresh entry must be current immediately. Retained profiles separately
        # measure first navigation, then the user's ordinary refresh recovery.
        # Never relabel a stale first navigation as automatic migration success.
        if expected and profile.endswith('-warm'):
            if initial_build!=expected:
                await page.screenshot(path=str(OUT/(profile+'-stale-navigation.png')),timeout=60000)
            saved=await page.evaluate('localStorage.getItem("roundhouse_save_v11")')
            response=await page.reload(wait_until='networkidle',timeout=60000)
            reload_headers=await response.all_headers()
            await page.wait_for_function('window.__RH_DEBUG?.snapshot().assetModelsLoaded===21',timeout=60000)
            assert page.url==URL, 'Ordinary reload redirected: '+page.url
            s=await page.evaluate('__RH_DEBUG.snapshot()');ordinary_reload=True
            save_preserved=saved==await page.evaluate('localStorage.getItem("roundhouse_save_v11")')
            assert save_preserved, 'Ordinary reload changed retained save'
        assert not await page.evaluate('!!window.__RH_TEST'), 'Mutable test API on public entry'
        assert not s['test'] and not s['dev'] and s['renderer']=='WebGL2' and s['modelsLoaded']==3 and not s['assetFailures'], s
        if expected:
            assert s['build']==expected, {'expected':expected,'actual':s['build']}
        await page.locator('[data-route=freight]').click()
        await page.locator('[data-car=cargo]').click()
        await page.locator('#start').click()
        await page.wait_for_function('__RH_DEBUG.snapshot().status==="running"&&__RH_DEBUG.snapshot().elapsed>3.5&&__RH_DEBUG.snapshot().routeT>0&&!__RH_DEBUG.snapshot().paused',timeout=60000)
        s=await page.evaluate('__RH_DEBUG.snapshot()')
        assert not errors and s['errors']==0 and await page.locator('#fatal').is_hidden(), errors
        await page.screenshot(path=str(OUT/(profile+'-'+sys.argv[1]+'.png')),timeout=60000)
        return {'browser':name,'profile':profile,'url':page.url,'initialBuild':initial_build,'automaticUpgrade':initial_build==expected if expected else None,'ordinaryReloadPerformed':ordinary_reload,'savePreservedByReload':save_preserved,'navigationHeaders':navigation_headers,'reloadHeaders':reload_headers,'build':s['build'],'elapsed':s['elapsed'],'routeT':s['routeT'],'models':s['assetModelsLoaded'],'errors':errors,'passed':True}
    except Exception:
        if 'page' in locals():
            try:await page.screenshot(path=str(OUT/(profile+'-'+sys.argv[1]+'-failure.png')),timeout=60000)
            except Exception as capture_error:print('Failure screenshot unavailable:',str(capture_error),flush=True)
        raise
    finally:
        await context.close()

async def main():
    mode=sys.argv[1]
    assert mode in ['seed','verify']
    report={'mode':mode,'checks':[],'passed':False}
    try:
        expected=None
        # build identity comes from the tested source, independent of public content.
        if mode=='verify':
            sys.path.insert(0,str(Path(__file__).resolve().parent))
            from build_identity import expected_build
            expected=expected_build()
            assert json.loads(Path('proof/release-gate.json').read_text())['commit']==os.environ['GITHUB_SHA']
            seed=json.loads((OUT/'seed.json').read_text())
            assert seed['passed'] and {s['browser'] for s in seed['checks'] if s['passed']}=={'chromium','webkit'}, 'Missing successful pre-deployment cache proof'
            for name in ['chromium','webkit']:
                profile=OUT/(name+'-warm')
                assert profile.is_dir() and any(profile.iterdir()), 'Missing retained native profile: '+name
            # Preserve pre-upgrade HTTP caches and storage before verification can alter them.
            with tarfile.open(OUT/'seed-profiles.tar.gz','w:gz') as archive:
                for name in ['chromium','webkit']:
                    archive.add(OUT/(name+'-warm'),arcname=name+'-warm')
            report['seed']=seed
        async with async_playwright() as p:
            for name in ['chromium','webkit']:
                report['checks'].append(await check(p,name,name+'-warm',expected))
                if mode=='verify':report['checks'].append(await check(p,name,name+'-fresh',expected))
        report['passed']=True
    except Exception as error:
        report['error']=str(error)
        raise
    finally:
        (OUT/(mode+'.json')).write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps(report),flush=True)

if __name__=='__main__':asyncio.run(main())
