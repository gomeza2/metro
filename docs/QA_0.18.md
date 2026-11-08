# CITYFLOW 0.18 validation

Base: `ad6a1c1` (PR #9, 0.17.0), verified against the remote main ref before editing. Development branch: `feat/cityflow-network-command`.

## Automated checks

- Baseline: 53 tests and production build passed.
- Styles/build identity stage: 53 tests and build passed.
- Interface/viewport stage: 56 tests and build passed.
- Final service rules/state/scenario stage: 67 tests, no failures or skips; strict TypeScript, Vite and compiled-asset verification passed.
- The five-minute deterministic scenario traverses two interchanges to Grand Stadium and checks generated = waiting + onboard + delivered on every tick. It then resets the same state and engine references.

## Browser checks

System Chromium through external playwright-core; no new application dependencies. Desktop 1440×1000 DPR1, tablet 820×1180 DPR2, phone 390×844 DPR2 and landscape 844×390 DPR2.

Checked actual Canvas taps; routes and live fleet; grant acceptance, topology completion and single reward; capacity and dispatch purchases; edit/inspect switch; zoom, drag without accidental edits and Fit; backing-store dimensions; restart and difficulty budget; main menu and gameplay screenshots; no horizontal overflow, page exceptions or HTTP asset errors. Deliberately aborting CSS requests leaves the recovery screen and reload action visible.

The same browser checks run against a plain static HTTP server with `dist` mounted at `/metro/`, including JavaScript and CSS responses. This tests Pages-style paths independently of Vite's development transforms.

A separate live browser run built three intersecting lines, advanced at 3×, delivered four passengers, verified that pause froze clock and score, then observed Museum late opening activate at city time 09:08 with 39 seconds remaining. No page exceptions occurred. This is a short functional playthrough, not a balance or endurance study.

## Limits

The actual `https://gomeza2.github.io/metro/` request returned a CONNECT 403 from the environment's egress proxy. This does not diagnose the published app or reproduce the user's stale 0.15 screenshot. `api.github.com` is also blocked, so remote PR/deploy status cannot be inspected through the GitHub API. Required host additions were saved in the environment draft; they must be applied in environment settings before a fresh live check.

Local rendering and static-path checks do not prove deployment. Actual Pages version, CDN/cache behavior and workflow completion remain unverified. Real-device touch, Safari/Firefox, long-session browser memory profiling and human difficulty playtesting remain outstanding. Tests do not establish those results.
