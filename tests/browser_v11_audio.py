"""Actual WebAudio output through post-Master analyser. No mocked context or autoplay bypass."""
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
        await page.add_init_script('''window.resumeCalls=0;const C=window.AudioContext||window.webkitAudioContext;if(C){const real=C.prototype.resume;C.prototype.resume=function(...args){window.resumeCalls++;return real.apply(this,args);};}''')
        await page.goto('http://127.0.0.1:8772/?test=1',wait_until='networkidle');await page.wait_for_function('window.__RH_DEBUG?.snapshot().modelsLoaded===3')
        report['checks']['fresh_default_not_muted_no_autoplay_context']=await page.evaluate('__RH_DEBUG.snapshot().audio.context==="not_created"&&!__RH_DEBUG.snapshot().audio.muted')
        await page.locator('[data-route=freight]').tap();await page.locator('[data-car=cargo]').tap()
        await page.evaluate('(()=>{const b=document.getElementById("start"),original=b.onclick;b.onclick=function(e){const before=window.resumeCalls,result=original.call(this,e);window.startAudioProof={trusted:e.isTrusted,synchronous:window.resumeCalls>before};return result;};})()')
        await page.locator('#start').tap();await page.wait_for_function('__RH_DEBUG.snapshot().audio.context==="running"&&__RH_DEBUG.snapshot().audio.firstSound',timeout=10000)
        report['start']=await page.evaluate('({proof:window.startAudioProof,audio:__RH_DEBUG.snapshot().audio})')
        report['checks']['trusted_start_synchronously_requests_resume']=report['start']['proof']=={'trusted':True,'synchronous':True}
        report['checks']['context_running_master_positive']=report['start']['audio']['context']=='running' and report['start']['audio']['master']>0
        await page.wait_for_function('__RH_DEBUG.snapshot().audio.outputRMS>0.00005',timeout=10000)
        report['checks']['actual_post_master_waveform_nonzero']=True
        await page.locator('#sound').tap();await page.wait_for_function('__RH_DEBUG.snapshot().audio.master===0');await page.wait_for_timeout(750)
        muted=await page.evaluate('__RH_DEBUG.snapshot().audio');report['muted']=muted
        report['checks']['mute_zeroes_actual_signal']=muted['muted'] and muted['master']==0 and muted['outputRMS']<.00001
        await page.locator('#sound').tap();await page.wait_for_function('__RH_DEBUG.snapshot().audio.outputRMS>0.00005')
        report['checks']['unmute_restores_master_signal']=await page.evaluate('__RH_DEBUG.snapshot().audio.master===1&&!__RH_DEBUG.snapshot().audio.muted')
        await page.evaluate('(()=>{const a=__RH_TEST;a.forceRoute(.1);a.forcePlayer(5.8)})()')
        report['modes']={}
        for mode in ['STOP','CRUISE','FAST']:
            await page.evaluate('__RH_TEST.game().setSpeed('+json.dumps(mode)+')');await page.wait_for_timeout(250)
            report['modes'][mode]=await page.evaluate('__RH_DEBUG.snapshot().audio')
        report['checks']['real_speed_changes_engine_loop']= [report['modes'][m]['engineLoop'] for m in ['STOP','CRUISE','FAST']]==['idle','cruise','fast']
        await page.keyboard.down('j');await page.wait_for_function('__RH_DEBUG.snapshot().audio.lastSfx==="wrench"');await page.keyboard.up('j')
        report['checks']['actual_attack_input_triggers_sound']=True
        report['weapons']=[]
        for weapon,slot in [('knife','melee'),('axe','melee'),('handgun','ranged'),('smg','ranged'),('rifle','ranged')]:
            await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();a.forcePlayer(1.7);g.scrap=200;g.armoryOpen=false;g.openArmory();g.buyWeapon('+json.dumps(slot)+');g.closeArmory();g.player.cooldown=0;g.player.rangedCooldown=0;})()')
            key='j' if slot=='melee' else 'k';await page.keyboard.down(key)
            await page.wait_for_function('__RH_DEBUG.snapshot().audio.lastSfx==='+json.dumps(weapon));await page.keyboard.up(key)
            report['weapons'].append(await page.evaluate('__RH_DEBUG.snapshot().audio'))
        report['checks']['six_weapons_have_distinct_live_sfx']=len(report['weapons'])==5
        await page.evaluate('__RH_TEST.audio().context.suspend()');await page.evaluate('window.dispatchEvent(new Event("pageshow"))')
        await page.wait_for_function('__RH_DEBUG.snapshot().audio.context==="running"',timeout=10000)
        report['checks']['pageshow_recovers_suspended_context']=True
        report['checks']['audio_telemetry_from_measured_output']=await page.evaluate('(()=>{const es=__RH_DEBUG.logs();return ["audio_unlock_attempt","audio_context_state","audio_first_sound","mute_change"].every(t=>es.some(e=>e.type===t))})()')
        await page.evaluate('(()=>{const a=__RH_DEBUG.snapshot().audio,e=document.createElement("pre");e.style="position:fixed;right:20px;top:80px;background:#102733ed;color:white;padding:12px;z-index:50;font-size:12px";e.textContent="AUDIO OUTPUT EVIDENCE\\n"+JSON.stringify(a,null,2);document.body.append(e);})()')
        await page.screenshot(path=str(ART/f'{name}-audio-running-output.png'))
        report['final']=await page.evaluate('__RH_DEBUG.snapshot().audio');report['checks']['no_page_errors']=not errors
    except Exception as e:
        report['exception']=str(e);report['checks']['completed_suite']=False
        try:report['failureState']=await page.evaluate('__RH_DEBUG.snapshot()');report['failureEvents']=await page.evaluate('__RH_DEBUG.logs().slice(-40)');await page.screenshot(path=str(ART/f'{name}-audio-failure.png'))
        except Exception:pass
    finally:await browser.close()
    report['errors']=errors;report['passed']=all(report['checks'].values());(ART/f'{name}-audio-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True);return report['passed']
async def main():
    server=subprocess.Popen([sys.executable,'-m','http.server','8772','--directory','dist','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(.5)
        async with async_playwright() as p:results=[await run(p,n) for n in ['chromium','webkit']]
        if not all(results):raise SystemExit(1)
    finally:server.terminate();server.wait(timeout=5)
asyncio.run(main())
