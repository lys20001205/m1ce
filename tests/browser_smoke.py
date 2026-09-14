"""HTTP + actual WebGL in both engines. Deterministic scenario time is separate from CI GPU speed."""
import asyncio,json,subprocess,sys,io,os
from pathlib import Path
from PIL import Image,ImageChops
from playwright.async_api import async_playwright
ART=Path('artifacts');ART.mkdir(exist_ok=True)
async def run_browser(p,name):
    checks={};errors=[];result={'browser':name,'checks':checks};browser=None
    try:
        kw={'headless':True}
        if name=='chromium':
            kw['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
            if os.getenv('RH_CHROMIUM'):kw['executable_path']=os.environ['RH_CHROMIUM']
        browser=await getattr(p,name).launch(**kw)
        page=await browser.new_page(viewport={'width':844,'height':390},device_scale_factor=2,is_mobile=True,has_touch=True)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        async def slow_model(route):
            await asyncio.sleep(1.8);await route.continue_()
        await page.route('**/crew-robot.json*',slow_model)
        await page.goto('http://127.0.0.1:8765/?test=1',wait_until='networkidle')
        await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded === 3',timeout=30000)
        s=await page.evaluate('window.__RH_DEBUG.snapshot()');result['boot']=s
        checks['build_is_v11']=s['build'].startswith('V11-')
        checks['slow_model_loading_no_errors']=not errors
        checks['actual_webgl2']=s['renderer']=='WebGL2'
        checks['external_model_files_loaded']=s['modelsLoaded']==3
        checks['3d_mesh_depth']=s['modelDepth']>3
        checks['triangles_submitted']=s['triangles']>2000
        checks['no_2d_fallback']=await page.evaluate('document.querySelector("canvas").getContext("2d") === null')
        checks['nothing_starts_under_modal']=s['routeT']==0 and s['status']=='ready'
        await page.click('[data-route=industrial]');await page.click('[data-car=cargo]');await page.click('#start');await page.wait_for_timeout(400)
        checks['departure_not_skipped']=(await page.evaluate('window.__RH_DEBUG.snapshot()'))['phase']=='depart'
        await page.screenshot(path=str(ART/f'{name}-departure.png'))
        before=await page.evaluate('window.__RH_DEBUG.snapshot()')
        for id in ['L','R']:
            box=await page.locator('#'+id).bounding_box();await page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
            await page.mouse.down()
            # Slow software WebGL may not tick within a fixed 650ms interval. Keep real input
            # held until two actual frames have processed it, still enforcing displacement.
            await page.wait_for_function("""({x,frames,id}) => {
                const a=window.__RH_TEST,g=a.game();
                return a.input().move===(id==='L'?-1:1) && a.view().frames>=frames+2 &&
                    (id==='L'?g.player.x<x-.02:g.player.x>x+.02);
            }""",arg={'x':before['px'],'frames':before['drawCount'],'id':id},timeout=15000)
            await page.mouse.up()
            after=await page.evaluate('window.__RH_DEBUG.snapshot()')
            checks[id+'_moves']=after['px']<before['px'] if id=='L' else after['px']>before['px']
            checks[id+'_render_continues']=after['drawCount']>before['drawCount']+1;before=after
        checks['pointer_release_clears_move']=await page.evaluate('window.__RH_TEST.input().move===0')
        checks['selection_disabled']=await page.evaluate('getComputedStyle(document.querySelector("#L")).webkitUserSelect === "none"')
        await page.evaluate('window.__RH_TEST.forceRoute(.22);window.__RH_TEST.forcePlayer(6);window.__RH_TEST.game().pause(true)')
        await page.wait_for_timeout(150)
        normal=await page.screenshot(path=str(ART/f'{name}-yard.png'))
        checks['interior_not_occluded']=not await page.evaluate('window.__RH_DEBUG.occlusion()')
        checks['wheels_have_position']=await page.evaluate('window.__RH_TEST.view().carTemplate.children.filter(n=>n.name==="Wheel").every(n=>Math.abs(n.position.x)>2)')
        await page.click('#angle');await page.wait_for_timeout(150)
        angled=await page.screenshot(path=str(ART/f'{name}-angled.png'))
        diff=ImageChops.difference(Image.open(io.BytesIO(normal)).convert('RGB'),Image.open(io.BytesIO(angled)).convert('RGB'))
        checks['3d_view_angle_changes_pixels']=sum(1 for px in diff.getdata() if sum(px)>55)>1500
        await page.click('#angle')
        poses=await page.evaluate("""() => {
          const a=window.__RH_TEST,g=a.game(),v=a.view();g.pause(false);a.forcePlayer(4.2);g.player.cooldown=0;
          g.attack();v.render(0);const first=v.playerRig.userData.arm.rotation.z;a.step(.12);g.pause(true);v.render(0);
          return {first,second:v.playerRig.userData.arm.rotation.z,swing:g.player.swing};
        }""")
        result['melee_poses']=poses;checks['weapon_arm_animates']=abs(poses['first']-poses['second'])>.25 and 0<poses['swing']<.36
        await page.screenshot(path=str(ART/f'{name}-melee.png'))
        socket=await page.evaluate("""() => {let g=window.__RH_TEST.game();g.pause(false);g.round=3;g.player.cooldown=0;g.attack();window.__RH_TEST.view().render(0);return {actual:window.__RH_TEST.view().muzzle(),bullet:g.lastMuzzle};}""")
        result['muzzle']=socket
        checks['bullet_matches_model_socket']=all(abs(socket['actual'][k]-socket['bullet'][k])<.02 for k in ['x','y','z'])
        await page.evaluate('window.__RH_TEST.forceRoute(.32);window.__RH_TEST.forcePlayer(12,true)');await page.wait_for_timeout(100)
        await page.screenshot(path=str(ART/f'{name}-crane-warning.png'))
        hazard=await page.evaluate("""() => {const a=window.__RH_TEST,g=a.game();a.forceRoute(.43);g.player.invul=0;g.player.x=g.craneX;a.step(.03);const hit=g.player.hp<100;g.route='tunnel';a.forceRoute(.39);a.forcePlayer(12,true);g.player.invul=0;a.step(.03);return {hit,roof:g.player.roof};}""")
        checks['crane_spatial_collision']=hazard['hit'];checks['tunnel_enforces_clearance']=not hazard['roof']
        await page.screenshot(path=str(ART/f'{name}-tunnel.png'))
        # Reset before rescue. Damage here is test-only, never a forced near-death in a normal run.
        await page.evaluate('window.__RH_TEST.reset();window.__RH_TEST.forceRoute(.22);window.__RH_TEST.forcePlayer(5.8);window.__RH_TEST.game().damageCar(0,180,"test")')
        stall=await page.evaluate('window.__RH_DEBUG.snapshot()');result['stalled']=stall
        checks['zero_hp_has_grace']=stall['status']=='running' and stall['rescue']['remaining']>7
        await page.screenshot(path=str(ART/f'{name}-engine-stalled.png'))
        box=await page.locator('#fix').bounding_box();await page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);await page.mouse.down()
        checks['repair_button_drives_input']=await page.evaluate('window.__RH_TEST.input().repair')
        await page.evaluate('window.__RH_TEST.step(1,window.__RH_TEST.input());window.__RH_TEST.game().pause(true)')
        partial=await page.evaluate('window.__RH_DEBUG.snapshot()')
        checks['repair_progress_no_early_heal']=partial['engineHp']==0 and partial['repair'] is not None and partial['repair']['progress']>0
        checks['repair_bar_visible']=await page.locator('#repairPanel').is_visible()
        await page.screenshot(path=str(ART/f'{name}-repair-progress.png'))
        await page.evaluate('const a=window.__RH_TEST,g=a.game(),remaining=g.repairJob.duration-g.repairJob.progress;g.pause(false);a.step(remaining+.05,a.input());g.pause(true)');await page.mouse.up()
        rescued=await page.evaluate('window.__RH_DEBUG.snapshot()');result['rescued']=rescued
        checks['repair_restarts_engine']=rescued['engineHp']>0 and rescued['rescue'] is None and rescued['stats']['clutchSaves']==1
        checks['rescue_has_recovery_window']=rescued['threat']['rest']>7
        checks['success_confirmation_visible']=await page.locator('#success').is_visible()
        checks['rescue_does_not_mint_money']=rescued['money']==1000
        await page.screenshot(path=str(ART/f'{name}-engine-restarted.png'))
        # All channel/deadline timers freeze when paused.
        await page.evaluate('window.__RH_TEST.reset();window.__RH_TEST.forcePlayer(5.8);window.__RH_TEST.game().damageCar(0,180,"test");window.__RH_TEST.step(.5,{repair:true});window.__RH_TEST.game().pause(true)')
        paused=await page.evaluate('window.__RH_DEBUG.snapshot()');await page.wait_for_timeout(220)
        p2=await page.evaluate('window.__RH_DEBUG.snapshot()')
        checks['pause_freezes_rescue_and_repair']=paused['rescue']==p2['rescue'] and paused['repair']==p2['repair'] and paused['routeT']==p2['routeT']
        await page.evaluate('window.__RH_TEST.game().pause(false);window.__RH_TEST.step(8)')
        checks['deadline_failure_has_reason']=await page.evaluate('window.__RH_TEST.game().status==="lost"&&window.__RH_TEST.game().failReason==="engine_timeout"')
        # Cargo recovery feedback and no duplicate credit.
        cargo=await page.evaluate("""() => {const a=window.__RH_TEST;a.reset();a.forcePlayer(4.2);const g=a.game(),e=g.spawn('thief',12.4,false);e.climb=0;a.step(1);const before=g.money;g.hitEnemy(e,99);g.hitEnemy(e,99);g.pause(true);a.view().render(0);return {before,after:g.money,saved:g.total.cargoSaved,cargo:g.cars[1].cargo};}""")
        checks['cargo_recovery_feedback_and_accounting']=cargo=={'before':1000,'after':1050,'saved':250,'cargo':3}
        await page.evaluate('window.__RH_TEST.reset();window.__RH_TEST.forceCars(12);window.__RH_TEST.forceRoute(.9)')
        visible=True;result['camera_samples']=[]
        for x in [.5,20,60,97]:
            mark=await page.evaluate('(x)=>{window.__RH_TEST.game().player.x=x;return window.__RH_TEST.view().frames}',x)
            await page.wait_for_function('(mark)=>window.__RH_TEST.view().frames>=mark+2',arg=mark,timeout=15000)
            s=await page.evaluate('window.__RH_DEBUG.snapshot()');result['camera_samples'].append({k:s[k] for k in ['px','cameraX','playerScreenX','playerScreenY','canvasCss','drawCount']});visible &= 25<s['playerScreenX']<s['canvasCss'][0]-25 and 10<s['playerScreenY']<s['canvasCss'][1]-10
        checks['twelve_car_camera_tracking']=visible
        await page.screenshot(path=str(ART/f'{name}-long-train.png'))
        long_grace=await page.evaluate('window.__RH_TEST.game().damageCar(0,180,"test");window.__RH_DEBUG.snapshot().rescue.window')
        checks['long_train_gets_reachable_grace']=long_grace>20
        for width,height in [(812,332),(932,430)]:
            await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(250)
            s=await page.evaluate('window.__RH_DEBUG.snapshot()')
            checks[f'{width}_canvas_not_squashed']=abs(s['canvasBacking'][0]/s['canvasBacking'][1]-s['canvasCss'][0]/s['canvasCss'][1])<.02
            checks[f'{width}_player_inside_scene']=5<s['playerScreenY']<s['canvasCss'][1]-5
            rects=await page.evaluate("""() => {const r=id=>{const b=document.getElementById(id).getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right}};return {scene:r('viewport'),hud:r('hud'),controls:r('controls'),repair:r('repairPanel')};}""")
            checks[f'{width}_ui_does_not_cover_scene']=rects['scene']['top']>=rects['hud']['bottom'] and rects['controls']['top']>=rects['scene']['bottom']
            await page.screenshot(path=str(ART/f'{name}-{width}x{height}.png'))
        await page.set_viewport_size({'width':390,'height':844});await page.wait_for_timeout(200)
        checks['portrait_pauses_game']=await page.evaluate('window.__RH_TEST.game().paused') and await page.locator('#portrait').is_visible()
        await page.set_viewport_size({'width':844,'height':390});await page.wait_for_timeout(200)
        checks['landscape_requires_explicit_resume']=await page.evaluate('window.__RH_TEST.game().paused')
        # Arrival is an explicit safe state, not an immediate choice popup.
        arrived=await page.evaluate("""() => {const a=window.__RH_TEST;a.reset();a.forceRoute(.999);a.step(.3);const g=a.game();return {status:g.status,cashAllowed:g.cashout(),enemies:g.enemies.length};}""")
        checks['arrival_has_safe_release']=arrived=={'status':'arriving','cashAllowed':False,'enemies':0}
        await page.screenshot(path=str(ART/f'{name}-safe-arrival.png'))
        await page.evaluate('window.__RH_TEST.step(4)')
        checks['round_complete']=(await page.evaluate('window.__RH_DEBUG.snapshot()'))['status']=='complete'
        checks['risk_and_result_stats_visible']=await page.locator('#riskPanel').is_visible() and await page.locator('#resultStats').is_visible()
        await page.screenshot(path=str(ART/f'{name}-round-summary.png'))
        await page.click('#cash');s=await page.evaluate('window.__RH_DEBUG.snapshot()')
        checks['cashout_stores_bank']=s['bank']>0 and s['money']==0
        await page.click('#restart');await page.wait_for_timeout(120)
        restart=await page.evaluate('window.__RH_DEBUG.snapshot()')
        checks['restart_keeps_bank']=restart['bank']==s['bank']
        checks['restart_immediate_camera_visible']=15<restart['playerScreenX']<restart['canvasCss'][0]-15 and 5<restart['playerScreenY']<restart['canvasCss'][1]-5
        # Practice is reachable through the real menu and cannot change bank storage.
        await page.click('[data-route=industrial]');await page.click('[data-car=cargo]');await page.click('#start');await page.evaluate('window.__RH_TEST.game().fail("test")');await page.wait_for_timeout(100)
        oldbank=await page.evaluate('localStorage.getItem("roundhouse_bank")')
        await page.click('#practice')
        checks['practice_label_and_mode']=await page.evaluate('window.__RH_DEBUG.snapshot().mode==="practice"')
        await page.evaluate('window.__RH_TEST.step(3,{repair:true})')
        checks['practice_completes_without_payment']=await page.evaluate('window.__RH_TEST.game().status==="practice_complete"') and oldbank==await page.evaluate('localStorage.getItem("roundhouse_bank")')
        checks['critical_events_in_log']=await page.evaluate('["engine_stalled","engine_recovered","clutch_save","repair_complete","cargo_recovered","round_complete","run_failed"].every(k=>window.__RH_DEBUG.logs().some(e=>e.type===k))')
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
            for name in os.getenv('RH_BROWSERS','chromium,webkit').split(','):results.append(await run_browser(p,name))
        if not all(r['passed'] for r in results):raise SystemExit(1)
    finally:server.terminate();server.wait(timeout=5)
asyncio.run(main())
