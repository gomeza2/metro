# CITYFLOW architecture notes

This document records the current boundaries and the order in which the original prototype is being separated. The project is intentionally being refactored in small, verifiable steps instead of replacing the working game all at once.

## Current runtime

- `src/boot.ts` loads the application module, reports startup progress, and displays a retry state if startup fails.
- `src/main.ts` is still the application composition root. It composes `RunState`, `NetworkCommands` and `GameSimulation`; it still owns UI flags, the update loop, DOM interaction, HUD coordination and Canvas render orchestration. It is smaller than before, but it is not yet a fully separated engine.
- `src/simulation/pathfinding.ts` owns the transit graph snapshot and shortest-route planner.
- `src/simulation/trainMotion.ts` owns pure train-direction and next-stop calculations.
- `src/simulation/passengerDemand.ts` owns phase-aware trip weighting and injectable weighted candidate selection.
- `src/simulation/shiftPhases.ts` is the single source of truth for phase IDs, boundaries, mission copy and current-phase lookup.
- `src/simulation/passengerOperations.ts` owns pure boarding selection and arrival classification for continuing, transferring and delivered passengers.
- `src/simulation/fixedStepClock.ts` converts variable render-frame deltas into bounded, fixed-size simulation updates.
- `src/simulation/gameSimulation.ts` owns the DOM-free gameplay tick: passenger demand, train movement, boarding, arrivals, delivery rewards and overload detection.
- `src/simulation/gameTypes.ts` defines the shared passenger, station, train, line and station-kind contracts.
- `src/visuals.ts` owns the cached Port Azure city map, coastline, parks, roads, landmarks and animated water highlights.
- `src/main.ts` draws interactive routes, station markers, deliberate station-label anchors, trains and gameplay overlays on top of the static city layer.
- `src/style.css` owns the responsive interface and loading presentation.
- `test/` contains Node's built-in test-runner suites. The tests compile only the simulation modules they exercise into the ignored `.test-build/` directory.

### Shift phase model

`SHIFT_PHASES` is defined once in `src/simulation/shiftPhases.ts`.

- Every phase has a stable ID, start-inclusive/end-exclusive timing, display name, objective and goal copy.
- `getShiftPhaseIndex` and `getShiftPhase` are the only supported way for other systems to resolve the current phase from elapsed simulation time.
- The mission HUD, event presentation, soundtrack and passenger demand all use the shared phase model.
- The final phase remains active after its nominal end time, so a run can continue without falling into an undefined state.
- Phase boundaries are unit-tested at the precise transition points. Demand multipliers are intentionally not tuned as part of this architecture change.

## Simulation boundaries

### Route planner

A `RoutePlanner` is created from the current station list and active metro lines.

- Lines create bidirectional edges between adjacent stations.
- The planner uses breadth-first search, so the returned route has the fewest station-to-station edges.
- Search results, including unreachable pairs, are cached for the lifetime of that network snapshot.
- A route edit rebuilds the planner. It is not rebuilt for every passenger spawn.
- The planner returns a shared, frozen route array for read-only lookups. A passenger receives its own mutable copy only when that route is assigned to it. This avoids per-candidate route-array allocation while preserving cache safety.
- Unknown or disconnected stations return `null`.

### Passenger demand

Passenger demand selection is isolated from the game loop.

- Candidates are built from connected station pairs and their cached routes.
- A pure weighting function applies the time-of-day and five shift-phase multipliers.
- The selector prefers origins with shorter queues when such candidates exist, then falls back to all valid candidates.
- The random source is injectable. Tests can verify phase behavior and selection boundaries without relying on an uncontrolled random sequence.
- The selected candidate retains its station payload; the mutable passenger route is copied only when the passenger is created.

### Passenger boarding and arrivals

`passengerOperations.ts` contains the pure passenger rules that run when a train is ready to board or reaches a station.

- Boarding accepts an explicit station, next stop and available seat count.
- Eligible passengers must have the current station and the train's next stop as their next route edge.
- Eligible passengers board in queue order. Other passengers keep their relative queue order.
- Arrival resolution advances a passenger's path only when the station just reached matches the next route station.
- Passengers are classified as continuing, transferring, or delivered. The caller remains responsible for the score, operating funds, and stadium mission counters.
- The functions return new result arrays and progressed passenger route copies; they do not mutate the supplied passenger queue or onboard list.

### Train movement

Train movement helpers are pure functions. They calculate the direction appropriate for an endpoint and the next valid station index without changing a train object. The simulation update remains responsible for applying a direction change. Rendering may ask for the next stop without mutating gameplay state.

### Game simulation engine

`GameSimulation` owns the gameplay update and has no dependency on the DOM, Canvas, local storage or browser events.

- The browser layer supplies station and line collections, the current route-planner snapshot, upgrade levels, and a mutable state contract for elapsed time, demand time, passenger IDs, score, credits and stadium counters.
- `step(dt)` advances passenger demand, train dwell and travel, boarding, station arrivals, transfers, deliveries and overload pressure.
- Passenger selection and arrival/boarding classification remain delegated to the smaller tested modules. The engine composes those rules and applies the resulting changes to the live run state.
- The only presentation boundary is an overload callback. The browser handles the game-over screen and persistence; the engine itself never queries or updates HTML.
- A route edit replaces the planner referenced by the browser-provided getter. The simulation therefore sees the same immutable graph snapshot used by passenger replanning.

### Fixed-step simulation clock

`FixedStepClock` is independent of the browser and game state.

- The live game advances in fixed 1/60-second updates. The display can render at a different refresh rate without changing the size of gameplay updates.
- The existing 50 ms frame-delta ceiling is retained, then the selected 1x, 2x or 3x speed multiplier is applied to simulation time.
- At most 12 updates run during one rendered frame. If an unusually large backlog remains, excess whole steps are discarded while the fractional remainder is retained. This prevents a catch-up spiral after a stall.
- The clock is reset when a run restarts, so a partial step from the previous run cannot leak into the next one.
- The clock reports an interpolation fraction for future rendering work, but the current renderer does not interpolate train positions yet. Simulation state remains authoritative.

### Rendering

Port Azure's roads, parks, buildings, coastline and landmarks do not change during a run. `drawCityOverlay` paints this static artwork into an offscreen canvas once, then composites the cached layer on later frames. Only water highlights are redrawn as animated scenery. If the offscreen context cannot be created, the renderer falls back to drawing the static layer directly.

Interactive station markers and route segments are drawn after the city layer. Station labels use per-station anchors rather than one universal offset; this keeps names away from close neighboring stations and makes the map easier to scan. The menu overview uses the same 1200 × 760 world coordinates scaled into its SVG, so its fourteen station positions and coast geometry match the playable map.

The event panel is also no longer written from the per-frame simulation update. Event presentation changes only when its phase/event key changes, during the throttled HUD refresh.

## Rules to preserve

1. Rebuild the route planner whenever the active line topology changes, including a full game restart.
2. Never hand a mutable cached path array directly to a passenger.
3. Keep simulation state changes out of drawing functions.
4. Do not let visual interpolation change station indices, train direction, passenger routes, or money.
5. Keep Canvas rendering smooth while throttling DOM updates independently.
6. Keep audio optional and do not make an external service a gameplay dependency.
7. Add tests for pure simulation logic before extracting larger systems.

## Verification

Run:

```bash
npm test
npm run build
```

The GitHub Actions build workflow runs the tests first, then strict TypeScript checking and the Vite production build. A successful build does not by itself prove the game has been visually tested in a browser or deployed to Pages; those are tracked separately.

## Next extraction sequence

1. Move ownership of the remaining run state into a dedicated simulation state object, then make restart and route-edit operations explicit engine commands rather than UI-side field mutations.
2. Split Canvas rendering from interaction and presentation; add resize-aware backing-store management and profiling before adding more visual effects.
3. Replace the static menu map's duplicated coordinate data with shared city-map metadata so future city changes cannot drift apart.
4. Separate economy, events, and progression once their state contracts are clear.
5. Add deterministic end-to-end scenario tests for multi-line transfers, fleet spacing, phase rewards, and restart behavior.

The next steps are deliberately ordered around correctness first. New cities, campaign progression, and larger passenger populations become much safer once these boundaries are in place.

## v0.18 — map viewport and shared city data

`cityMap.ts` owns the fourteen immutable station definitions; `createCityStations()` gives every run fresh queues. The menu canvas uses these coordinates and the same cached scenery as the playable map.

`MapViewport` owns the uniform world-to-CSS transform and its inverse, bounded zoom (1–3×), cursor-anchored zoom and bounded panning. `ResizeObserver` sizes the backing store; DPR changes trigger a refresh. Hit testing uses the same inverse transform with a CSS-pixel minimum target. Pointer capture separates taps from drags and cancels incomplete gestures. Ordinary wheel scrolling remains page scrolling; Ctrl/Meta+wheel zooms. Fit restores full-city visibility. The station selector offers a keyboard alternative to spatial input.

The release stylesheet `command.css` builds on the existing component styles. No fonts, images or mandatory services are downloaded at runtime. Browser validation covers both desktop and mobile; real-device touch testing remains outstanding.


## v0.18 — service rules and run counters

`RunState` implements the existing engine state contract. The browser and engine share one object; restart uses `reset(startingCredits)` rather than independent assignments. Route/fleet commands and upgrades remain in the composition root and are the next extraction, not a completed engine rewrite.

`servicePlans.ts` is the source of truth for demand multipliers, rescue windows, initial budgets and ranked eligibility. The standard plan keeps the previous tuning. `GameSimulation` accepts optional plan/seed getters; existing callers retain default behavior. Event schedules use a per-shift seed and simulation time: 30–70 seconds, then 220–260 and every 100 seconds afterward. These windows avoid the original stadium phases. Candidate weights change only for connected trips, preserving routing invariants. Museum/university attract arrivals; harbor creates departures.

`ServiceContracts` is DOM-free. Acceptance captures the delivery baseline and simulation timestamp. Only a live simulation tick can award a grant in the application. Deadlines are exclusive; a completion at the deadline expires. Completed or expired offers cannot be accepted again until reset. Coverage measures the largest connected component; hubs require three lines with at least two stops. The browser applies a returned reward exactly once. The five legacy phase missions retain their existing rewards.

A five-minute deterministic scenario checks passenger conservation every tick through multi-line transfers, stadium delivery, all phase boundaries and clean reset. Browser QA exercises the composition and economy that pure engine tests cannot cover. Background Canvas rendering is suspended while the opaque main menu is open; resize uses an observer rather than a per-frame layout read. Full renderer extraction, real-device profiling and stronger route-command boundaries remain future work.


## v0.19 — startup recovery and network commands

A small inline recovery script runs before external CSS and modules. It owns the startup deadline, failure state, accessible retry and the final menu release. This deliberately stays in the HTML so a missing entry bundle cannot disable recovery. `boot.ts` verifies both stylesheet sentinels, waits for the actual engine-ready event, and races that work against the independent failure signal. Failure is terminal until reload: a late import may initialize behind the overlay but cannot reveal the menu. Progress is explicitly estimated, stops on failure and reaches 100% only after readiness. Retry preserves the route/hash and adds a fresh-HTML query. Listeners and animation callbacks are cleaned up. CSP changes must preserve the inline recovery script or provide an equivalent trusted bootstrap.

`NetworkCommands` owns extension/trimming, Undo, Clear, planner replacement, fleet placement, dispatch debiting and full network reset. A no-op endpoint selection does not reset trains. Every topology edit returns riders from the edited fleet to their recorded last stops and replans all station queues. Other fleets retain their positions; `GameSimulation` replans onboard riders at their actual next arrival. A disconnected destination creates a waiting passenger with an empty route, never a delivery. Restoring an edge replans and rescues these passengers.

The existing pure arrival helper retains its legacy empty-route behavior for compatibility; the engine filters disconnected arrivals before passing them to that helper. Route-command tests cover immutable planner snapshots, no-op identity, invalid inputs, passenger conservation, paid dispatch limits, reconnection and reset. Upgrade purchases, phase rewards and rendering extraction remain next; the architecture is still incremental.


## v0.20 — truthful startup, economy and certification

Startup now reports completed checks instead of an asymptotic estimated percentage. Initial HTML and CSS both start at zero. An independent 100ms ticker measures from the inline bootstrap with `performance.now()`, stops on readiness/failure and records the result in the menu. Fresh navigation creates a new timer. `boot.ts` releases the menu immediately after all three checks; no minimum-display sleep remains. Stylesheets use non-render-blocking media until loaded, then activate; boot explicitly waits for every sheet. The inline critical card remains legible while CSS is pending, including its timer and recovery controls.

`RunEconomy` owns upgrade levels, escalating costs, atomic purchases and phase completion. `GameSimulation.step` awards an eligible active-phase reward exactly once, after checking overload and only when the simulation is running. `phaseGoal` and HUD updates are read-only. The stadium preparation goal now requires two or more stations on its service, rather than an isolated stadium marker. Existing standard tuning and prices remain unchanged. Reset clears both upgrade tracks and phase grants.

`serviceChallengeStatus` derives certification progress from elapsed simulation time, deliveries, largest connected component and completed grants. All objectives must hold simultaneously before the exclusive 320-second deadline. It adds no persistent mutable counters. The browser composition ends only the challenge mode on success/deadline; original modes retain their overload behavior. Outcome presentation freezes the simulation and disables playback until restart. Certification records use the existing mode-specific score key.

Coverage calculation is shared by grants and certification. The inspector summarizes actual queued destinations, including a notice when a topology edit leaves riders without a path. Full renderer extraction and persistent run history remain separate future work.
