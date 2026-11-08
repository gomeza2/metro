# CITYFLOW 0.21 validation

## Report and diagnosis limits

The user reported the old loader failing at 0 / 3 after 20 seconds, and clarified they use GitHub Pages main/root and want direct entry. The previous source root entry referenced TypeScript; serving that file without the Vite build cannot initialize a browser game. Separately, the old stylesheet wait/hard deadline could make late resources a terminal failure. The exact public response is not observable here because Pages/API requests are blocked by environment egress, so no claim is made that either hypothesis was confirmed on the user's device.

## Changes and checks

- Removed the loading overlay, stylesheet gate and hard 20-second failure deadline.
- The menu is visible directly. Start enables on actual engine readiness. Scripts delayed beyond 20 seconds become playable automatically when released.
- Compiled root entry/assets support branch-based main/root Pages; source entry is src/index.html and Actions still publishes dist.
- 81 existing Node tests passed without failures/skips. Strict TypeScript, Vite, all linked assets, package version and direct-entry invariants passed for both dist and committed root output.
- Browser startup suite passed against both plain-static outputs: desktop, phone, small phone, landscape; actual Start action; delayed entry and engine; missing entry, engine and CSS; successful retry. No blocking loading element exists.
- The full gameplay browser suite passed on the actual main/root output, including routes, grants, purchases, dispatch, inspection, zoom/pan, DPR and reset. Resume from the menu keeps the correct Pause label and aria-pressed state; starting focuses map controls.

The publication workflow is documented in AGENTS.md and README.md. Generated root HTML and assets are committed with source rather than relying on a browser to execute TypeScript.

## Limits

These are local static-publication checks. Actual Pages deployment completion, GitHub settings and the response on the user's device remain unverified. Real hardware, Safari/Firefox and screen-reader usability remain outstanding. The game is not claimed playable when required script requests are denied; that state offers retry without hiding the menu.
