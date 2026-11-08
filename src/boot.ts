/** Connect the already visible menu. No loader overlay or timeout gate. */
async function connectGame(): Promise<void> {
  let markReady: () => void = () => {};
  const ready = new Promise<void>(resolve => { markReady = resolve; });
  window.addEventListener('cityflow:ready', markReady, { once: true });
  try {
    await Promise.all([import('./main'), ready]);
    window.dispatchEvent(new Event('cityflow:startup-complete'));
  } catch (error) {
    console.error('CITYFLOW controls could not start:', error);
    window.dispatchEvent(new Event('cityflow:startup-failed'));
  } finally {
    window.removeEventListener('cityflow:ready', markReady);
  }
}
void connectGame();
