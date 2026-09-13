import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    html = Path("index.html").read_text(encoding="utf-8")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 844, "height": 390}, device_scale_factor=2, is_mobile=True, has_touch=True)
        errors = []
        console_errors = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        await page.set_content(html, wait_until="load")
        await page.wait_for_timeout(250)
        boot = await page.evaluate("window.__RH_DEBUG.snapshot()")
        await page.click("#start")
        await page.wait_for_timeout(200)
        before = await page.evaluate("window.__RH_DEBUG.snapshot()")

        left = page.locator("#L")
        box = await left.bounding_box()
        await page.mouse.move(box["x"] + box["width"]/2, box["y"] + box["height"]/2)
        await page.mouse.down()
        await page.wait_for_timeout(650)
        await page.mouse.up()
        await page.wait_for_timeout(180)
        after_left = await page.evaluate("window.__RH_DEBUG.snapshot()")

        right = page.locator("#R")
        box = await right.bounding_box()
        await page.mouse.move(box["x"] + box["width"]/2, box["y"] + box["height"]/2)
        await page.mouse.down()
        await page.wait_for_timeout(650)
        await page.mouse.up()
        await page.wait_for_timeout(180)
        after_right = await page.evaluate("window.__RH_DEBUG.snapshot()")

        await page.evaluate("window.__RH_DEBUG.forceRound(3)")
        await page.wait_for_timeout(180)
        ranged = await page.evaluate("window.__RH_DEBUG.snapshot()")
        logs = await page.evaluate("window.__RH_DEBUG.logs()")

        checks = {
            "boot_draws": boot["drawCount"] > 0,
            "start_running": before["running"] is True,
            "left_moves": after_left["px"] < before["px"],
            "draw_continues_after_left": after_left["drawCount"] > before["drawCount"] + 3,
            "right_moves": after_right["px"] > after_left["px"],
            "move_events_logged": any(x.get("type") == "move_start" for x in logs) and any(x.get("type") == "move_end" for x in logs),
            "round3_sidearm": ranged["round"] == 3 and ranged["weapon"] == "SIDEARM",
            "no_page_errors": not errors,
            "no_console_errors": not console_errors,
        }
        print(json.dumps({"checks": checks, "errors": errors, "console_errors": console_errors, "after_left": after_left, "after_right": after_right}, ensure_ascii=False, indent=2))
        await browser.close()
        if not all(checks.values()):
            raise SystemExit(1)

asyncio.run(main())
