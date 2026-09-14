"""V11-B real route/car UI and three rendered gate/turntable cases."""
import os,shutil
import asyncio,json,subprocess,sys,io
from PIL import Image,ImageChops
from pathlib import Path
from playwright.async_api import async_playwright
ART=Path('artifacts');ART.mkdir(exist_ok=True)
async def run(p,name):
 kw={'headless':True}
 if name=='chromium':kw['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
 browser=await getattr(p,name).launch(**({**kw,'executable_path':os.environ['CHROMIUM_PATH']} if name=='chromium' and os.environ.get('CHROMIUM_PATH') else kw));report={'browser':name,'checks':{},'routes':[]};errors=[]
 try:
  for route,angle in [('industrial',-.42),('freight',0),('tunnel',.42)]:
   page=await browser.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True)
   page.on('pageerror',lambda e:errors.append(str(e)))
   await page.goto('http://127.0.0.1:8766/?test=1',wait_until='networkidle')
   await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
   report['checks'][route+'_three_choices']=await page.locator('[data-route]').count()==3
   report['checks'][route+'_car_not_first']=not await page.locator('#choices').is_visible()
   boot=await page.evaluate('window.__RH_DEBUG.snapshot()');report['checks'][route+'_gates_framed']=all(0<x['screen'][0]<boot['canvasCss'][0] and 0<x['screen'][1]<boot['canvasCss'][1] for x in boot['gateScreens'])
   await page.screenshot(path=str(ART/f'{name}-{route}-hub.png'))
   await page.click('[data-route='+route+']');await page.click('[data-car=cargo]');await page.click('#start')
   # Step the real simulation deterministically to the end of the turntable animation.
   await page.evaluate('(()=>{const a=window.__RH_TEST,g=a.game();a.step(Math.max(0,3-g.elapsed));g.pause(true);a.view().render(0)})()')
   s=await page.evaluate('window.__RH_DEBUG.snapshot()');report['routes'].append(s)
   report['checks'][route+'_three_physical_gates']=s['gateCount']==3
   report['checks'][route+'_target_angle']=abs(s['turntableAngle']-angle)<.015
   report['checks'][route+'_real_meshes']=s['renderer']=='WebGL2' and s['triangles']>2000
   await page.screenshot(path=str(ART/f'{name}-{route}-turntable.png'))

   # Same meshes move continuously under the real simulation; no route-phase scene swap.
   await page.evaluate('(()=>{const a=window.__RH_TEST,g=a.game();g.pause(false);a.forcePlayer(5.8);a.forceRoute(.24);g.setSpeed("CRUISE");g.pause(true);a.view().render(0)})()')
   before=await page.evaluate('window.__RH_DEBUG.snapshot()')
   image1=await page.locator('canvas').screenshot(path=str(ART/f'{name}-{route}-ring-before.png'))
   await page.evaluate('(()=>{const a=window.__RH_TEST,g=a.game();g.pause(false);a.step(2);g.pause(true);a.view().render(0)})()')
   after=await page.evaluate('window.__RH_DEBUG.snapshot()')
   image2=await page.locator('canvas').screenshot(path=str(ART/f'{name}-{route}-ring-after.png'))
   diff=ImageChops.difference(Image.open(io.BytesIO(image1)).convert('RGB'),Image.open(io.BytesIO(image2)).convert('RGB'))
   changed=sum(1 for px in diff.getdata() if sum(px)>60)
   lm1=before['landmarks'][1];lm2=after['landmarks'][1]
   report['checks'][route+'_landmark_geometry_moves']=lm1['id']==lm2['id'] and lm2['world'][0]>lm1['world'][0]+10
   report['checks'][route+'_landmark_projected_movement']=abs(lm2['screen'][0]-lm1['screen'][0])>10
   report['checks'][route+'_continuous_world_pixel_diff']=changed>1000
   report['checks'][route+'_one_ring_and_lod']=after['loadedRouteWorlds']==1 and 0<after['routeSegmentsNear']<after['routeSegmentsVisible']<=after['routeSegmentsTotal']
   report.setdefault('ringEvidence',[]).append({'route':route,'before':lm1,'after':lm2,'changedPixels':changed,'renderer':after})
   # STOP is issued via the real global button; neither landmarks nor progress then move.
   await page.evaluate('window.__RH_TEST.game().pause(false)');await page.click('#brake');await page.wait_for_timeout(800)
   await page.evaluate('window.__RH_TEST.game().pause(true)')
   stopped=await page.evaluate('window.__RH_DEBUG.snapshot()')
   await page.evaluate('(()=>{const a=window.__RH_TEST,g=a.game();g.pause(false);a.step(1);g.pause(true)})()')
   s2=await page.evaluate('window.__RH_DEBUG.snapshot()')
   report['checks'][route+'_stop_world_still']=s2['routeT']==stopped['routeT'] and s2['landmarks']==stopped['landmarks'] and s2['speedMode']=='STOP'
   await page.evaluate('window.__RH_TEST.game().pause(false)')
   # Live enemies may interrupt an interaction. Retry real input only; never clear stun/HP/enemies.
   attempts=[]
   for _ in range(6):
    visible=await page.locator('#speedPanel').is_visible()
    if visible:break
    await page.click('#interact');await page.wait_for_timeout(180)
    attempts.append(await page.evaluate('(()=>{const g=__RH_TEST.game();return {x:g.player.x,stun:g.player.stun,alive:g.alive,status:g.status,paused:g.paused,console:g.consoleOpen,atConsole:g.atConsole}})()'))
   report.setdefault('consoleAttempts',{})[route]=attempts
   report['checks'][route+'_console_interaction_admitted']=await page.locator('#speedPanel').is_visible()
   await page.click('[data-speed=FAST]',timeout=3000)
   await page.evaluate('window.__RH_TEST.game().pause(true)')
   report['checks'][route+'_console_fast']=await page.evaluate('window.__RH_DEBUG.snapshot().speedMode==="FAST"')
   await page.close()
  pictures=[Image.open(ART/f'{name}-{r}-ring-before.png').convert('RGB') for r in ['industrial','freight','tunnel']]
  report['checks']['routes_visibly_differ']=all(sum(1 for px in ImageChops.difference(pictures[i],pictures[i+1]).getdata() if sum(px)>60)>3000 for i in range(2))
  report['checks']['no_page_errors']=not errors
 except Exception as e:
  report['exception']=str(e);report['checks']['completed_suite']=False
  try:
   report['failureState']=await page.evaluate('__RH_DEBUG.snapshot()');report['failureEvents']=await page.evaluate('__RH_DEBUG.logs().slice(-30)')
   await page.screenshot(path=str(ART/f'{name}-v11-failure.png'))
  except Exception:pass
 finally:await browser.close()
 report['errors']=errors;report['passed']=all(report['checks'].values());(ART/f'{name}-v11-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
 return report['passed']
async def main():
 server=subprocess.Popen([sys.executable,'-m','http.server','8766','--directory','dist','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  await asyncio.sleep(.5)
  async with async_playwright() as p:
   results=[await run(p,n) for n in os.environ.get('RH_BROWSERS','chromium,webkit').split(',')]
  if not all(results):raise SystemExit(1)
 finally:server.terminate();server.wait(timeout=5)
asyncio.run(main())
