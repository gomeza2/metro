import {showPanel, returnToMap} from './control-room.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.argv[2]??'http://127.0.0.1:4173/main-root/';
const output=process.env.QA_OUTPUT??'/tmp/cityflow-growth';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
try{
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['small',320,568]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.addInitScript(()=>{Math.random=()=>0;window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),50);window.cancelAnimationFrame=id=>clearTimeout(id);});
  await page.goto(base);await page.waitForSelector('#start-game:not([disabled])');assert.equal(await page.locator('html').getAttribute('lang'),'es');
  await page.screenshot({path:`${output}/${name}-menu.png`});await page.click('#start-game');
  assert.equal(await page.locator('#station-access option').count(),4);assert.equal(await page.locator('[data-line]:disabled').count(),3);
  assert.equal(await page.locator('#line-operations').isVisible(),false);assert.equal(await page.locator('.upgrade-strip').isVisible(),false);
  assert.match(await page.locator('#start-hint strong').textContent(),/Tu primera línea/);await page.clock.runFor(100);
  assert.ok(await page.locator('#game-canvas').evaluate(canvas=>{const c=canvas.getContext('2d'),p=c.getImageData(0,0,canvas.width,canvas.height).data;let ink=0;const colors=new Set();for(let i=0;i<p.length;i+=40){if(p[i]<150&&p[i+1]<170&&p[i+2]<170)ink++;colors.add(`${p[i]>>4}:${p[i+1]>>4}:${p[i+2]>>4}`);}return ink>20&&colors.size>15;}));await page.screenshot({path:`${output}/${name}-opening.png`,fullPage:true});
  await page.click('.brand');await page.keyboard.press('Space');await page.clock.runFor(2000);assert.equal(await page.locator('#city-time').textContent(),'08:00');assert.equal(await page.locator('#pause-button').getAttribute('aria-pressed'),'true');await page.click('#start-game');
  const tap=async(x,y)=>{await page.clock.runFor(100);const r=await page.locator('#game-canvas').boundingBox();const point=await page.locator('#game-canvas').evaluate((canvas,p)=>{const m=canvas.getContext('2d').getTransform(),ratio=canvas.width/canvas.getBoundingClientRect().width;return{x:(m.a*p.x+m.c*p.y+m.e)/ratio,y:(m.b*p.x+m.d*p.y+m.f)/ratio};},{x,y});await page.mouse.click(r.x+point.x,r.y+point.y);};
  await tap(420,130);await tap(530,285);assert.ok((await page.locator('[data-line="0"]').textContent()).includes('2'));
  await page.locator('#game-canvas').focus();await page.keyboard.press('z');assert.ok((await page.locator('[data-line="0"]').textContent()).includes('1'));await tap(530,285);
  await page.clock.runFor(200);assert.match(await page.locator('#start-hint strong').textContent(),/primer viaje/);
  await page.click('[data-speed="0.5"]');await page.clock.runFor(200);assert.equal(await page.locator('[data-speed="0.5"]').getAttribute('aria-pressed'),'true');
  await page.click('[data-speed="3"]');await page.clock.runFor(7000);
  assert.ok(Number(await page.locator('#score').textContent())>=1);assert.match(await page.locator('#start-hint strong').textContent(),/Pausa/);
  await page.locator('#game-canvas').focus();await page.keyboard.press('Space');await page.clock.runFor(200);assert.match(await page.locator('#start-hint strong').textContent(),/Mira antes/);
  await page.click('#map-mode-button');await tap(420,130);await page.clock.runFor(200);assert.equal(await page.locator('#start-hint').isVisible(),false);
  await showPanel(page,'station');
  const funds=()=>page.locator('#credits').textContent().then(value=>Number(value.replace('$','')));
  const beforePlatform=await funds();await page.click('#platform-button');assert.equal(await funds(),beforePlatform-16);assert.match(await page.locator('#station-queue').textContent(),/\/ 18/);
  await showPanel(page,'operations');
  const beforePolicy=await funds();await page.selectOption('#line-policy','local');assert.equal(await funds(),beforePolicy);assert.match(await page.locator('#policy-seats').textContent(),/9 por tren/);
  await page.click('#apply-policy');assert.equal(await funds(),beforePolicy-6);
  await returnToMap(page);await page.locator('#game-canvas').focus();await page.keyboard.press('2');assert.equal(await page.locator('[data-line="0"]').getAttribute('aria-pressed'),'true');
  await page.click('#pause-button');await page.clock.runFor(5000);
  assert.equal(await page.locator('#station-access option').count(),7);assert.equal(await page.locator('[data-line="1"]').isDisabled(),false);
  await page.locator('#game-canvas').focus();await page.keyboard.press('2');assert.equal(await page.locator('[data-line="1"]').getAttribute('aria-pressed'),'true');
  if(name==='desktop'){
   await page.clock.runFor(10000);assert.equal(await page.locator('#station-access option').count(),11);assert.equal(await page.locator('[data-line="2"]').isDisabled(),false);
   await page.clock.runFor(30000);assert.equal(await page.locator('#station-access option').count(),15);assert.equal(await page.locator('[data-line="3"]').isDisabled(),false);
  }
  await page.click('#zoom-reset');await page.locator('#game-canvas').scrollIntoViewIfNeeded();await page.clock.runFor(100);await page.screenshot({path:`${output}/${name}-expanded.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  page.on('dialog',d=>d.accept());await page.click('#new-shift');await page.click('#start-game');assert.equal(await page.locator('#station-access option').count(),4);assert.equal(await page.locator('#score').textContent(),'000');assert.equal(await page.locator('#credits').textContent(),'$28');assert.equal(await page.locator('#line-policy').inputValue(),'balanced');
  await page.close();console.log(`${name}: Spanish, small start, tutorial, pause, strategy, growth, keyboard and reset passed`);
 }
}finally{await browser.close();}
