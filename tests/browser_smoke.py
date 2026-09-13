import asyncio, json, subprocess, sys, time
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    Path('artifacts').mkdir(exist_ok=True)
    server=subprocess.Popen([sys.executable,'-m','http.server','8765','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    time.sleep(.5)
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=True)
            page=await browser.new_page(viewport={'width':844,'height':390},device_scale_factor=2,is_mobile=True,has_touch=True)
            errors=[];console_errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda m:console_errors.append(m.text) if m.type=='error' else None)
            await page.goto('http://127.0.0.1:8765/',wait_until='networkidle')
            await page.click('#start');await page.wait_for_timeout(300)
            started=await page.evaluate('window.__RH_DEBUG.snapshot()')
            await page.evaluate('window.__RH_DEBUG.forceRoute(.37)');await page.click('#layer');await page.wait_for_timeout(120)
            crane=await page.evaluate('window.__RH_DEBUG.snapshot()')
            await page.evaluate('window.__RH_DEBUG.forceRoute(.65)');await page.click('#layer');await page.wait_for_timeout(120)
            tunnel=await page.evaluate('window.__RH_DEBUG.snapshot()')
            await page.evaluate('window.__RH_DEBUG.forceCars(12); window.__RH_DEBUG.forcePlayerX(1500)');await page.wait_for_timeout(650)
            longtrain=await page.evaluate('window.__RH_DEBUG.snapshot()')
            await page.screenshot(path='artifacts/roundhouse_v9_route.png',full_page=True)
            checks={
              'started_industrial': started['phase']=='industrial' and started['routeT']>=.12,
              'crane_route_reachable': crane['phase']=='industrial',
              'tunnel_forces_inside': tunnel['phase']=='tunnel' and tunnel['roof'] is False,
              'long_train_camera_tracks': longtrain['cameraX']>100,
              'long_train_player_visible': 30<longtrain['playerScreenX']<longtrain['canvasCss'][0]-30,
              'no_page_errors': not errors,
              'no_console_errors': not console_errors,
            }
            print(json.dumps({'checks':checks,'errors':errors,'console_errors':console_errors,'started':started,'crane':crane,'tunnel':tunnel,'longtrain':longtrain},ensure_ascii=False,indent=2))
            await browser.close()
            if not all(checks.values()): raise SystemExit(1)
    finally:
        server.terminate()
        try: server.wait(timeout=3)
        except: server.kill()

asyncio.run(main())
