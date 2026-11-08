const screen = document.querySelector<HTMLElement>('#loading-screen');
const progressTrack = document.querySelector<HTMLElement>('#loading-progress');
const progressBar = document.querySelector<HTMLElement>('#loading-bar');
const progressLabel = document.querySelector<HTMLElement>('#loading-status');
const progressValue = document.querySelector<HTMLElement>('#loading-percent');
const errorMessage = document.querySelector<HTMLElement>('#loading-error');
const retryButton = document.querySelector<HTMLButtonElement>('#loading-retry');

let progress = 4;
let animationFrame = 0;
const startedAt = performance.now();

function renderProgress(value: number): void {
  progress = Math.max(progress, Math.min(100, Math.round(value)));
  if (progressBar) progressBar.style.width = `${progress}%`;
  if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(progress));
  if (progressValue) progressValue.textContent = `${String(progress).padStart(2, '0')}%`;

  if (progressLabel) {
    if (progress < 24) progressLabel.textContent = 'Opening Port Azure';
    else if (progress < 48) progressLabel.textContent = 'Drawing the city';
    else if (progress < 70) progressLabel.textContent = 'Preparing passenger routes';
    else if (progress < 88) progressLabel.textContent = 'Connecting metro lines';
    else progressLabel.textContent = 'Starting the simulation';
  }
}

function animateLoading(): void {
  const seconds = (performance.now() - startedAt) / 1000;
  // Ease toward 92% while the browser downloads and evaluates the game modules.
  const estimated = 4 + 89 * (1 - Math.exp(-seconds / 2.1));
  renderProgress(estimated);
  animationFrame = window.requestAnimationFrame(animateLoading);
}

function wait(duration: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function hideLoadingScreen(): void {
  if (!screen) return;
  screen.classList.add('is-hidden');
  window.setTimeout(() => screen.remove(), 650);
}

function showLoadingError(): void {
  window.cancelAnimationFrame(animationFrame);
  if (progressLabel) progressLabel.textContent = 'City startup needs another try';
  if (errorMessage) { errorMessage.hidden = false; errorMessage.textContent = 'Game assets could not load. Check your connection and reload CITYFLOW.'; }
  if (retryButton) retryButton.hidden = false;
  screen?.classList.add('has-error');
}

retryButton?.addEventListener('click', () => window.location.reload());

async function bootCityFlow(): Promise<void> {
  if (!screen) {
    await import('./main');
    return;
  }

  // Listen before importing main.ts so a fast cached load cannot skip the ready signal.
  const ready = new Promise<void>((resolve) => {
    window.addEventListener('cityflow:ready', () => resolve(), { once: true });
  });

  animationFrame = window.requestAnimationFrame(animateLoading);

  try {
    if (getComputedStyle(document.documentElement).getPropertyValue('--cityflow-ui-ready').trim() !== '1') {
      throw new Error('The interface stylesheet did not load. Reload to fetch the latest build.');
    }
    await Promise.all([import('./main'), ready]);
    window.cancelAnimationFrame(animationFrame);

    // Keep the loader visible briefly, even on fast connections, so progress is readable.
    const minimumDisplay = 650;
    await wait(Math.max(0, minimumDisplay - (performance.now() - startedAt)));
    renderProgress(100);
    if (progressLabel) progressLabel.textContent = 'Port Azure is ready';
    await wait(260);
    hideLoadingScreen();
  } catch (error) {
    console.error('CITYFLOW could not start:', error);
    showLoadingError();
  }
}

void bootCityFlow();
