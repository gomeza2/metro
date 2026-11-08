import {showPanel, returnToMap} from './control-room.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.argv[2]??'http://127.0.0.1:4173/main-root/';
const output=process.env.QA_OUTPUT??'/tmp/cityflow-planning';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
try{
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['small',320,568]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.addInitScript(()=>{Math.random=()=>0;window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),50);window.cancelAnimationFrame=id=>clearTimeout(id);});
  await page.goto(base);await page.waitForSelector('#start-game:not([disabled])');
  await page.selectOption('#service-plan','sandbox');await page.check('#incidents-enabled');await page.uncheck('#tutorial-enabled');await page.click('#start-game');
  await showPanel(page,'station');
  const connect=async id=>{await showPanel(page,'station');await page.selectOption('#station-access',id);await page.click('#station-connect');};
  await connect('north');await connect('museum');await page.clock.runFor(1500);
  await page.click('#plan-route');assert.equal(await page.locator('#draft-panel').isVisible(),true);assert.equal(await page.locator('#pause-button').isDisabled(),true);
  const heldTime=await page.locator('#city-time').textContent();await page.clock.runFor(25000);assert.equal(await page.locator('#city-time').textContent(),heldTime);
  await connect('market');assert.match(await page.locator('#draft-summary').textContent(),/3 estaciones/);assert.ok((await page.locator('[data-line="0"]').textContent()).includes('2'));
  await page.click('#clear-button');assert.match(await page.locator('#draft-summary').textContent(),/0 estaciones/);assert.ok((await page.locator('[data-line="0"]').textContent()).includes('2'));
  await page.keyboard.press('Escape');assert.equal(await page.locator('#draft-panel').isVisible(),false);assert.ok((await page.locator('[data-line="0"]').textContent()).includes('2'));
  await page.click('#plan-route');await connect('market');await page.locator('#game-canvas').scrollIntoViewIfNeeded();await page.clock.runFor(100);await page.screenshot({path:`${output}/${name}-draft.png`,fullPage:true});
  await page.click('.brand');await page.click('#start-game');assert.equal(await page.locator('#pause-button').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#pause-button').isDisabled(),true);
  await page.click('#apply-draft');assert.equal(await page.locator('#draft-panel').isVisible(),false);assert.ok((await page.locator('[data-line="0"]').textContent()).includes('3'));assert.equal(await page.locator('#pause-button').getAttribute('aria-pressed'),'true');
  await page.click('#pause-button');await page.click('[data-speed="3"]');await page.clock.runFor(30000);
  await page.click('#operating-alert');await returnToMap(page,true);await showPanel(page,'missions');await page.click('#pause-button');
  assert.equal(await page.locator('#incident-panel').isVisible(),true);assert.match(await page.locator('#incident-title').textContent(),/Preparar:/);
  await page.clock.runFor(5500);assert.match(await page.locator('#incident-title').textContent(),/^Señal lenta/);
  await page.click('#pause-button');const left=await page.locator('#incident-time').textContent();await page.clock.runFor(2000);assert.equal(await page.locator('#incident-time').textContent(),left);
  await page.locator('#game-canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/${name}-incident.png`,fullPage:true});
  await page.click('#pause-button');await page.clock.runFor(11000);assert.equal(await page.locator('#incident-panel').isVisible(),false);
  page.on('dialog',dialog=>dialog.accept());await page.click('#new-shift');assert.equal(await page.locator('#run-history li').count(),1);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cityflow.runHistory.v1'))[0].outcome),'abandoned');
  await page.reload();await page.waitForSelector('#start-game:not([disabled])');assert.equal(await page.locator('#run-history li').count(),1);assert.match(await page.locator('#run-history').textContent(),/Interrumpido/);
  await page.selectOption('#service-plan','rush');assert.equal(await page.locator('#incidents-enabled').isChecked(),true);assert.equal(await page.locator('#incidents-enabled').isDisabled(),true);
  await page.selectOption('#service-plan','relaxed');assert.equal(await page.locator('#incidents-enabled').isChecked(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  await page.close();console.log(`${name}: draft isolation/apply/cancel, menu pause, incident warning/end, history persistence and mode preference passed`);
 }
}finally{await browser.close();}
