"""Native HTTP cache fixture + actual release WebGL; no game-state mutation."""
import asyncio,json,mimetypes,threading,sys
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlparse,parse_qs,unquote
from playwright.async_api import async_playwright
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from build_identity import expected_build
ART=Path('artifacts');ART.mkdir(exist_ok=True)
ROOT=Path('dist').resolve();BUILD=expected_build();MODE='seed'
POISON=b"globalThis.__legacyCachePoison=true;throw new Error('LEGACY_CACHE_POISON');"
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        name=unquote(urlparse(self.path).path)
        if name=='/src/__legacy_cache_probe.js':
            body=b"export const revision='LEGACY_CACHE_POISON';" if MODE=='seed' else b"export const revision='current';";mime='text/javascript'
        elif MODE=='seed' and name.startswith('/src/') and name.endswith('.js'):
            body=POISON;mime='text/javascript'
        else:
            file=ROOT/('index.html' if name in ['/','/control.html'] else name.lstrip('/'))
            if not file.is_relative_to(ROOT) or not file.is_file():self.send_error(404);return
            body=file.read_bytes();mime=mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
            if file.suffix=='.js':mime='text/javascript'
            if name=='/control.html':body=body.replace(('?build='+BUILD).encode(),b'?v=12-art2')
        self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Cache-Control','max-age=600');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
async def run(p,name,base):
    global MODE
    args={'headless':True}
    if name=='chromium':args['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
    browser=await getattr(p,name).launch(**args);context=await browser.new_context(viewport={'width':844,'height':390})
    report={'browser':name,'checks':{},'scope':'Adversarial legacy native-HTTP-cache fixture, then unchanged actual release files and ordinary route/start inputs. No renderer mocks or mutable game API.'};errors=[];requests=[]
    try:
        MODE='seed';seed=await context.new_page()
        # Use this origin for the trusted fetch cache; no request interception.
        await seed.goto(base+'/control.html',wait_until='domcontentloaded')
        urls=['/src/'+f.name+q for f in Path('dist/src').glob('*.js') for q in ['', '?v=12','?v=12-art2']]
        # The seed document's entry may have executed poison; use a fresh native
        # document at the same origin only to fetch (not modify) cached files.
        seeded=await seed.evaluate('''async urls=>{const rows=await Promise.all(urls.map(async u=>{const r=await fetch(u,{cache:'force-cache'});return r.headers.get('cache-control')==='max-age=600'&&(await r.text()).includes('LEGACY_CACHE_POISON');}));return rows.every(Boolean);}''',urls)
        report['checks']['legacy_native_cache_seeded']=seeded
        # Successfully imported legacy modules remain in the native module map;
        # WebKit may retry rejected imports and revalidate cross-page HTTP caches.
        # The unchanged URL must still expose the old export after server bytes
        # change, proving why all release import identities must be canonical.
        probe='''async url=>Promise.race([(async()=>{try{return (await import(url)).revision;}catch(e){return String(e);}})(),new Promise(r=>setTimeout(()=>r('legacy probe did not settle'),10000))])'''
        probe_url=base+'/src/__legacy_cache_probe.js?v=12-art2'
        first=await seed.evaluate(probe,probe_url);MODE='current';second=await seed.evaluate(probe,probe_url)
        report['legacyExports']=[first,second];report['checks']['negative_control_retains_cached_legacy_module']=first=='LEGACY_CACHE_POISON' and second=='LEGACY_CACHE_POISON'
        page=await context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:requests.append(r.url))
        await page.goto(base+'/',wait_until='networkidle');await page.wait_for_function('window.__RH_DEBUG?.snapshot().assetModelsLoaded===21')
        report['checks']['authored_revision_and_entry']=await page.evaluate('__RH_DEBUG.snapshot().build')==BUILD and 'V13 R4' in await page.title()
        game=[u for u in requests if urlparse(u).path.startswith('/src/') and urlparse(u).path.endswith('.js')]
        assets=[u for u in requests if urlparse(u).path.startswith('/assets/')]
        report['checks']['canonical_game_module_versions']=len(game)>=20 and all(parse_qs(urlparse(u).query).get('build')==[BUILD] for u in game)
        report['checks']['canonical_asset_versions']=len(assets)>=25 and all(parse_qs(urlparse(u).query).get('build')==[BUILD] for u in assets)
        s=await page.evaluate('__RH_DEBUG.snapshot()');report['checks']['actual_WebGL_and_models']=s['renderer']=='WebGL2' and s['modelsLoaded']==3 and s['assetModelsLoaded']==21 and not s['assetFailures']
        report['checks']['no_caught_runtime_pause']=s['errors']==0 and await page.locator('#fatal').is_hidden() and not await page.evaluate('!!window.__legacyCachePoison')
        await page.locator('[data-route=tunnel]').click();await page.locator('[data-car=cargo]').click();await page.locator('#start').click()
        await page.wait_for_function('__RH_DEBUG.snapshot().elapsed>3.5&&__RH_DEBUG.snapshot().routeT>0&&!__RH_DEBUG.snapshot().paused')
        s=await page.evaluate('__RH_DEBUG.snapshot()');report['state']=s
        report['checks']['normal_route_start_advances']=s['status']=='running' and s['errors']==0 and await page.locator('#fatal').is_hidden()
        report['checks']['release_has_no_mutable_test_api']=not await page.evaluate('!!window.__RH_TEST') and not s['test'] and not s['dev']
        await page.screenshot(path=str(ART/(name+'-release-cache-normal.png')))
        report['checks']['no_page_errors']=not errors;report['checks']['completed_suite']=True
    except Exception as e:report['exception']=str(e);report['checks']['completed_suite']=False
    finally:await browser.close()
    report['requests']=requests;report['errors']=errors;report['passed']=len(report['checks'])>=11 and all(report['checks'].values()) and not errors
    (ART/(name+'-release-cache-report.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True);return report['passed']
async def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try:
        async with async_playwright() as p:results=[await run(p,n,'http://127.0.0.1:'+str(server.server_port)) for n in ['chromium','webkit']]
        if not all(results):raise SystemExit(1)
    finally:server.shutdown();server.server_close()
if __name__=='__main__':asyncio.run(main())
