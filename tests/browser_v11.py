"""V11-B real route/car UI and three rendered gate/turntable cases."""
import asyncio,json,subprocess,sys
from pathlib import Path
from playwright.async_api import async_playwright
ART=Path('artifacts');ART.mkdir(exist_ok=True)
async def run(p,name):
 kw={'headless':True}
 if name=='chromium':kw['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
 browser=await getattr(p,name).launch(**kw);report={'browser':name,'checks':{},'routes':[]};errors=[]
 try:
  for route,angle in [('industrial',-.42),('freight',0),('tunnel',.42)]:
   page=await browser.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True)
   page.on('pageerror',lambda e:errors.append(str(e)))
   await page.goto('http://127.0.0.1:8766/?test=1',wait_until='networkidle')
   await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
   report['checks'][route+'_three_choices']=await page.locator('[data-route]').count()==3
   report['checks'][route+'_car_not_first']=not await page.locator('#choices').is_visible()
   await page.screenshot(path=str(ART/f'{name}-{route}-hub.png'))
   await page.click('[data-route='+route+']');await page.click('[data-car=cargo]');await page.click('#start')
   # Step the real simulation deterministically to the end of the turntable animation.
   await page.evaluate('(()=>{const a=window.__RH_TEST,g=a.game();a.step(Math.max(0,3-g.elapsed));g.pause(true);a.view().render(0)})()')
   s=await page.evaluate('window.__RH_DEBUG.snapshot()');report['routes'].append(s)
   report['checks'][route+'_three_physical_gates']=s['gateCount']==3
   report['checks'][route+'_target_angle']=abs(s['turntableAngle']-angle)<.015
   report['checks'][route+'_real_meshes']=s['renderer']=='WebGL2' and s['triangles']>2000
   await page.screenshot(path=str(ART/f'{name}-{route}-turntable.png'))
   await page.close()
  report['checks']['no_page_errors']=not errors
 except Exception as e:report['exception']=str(e);report['checks']['completed_suite']=False
 finally:await browser.close()
 report['errors']=errors;report['passed']=all(report['checks'].values());(ART/f'{name}-v11-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
 return report['passed']
async def main():
 server=subprocess.Popen([sys.executable,'-m','http.server','8766','--directory','dist','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  await asyncio.sleep(.5)
  async with async_playwright() as p:
   results=[await run(p,n) for n in ['chromium','webkit']]
  if not all(results):raise SystemExit(1)
 finally:server.terminate();server.wait(timeout=5)
asyncio.run(main())
