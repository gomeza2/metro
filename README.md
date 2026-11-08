# CITYFLOW

A small, original urban-transit strategy game prototype. Build metro lines, connect stations, move passengers, manage capacity, and keep the network flowing.

## Current release — v0.20.0 · Live startup and network certification

Startup now begins at 0% and 0.0 seconds. Progress counts three real checks (interface, engine, city readiness), while a live clock reports actual elapsed time. There is no forced minimum loading delay; the menu retains the completed duration. CSS loads without blocking the critical loading card. Recovery works even if the entry JavaScript is missing. A 20-second deadline prevents indefinite loading; retry requests fresh HTML, and late engine responses cannot dismiss a failed startup. The loading card remains readable without external CSS, keeps the menu inaccessible until ready and explains when JavaScript is disabled.

Route edits, fleet dispatch and network reset now run through tested engine commands. Selecting an existing endpoint keeps the fleet moving. Passengers on other lines replan at their next arrival; a removed transfer leaves them waiting for reconnection instead of creating false deliveries.

A map-led operations desk with larger type, readable touch controls, mobile panel navigation and a shared city preview. All fourteen stations, four editable lines, transfers, upgrades, optional audio and the five stadium shift phases remain available.

- Uniform Canvas scaling with DPR-aware backing store, 1–3× zoom, drag-to-pan, Fit and a keyboard station selector. Ctrl/Meta+wheel zooms; ordinary scrolling stays available.
- Five service plans: **City shift** (original balance), **Gentle shift** (70% demand, 25-second rescue window, $40), **Rush hour** (150% demand, 12-second rescue window), **Free build** (70% demand, $150, no overload defeat) and **Network certification** (a timed victory challenge).
- **Network certification:** start with $32 and complete 30 deliveries, eight stations in one connected network and two grants before 320 simulation seconds. All goals must hold together. Overload can still end the run. The first service starts the clock; pause stops it.
- Capacity/express purchases and phase rewards are now engine commands. The inspector lists leading passenger destinations and explains broken connections.
- Optional city grants: ten new deliveries, eight stations in one connected network or a three-line interchange. Accept one at a time; complete it before its simulation-time deadline for funds. Each grant allows one attempt per shift; restarting restores the offers.
- Seeded museum, harbor and university events redirect connected passenger demand. An advance notice and map ring identify the affected district. The existing stadium phases keep their own time window.
- Ranked best scores are separate for each difficulty; the original standard score is preserved. Free build is unranked. Audio and Spotify remain optional.
- Missing CSS produces a readable recovery screen instead of starting an unstyled game. Production output includes the exact package version and verified relative asset paths.

Play the published build: https://gomeza2.github.io/metro/ (publication may lag this branch).

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

To create a production build:

```bash
npm run build
npm run preview
```

## Publish with GitHub Pages

In repository Settings → Pages, set the build and deployment source to **GitHub Actions**. The `.github/workflows/deploy.yml` workflow then builds the Vite app and publishes the compiled `dist/` directory on each push to `main`.

## Prototype controls

- Select a colored line in the toolbar.
- Click stations on the map in the order you want the line to visit them.
- Click a station already on the line to trim the route back to that station.
- Use **Undo** to remove the last station from the selected line.
- Use **Pause** and the speed control to manage the simulation.
- Open **Ambient audio** to enable the original synthesized background sound.

Passengers only appear between stations that are connected by the current network. Trains reverse at the ends of each line. At interchange stations, passengers can change lines when the route requires it.

## Previous scope — v0.7.0

The shift now has five phase goals with progress tracking and an $8 reward for each completed goal. Objectives include starting passenger service, connecting Grand Stadium, delivering passengers to and from the venue, and reaching a total delivery target. The session report shows completed goals and a locally saved personal best score. The stadium return phase tracks passengers from their original station through transfers.

The map has two interaction modes: Edit route changes the selected line, while Inspect selects stations and reads live queues and connections without changing the network. The mode can also be toggled with the `I` key.

## Previous scope — v0.4

The opening experience now has a dedicated start screen with an original illustrated city map, a clear entry into the first session, a quick explanation of the game loop, and optional ambient audio. The in-game interface has a stronger visual hierarchy and a redesigned performance panel. The simulation remains paused until the player starts or resumes a shift.

## Previous scope — v0.3

The first playable city now includes a detailed coastal map, streets and landmarks, animated metro vehicles, up to three trains per line, route connections, passenger pathfinding and transfers, station queues, station inspection, overload conditions, adaptive time-of-day passenger patterns, an announced stadium event, an operating-funds system, paid capacity/speed upgrades, simulation controls, and synthesized ambient audio.

Passengers earn operating funds when delivered. Capacity and express upgrades have explicit prices. Players can also purchase additional trains for the selected line, with escalating costs and a three-train fleet limit. The station inspector shows queue size, connected lines, pressure, and district-specific guidance.

The project deliberately starts without accounts, a backend, or external music services. The game should first prove that its core loop is fun and understandable.

## Browser QA

Run `npm test` and `npm run build` first. The optional `scripts/browser-smoke.mjs` uses an external Playwright installation and system Chromium; it adds no application dependency:

```bash
npm install --prefix /tmp/cityflow-qa-tools --no-save --package-lock=false playwright-core
PLAYWRIGHT_MODULE=/tmp/cityflow-qa-tools/node_modules/playwright-core/index.mjs node scripts/browser-smoke.mjs
```

Start Vite before that command. Pass a different base URL as the first argument to test a static build served under `/metro/`. The check covers four viewports, asset responses, real canvas taps, grants, purchases, inspection, zoom/pan, DPR, restart and CSS failure recovery. Screenshots default to `/tmp/cityflow-qa`. See [latest QA notes](docs/QA_0.20.md) for observed results and limits.

The startup failure suite targets a production build served under `/metro/`:

```bash
PLAYWRIGHT_MODULE=/tmp/cityflow-qa-tools/node_modules/playwright-core/index.mjs node scripts/loading-smoke.mjs http://127.0.0.1:4173/metro/
```

It tests an exact zero start, a live elapsed clock, reset on fresh navigation, immediate readiness without an artificial delay, slow/cached startup, missing entry/module/CSS, delayed CSS, the real timeout, late responses, retry and JavaScript-disabled messaging.

The certification browser scenario plays through both outcomes using actual UI controls and a virtual clock:

```bash
PLAYWRIGHT_MODULE=/tmp/cityflow-qa-tools/node_modules/playwright-core/index.mjs node scripts/challenge-smoke.mjs http://127.0.0.1:4173/metro/
```

Its deterministic demand is test-only. Live games retain randomized passenger selection.

## Project structure

- `src/boot.ts`: startup progress and loading error recovery.
- `src/main.ts`: browser presentation, rendering, input, audio and simulation wiring.
- `src/simulation/gameSimulation.ts`: DOM-free gameplay updates for passengers, trains, boarding, transfers, rewards and station pressure.
- `src/simulation/gameTypes.ts`: shared simulation entity types.
- `src/mapViewport.ts`: uniform world/CSS transforms, zoom and pan.
- `src/cityMap.ts`: shared fourteen-station metadata and fresh runtime station creation.
- `src/simulation/runEconomy.ts`: upgrades, goal progress and one-time phase rewards.
- `src/simulation/serviceChallenge.ts`: timed certification objectives and outcomes.
- `src/simulation/networkCommands.ts`: route edits, fleet placement, dispatch budget and graph reset.
- `src/simulation/runState.ts`: run counters and explicit reset.
- `src/simulation/servicePlans.ts`: difficulty tuning and seeded district events.
- `src/simulation/serviceContracts.ts`: optional grants, progress, deadlines and one-time rewards.
- `src/visuals.ts`: city scenery and map landmarks.
- `src/style.css`: game interface, loading screen, and responsive layout.
- `index.html`: accessible application shell.
- `docs/GAME_DESIGN.md`: product direction and development roadmap.

## Design principles

1. The player should understand the basic action in under a minute.
2. Every upgrade and event should create a meaningful trade-off.
3. Difficulty should rise from readable systems, not random punishment.
4. The simulation must remain separate enough from rendering to evolve safely.
5. A small, polished playable loop is more valuable than many unfinished features.

## License and assets

The prototype uses original code and procedurally drawn graphics/audio. No Mini Metro or Mini Motorways code, artwork, audio, or other assets are included.


## v0.8.0 — Interface and phase presentation

- Refined the main menu and gameplay dashboard with clearer spacing, contrast, card hierarchy, and map-first emphasis.
- Added a five-phase preview to the opening screen so players know what changes during a shift.
- Improved the readability of phase objectives, progress bars, route controls, and responsive layouts.


## Previous release — v0.9.0 — Better first launch, phase identity and sound

- Added a startup screen with a progress indicator that waits for the game engine's ready signal. If startup fails, the player gets a clear retry action.
- Reworked the five shift descriptions and passenger destination weights so morning, event preparation, stadium arrivals, post-event returns, and the afternoon build-up create different travel patterns.
- Rebuilt the optional Web Audio soundtrack as an original repeating synth motif. Its notes and tempo respond to the current phase and passenger pressure.
- Added optional Spotify search shortcuts for players who prefer their own music. Spotify opens in a separate tab; it is not required and does not replace the game's original soundtrack.
- Reduced DOM-heavy HUD refreshes while keeping the Canvas animation on the display refresh cycle.
- Made train next-stop lookup read-only so drawing a train cannot change its simulation direction.


The loading percentage is an estimate of startup progress, not a byte-by-byte download meter. The screen only reaches 100% after the game module signals that the engine is ready.


## Previous release — v0.10.0 — Simulation and rendering foundations

- Extracted shortest-path routing into `src/simulation/pathfinding.ts`.
- Route planning now uses a snapshot of the active lines and caches route results until a route edit rebuilds that snapshot.
- The planner shares frozen cached route arrays for read-only lookups. It copies only the selected path when assigning it to a passenger, so passenger progress cannot mutate shared planner state.
- Added Node's built-in test runner for route direction, shortest paths, disconnected stations, cyclic networks, cache isolation, and snapshot behavior. No third-party test dependency is required.
- Moved the fixed Port Azure scenery to an offscreen canvas cache. The render loop now blits the static layer and draws only the moving river glints on top.
- GitHub Actions runs the simulation tests before the TypeScript/Vite production build.


## Previous release — v0.11.0 — Passenger demand system

- Extracted time-of-day and shift-phase passenger trip weighting into `src/simulation/passengerDemand.ts`.
- Passenger demand selection now receives an injectable random source, allowing phase behavior and queue-pressure preferences to be tested deterministically.
- Preserved the existing demand tuning while moving morning departures, stadium preparation, event arrivals, post-event returns, and late-shift residential trips out of `main.ts`.
- Added tests for each phase, queue-pressure fallback, weighted selection, random boundaries, and empty candidate pools.


## Previous release — v0.12.0 — Central shift phase model

- Added `src/simulation/shiftPhases.ts` as the single source of truth for the five phase IDs, boundaries, names, objectives and goals.
- The mission HUD, event panel, soundtrack and passenger-demand system now resolve the active phase through the same phase helper.
- Kept the previous time boundaries and demand multipliers unchanged; this is a consistency and correctness refactor, not a difficulty rebalance.
- Added seven boundary tests for inclusive/exclusive transitions, the final phase continuing beyond its nominal end, and invalid elapsed values.


## Current release — v0.13.0 — Passenger boarding and transfer operations

- Extracted boarding selection and train-arrival passenger resolution into `src/simulation/passengerOperations.ts`.
- Boarding now uses an explicit available-seat count and preserves FIFO order among passengers whose next route edge matches the train.
- Arrival resolution returns three clear groups: passengers continuing on the train, passengers transferring into the station queue, and passengers who completed their trip.
- Passenger routes are advanced on fresh arrays, preserving the caller's passenger state and preventing accidental mutation of shared route data.
- Added nine tests for capacity, eligibility, destination arrival, transfers, continuation, path advancement and mutation safety.
