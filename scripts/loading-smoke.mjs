// Failure and race tests against the actual production HTML and split modules.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:4173/metro/';
const output = process.env.QA_OUTPUT ?? '/tmp/cityflow-loading';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] });
const enginePattern = '**/assets/main-*.js';
const entryPattern = '**/assets/index-*.js';
try {
  for (const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['small',320,568],['landscape',844,390]]) {
    const page = await browser.newPage({ viewport:{width,height},reducedMotion:'reduce' });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route(enginePattern, async route => { await gate; await route.continue(); });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.documentElement.dataset.cityflowStartup==='starting');
    assert.equal(await page.locator('#main-menu').getAttribute('inert'),'');
    assert.ok(Number(await page.locator('#loading-progress').getAttribute('aria-valuenow'))<100);
    await page.screenshot({path:`${output}/${name}-loading.png`});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    release();
    await page.waitForSelector('#loading-screen',{state:'detached'});
    assert.equal(await page.locator('#app').getAttribute('aria-busy'),'false');
    assert.equal(await page.locator('#main-menu').getAttribute('inert'),null);
    await page.reload();await page.waitForSelector('#loading-screen',{state:'detached'});
    await page.close();console.log(`${name}: slow engine, visible loader, ready and cached reload passed`);
  }
  // Freeze time before navigation: inspect exact initial state and prove that
  // readiness does not require any artificial animation/minimum-display timer.
  {
    const page = await browser.newPage({ viewport:{width:390,height:844} });
    await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
    let release;
    let gate = new Promise(resolve => { release = resolve; });
    await page.route(entryPattern, async route => { await gate; await route.continue(); });
    await page.goto(base,{waitUntil:'commit'});
    await page.waitForSelector('#loading-percent');
    assert.equal(await page.locator('#loading-percent').textContent(),'0%');
    assert.equal(await page.locator('#loading-elapsed').textContent(),'0.0s elapsed');
    await page.clock.runFor(1200);
    assert.equal(await page.locator('#loading-percent').textContent(),'0%');
    assert.equal(await page.locator('#loading-elapsed').textContent(),'1.2s elapsed');
    release();
    await page.waitForSelector('#loading-screen',{state:'detached'});
    assert.equal(await page.locator('#startup-duration').textContent(),'Ready in 1.2s');
    gate = new Promise(resolve => { release = resolve; });
    await page.reload({waitUntil:'commit'});await page.waitForSelector('#loading-percent');
    assert.equal(await page.locator('#loading-percent').textContent(),'0%');
    assert.equal(await page.locator('#loading-elapsed').textContent(),'0.0s elapsed');
    release();await page.waitForSelector('#loading-screen',{state:'detached'});
    await page.close();console.log('Zero start, live elapsed clock, fresh-navigation reset and no forced delay passed');
  }
  // Use a virtual clock so the production 20-second deadline is tested without a real wait.
  for (const kind of ['entry-missing','engine-missing','engine-late','css-missing','css-late']) {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now()+1000));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    if(kind==='entry-missing') await page.route(entryPattern,route=>route.abort());
    if(kind==='engine-missing') await page.route(enginePattern,route=>route.abort());
    if(kind==='css-missing') await page.route('**/*.css',route=>route.abort());
    if(kind==='engine-late') await page.route(enginePattern,async route=>{await gate;await route.continue();});
    if(kind==='css-late') await page.route('**/*.css',async route=>{await gate;await route.continue();});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    if(kind==='css-late') { await page.clock.runFor(1000);assert.equal(await page.locator('#loading-elapsed').textContent(),'1.0s elapsed');assert.equal(await page.locator('#loading-percent').textContent(),'0%');await page.screenshot({path:`${output}/waiting-css.png`}); }
    await page.clock.runFor(21000);
    await page.waitForFunction(()=>document.documentElement.dataset.cityflowStartup==='failed');
    assert.equal(await page.locator('#loading-retry').isVisible(),true);
    assert.equal(await page.locator('#main-menu').getAttribute('inert'),'');
    assert.equal(await page.locator('#app').getAttribute('aria-busy'),'false');
    assert.equal(await page.locator('#loading-progress').getAttribute('aria-valuenow'),null);
    const frozenTime=await page.locator('#loading-elapsed').textContent();
    await page.clock.runFor(1000);
    assert.equal(await page.locator('#loading-elapsed').textContent(),frozenTime);
    const value=await page.locator('#loading-percent').textContent();
    assert.notEqual(value,'100%');
    if(kind==='engine-late') { release();await page.waitForFunction(()=>document.querySelector('#station-access').options.length>1);await page.clock.runFor(2000);assert.equal(await page.locator('#loading-retry').isVisible(),true); }
    if(kind==='css-late') { release();await page.waitForFunction(()=>[...document.querySelectorAll('link[rel=stylesheet]')].every(link=>link.dataset.loaded==='true'));assert.equal(await page.locator('#loading-retry').isVisible(),true); }
    await page.screenshot({path:`${output}/${kind}.png`});
    // Repair the network, use the real retry control, verify query-based HTML refresh and readiness.
    await page.unrouteAll({behavior:'wait'});
    await page.clock.resume();
    await page.click('#loading-retry');
    await page.waitForSelector('#loading-screen',{state:'detached'});
    assert.ok(new URL(page.url()).searchParams.has('cityflow_reload'));
    assert.equal(await page.locator('#main-menu').getAttribute('inert'),null);
    await page.close();console.log(`${kind}: recovery, no false 100%, fresh retry passed`);
  }
  const context = await browser.newContext({ javaScriptEnabled:false });
  const page = await context.newPage();await page.goto(base);
  assert.equal(await page.locator('noscript p').isVisible(),true);
  await context.close();console.log('JavaScript disabled: explanation visible');
} finally { await browser.close(); }
