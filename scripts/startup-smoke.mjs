// Validate direct entry against Actions dist and the committed main/root site.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.argv[2]??'http://127.0.0.1:4173/metro/';
const output=process.env.QA_OUTPUT??'/tmp/cityflow-startup';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
try{
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['small',320,568],['landscape',844,390]]){
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);await page.waitForSelector('#start-game:not([disabled])');
    assert.equal(await page.locator('#loading-screen').count(),0);assert.equal(await page.locator('#main-menu').isVisible(),true);
    assert.match(await page.locator('#startup-status').textContent(),/Todo listo/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`${output}/${name}-direct-menu.png`});
    await page.click('#start-game');await page.waitForFunction(()=>getComputedStyle(document.querySelector('#main-menu')).visibility==='hidden');
    assert.ok((await page.locator('#game-canvas').boundingBox()).width>0);assert.deepEqual(errors,[]);
    await page.close();console.log(`${name}: direct menu and playable entry passed`);
  }
  for(const target of ['entry','engine']){
    const page=await browser.newPage({viewport:{width:390,height:844}});await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
    let release;const gate=new Promise(resolve=>{release=resolve;});
    await page.route(target==='entry'?'**/assets/index-*.js':'**/assets/main-*.js',async route=>{await gate;await route.continue();});
    await page.goto(base,{waitUntil:'commit'});await page.waitForSelector('#main-menu');
    assert.equal(await page.locator('#main-menu').isVisible(),true);assert.equal(await page.locator('#loading-screen').count(),0);
    await page.clock.runFor(25000);
    assert.notEqual(await page.locator('html').getAttribute('data-cityflow-startup'),'failed');
    assert.equal(await page.locator('#start-game').isDisabled(),true);
    assert.match(await page.locator('#startup-status').textContent(),/siguen conectándose/);
    release();await page.waitForSelector('#start-game:not([disabled])');
    await page.clock.resume();await page.click('#start-game');
    assert.equal(await page.locator('#main-menu').getAttribute('aria-hidden'),'true');
    await page.close();console.log(`Delayed ${target}: menu visible, no 20s lock, automatic late recovery passed`);
  }
  for(const target of ['entry','engine','css']){
    const page=await browser.newPage();
    await page.route(target==='css'?'**/*.css':target==='entry'?'**/assets/index-*.js':'**/assets/main-*.js',route=>route.abort());
    await page.goto(base);await page.waitForSelector('#startup-retry:not([hidden])');
    assert.equal(await page.locator('#main-menu').isVisible(),true);assert.equal(await page.locator('#loading-screen').count(),0);
    if(target==='css'){await page.waitForSelector('#start-game:not([disabled])');assert.match(await page.locator('#startup-status').textContent(),/faltan los estilos/);}
    await page.unrouteAll();await page.click('#startup-retry');await page.waitForSelector('#start-game:not([disabled])');
    assert.ok(new URL(page.url()).searchParams.has('cityflow_reload'));
    await page.close();console.log(`Missing ${target}: inline notice and successful retry passed`);
  }
}finally{await browser.close();}
