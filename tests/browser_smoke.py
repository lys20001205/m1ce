"""Real HTTP + WebGL regression, with screenshots. No state-only rendering pass."""
import asyncio,json,subprocess,sys,io
from pathlib import Path
from PIL import Image,ImageChops
from playwright.async_api import async_playwright
ART=Path('artifacts');ART.mkdir(exist_ok=True)
async def run_browser(p,name):
    checks={};errors=[];result={'browser':name,'checks':checks};browser=None
    try:
        kw={'headless':True}
        if name=='chromium':kw['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
        browser=await getattr(p,name).launch(**kw)
        page=await browser.new_page(viewport={'width':844,'height':390},device_scale_factor=2,is_mobile=True,has_touch=True)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        async def slow_model(route):
            await asyncio.sleep(1.8)
            await route.continue_()
        await page.route('**/crew-robot.json',slow_model)
        await page.goto('http://127.0.0.1:8765/?test=1',wait_until='networkidle')
        await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded === 3',timeout=30000)
        s=await page.evaluate('window.__RH_DEBUG.snapshot()');result['boot']=s
        checks['slow_model_loading_no_errors']=not errors
        checks['actual_webgl2']=s['renderer']=='WebGL2'
        checks['external_model_files_loaded']=s['modelsLoaded']==3
        checks['3d_mesh_depth']=s['modelDepth']>3
        checks['triangles_submitted']=s['triangles']>2000
        checks['no_2d_fallback']=await page.evaluate('document.querySelector("canvas").getContext("2d") === null')
        await page.click('#start');await page.wait_for_timeout(400)
        checks['departure_not_skipped']=(await page.evaluate('window.__RH_DEBUG.snapshot()'))['phase']=='depart'
        await page.screenshot(path=str(ART/f'{name}-departure.png'))
        before=await page.evaluate('window.__RH_DEBUG.snapshot()')
        for id in ['L','R']:
            box=await page.locator('#'+id).bounding_box()
            await page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
            await page.mouse.down();await page.wait_for_timeout(650);await page.mouse.up();await page.wait_for_timeout(100)
            after=await page.evaluate('window.__RH_DEBUG.snapshot()')
            checks[id+'_moves']=after['px']<before['px'] if id=='L' else after['px']>before['px']
            checks[id+'_render_continues']=after['drawCount']>before['drawCount']+1
            before=after
        await page.evaluate('window.__RH_TEST.forceRoute(.22); window.__RH_TEST.forcePlayer(6); window.__RH_TEST.game().pause(true)')
        await page.wait_for_timeout(200)
        normal=await page.screenshot(path=str(ART/f'{name}-yard.png'))
        checks['interior_not_occluded']=not await page.evaluate('window.__RH_DEBUG.occlusion()')
        checks['wheels_have_position']=await page.evaluate('window.__RH_TEST.view().carTemplate.children.filter(n=>n.name==="Wheel").every(n=>Math.abs(n.position.x)>2)')
        await page.click('#angle');await page.wait_for_timeout(200)
        angled=await page.screenshot(path=str(ART/f'{name}-angled.png'))
        a=Image.open(io.BytesIO(normal)).convert('RGB');b=Image.open(io.BytesIO(angled)).convert('RGB')
        diff=ImageChops.difference(a,b);checks['3d_view_angle_changes_pixels']=sum(1 for px in diff.getdata() if sum(px)>55)>1500
        await page.click('#angle')
        # Sample exact simulation times; slow CI wall-clock waits can miss a short swing.
        poses=await page.evaluate("""() => {
            const api=window.__RH_TEST,g=api.game(),view=api.view();
            g.pause(false);api.forcePlayer(4.2);g.player.cooldown=0;
            g.attack();view.render(0);const first=view.playerRig.userData.arm.rotation.z;
            api.step(.12);g.pause(true);view.render(0);
            return {first,second:view.playerRig.userData.arm.rotation.z,swing:g.player.swing};
        }""")
        result['melee_poses']=poses
        checks['weapon_arm_animates']=abs(poses['first']-poses['second'])>.25 and 0<poses['swing']<.36
        await page.screenshot(path=str(ART/f'{name}-melee.png'))
        await page.evaluate('let g=window.__RH_TEST.game();g.pause(false);g.round=3;g.player.cooldown=0;g.attack();window.__RH_TEST.view().render(.016)')
        socket=await page.evaluate('({actual:window.__RH_TEST.view().muzzle(),bullet:window.__RH_TEST.game().lastMuzzle})');result['muzzle']=socket
        checks['bullet_matches_model_socket']=abs(socket['actual']['x']-socket['bullet']['x'])<.02 and abs(socket['actual']['y']-socket['bullet']['y'])<.02 and abs(socket['actual']['z']-socket['bullet']['z'])<.02
        await page.evaluate('window.__RH_TEST.forceRoute(.32);window.__RH_TEST.forcePlayer(12,true)');await page.wait_for_timeout(180)
        await page.screenshot(path=str(ART/f'{name}-crane-warning.png'))
        await page.evaluate('window.__RH_TEST.forceRoute(.37);let g=window.__RH_TEST.game();g.player.x=g.craneX;window.__RH_TEST.step(.03)')
        checks['crane_spatial_collision']=(await page.evaluate('window.__RH_DEBUG.snapshot()'))['playerHp']<100
        await page.evaluate('window.__RH_TEST.forceRoute(.59);window.__RH_TEST.forcePlayer(12,true);window.__RH_TEST.step(.03)')
        checks['tunnel_enforces_clearance']=(await page.evaluate('window.__RH_DEBUG.snapshot()'))['roof']==False
        await page.screenshot(path=str(ART/f'{name}-tunnel.png'))
        await page.evaluate('window.__RH_TEST.forceCars(12);window.__RH_TEST.forceRoute(.9)')
        visible=True
        for x in [.5,20,60,97]:
            await page.evaluate('(x)=>{window.__RH_TEST.game().player.x=x}',x);await page.wait_for_timeout(350)
            s=await page.evaluate('window.__RH_DEBUG.snapshot()');visible &= 25<s['playerScreenX']<s['canvasCss'][0]-25 and 15<s['playerScreenY']<s['canvasCss'][1]-15
        checks['twelve_car_camera_tracking']=visible
        await page.screenshot(path=str(ART/f'{name}-long-train.png'))
        for width,height in [(812,332),(932,430)]:
            await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(250)
            s=await page.evaluate('window.__RH_DEBUG.snapshot()');checks[f'{width}_canvas_not_squashed']=abs(s['canvasBacking'][0]/s['canvasBacking'][1]-s['canvasCss'][0]/s['canvasCss'][1])<.02
            checks[f'{width}_player_inside_scene']=5<s['playerScreenY']<s['canvasCss'][1]-5
            await page.screenshot(path=str(ART/f'{name}-{width}x{height}.png'))
        await page.evaluate('window.__RH_TEST.game().pause(true)');t=await page.evaluate('window.__RH_DEBUG.snapshot().routeT');await page.wait_for_timeout(150)
        checks['pause_freezes_route']=t==await page.evaluate('window.__RH_DEBUG.snapshot().routeT')
        await page.evaluate('window.__RH_TEST.game().pause(false);window.__RH_TEST.forceRoute(.999);window.__RH_TEST.step(.3)');await page.wait_for_timeout(200)
        checks['round_complete']=(await page.evaluate('window.__RH_DEBUG.snapshot()'))['status']=='complete'
        await page.click('#cash');await page.wait_for_timeout(100)
        s=await page.evaluate('window.__RH_DEBUG.snapshot()');checks['cashout_stores_bank']=s['bank']>0 and s['money']==0
        await page.click('#restart');await page.wait_for_timeout(120)
        restart=await page.evaluate('window.__RH_DEBUG.snapshot()')
        checks['restart_keeps_bank']=restart['bank']==s['bank']
        checks['restart_immediate_camera_visible']=15<restart['playerScreenX']<restart['canvasCss'][0]-15 and 5<restart['playerScreenY']<restart['canvasCss'][1]-5
        checks['no_page_or_console_errors']=not errors
        result['final']=await page.evaluate('window.__RH_DEBUG.snapshot()')
    except Exception as e:
        result['exception']=str(e);checks['completed_suite']=False
        if browser:
            try:await page.screenshot(path=str(ART/f'{name}-failure.png'))
            except Exception:pass
    finally:
        result['errors']=errors
        if browser:await browser.close()
        result['passed']=all(checks.values());(ART/f'{name}-report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2),flush=True)
    return result
async def main():
    server=subprocess.Popen([sys.executable,'-m','http.server','8765','--directory','dist','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(.5)
        async with async_playwright() as p:
            results=[]
            for name in ['chromium','webkit']:results.append(await run_browser(p,name))
        if not all(r['passed'] for r in results):raise SystemExit(1)
    finally:server.terminate();server.wait(timeout=5)
asyncio.run(main())
