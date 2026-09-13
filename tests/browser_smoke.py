import asyncio, json, subprocess, sys, time
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    Path('artifacts').mkdir(exist_ok=True)
    server = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.6)
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True)
            errors=[]; console_errors=[]
            page.on('pageerror', lambda exc: errors.append(str(exc)))
            page.on('console', lambda msg: console_errors.append(msg.text) if msg.type=='error' else None)
            await page.goto('http://127.0.0.1:8765/', wait_until='networkidle')
            await page.wait_for_timeout(300)
            boot = await page.evaluate('window.__RH_DEBUG.snapshot()')
            await page.click('#start')
            await page.wait_for_timeout(140)
            before = await page.evaluate('window.__RH_DEBUG.snapshot()')

            left = page.locator('#L'); box = await left.bounding_box()
            await page.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2); await page.mouse.down(); await page.wait_for_timeout(650); await page.mouse.up(); await page.wait_for_timeout(160)
            after_left = await page.evaluate('window.__RH_DEBUG.snapshot()')
            right = page.locator('#R'); box = await right.bounding_box()
            await page.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2); await page.mouse.down(); await page.wait_for_timeout(650); await page.mouse.up(); await page.wait_for_timeout(160)
            after_right = await page.evaluate('window.__RH_DEBUG.snapshot()')

            await page.evaluate('window.__RH_DEBUG.forceRound(1)')
            await page.click('#attack'); await page.wait_for_timeout(30)
            melee_logs = await page.evaluate('window.__RH_DEBUG.logs()')

            await page.evaluate('window.__RH_DEBUG.forceRound(3)')
            await page.wait_for_timeout(520)
            await page.click('#attack'); await page.wait_for_timeout(25)
            logs = await page.evaluate('window.__RH_DEBUG.logs()')
            projectile_logs=[x for x in logs if x.get('type')=='projectile_spawn']
            projectile=projectile_logs[-1] if projectile_logs else None

            await page.evaluate('window.__RH_DEBUG.forceCars(14); window.__RH_DEBUG.forcePlayerX(1800)')
            await page.wait_for_timeout(650)
            long_train = await page.evaluate('window.__RH_DEBUG.snapshot()')

            await page.set_viewport_size({'width':932,'height':430})
            await page.wait_for_timeout(300)
            resized = await page.evaluate('window.__RH_DEBUG.snapshot()')

            await page.evaluate('window.__RH_DEBUG.forceMoney(6000); window.__RH_DEBUG.forceFinish()')
            await page.wait_for_timeout(80)
            await page.click('#cash')
            await page.wait_for_timeout(100)
            banked = await page.evaluate('window.__RH_DEBUG.meta()')
            garage_visible = await page.locator('#garageUi').is_visible()
            first_shop_btn = page.locator('.shopRow').first.locator('button')
            if await first_shop_btn.is_enabled():
                await first_shop_btn.click()
                await page.wait_for_timeout(80)
            after_purchase = await page.evaluate('window.__RH_DEBUG.meta()')
            await page.click('#newRun')
            await page.wait_for_timeout(80)
            new_run = await page.evaluate('window.__RH_DEBUG.snapshot()')
            await page.screenshot(path='artifacts/roundhouse_v8_smoke.png', full_page=True)

            def backing_matches(s):
                return abs(s['canvasBacking'][0]-round(s['canvasCss'][0]*s['dpr'])) <= 1 and abs(s['canvasBacking'][1]-round(s['canvasCss'][1]*s['dpr'])) <= 1

            checks={
                'boot_draws': boot['drawCount'] > 0,
                'start_running': before['running'] is True,
                'left_moves': after_left['px'] < before['px'],
                'draw_continues_after_left': after_left['drawCount'] > before['drawCount'] + 3,
                'right_moves': after_right['px'] > after_left['px'],
                'melee_attack_logged': any(x.get('type')=='attack' and x.get('weapon')=='WRENCH' for x in melee_logs),
                'projectile_created': projectile is not None,
                'projectile_from_hand': projectile is not None and abs(projectile.get('y',999)-projectile.get('handY',0)) < .2 and abs(projectile.get('x',999)-projectile.get('handX',0)) < 20,
                'long_train_camera_moves': long_train['cameraX'] > 100,
                'long_train_player_visible': 45 < long_train['playerScreenX'] < long_train['canvasCss'][0]-45,
                'boot_canvas_backing_matches_css': backing_matches(boot),
                'resized_canvas_backing_matches_css': backing_matches(resized),
                'resize_triggered_canvas_sync': resized['canvasSyncCount'] > boot['canvasSyncCount'],
                'train_uses_lower_screen': resized['base'] > resized['canvasCss'][1] * .78,
                'cashout_banks_money': banked['bank'] >= 6000,
                'garage_visible_after_cashout': garage_visible,
                'reroll_purchase_works': after_purchase['rerollTokens'] >= 1,
                'new_run_resets_unbanked': new_run['round'] == 1 and new_run['cash'] == 1000 and new_run['bank'] == after_purchase['bank'],
                'no_page_errors': not errors,
                'no_console_errors': not console_errors,
            }
            print(json.dumps({'checks':checks,'errors':errors,'console_errors':console_errors,'boot':boot,'after_left':after_left,'after_right':after_right,'projectile':projectile,'long_train':long_train,'resized':resized,'banked':banked,'after_purchase':after_purchase,'new_run':new_run},ensure_ascii=False,indent=2))
            await browser.close()
            if not all(checks.values()): raise SystemExit(1)
    finally:
        server.terminate()
        try: server.wait(timeout=3)
        except subprocess.TimeoutExpired: server.kill()

asyncio.run(main())
