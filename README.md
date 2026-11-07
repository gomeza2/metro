# CITYFLOW

A small, original urban-transit strategy game prototype. Build metro lines, connect stations, move passengers, manage capacity, and keep the network flowing.

## Current release — v0.15.0

The current build focuses on clarity and playability: a redesigned high-contrast interface, a cleaner Port Azure city map, station labels positioned to avoid collisions, a matching menu-map preview, and simpler first-route instructions. The static passenger-demand illustration was removed so the interface only presents gameplay information that is actually connected to the simulation.

Play the published build: https://gomeza2.github.io/metro/

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

## Project structure

- `src/boot.ts`: startup progress and loading error recovery.
- `src/main.ts`: simulation, rendering, input, and audio.
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
