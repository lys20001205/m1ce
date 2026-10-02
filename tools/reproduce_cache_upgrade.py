"""Actual legacy/current builds with native HTTP cache; no routing or cache clearing."""
import argparse,asyncio,hashlib,json,mimetypes,os,shutil,threading
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlsplit,unquote
from playwright.async_api import async_playwright

async def main():
    parser=argparse.ArgumentParser();parser.add_argument('--old-dist',required=True);parser.add_argument('--new-dist',default='dist');parser.add_argument('--output',default='artifacts/cache-upgrade-repro');args=parser.parse_args()
    old=Path(args.old_dist).resolve();new=Path(args.new_dist).resolve();out=Path(args.output).resolve()
    out.mkdir(parents=True,exist_ok=False)
    old_build=json.loads((old/'build.json').read_text());new_build=json.loads((new/'build.json').read_text());assert old_build['build']!=new_build['build']
    state={'root':old,'phase':'seed'};requests=[]
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_GET(self):
            relative=unquote(urlsplit(self.path).path)
            if not relative.startswith('/m1ce/'):self.send_error(404);return
            path=(state['root']/(relative.removeprefix('/m1ce/') or 'index.html')).resolve()
            if not path.is_relative_to(state['root']) or not path.is_file():self.send_error(404);return
            data=path.read_bytes();etag='"'+hashlib.sha256(data).hexdigest()+'"';modified='Thu, 01 Oct 2026 08:00:00 GMT' if state['root']==old else 'Fri, 02 Oct 2026 08:00:00 GMT'
            tag=self.headers.get('If-None-Match');since=self.headers.get('If-Modified-Since');status=304 if tag==etag or (tag is None and since==modified) else 200
            requests.append({'phase':state['phase'],'url':self.path,'status':status,'requestHeaders':dict(self.headers),'etag':etag,'lastModified':modified})
            self.send_response(status);self.send_header('Cache-Control','max-age=600');self.send_header('ETag',etag);self.send_header('Last-Modified',modified);self.send_header('Content-Type',mimetypes.guess_type(str(path))[0] or 'application/octet-stream');self.send_header('Content-Length',str(len(data)));self.end_headers()
            if status==200:self.wfile.write(data)
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/m1ce/'
    fixture={'version':11,'bank':23456,'career':{'boots':2,'hull':1,'kit':2},'starterWeapon':'shotgun','prep':{'reroll':0,'repairKit':0,'intel':0}}
    report={'scope':'Controlled native-HTTP-cache replay using actual builds, not the lost original public profile. Representative save fixture, not earned by play.','oldBuild':old_build,'newBuild':new_build,'url':url,'fixture':fixture,'browsers':[],'passed':False}
    try:
        async with async_playwright() as p:
            for name in ['chromium','webkit']:
                state.update(root=old,phase=name+'-seed');profile=out/(name+'-profile');row={'browser':name,'network':[]};report['browsers'].append(row)
                options={'headless':True,'viewport':{'width':844,'height':390}}
                if name=='chromium':
                    options['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
                    if os.environ.get('CHROMIUM_EXECUTABLE'):options['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
                ctx=None
                async def open_context():return await getattr(p,name).launch_persistent_context(str(profile),**options)
                async def observe(page,label):
                    await page.wait_for_function('window.__RH_DEBUG?.snapshot().assetModelsLoaded===21',timeout=60000)
                    d=await page.evaluate('''async()=>({snapshot:__RH_DEBUG.snapshot(),save:localStorage.getItem('roundhouse_save_v11'),serviceWorkers:(await navigator.serviceWorker.getRegistrations()).map(r=>r.scope),test:!!window.__RH_TEST,url:location.href,modules:performance.getEntriesByType('resource').filter(e=>e.name.includes('/src/')).map(e=>e.name)})''')
                    row[label]=d;await page.screenshot(path=str(out/(name+'-'+label+'.png')),timeout=60000);return d
                try:
                    ctx=await open_context();page=await ctx.new_page();await page.goto(url,wait_until='networkidle');await observe(page,'seed-before-fixture')
                    await page.evaluate('(s)=>localStorage.setItem("roundhouse_save_v11",JSON.stringify(s))',fixture);await page.reload(wait_until='networkidle');seed=await observe(page,'seed');assert json.loads(seed['save'])==fixture
                    await ctx.close();ctx=None;shutil.copytree(profile,out/(name+'-legacy-cold-backup'))
                    state.update(root=new,phase=name+'-upgrade');ctx=await open_context();page=await ctx.new_page()
                    if name=='chromium':
                        cdp=await ctx.new_cdp_session(page);await cdp.send('Network.enable')
                        for event in ['Network.requestWillBeSent','Network.responseReceived','Network.requestServedFromCache']:
                            cdp.on(event,lambda data,event=event:row['network'].append({'phase':state['phase'],'event':event,'data':data}))
                    await page.goto(url,wait_until='networkidle');initial=await observe(page,'initial-upgrade')
                    row['automaticUpgrade']=initial['snapshot']['build']==new_build['build']
                    if name=='chromium':
                        assert initial['snapshot']['build']==old_build['build'],'Chromium stale-page negative control was not reproduced'
                        assert any(e['event']=='Network.responseReceived' and e['data']['response']['url']==url and e['data']['response'].get('fromDiskCache') and not e['data']['response'].get('fromServiceWorker') for e in row['network'])
                    state['phase']=name+'-reload';await page.reload(wait_until='networkidle');recovered=await observe(page,'ordinary-reload')
                    assert recovered['snapshot']['build']==new_build['build'];assert recovered['save']==seed['save'];assert recovered['url']==url and not recovered['test'] and not recovered['serviceWorkers']
                    await page.locator('[data-route=freight]').click();await page.locator('[data-car=cargo]').click();await page.locator('#start').click();await page.wait_for_function('__RH_DEBUG.snapshot().elapsed>3.5&&__RH_DEBUG.snapshot().routeT>0&&!__RH_DEBUG.snapshot().paused',timeout=60000)
                    playing=await observe(page,'normal-start');assert playing['save']==seed['save'] and playing['snapshot']['errors']==0 and await page.locator('#fatal').is_hidden()
                    row['passed']=True
                except Exception as e:row['error']=str(e);raise
                finally:
                    if ctx:await ctx.close()
        report['passed']=True
    finally:
        server.shutdown();server.server_close();(out/'report.json').write_text(json.dumps(report,indent=2)+'\n');(out/'server-requests.json').write_text(json.dumps(requests,indent=2)+'\n');print(json.dumps({'passed':report['passed'],'browsers':[{k:v for k,v in r.items() if k in ['browser','passed','error','automaticUpgrade']} for r in report['browsers']]}),flush=True)
if __name__=='__main__':asyncio.run(main())
