# CITYFLOW 0.19 validation

Continues the reviewed 0.18 branch. The user explicitly authorized integration into `main` after checks.

- 73 Node tests passed, no failures or skips. All previous suites remain enabled.
- Strict TypeScript, Vite production build, package/HTML version identity and relative CSS/JS asset checks passed.
- New network-command tests cover route extension/trimming/undo/clear, immutable graph snapshots, invalid/no-op edits, preservation of riders from multiple trains, dispatch pricing/limits and reset.
- A removed-transfer scenario holds an in-transit rider at the next station without a phantom delivery, restores the edge and delivers that same rider. Passenger conservation is checked on every subsequent tick.

## Startup browser checks

Production output served by a plain HTTP server under `/metro/`; system Chromium and external playwright-core.

- Slow engine and cached reload at 1440×1000, 390×844, 320×568 and 844×390. Loading cards were captured and inspected; no horizontal overflow.
- Missing entry JavaScript, missing engine module, missing CSS and an engine response arriving after the deadline.
- The actual 20-second production deadline exercised with Chromium's virtual clock, not a different timeout in application code.
- Failure keeps the menu inert, releases aria-busy, stops progress below 100% and exposes a usable retry. Repairing the intercepted network and clicking retry requests fresh HTML and reaches the menu.
- A late module response cannot dismiss an already failed startup.
- JavaScript disabled: the explanation is visibly rendered. Playwright text selectors omit noscript content; the check uses the actual `noscript p` element and a screenshot.

The full gameplay smoke suite also passed on production output at desktop, tablet, phone and landscape sizes: actual canvas taps, route editing, grants, purchases, dispatch, inspect, zoom/pan, DPR and restart.

## Limits

These results establish local production-build behavior, not the public deployment. Git read access worked; direct Pages and GitHub API requests still returned egress-proxy 403 responses. Their domain requirements were already saved in the environment draft. CI status and deployed version cannot be confirmed until those runtime permissions are applied. No claim of Safari, Firefox, real touch hardware or long-session memory profiling is made.
