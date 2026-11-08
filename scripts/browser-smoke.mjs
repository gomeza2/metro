// Optional browser QA. Pass an installed Playwright module through PLAYWRIGHT_MODULE.
// No browser dependency is added to the application bundle or package manifest.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const packageVersion = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const output = process.env.QA_OUTPUT ?? '/tmp/cityflow-qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  for (const [name, width, height, dpr] of [['desktop',1440,1000,1],['tablet',820,1180,2],['mobile',390,844,2],['landscape',844,390,2]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
    const errors = [], failures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if(response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    assert.equal((await page.goto(base)).status(), 200);
    assert.equal(await page.locator('#loading-screen').count(),0);
    await page.waitForSelector('#start-game:not([disabled])');
    assert.equal(await page.locator('meta[name="cityflow-version"]').getAttribute('content'), packageVersion);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cityflow-ui-ready').trim()), '1');
    await page.screenshot({ path: `${output}/${name}-menu.png`, fullPage: false });
    await page.selectOption('#service-plan', 'sandbox');
    await page.click('#start-game');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#main-menu')).visibility === 'hidden');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'map-mode-button');
    assert.equal(await page.locator('#credits').textContent(), '$150');
    assert.equal(await page.locator('#best-score').textContent(), 'LIBRE');
    // Real canvas taps, including letterboxing in portrait layouts.
    const tap = async (x, y) => {
      await page.locator('#game-canvas').scrollIntoViewIfNeeded();
      const rect = await page.locator('#game-canvas').boundingBox();
      const scale = Math.min(rect.width / 1200, rect.height / 760);
      await page.mouse.click(rect.x + rect.width / 2 + (x - 600) * scale, rect.y + rect.height / 2 + (y - 380) * scale);
    };
    await page.click('#dismiss-hint');
    await tap(420,130); await tap(530,285);
    await page.waitForFunction(() => document.querySelector('[data-line="0"]').textContent.includes('2'));
    await page.click('#pause-button');
    await page.click('.brand');await page.click('#start-game');
    assert.match(await page.locator('#pause-button').textContent(),/Pausa/);
    assert.equal(await page.locator('#pause-button').getAttribute('aria-pressed'),'false');
    await page.click('#pause-button');
    // Keyboard-accessible selection, transfer network, contract reward.
    if (width <= 620) await page.click('[data-panel="station"]');
    const connect = async id => { await page.selectOption('#station-access',id); await page.click('#station-connect'); };
    await connect('market');
    if (width <= 620) await page.click('[data-panel="grants"]');
    await page.click('[data-contract="coverage"]');
    if (width <= 620) await page.click('[data-panel="station"]');
    for (const id of ['civic','east','university','stadium','heights']) await connect(id);
    await page.click('#pause-button');
    await page.waitForFunction(() => document.querySelector('#grant-count').textContent.startsWith('1'));
    await page.click('#pause-button');
    assert.equal(await page.locator('#credits').textContent(), '$164');
    await page.click('#capacity-button');assert.equal(await page.locator('#credits').textContent(),'$152');
    await page.click('#dispatch-button');assert.equal(await page.locator('#fleet-state').textContent(),'Flota · 2/3 trenes');
    await page.click('#map-mode-button');
    assert.equal(await page.locator('#map-mode-button').getAttribute('aria-pressed'),'true');
    // Zoom and drag must not edit the network. Fit restores coordinate mapping.
    await page.click('#zoom-in');await page.locator('#game-canvas').scrollIntoViewIfNeeded();
    const rect = await page.locator('#game-canvas').boundingBox();
    await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+70,rect.y+rect.height/2+20,{steps:5});await page.mouse.up();
    assert.ok((await page.locator('[data-line="0"]').textContent()).includes('8'));
    await page.click('#zoom-reset');
    const backing=await page.locator('#game-canvas').evaluate(canvas=>({w:canvas.width,h:canvas.height,cw:canvas.clientWidth,ch:canvas.clientHeight}));
    assert.ok(Math.abs(backing.w-backing.cw*dpr)<=2);assert.ok(Math.abs(backing.h-backing.ch*dpr)<=2);
    await page.locator('#game-canvas').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${output}/${name}-game.png`,fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
    // Restart clears the network and mode budget without carrying upgrades/grants.
    page.on('dialog', dialog => dialog.accept());
    await page.click('#new-shift');
    await page.selectOption('#service-plan','relaxed');await page.click('#start-game');
    assert.equal(await page.locator('#credits').textContent(),'$40');
    assert.equal(await page.locator('#grant-count').textContent(),'0 / 3 COMPLETADOS');
    assert.ok((await page.locator('[data-line="0"]').textContent()).includes('0'));
    console.log(`${name}: assets, gameplay, grants, economy, zoom/pan, DPR, restart passed`);
    await page.close();
  }
} finally { await browser.close(); }
