import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {MapViewport} from '../.test-build/mapViewport.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.argv[2]??'http://127.0.0.1:4175/main-root/';
const output=process.env.QA_OUTPUT??'/tmp/cityflow-workspace';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
try{
 for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844],['small',320,568],['landscape',844,390]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:2,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.addInitScript(()=>{Math.random=()=>0;window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),50);window.cancelAnimationFrame=id=>clearTimeout(id);});
  await page.goto(base);await page.waitForSelector('#start-game:not([disabled])');await page.click('#start-game');await page.clock.runFor(200);
  const checkViewport=async()=>assert.deepEqual(await page.evaluate(()=>({x:document.documentElement.scrollWidth>innerWidth,y:document.documentElement.scrollHeight>innerHeight+1})),{x:false,y:false});
  await checkViewport();assert.match(await page.locator('#focus-goal').textContent(),/Barrio Norte/);
  const canvas=await page.locator('#game-canvas').boundingBox(),dock=await page.locator('.control-dock').boundingBox();
  assert.ok(canvas.height>=150);assert.ok(dock.y+dock.height<=height);assert.equal(await page.locator('#control-room').isVisible(),false);
  const view=new MapViewport(canvas.width,canvas.height);view.zoomAt(Math.min(3,Math.max(1.5,view.height/(460*view.scale))));view.pan(140*view.scale,70*view.scale);
  const tap=async(x,y)=>{const p=view.screen({x,y});await page.mouse.click(canvas.x+p.x,canvas.y+p.y);};
  await page.screenshot({path:`${output}/${name}-opening.png`});
  await tap(420,130);await tap(530,285);assert.match(await page.locator('[data-line="0"]').textContent(),/2/);assert.match(await page.locator('#track-state').textContent(),/3 \/ 9/);
  await page.clock.runFor(8000);assert.ok(Number(await page.locator('#score').textContent())>0);assert.match(await page.locator('#focus-goal').textContent(),/5 personas/);
  await page.click('#map-mode-button');await tap(420,130);assert.equal(await page.locator('#control-room').isVisible(),true);assert.equal(await page.locator('#pause-button').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#station-access').inputValue(),'north');
  const held=await page.locator('#city-time').textContent();await page.clock.runFor(5000);assert.equal(await page.locator('#city-time').textContent(),held);
  await page.click('#close-room');await page.click('#map-mode-button');await checkViewport();
  page.on('dialog',dialog=>dialog.accept());await page.click('#new-shift');await page.uncheck('#progressive-city');await page.uncheck('#tutorial-enabled');await page.click('#start-game');
  const panel=async name=>{if(!(await page.locator('#control-room').isVisible()))await page.click('#open-room');await page.click(`[data-panel="${name}"]`);};
  const connect=async id=>{await panel('station');await page.selectOption('#station-access',id);await page.click('#station-connect');};
  for(const id of ['north','museum','market','harbor','gardens','orchard'])await connect(id);
  assert.match(await page.locator('[data-line="0"]').textContent(),/6/);
  const before=await page.locator('#track-state').textContent();await connect('civic');assert.match(await page.locator('#map-status').textContent(),/Máximo 6/);assert.equal(await page.locator('#track-state').textContent(),before);
  await page.click('[data-line="1"]');for(const id of ['north','airport'])await connect(id);
  await connect('heights');assert.match(await page.locator('#map-status').textContent(),/Faltan/);assert.match(await page.locator('[data-line="1"]').textContent(),/2/);
  const funds=Number((await page.locator('#credits').textContent()).slice(1));await page.click('#expand-track');assert.equal(await page.locator('#credits').textContent(),`$${funds-16}`);await connect('heights');assert.match(await page.locator('[data-line="1"]').textContent(),/3/);assert.match(await page.locator('#track-state').textContent(),/33 \/ 35/);
  assert.equal(await page.locator('#expand-track').isDisabled(),true);
  await page.click('#plan-route');assert.equal(await page.locator('#control-room').isVisible(),false);await page.click('#clear-button');
  for(const id of ['north','museum','market','harbor','gardens','orchard','civic'])await connect(id);
  assert.equal(await page.locator('#apply-draft').isDisabled(),true);assert.match(await page.locator('#draft-resources').textContent(),/Máximo 6/);assert.match(await page.locator('[data-line="1"]').textContent(),/3/);
  await page.keyboard.press('Escape');await page.click('#close-room');await page.click('#zoom-reset');await page.clock.runFor(200);await page.screenshot({path:`${output}/${name}-network.png`});
  await panel('operations');await page.clock.runFor(200);await page.screenshot({path:`${output}/${name}-management.png`});await checkViewport();
  await page.click('#close-room');
  const backing=await page.locator('#game-canvas').evaluate(c=>({w:c.width,h:c.height,cw:c.clientWidth,ch:c.clientHeight}));assert.ok(Math.abs(backing.w-backing.cw*2)<2);assert.ok(Math.abs(backing.h-backing.ch*2)<2);
  // Real resize cannot blank or stretch the Canvas backing store.
  await page.setViewportSize({width:width+20,height});await page.clock.runFor(200);await checkViewport();assert.ok(await page.locator('#game-canvas').evaluate(c=>{const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let dark=0;for(let i=0;i<p.length;i+=160)if(p[i]<140&&p[i+1]<160)dark++;return dark>20;}));
  await page.click('#new-shift');await page.click('#start-game');assert.equal(await page.locator('#track-state').textContent(),'Vía 0 / 30');assert.equal(await page.locator('#credits').textContent(),'$28');assert.match(await page.locator('#expand-track').textContent(),/\$16/);
  assert.deepEqual(errors,[]);await page.close();console.log(`${name}: viewport without scroll, real Canvas tutorial, objective, auto pause, material/stop limits, purchase, draft guards, resize/DPR and reset passed`);
 }
}finally{await browser.close();}
