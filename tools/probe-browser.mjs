import {chromium} from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('artifacts/baseline',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:8779/',{waitUntil:'networkidle'});
await page.screenshot({path:'artifacts/baseline/normal-entry.png'});
console.log(JSON.stringify({fatal:await page.locator('#fatal').textContent(),errors,debug:await page.evaluate(()=>window.__RH_DEBUG?.snapshot())}));
await browser.close();
