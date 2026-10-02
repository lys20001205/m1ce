"""Live Pages headers, ordinary reload and save retention. Not a V12 migration claim."""
import asyncio,json,os
from pathlib import Path
from urllib.request import urlopen
from playwright.async_api import async_playwright
URL='https://lys20001205.github.io/m1ce/'
OUT=Path('artifacts/public-cache-diagnostic');OUT.mkdir(parents=True,exist_ok=True)
# Intel is intentionally consumed when route selection opens; exclude that active
# consumable from a byte-preservation fixture (its behavior has a separate gate).
SAVE={'version':11,'bank':4321,'career':{'boots':1,'hull':1,'kit':2},'starterWeapon':'shotgun','prep':{'reroll':1,'repairKit':1,'intel':0}}
async def run(p,name,build):
    opts={'headless':True,'viewport':{'width':844,'height':390}}
    if name=='chromium':opts['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
    ctx=await getattr(p,name).launch_persistent_context(str(OUT/(name+'-profile')),**opts)
    report={'browser':name,'scope':'Live current Pages ordinary reload; representative save fixture; NOT historical V12 migration','checks':{}}
    try:
        page=await ctx.new_page();errors=[];requests=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:requests.append({'url':r.url,'resourceType':r.resource_type}))
        response=await page.goto(URL,wait_until='networkidle')
        report['navigationHeaders']=await response.all_headers()
        await page.wait_for_function('window.__RH_DEBUG?.snapshot().assetModelsLoaded===21')
        report['initialBuild']=await page.evaluate('__RH_DEBUG.snapshot().build')
        await page.evaluate('(s)=>localStorage.setItem("roundhouse_save_v11",JSON.stringify(s))',SAVE)
        response=await page.reload(wait_until='networkidle')
        report['reloadHeaders']=await response.all_headers()
        report['reloadRequestHeaders']=await response.request.all_headers()
        await page.wait_for_function('window.__RH_DEBUG?.snapshot().assetModelsLoaded===21')
        s=await page.evaluate('__RH_DEBUG.snapshot()');report['afterReload']=s
        report['saveAfterReload']=await page.evaluate('JSON.parse(localStorage.getItem("roundhouse_save_v11"))')
        report['serviceWorkers']=await page.evaluate('async()=>({controller:!!navigator.serviceWorker?.controller,registrations:navigator.serviceWorker?(await navigator.serviceWorker.getRegistrations()).map(r=>r.scope):[]})')
        report['checks']={'original_bare_url':page.url==URL,'expected_build':s['build']==build['build'],'normal_reload_retains_save':report['saveAfterReload']==SAVE,'bank_and_career_loaded':s['bank']==SAVE['bank'] and s['career']==SAVE['career'],'no_service_worker':not report['serviceWorkers']['controller'] and not report['serviceWorkers']['registrations'],'no_test_api':not await page.evaluate('!!window.__RH_TEST')}
        await page.locator('[data-route=freight]').click();await page.locator('[data-car=cargo]').click();await page.locator('#start').click()
        await page.wait_for_function('__RH_DEBUG.snapshot().elapsed>3.5&&__RH_DEBUG.snapshot().routeT>0&&!__RH_DEBUG.snapshot().paused')
        report['checks']['ordinary_start']=await page.evaluate('__RH_DEBUG.snapshot().status==="running"&&__RH_DEBUG.snapshot().errors===0')
        report['checks']['no_page_errors']=not errors
        await page.screenshot(path=str(OUT/(name+'-reload.png')),timeout=60000)
        report['requests']=requests;report['errors']=errors
        report['passed']=all(report['checks'].values());assert report['passed'],report['checks']
    except Exception as e:report['error']=str(e);report['passed']=False;raise
    finally:
        await ctx.close();(OUT/(name+'.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
async def main():
    with urlopen(URL+'build.json',timeout=30) as r:build=json.load(r)
    assert build['commit']==os.environ['EXPECTED_PUBLIC_SHA'],build
    (OUT/'build.json').write_text(json.dumps(build,indent=2)+'\n')
    async with async_playwright() as p:
        for name in ['chromium','webkit']:await run(p,name,build)
if __name__=='__main__':asyncio.run(main())
