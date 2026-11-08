# CITYFLOW 0.20 validation

## Automated rules

81 Node tests passed, no failures or skips. Strict TypeScript, Vite and verification of every linked production CSS/JavaScript asset passed. Prior routing, passenger-conservation, demand, timing, boarding and network-edit scenarios remain enabled.

New economy tests cover exact escalating debits, failed purchases, level caps, non-finite budgets, pure goal reads, an isolated stadium not earning a phase reward, all five one-time phase grants, reset and phase rewards occurring in the engine without any HUD rendering. Paused engine updates cannot award money.

New certification tests cover simultaneous requirements, deadline precedence, a clean initial state and a complete deterministic scenario that earns grants, upgrades and delivers through the actual simulation before winning.

## Startup in Chromium

Production output served under `/metro/`. Slow/cached startup at desktop 1440×1000, phone 390×844, small phone 320×568 and landscape 844×390; screenshots inspected.

A virtual-clock test holds the entry bundle: HTML starts at 0% and 0.0s, elapsed time advances to 1.2s while progress remains zero, then readiness completes without advancing time further. A fresh navigation resets both to zero. Completed duration stays visible in the menu. The percentage represents checks completed, not bytes downloaded.

Missing entry, missing engine, missing CSS, delayed engine and delayed CSS are exercised against the actual production 20-second deadline. The timer stops on failure; late resources cannot dismiss the failed state. Restoring the network and using Retry succeeds. Critical inline styling renders the card and elapsed time even while CSS is pending. JavaScript-disabled messaging remains visible.

## Gameplay in Chromium

The full smoke suite passed at desktop, tablet, mobile and landscape sizes: actual canvas taps, topology, grants, purchases, dispatch, inspection, zoom/pan, DPR, restart, assets and overflow.

The certification browser script builds a connected three-line network with actual controls, earns two grants, purchases express/capacity improvements and reaches the success report. A separate two-station run reaches the deadline failure report. It verifies frozen score/time at either outcome, disabled playback controls, correct status and fresh challenge budget/objectives on restart. Tests use deterministic demand and a virtual 20Hz display with the unchanged 1/60 engine and normal 3× setting; live play retains randomized demand.

## Limits

Local production checks do not establish that GitHub Pages has deployed this version. Direct Pages/API verification remains limited by the previously observed environment egress policy. Real-device touch, other browser engines, accessibility usability studies and human balancing remain outstanding.
