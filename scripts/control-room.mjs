// Visible controls only. Opening management intentionally pauses the simulation.
export async function showPanel(page, panel) {
  if (!(await page.locator('#control-room').isVisible())) await page.click('#open-room');
  await page.click(`[data-panel="${panel}"]`);
}
export async function returnToMap(page, resume = false) {
  if (await page.locator('#control-room').isVisible()) await page.click('#close-room');
  if (resume && await page.locator('#pause-button').getAttribute('aria-pressed') === 'true') await page.click('#pause-button');
}
