"""H: real repair input, local industrial service and charge-dependent rendered lighting."""
import asyncio,json,subprocess,sys,io
from pathlib import Path
from PIL import Image,ImageChops
from playwright.async_api import async_playwright
ART=Path('artifacts');ART.mkdir(exist_ok=True)
async def run(p,name):
    kw={'headless':True}
    if name=='chromium':kw['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
    browser=await getattr(p,name).launch(**kw);report={'browser':name,'checks':{}};errors=[]
    try:
        page=await browser.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True)
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('http://127.0.0.1:8771/?test=1',wait_until='networkidle');await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
        await page.click('[data-route=freight]');await page.click('[data-car=cargo]');await page.click('#start')
        await page.evaluate('(async()=>{const a=__RH_TEST,g=a.game(),{car}=await import("/src/sim.js?v=11");g.cars.push(car("battery"),car("workshop"));a.view().rebuildCars();a.forceRoute(.1);a.forcePlayer(5.8);g.damageCar(0,40);g.pause(false)})()')
        await page.keyboard.down('e');await page.evaluate('__RH_TEST.step(.4,__RH_TEST.input());__RH_TEST.game().pause(true)')
        report['checks']['real_repair_button_powered_workshop_channel']=await page.evaluate('(()=>{const g=__RH_TEST.game();return __RH_TEST.input().repair&&Math.abs(g.repairJob.duration-1.2)<.0001&&g.repairJob.progress>0&&g.cars[0].hp===140})()')
        report['checks']['physical_station_markers']=await page.evaluate('(()=>{const v=__RH_TEST.view();return !!v.cars[0].m.getObjectByName("Station-ARMORY")&&!!v.cars[0].m.getObjectByName("Station-SPEED")&&!!v.cars[3].m.getObjectByName("Station-SERVICE")&&!!v.cars[2].m.getObjectByName("BatteryChargeMeter")})()')
        await page.screenshot(path=str(ART/f'{name}-powered-workshop-repair.png'))
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);for(let i=0;i<100&&g.lap.repairs===0;i++)a.step(.025,a.input());g.pause(true)})()');await page.keyboard.up('e')
        report['checks']['repair_completed_actual_hp']=await page.evaluate('__RH_TEST.game().cars[0].hp===168&&__RH_TEST.game().lap.repairs===1')
        await page.evaluate('(async()=>{const a=__RH_TEST;a.reset();const g=a.game(),{car}=await import("/src/sim.js?v=11");g.cars.push(car("workshop"));a.view().rebuildCars();g.round=3;a.forceRoute(.151);a.forcePlayer(20.75);a.step(3.1)})()')
        report['checks']['industrial_fault_really_active']=await page.evaluate('__RH_TEST.game().director.fault?.active===true')
        await page.keyboard.down('e');await page.evaluate('__RH_TEST.step(.4,__RH_TEST.input());__RH_TEST.game().pause(true)')
        report['checks']['local_fault_service_not_engine_repair']=await page.evaluate('(()=>{const j=__RH_TEST.game().repairJob;return j.localFault&&j.car===2&&Math.abs(j.duration-.96)<.001})()')
        await page.screenshot(path=str(ART/f'{name}-workshop-local-fault.png'))
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);for(let i=0;i<100&&g.director.fault;i++)a.step(.025,a.input());g.pause(true)})()');await page.keyboard.up('e')
        report['checks']['workshop_clears_fault_with_recovery']=await page.evaluate('__RH_TEST.game().director.fault===null&&__RH_TEST.game().director.rest>7&&__RH_TEST.game().cars[2].hp===120')
        await page.evaluate('(async()=>{const a=__RH_TEST;a.reset();const g=a.game(),{car}=await import("/src/sim.js?v=11");g.cars.push(car("battery"));a.view().rebuildCars();g.route="tunnel";a.forceRoute(.5);a.forcePlayer(20.75);g.pause(true);g.syncSystems();a.view().render(0)})()')
        full=await page.locator('canvas#game').screenshot(path=str(ART/f'{name}-battery-full-tunnel.png'))
        report['full']=await page.evaluate('({power:__RH_TEST.game().power,lamps:__RH_TEST.view().lamps.intensity,meter:__RH_TEST.view().cars[2].m.userData.chargeMeter.scale.x})')
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.cars[2].charge=10;g.syncSystems();a.view().render(0)})()')
        low=await page.locator('canvas#game').screenshot(path=str(ART/f'{name}-battery-low-tunnel.png'))
        report['low']=await page.evaluate('({power:__RH_TEST.game().power,lamps:__RH_TEST.view().lamps.intensity,meter:__RH_TEST.view().cars[2].m.userData.chargeMeter.scale.x})')
        diff=ImageChops.difference(Image.open(io.BytesIO(full)).convert('RGB'),Image.open(io.BytesIO(low)).convert('RGB'))
        pixels=sum(1 for px in diff.getdata() if sum(px)>30);report['lightingChangedPixels']=pixels
        report['checks']['charge_really_changes_rendered_lighting']=pixels>300 and report['full']['lamps']>report['low']['lamps'] and report['full']['meter']>report['low']['meter']
        report['checks']['fast_drains_car_storage']=await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.cars[2].charge=100;g.boostCharge=0;g.pause(false);a.forcePlayer(5.8);g.setSpeed("FAST");a.step(1);g.pause(true);return Math.abs(g.cars[2].charge-88)<.0001&&g.speedMode==="FAST"})()')
        report['checks']['dock_refill_before_cashout']=await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);g.finish();a.step(4);g.pause(true);return g.status==="complete"&&g.batteryCharge===200&&g.bank===0})()')
        report['checks']['no_page_errors']=not errors
    except Exception as e:
        report['exception']=str(e);report['checks']['completed_suite']=False
        try:report['failureState']=await page.evaluate('__RH_DEBUG.snapshot()');await page.screenshot(path=str(ART/f'{name}-train-build-failure.png'))
        except Exception:pass
    finally:await browser.close()
    report['errors']=errors;report['passed']=all(report['checks'].values());(ART/f'{name}-train-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True);return report['passed']
async def main():
    server=subprocess.Popen([sys.executable,'-m','http.server','8771','--directory','dist','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(.5)
        async with async_playwright() as p:results=[await run(p,n) for n in ['chromium','webkit']]
        if not all(results):raise SystemExit(1)
    finally:server.terminate();server.wait(timeout=5)
asyncio.run(main())
