const screen = document.querySelector<HTMLElement>('#loading-screen');
const progressTrack = document.querySelector<HTMLElement>('#loading-progress');
const progressBar = document.querySelector<HTMLElement>('#loading-bar');
const progressLabel = document.querySelector<HTMLElement>('#loading-status');
const progressValue = document.querySelector<HTMLElement>('#loading-percent');
const checksLabel = document.querySelector<HTMLElement>('#loading-checks');
const root = document.documentElement;

function completeChecks(count: number, label: string): void {
  if (root.dataset.cityflowStartup === 'failed') return;
  const percentage = Math.round(count / 3 * 100);
  if (progressBar) progressBar.style.width = `${percentage}%`;
  if (progressTrack) {
    progressTrack.setAttribute('aria-valuenow', String(percentage));
    progressTrack.setAttribute('aria-valuetext', `${count} of 3 startup checks complete`);
  }
  if (progressValue) progressValue.textContent = `${percentage}%`;
  if (progressLabel) progressLabel.textContent = label;
  if (checksLabel) checksLabel.textContent = `${count} / 3 checks`;
}

async function bootCityFlow(): Promise<void> {
  if (!screen || root.dataset.cityflowStartup === 'failed') return;
  root.dataset.cityflowStartup = 'starting';
  const controller = new AbortController();
  const ready = new Promise<void>(resolve => window.addEventListener('cityflow:ready', () => resolve(), { once: true, signal: controller.signal }));
  const stopped = new Promise<never>((_, reject) => window.addEventListener('cityflow:startup-stopped', () => reject(new Error('Startup deadline exceeded')), { once: true, signal: controller.signal }));
  void stopped.catch(() => {});
  try {
    completeChecks(0, 'Checking the interface');
    const stylesheets = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')];
    const loadedStyles = stylesheets.map(link => new Promise<void>((resolve, reject) => {
      if (link.dataset.failed === 'true') { reject(new Error('The interface stylesheet could not load. Reload the latest build.')); return; }
      if (link.dataset.loaded === 'true' || link.sheet) { link.media = 'all'; resolve(); return; }
      link.addEventListener('load', () => { link.media = 'all'; resolve(); }, { once: true, signal: controller.signal });
      link.addEventListener('error', () => reject(new Error('The interface stylesheet could not load. Reload the latest build.')), { once: true, signal: controller.signal });
    }));
    await Promise.race([Promise.all(loadedStyles), stopped]);
    const styles = getComputedStyle(root);
    if (styles.getPropertyValue('--cityflow-ui-ready').trim() !== '1' || styles.getPropertyValue('--cityflow-command-ready').trim() !== '1') {
      throw new Error('The interface stylesheet did not load. Check your connection and reload the latest build.');
    }
    completeChecks(1, 'Interface ready · loading the engine');
    await Promise.race([import('./main'), stopped]);
    completeChecks(2, 'Engine loaded · checking the city');
    await Promise.race([ready, stopped]);
    if (root.dataset.cityflowStartup === 'failed') return;
    completeChecks(3, 'Port Azure is ready');
    screen.setAttribute('aria-busy', 'false');
    // Reveal immediately. The completed duration remains visible in the menu.
    window.dispatchEvent(new Event('cityflow:startup-complete'));
    screen.remove();
  } catch (error) {
    if (root.dataset.cityflowStartup !== 'failed') {
      console.error('CITYFLOW could not start:', error);
      window.dispatchEvent(new CustomEvent('cityflow:startup-failed', { detail: error instanceof Error ? error.message : 'Game assets could not load. Reload the latest build.' }));
    }
  } finally {
    controller.abort();
  }
}
void bootCityFlow();
