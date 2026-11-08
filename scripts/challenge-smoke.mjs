import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.argv[2]??'http://127.0.0.1:4173/metro/';
const output=process.env.QA_OUTPUT??'/tmp/cityflow-challenge';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
try{
  for(const outcome of ['win','deadline']){
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
    // Deterministic demand and a 20 Hz display. Simulation still uses its normal
    // 1/60 fixed steps, bounded frame delta and player-selected 3× speed.
    await page.addInitScript(()=>{
      Math.random=()=>0;
      window.requestAnimationFrame=callback=>window.setTimeout(()=>callback(performance.now()),50);
      window.cancelAnimationFrame=id=>clearTimeout(id);
    });
    await page.goto(base);await page.waitForSelector('#start-game:not([disabled])');
    await page.selectOption('#service-plan','challenge');await page.click('#start-game');
    assert.equal(await page.locator('#credits').textContent(),'$32');assert.equal(await page.locator('#challenge-panel').isVisible(),true);
    const connect=async id=>{await page.selectOption('#station-access',id);await page.click('#station-connect');};
    await connect('harbor');await connect('gardens');
    if(outcome==='win'){
      for(const id of ['north','museum','market'])await connect(id);
      await page.click('[data-line="1"]');for(const id of ['museum','civic','east','stadium'])await connect(id);
      await page.click('[data-line="2"]');for(const id of ['museum','university'])await connect(id);
      await page.click('[data-contract="coverage"]');await page.clock.runFor(200);
      await page.click('[data-contract="interchange"]');await page.clock.runFor(200);
      assert.equal(await page.locator('#grant-count').textContent(),'2 / 3 COMPLETADOS');
      await page.click('#speed-button');await page.click('#speed-button');await page.click('#capacity-button');
    }
    await page.click('[data-speed="3"]');
    await page.clock.runFor(110000);
    assert.equal(await page.locator('#game-over').isVisible(),true);
    if(outcome==='win'){
      assert.equal(await page.locator('#report-outcome').textContent(),'RED CERTIFICADA');
      assert.ok(Number(await page.locator('#final-score').textContent())>=30);
    }else{
      assert.match(await page.locator('#game-over-copy').textContent(),/Se acabó el plazo/);
    }
    assert.equal(await page.locator('#pause-button').isDisabled(),true);
    assert.equal(await page.locator('[data-speed="3"]').isDisabled(),true);
    assert.match(await page.locator('.status-pill').textContent(),outcome==='win'?/CERTIFICADA/:/FINALIZADO/);
    const score=await page.locator('#score').textContent(),time=await page.locator('#city-time').textContent();
    await page.clock.runFor(1000);assert.equal(await page.locator('#score').textContent(),score);assert.equal(await page.locator('#city-time').textContent(),time);
    await page.locator('#game-over').scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/${outcome}.png`,fullPage:true});
    await page.click('#restart-button');assert.equal(await page.locator('#credits').textContent(),'$32');assert.equal(await page.locator('#challenge-clock').textContent(),'320 s restantes');assert.equal(await page.locator('#game-over').isVisible(),false);assert.equal(await page.locator('#pause-button').isDisabled(),false);
    assert.deepEqual(errors,[]);console.log(`Certification ${outcome}: actual gameplay, report, frozen outcome and restart passed`);await page.close();
  }
}finally{await browser.close();}
