const screen = document.querySelector<HTMLElement>('#loading-screen');
const progressTrack = document.querySelector<HTMLElement>('#loading-progress');
const progressBar = document.querySelector<HTMLElement>('#loading-bar');
const progressLabel = document.querySelector<HTMLElement>('#loading-status');
const progressValue = document.querySelector<HTMLElement>('#loading-percent');
const root = document.documentElement;
let progress = 4;
let animationFrame = 0;
const startedAt = performance.now();

function renderProgress(value: number): void {
  progress = Math.max(progress, Math.min(100, Math.round(value)));
  if (progressBar) progressBar.style.width = `${progress}%`;
  if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(progress));
  if (progressValue) progressValue.textContent = `${String(progress).padStart(2, '0')}%`;
}

function animateLoading(): void {
  if (root.dataset.cityflowStartup === 'failed') return;
  // Estimated activity, never download telemetry. Only readiness can reach 100%.
  renderProgress(4 + 88 * (1 - Math.exp(-(performance.now() - startedAt) / 2100)));
  animationFrame = window.requestAnimationFrame(animateLoading);
}
const wait = (duration: number) => new Promise<void>(resolve => window.setTimeout(resolve, duration));

async function bootCityFlow(): Promise<void> {
  if (!screen || root.dataset.cityflowStartup === 'failed') return;
  root.dataset.cityflowStartup = 'starting';
  const controller = new AbortController();
  const ready = new Promise<void>(resolve => window.addEventListener('cityflow:ready', () => resolve(), { once: true, signal: controller.signal }));
  const stopped = new Promise<never>((_, reject) => window.addEventListener('cityflow:startup-stopped', () => reject(new Error('Startup deadline exceeded')), { once: true, signal: controller.signal }));
  // A synchronous stylesheet failure can happen before the race is attached.
  void stopped.catch(() => {});
  animationFrame = window.requestAnimationFrame(animateLoading);
  try {
    const styles = getComputedStyle(root);
    if (styles.getPropertyValue('--cityflow-ui-ready').trim() !== '1' || styles.getPropertyValue('--cityflow-command-ready').trim() !== '1') {
      throw new Error('The interface stylesheet did not load. Check your connection and reload the latest build.');
    }
    if (progressLabel) progressLabel.textContent = 'Loading the game engine';
    await Promise.race([Promise.all([import('./main'), ready]), stopped]);
    window.cancelAnimationFrame(animationFrame);
    await wait(Math.max(0, 650 - (performance.now() - startedAt)));
    if (root.dataset.cityflowStartup === 'failed') return;
    renderProgress(100);
    if (progressLabel) progressLabel.textContent = 'Port Azure is ready';
    // Make readiness visible before revealing the menu, while keeping it inert.
    await wait(260);
    if (root.dataset.cityflowStartup === 'failed') return;
    screen.setAttribute('aria-busy', 'false');
    screen.classList.add('is-hidden');
    window.dispatchEvent(new Event('cityflow:startup-complete'));
    screen.remove();
  } catch (error) {
    if (root.dataset.cityflowStartup !== 'failed') {
      console.error('CITYFLOW could not start:', error);
      window.dispatchEvent(new CustomEvent('cityflow:startup-failed', { detail: error instanceof Error ? error.message : 'Game assets could not load. Reload the latest build.' }));
    }
  } finally {
    window.cancelAnimationFrame(animationFrame);
    controller.abort();
  }
}
void bootCityFlow();
