"""Ordinary public entry on fresh and retained native browser profiles. No test API."""
import asyncio, json, os, sys
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
        await page.goto(URL, wait_until='networkidle', timeout=60000)
        assert page.url==URL, 'Public entry redirected: '+page.url
        await page.wait_for_function('window.__RH_DEBUG?.snapshot().assetModelsLoaded===21',timeout=60000)
        s=await page.evaluate('__RH_DEBUG.snapshot()')
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
        return {'browser':name,'profile':profile,'url':page.url,'build':s['build'],'elapsed':s['elapsed'],'routeT':s['routeT'],'models':s['assetModelsLoaded'],'errors':errors,'passed':True}
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
