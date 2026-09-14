"""Five real simulation behaviors plus rendered poses/kits and reuse of pooled rigs."""
import asyncio,json,subprocess,sys
from pathlib import Path
from playwright.async_api import async_playwright
ART=Path('artifacts');ART.mkdir(exist_ok=True)
async def run(p,name):
    kw={'headless':True}
    if name=='chromium':kw['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
    browser=await getattr(p,name).launch(**kw);report={'browser':name,'checks':{}};errors=[]
    try:
        page=await browser.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True)
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('http://127.0.0.1:8769/?test=1',wait_until='networkidle')
        await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
        # Fixtures select a reachable encounter; all transitions use Game.step and production rules.
        await page.evaluate('(()=>{const a=__RH_TEST;a.reset();a.forceRoute(.1);a.forcePlayer(6);const g=a.game();g.spawn("clinger",8);g.pause(true);a.view().render(0)})()')
        attach=await page.evaluate('(()=>{const g=__RH_TEST.game(),v=__RH_TEST.view(),e=g.enemies[0],m=v.enemyModels.get(e.id);return {state:e.state,y:e.y,modelY:m.position.y,z:m.position.z,roof:e.roof}})()')
        await page.screenshot(path=str(ART/f'{name}-clinger-attach.png'))
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);a.step(1);g.pause(true);a.view().render(0)})()')
        climb=await page.evaluate('(()=>{const g=__RH_TEST.game(),e=g.enemies[0];return {state:e.state,y:e.y,modelY:__RH_TEST.view().enemyModels.get(e.id).position.y}})()')
        await page.screenshot(path=str(ART/f'{name}-clinger-climb.png'))
        await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);a.step(1);g.pause(true);a.view().render(0)})()')
        roof=await page.evaluate('(()=>{const e=__RH_TEST.game().enemies[0];return {state:e.state,y:e.y,roof:e.roof,z:e.z}})()')
        report['clinger']={'attach':attach,'climb':climb,'roof':roof}
        report['checks']['clinger_real_vertical_motion']=attach['state']=='attach' and attach['modelY']<1.12 and attach['z']>1.5 and climb['state']=='climb' and 1.12<climb['modelY']<4.12 and roof['y']==4.12 and roof['roof'] and roof['z']==.65
        await page.screenshot(path=str(ART/f'{name}-clinger-roof.png'))
        thief=await page.evaluate('(()=>{const a=__RH_TEST;a.reset();a.forceRoute(.1);a.forcePlayer(12.4);const g=a.game();const c=g.createCargo(450,"stored",{carIndex:1,secured:true}),e=g.spawn("thief",12.4,false);e.climb=0;a.step(.8);g.pause(true);a.view().render(0);return {carry:e.carry,crate:c.id,location:c.location,playerHP:g.player.hp,money:g.money,carriedMesh:a.view().enemyModels.get(e.id).userData.carried.visible}})()')
        await page.screenshot(path=str(ART/f'{name}-thief-carry.png'))
        report['checks']['thief_prefers_crate_not_player']=thief['carry']==thief['crate'] and thief['location']=='thief' and thief['playerHP']==100 and thief['money']==1000 and thief['carriedMesh']
        escape=await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);a.step(2);g.pause(true);return {money:g.money,lost:g.total.cargoLost,location:g.cargoCrates.find(c=>c.secured===false&&c.value===450)?.location}})()')
        report['checks']['thief_escape_debits_exact_value']=escape['money']==550 and escape['lost']==450 and escape['location']=='lost'
        sab=await page.evaluate('(()=>{const a=__RH_TEST;a.reset();a.forceRoute(.1);const g=a.game();g.cars.push({type:"battery",hp:100,max:100,charge:100});a.view().rebuildCars();a.forcePlayer(20.75);const e=g.spawn("saboteur",20.75,false);e.climb=0;a.step(1);g.pause(true);a.view().render(0);return {state:e.state,target:e.targetCar,carHP:g.cars[2].hp,playerHP:g.player.hp,arm:a.view().enemyModels.get(e.id).userData.arm.rotation.z}})()')
        await page.screenshot(path=str(ART/f'{name}-saboteur-system-windup.png'))
        report['checks']['saboteur_telegraphs_system_attack']=sab['state']=='system_windup' and sab['target']==2 and sab['carHP']==100 and sab['playerHP']==100 and sab['arm']<-.8
        report['checks']['saboteur_system_damage_not_player']=await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);a.step(.4);g.pause(true);return g.cars[2].hp===80&&g.player.hp===100})()')
        await page.evaluate('(()=>{const a=__RH_TEST;a.reset();a.forceRoute(.1);a.forcePlayer(3);const g=a.game();g.round=3;const e=g.spawn("bruiser",3.5,false);e.climb=0;a.step(1);g.pause(true);a.view().render(0)})()')
        report['checks']['bruiser_heavy_windup_visible']=await page.evaluate('(()=>{const g=__RH_TEST.game(),e=g.enemies[0];return e.state==="heavy_windup"&&g.player.hp===100&&__RH_TEST.view().enemyModels.get(e.id).scale.x>1.2})()')
        await page.screenshot(path=str(ART/f'{name}-bruiser-heavy-windup.png'))
        report['checks']['bruiser_swing_can_be_dodged']=await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);a.step(.6,{move:1});g.pause(true);return g.player.hp===100&&g.enemies[0].recovery>0})()')
        # Five distinct mesh kits in one real cutaway scene, then recycle and render again.
        await page.evaluate('(()=>{const a=__RH_TEST;a.reset();a.forceRoute(.1);a.forcePlayer(11,true);const g=a.game();g.round=8;["boarder","clinger","thief","saboteur","bruiser"].forEach((t,i)=>g.spawn(t,3+i*3));g.pause(true);a.view().render(0)})()')
        kits=await page.evaluate('(()=>{const g=__RH_TEST.game(),v=__RH_TEST.view();return g.enemies.map(e=>({type:e.type,kit:Object.entries(v.enemyModels.get(e.id).userData.enemyKits).filter(([t,m])=>m.visible).map(([t])=>t)}))})()')
        report['kits']=kits;report['checks']['five_distinct_mesh_kits']=len(kits)==5 and all(x['kit']==[x['type']] for x in kits)
        await page.screenshot(path=str(ART/f'{name}-five-enemy-kits.png'))
        report['checks']['pooled_rigs_reused_without_new_geometry']=await page.evaluate('(()=>{const a=__RH_TEST,g=a.game(),v=a.view(),before=v.snapshot().gpuGeometries,rigs=[...v.enemyModels.values()];g.pause(false);for(const e of [...g.enemies])g.hitEnemy(e,10000);a.step(.025);g.pause(true);v.render(0);g.pause(false);["boarder","clinger","thief","saboteur","bruiser"].forEach((t,i)=>g.spawn(t,3+i*3));g.pause(true);v.render(0);return v.snapshot().gpuGeometries===before&&[...v.enemyModels.values()].every(m=>rigs.includes(m))})()')
        report['checks']['spawn_event_and_type_are_distinct']=await page.evaluate('__RH_DEBUG.logs().some(e=>e.type==="enemy_spawn"&&e.enemy_type==="saboteur")')
        report['renderer']=await page.evaluate('__RH_DEBUG.snapshot()');report['checks']['no_page_errors']=not errors
    except Exception as e:report['exception']=str(e);report['checks']['completed_suite']=False
    finally:await browser.close()
    report['errors']=errors;report['passed']=all(report['checks'].values());(ART/f'{name}-enemies-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True);return report['passed']
async def main():
    server=subprocess.Popen([sys.executable,'-m','http.server','8769','--directory','dist','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(.5)
        async with async_playwright() as p:results=[await run(p,n) for n in ['chromium','webkit']]
        if not all(results):raise SystemExit(1)
    finally:server.terminate();server.wait(timeout=5)
asyncio.run(main())
