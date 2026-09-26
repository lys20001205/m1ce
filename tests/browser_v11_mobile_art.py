"""Rendered mobile/UI/art regressions; not human feel, device performance or audio approval.
Chromium additionally sends native multi-touch through CDP. WebKit covers native mouse
capture and touch taps; CDP-only assertions are not presented as WebKit touch evidence.
"""
import asyncio,json,subprocess,sys
from pathlib import Path
from playwright.async_api import async_playwright
ART=Path('artifacts');ART.mkdir(exist_ok=True)
BASE='http://127.0.0.1:8792/?test=1'
SIZES=[(812,332),(844,390),(932,430),(1280,720)]
VIEW_KEYS=['actual_size','targets_44','controls_no_overlap','footer_outside_world','canvas_area','distinct_vitals']
CASE_KEYS=['normal_entry','locked_ranged_explained','move_response','hold_slide_reverse','neutral_stops','capture_release_stops','second_key_survives',
 'empty_context_says_return','empty_context_returns','crate_context_says_pickup','crate_pickup','carry_return','load_credits',
 'portrait_pauses','portrait_clears','landscape_stays_paused','resume_works','player_marker_present',
 'polish_instance_budget','polish_rebuild_bounded','polish_geometry_bounded','tunnel_visible','all_route_livery',
 'dead_marker_hidden','no_errors','completed']
RESET="""()=>{const a=__RH_TEST;a.reset();const g=a.game();g.director.rest=9999;g.enemies=[];
 g.elapsed=5;g.t=.1;g.phase='yard';g.speedMode='STOP';a.forcePlayer(5.8);a.step(0);}"""
async def run(p,name):
    report={'browser':name,'checks':{},'samples':[],'scope':'Rendered fixtures and native input; no human or physical-device claim'}
    errors=[];browser=page=context=None
    def check(key,value):
        report['checks'][key]=bool(value)
        if not value:raise AssertionError(key)
    try:
        args={'headless':True}
        if name=='chromium':args['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
        browser=await getattr(p,name).launch(**args);report['browserVersion']=browser.version
        context=await browser.new_context(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,
                                          record_video_dir=str(ART/f'{name}-mobile-art-video'))
        page=await context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto(BASE,wait_until='networkidle');await page.wait_for_function('window.__RH_TEST && __RH_DEBUG.snapshot().modelsLoaded===3')
        # Ordinary UI ingress before the independent fixture scenarios.
        await page.locator('[data-route=freight]').click();await page.locator('[data-car=cargo]').click();await page.locator('#start').click()
        await page.wait_for_function('__RH_TEST.game().status==="running"');check('normal_entry',True)
        before=await page.evaluate('__RH_TEST.game().player.x');await page.keyboard.down('KeyD');await page.wait_for_timeout(400);await page.keyboard.up('KeyD')
        check('move_response',await page.evaluate('__RH_TEST.game().player.x')>before+.4)
        await page.evaluate(RESET)
        await page.wait_for_function('document.getElementById("ranged").dataset.caption==="先购 AXE"')
        check('locked_ranged_explained',True)
        for w,h in SIZES:
            await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(400)
            rect=await page.evaluate("""()=>{const r=id=>{const b=document.getElementById(id).getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,bottom:b.bottom,right:b.right}};
                return {size:[innerWidth,innerHeight],buttons:['L','R','layer','interact','brake','fix','attack','ranged'].map(r),canvas:r('game'),controls:r('controls'),vitals:r('vitals')};}""")
            key=f'{w}x{h}_';report['samples'].append(rect)
            check(key+'actual_size',rect['size']==[w,h]);b=rect['buttons']
            check(key+'targets_44',all(x['w']>=44 and x['h']>=44 and x['x']>=0 and x['right']<=w+.5 and x['bottom']<=h+.5 for x in b))
            check(key+'controls_no_overlap',all(min(a['right'],c['right'])-max(a['x'],c['x'])<=.5 or min(a['bottom'],c['bottom'])-max(a['y'],c['y'])<=.5 for i,a in enumerate(b) for c in b[i+1:]))
            check(key+'footer_outside_world',rect['controls']['y']>=rect['canvas']['bottom'])
            check(key+'canvas_area',rect['canvas']['h']>=160 and rect['canvas']['w']>=w-40)
            check(key+'distinct_vitals',await page.locator('#engineVital').is_visible() and await page.locator('#playerVital').is_visible())
            await page.screenshot(path=str(ART/f'{name}-mobile-art-{w}x{h}.png'))
        await page.set_viewport_size({'width':844,'height':390});await page.wait_for_timeout(400);await page.evaluate(RESET)
        left=await page.locator('#L').bounding_box();right=await page.locator('#R').bounding_box();pad=await page.locator('#movementPad').bounding_box()
        await page.mouse.move(left['x']+left['width']/2,left['y']+left['height']/2);await page.mouse.down()
        await page.wait_for_function('__RH_TEST.input().move===-1')
        await page.mouse.move(right['x']+right['width']/2,right['y']+right['height']/2)
        await page.wait_for_function('__RH_TEST.input().move===1');check('hold_slide_reverse',True)
        await page.mouse.move(pad['x']+pad['width']/2,pad['y']+pad['height']/2)
        check('neutral_stops',await page.evaluate('__RH_TEST.input().move===0'))
        await page.mouse.up();check('capture_release_stops',await page.evaluate('__RH_TEST.input().move===0'))
        await page.keyboard.down('KeyD');await page.mouse.move(left['x']+20,left['y']+20);await page.mouse.down();await page.mouse.up()
        check('second_key_survives',await page.evaluate('__RH_TEST.input().move===1'));await page.keyboard.up('KeyD')
        if name=='chromium':
            await page.evaluate("window.mobileEvents=[];for(const event of ['pointerdown','pointerup','pointercancel','lostpointercapture'])document.addEventListener(event,e=>mobileEvents.push({event,id:e.pointerId,type:e.pointerType,target:e.target.id,trusted:e.isTrusted,primary:e.isPrimary}),true)")
            cdp=await context.new_cdp_session(page);attack=await page.locator('#attack').bounding_box()
            def point(box,id):return {'x':round(box['x']+box['width']/2),'y':round(box['y']+box['height']/2),'id':id}
            l=point(left,1);a=point(attack,2);r=point(right,1)
            await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[l]})
            await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[l,a]})
            await page.wait_for_function('__RH_TEST.input().move===-1&&__RH_TEST.input().attack')
            check('native_multitouch_move_attack',True)
            await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[r,a]})
            await page.wait_for_function('__RH_TEST.input().move===1&&__RH_TEST.input().attack');check('native_multitouch_slide',True)
            # Chromium targets the supplied touch ID for a partial lift (empirically checked).
            # Send the MOVEMENT point, not the remaining attack point; verify native targets below.
            await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[r]})
            await page.wait_for_function('__RH_TEST.input().move===0&&__RH_TEST.input().attack')
            check('native_independent_lift',await page.evaluate("mobileEvents.some(e=>e.event==='pointerup'&&e.target==='L')&&!mobileEvents.some(e=>e.event==='pointerup'&&e.target==='attack')"))
            await cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
            await page.wait_for_function('!__RH_TEST.input().attack&&__RH_TEST.input().move===0')
            check('native_cancel_clears',await page.evaluate("mobileEvents.some(e=>e.event==='pointercancel'&&e.target==='attack')"))
            proof=await page.evaluate('mobileEvents');report['samples'].append({'multiTouchEvents':proof})
            check('touch_trusted_events',len(proof)>=2 and all(e['trusted'] and e['type']=='touch' for e in proof) and any(not e['primary'] for e in proof))
        # Label must agree with interaction at a reachable bridge, but away from a crate.
        await page.evaluate("""()=>{const a=__RH_TEST;a.reset();const g=a.game();g.route='freight';g.prepareDepots();g.director.rest=9999;
          g.elapsed=5;g.t=.26;g.phase='yard';g.speedMode='STOP';a.forcePlayer(12.45,true);g.enterDepot();g.player.depotX=2.4;g.syncDepotPlayer();a.step(0);}""")
        await page.wait_for_function('document.getElementById("interact").textContent==="RETURN"')
        check('empty_context_says_return',await page.evaluate('__RH_TEST.game().playerLayer==="DEPOT"'))
        await page.locator('#interact').tap();await page.wait_for_function('__RH_TEST.game().playerLayer==="ROOF"');check('empty_context_returns',True)
        await page.keyboard.press('KeyF');await page.wait_for_function('__RH_TEST.game().playerLayer==="DEPOT"')
        await page.wait_for_function('document.getElementById("interact").textContent==="PICKUP"');check('crate_context_says_pickup',True)
        await page.locator('#interact').tap();await page.wait_for_function('!!__RH_TEST.game().heldCargo');check('crate_pickup',True)
        await page.screenshot(path=str(ART/f'{name}-mobile-art-cargo.png'))
        await page.locator('#layer').tap();await page.wait_for_function('__RH_TEST.game().playerLayer==="ROOF"');check('carry_return',True)
        await page.locator('#interact').tap();await page.wait_for_function('__RH_TEST.game().storedCargo===1');check('load_credits',await page.evaluate('__RH_TEST.game().money===1450'))
        await page.keyboard.down('KeyD');await page.set_viewport_size({'width':390,'height':844});await page.wait_for_timeout(600)
        check('portrait_pauses',await page.evaluate('__RH_TEST.game().paused'));check('portrait_clears',await page.evaluate('__RH_TEST.input().move===0'))
        await page.keyboard.up('KeyD');await page.set_viewport_size({'width':844,'height':390});await page.wait_for_timeout(600)
        check('landscape_stays_paused',await page.evaluate('__RH_TEST.game().paused'));await page.locator('#pause').tap();await page.wait_for_function('!__RH_TEST.game().paused');check('resume_works',True)
        await page.evaluate(RESET);await page.wait_for_timeout(300)
        check('player_marker_present',await page.evaluate('!!__RH_TEST.view().actorGroup.getObjectByName("Player-contact-marker")'))
        async def art_counts():return await page.evaluate("""()=>{const v=__RH_TEST.view(),list=[];v.train.traverse(o=>{if(o.name.startsWith('Livery-'))list.push(o)});return {batches:list.length,instances:list.reduce((s,m)=>s+m.count,0),geometry:v.renderer.info.memory.geometries,drawCalls:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles};}""")
        before=await art_counts();check('polish_instance_budget',before['batches']<=7 and before['instances']<=32)
        for i in range(5):
            await page.evaluate('__RH_TEST.view().rebuildCars()');await page.wait_for_timeout(120)
        after=await art_counts();report['samples'].append({'beforeRebuild':before,'afterRebuild':after})
        check('polish_rebuild_bounded',before['batches']==after['batches'] and before['instances']==after['instances'])
        check('polish_geometry_bounded',after['geometry']<=before['geometry']+2)
        route_count=0
        for route in ['industrial','freight','tunnel']:
            await page.evaluate("""route=>{const a=__RH_TEST,g=a.game();g.route=route;g.prepareDepots();g.t=route==='tunnel'?.5:.15;g.phase=route==='tunnel'?'tunnel':'yard';g.player.hp=100;g.cars[0].hp=180;g.syncSystems();a.forcePlayer(3);a.step(0);}""",route)
            await page.wait_for_timeout(300);await page.screenshot(path=str(ART/f'{name}-mobile-art-route-{route}.png'));route_count+=1
        check('all_route_livery',route_count==3)
        check('tunnel_visible',await page.evaluate('__RH_DEBUG.snapshot().routeWorld==="tunnel"&&__RH_DEBUG.snapshot().drawCalls>0'))
        await page.evaluate('__RH_TEST.game().killPlayer();__RH_TEST.step(0)');await page.wait_for_timeout(100)
        check('dead_marker_hidden',await page.evaluate('!__RH_TEST.view().actorGroup.getObjectByName("Player-contact-marker").visible'))
        check('no_errors',not errors);check('completed',True)
        await context.close();context=None
    except Exception as e:
        report['exception']=str(e)
        if page and not page.is_closed():
            try:
                report['failureState']=await page.evaluate('__RH_DEBUG.snapshot()')
                report['failureInput']=await page.evaluate('__RH_TEST.input()')
                report['failurePointerEvents']=await page.evaluate('window.mobileEvents||[]')
                await page.screenshot(path=str(ART/f'{name}-mobile-art-failure.png'))
            except Exception:pass
    finally:
        if browser:await browser.close()
    expected={f'{w}x{h}_{key}' for w,h in SIZES for key in VIEW_KEYS}|set(CASE_KEYS)
    if name=='chromium':expected|={'native_multitouch_move_attack','native_multitouch_slide','native_independent_lift','native_cancel_clears','touch_trusted_events'}
    report['missingChecks']=sorted(expected-set(report['checks']));report['errors']=errors
    report['passed']=not report.get('exception') and not errors and not report['missingChecks'] and all(report['checks'].values())
    (ART/f'{name}-mobile-art-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False),flush=True)
    return report['passed']
async def main():
    server=subprocess.Popen([sys.executable,'-m','http.server','8792','--directory','dist','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(.4)
        async with async_playwright() as p:results=[await run(p,n) for n in ['chromium','webkit']]
        if not all(results):raise SystemExit(1)
    finally:server.terminate();server.wait(timeout=5)
if __name__=='__main__':asyncio.run(main())
