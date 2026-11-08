import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.argv[2]??'http://127.0.0.1:4174/main-root/';
const output=process.env.QA_OUTPUT??'/tmp/cityflow-fleet';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
try{
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['small',320,568]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.addInitScript(()=>{Math.random=()=>0;window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),50);window.cancelAnimationFrame=id=>clearTimeout(id);});
  await page.goto(base);await page.waitForSelector('#start-game:not([disabled])');
  await page.selectOption('#service-plan','sandbox');await page.uncheck('#tutorial-enabled');await page.click('#start-game');await page.click('#pause-button');
  const stationTab=async()=>{if(width<=620)await page.click('[data-panel="station"]');};
  const connect=async id=>{await stationTab();await page.selectOption('#station-access',id);await page.click('#station-connect');};
  const operations=async()=>{if(await page.locator('#line-operations').getAttribute('open')===null)await page.click('#line-operations > summary');};
  const transfer=async()=>{await operations();if(await page.locator('.fleet-transfer').getAttribute('open')===null)await page.click('.fleet-transfer > summary');};
  const funds=()=>page.locator('#credits').textContent().then(text=>Number(text.replace('$','')));
  const people=async()=>page.evaluate(()=>Number(document.querySelector('#waiting').textContent)+Number(document.querySelector('#in-transit').textContent)+Number(document.querySelector('#score').textContent));
  await connect('north');await connect('museum');await connect('market');await page.click('#dispatch-button');
  await page.click('[data-line="1"]');await connect('museum');await connect('civic');await transfer();
  assert.equal(await page.locator('#line-load').textContent(),'0 / 6');assert.equal(await page.locator('#transfer-train').isEnabled(),true);
  assert.match(await page.locator('#transfer-preview').textContent(),/Destino: 1 → 2 trenes/);
  await page.selectOption('#line-policy','local');assert.match(await page.locator('#policy-seats').textContent(),/9 por tren/);assert.equal(await page.locator('#line-load').textContent(),'0 / 6');await page.selectOption('#line-policy','balanced');
  await page.click('#plan-route');await connect('harbor');assert.equal(await page.locator('#line-load').textContent(),'0 / 6');assert.equal(await page.locator('#transfer-train').isDisabled(),true);await page.keyboard.press('Escape');
  await page.click('#pause-button');const before=await funds(),count=await people();await page.click('#transfer-train');
  assert.equal(await funds(),before-4);assert.equal(await people(),count);assert.equal(await page.locator('#pause-button').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#line-load').textContent(),'0 / 12');assert.equal(await page.locator('#transfer-train').isDisabled(),true);
  await page.locator('#line-operations').scrollIntoViewIfNeeded();await page.clock.runFor(100);await page.screenshot({path:`${output}/${name}-fleet.png`,fullPage:true});
  // Recover a purchased train from a cleared route without buying it twice.
  await page.click('#clear-button');await page.click('[data-line="0"]');await transfer();
  assert.match(await page.locator('#transfer-preview').textContent(),/0 personas/);assert.equal(await page.locator('#transfer-source').inputValue(),'1');
  const reserveFunds=await funds();await page.click('#transfer-train');assert.equal(await funds(),reserveFunds-4);assert.equal(await page.locator('#line-load').textContent(),'0 / 12');
  await page.click('#pause-button');
  for(let attempt=0;attempt<20 && !(await page.locator('#line-priority').isVisible());attempt++)await page.clock.runFor(1000);
  await page.click('#pause-button');assert.equal(await page.locator('#line-priority').isVisible(),true);
  assert.ok(Number(await page.locator('#line-waiting').textContent())>0);
  const priority=await page.locator('#line-priority').getAttribute('data-station');await page.click('#line-priority');
  assert.equal(await page.locator('#station-access').inputValue(),priority);assert.equal(await page.locator('#station-name').evaluate(node=>node===document.activeElement),true);
  if(width<=620)assert.equal(await page.locator('[data-panel="station"]').getAttribute('aria-pressed'),'true');
  await page.click('#line-route [data-inspect-station="market"]');assert.equal(await page.locator('#station-access').inputValue(),'market');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  page.on('dialog',dialog=>dialog.accept());await page.click('#new-shift');await page.click('#start-game');await operations();await transfer();assert.equal(await page.locator('#transfer-train').isDisabled(),true);assert.equal(await page.locator('#line-load').textContent(),'0 / 0');
  await page.close();console.log(`${name}: fleet transfer, paused draft guard, reserve recovery, live telemetry, inspection focus and reset passed`);
 }
}finally{await browser.close();}
