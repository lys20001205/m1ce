"""Release packaging and real consent transport. HTTP is intercepted; no public telemetry is posted."""
import asyncio,json,mimetypes,os,subprocess,sys
from pathlib import Path
from urllib.parse import urlparse,unquote
from playwright.async_api import async_playwright
ART=Path('artifacts');ART.mkdir(exist_ok=True)
FIELDS=['route','speedMode','routeProgress','playerLayer','playerLifeState','respawnRemaining','cargoUsed','cargoCapacity','cargoValue','scrap','meleeTier','rangedTier','batteryCharge','threatCurrent','threatCap','dev']

async def run(p,name):
    kw={'headless':True}
    if name=='chromium':
        kw['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
        if os.environ.get('CHROMIUM_PATH'):kw['executable_path']=os.environ['CHROMIUM_PATH']
    browser=await getattr(p,name).launch(**kw);report={'browser':name,'checks':{}};errors=[];posts=[]
    try:
        context=await browser.new_context(viewport={'width':844,'height':390},is_mobile=True,has_touch=True)
        origin='https://lys20001205.github.io/m1ce/'
        async def serve(route):
            req=route.request;u=urlparse(req.url)
            if u.hostname=='ntfy.sh':
                if req.method=='POST':posts.append(json.loads(req.post_data))
                await route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps({'id':'synthetic_test_receipt'}));return
            if u.hostname!='lys20001205.github.io' or not u.path.startswith('/m1ce/'):
                await route.abort();return
            relative=unquote(u.path[len('/m1ce/'):]) or 'index.html';file=(Path('dist')/relative).resolve()
            if not file.is_relative_to(Path('dist').resolve()) or not file.is_file():
                await route.fulfill(status=404,body='not found');return
            mime=mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
            if file.suffix=='.js':mime='text/javascript'
            await route.fulfill(status=200,content_type=mime,body=file.read_bytes())
        await context.route('**/*',serve)
        page=await context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto(origin+'?test=0',wait_until='networkidle');await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
        report['checks']['non_test_query_has_no_mutable_api']=await page.evaluate('!window.__RH_TEST&&!__RH_DEBUG.snapshot().test&&!__RH_DEBUG.snapshot().dev')
        meta=await page.evaluate('(async()=>({build:await(await fetch("./build.json")).json(),manifest:await(await fetch("./manifest.webmanifest")).json(),title:document.title}))()')
        report['metadata']=meta
        report['checks']['version_and_entrypoint_are_v11']=meta['build']['build']=='V11-RELEASE-20260917' and meta['manifest']['start_url']=='./?build=v11' and 'V11' in meta['title']
        report['checks']['provenance_has_commit']=len(meta['build'].get('commit',''))==40
        raw=await page.evaluate('JSON.stringify(__RH_DEBUG.snapshot()).length');report['localSnapshotBytes']=raw
        await page.wait_for_timeout(200);report['checks']['no_upload_before_explicit_consent']=len(posts)==0 and not await page.locator('#telemetry').is_checked()
        await page.locator('#telemetry').check();await page.wait_for_function('__RH_DEBUG.logs().some(e=>e.type==="telemetry_consent"&&e.enabled===true)')
        for _ in range(40):
            if posts:break
            await page.wait_for_timeout(100)
        report['checks']['actual_consent_posts_with_large_local_snapshot']=raw>3500 and len(posts)>0
        if not posts:raise AssertionError('Consent must deliver a batch rather than refusing the renderer snapshot')
        report['transport']=posts[0]
        report['checks']['compact_payload_retains_frozen_fields']=all(f in posts[0]['state'] for f in FIELDS)
        report['checks']['payload_bounded_and_no_raw_diagnostics']=len(json.dumps(posts[0],ensure_ascii=False,separators=(',',':')).encode())<=3500 and not any(k in posts[0]['state'] for k in ['landmarks','enemyStates','message','credentials','url','session'])
        await page.locator('#telemetry').uncheck();before=len(posts);await page.wait_for_timeout(350)
        report['checks']['consent_can_be_revoked']=not await page.locator('#telemetry').is_checked() and len(posts)==before
        for query,mode in [('?test=1','test'),('?dev=1','dev')]:
            before=len(posts);await page.goto(origin+query,wait_until='networkidle');await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
            await page.locator('#telemetry').check();await page.wait_for_timeout(200)
            report['checks'][mode+'_cannot_upload_to_formal_channel']=len(posts)==before
        report['checks']['no_page_errors']=not errors
    except Exception as e:
        report['exception']=str(e);report['checks']['completed_suite']=False
        try:report['failureState']=await page.evaluate('__RH_DEBUG.snapshot()');await page.screenshot(path=str(ART/f'{name}-ship-failure.png'))
        except Exception:pass
    finally:await browser.close()
    report['errors']=errors;report['passed']=all(report['checks'].values());(ART/f'{name}-ship-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True);return report['passed']
async def main():
    async with async_playwright() as p:results=[await run(p,n) for n in os.environ.get('RH_BROWSERS','chromium,webkit').split(',')]
    if not all(results):raise SystemExit(1)
asyncio.run(main())
