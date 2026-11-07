# CITYFLOW architecture notes

This document records the current boundaries and the order in which the original prototype is being separated. The project is intentionally being refactored in small, verifiable steps instead of replacing the working game all at once.

## Current runtime

- `src/boot.ts` loads the application module, reports startup progress, and displays a retry state if startup fails.
- `src/main.ts` is still the application composition root. It currently owns the live game state, simulation update loop, DOM interaction, HUD coordination, and Canvas render orchestration. It is smaller than before, but it is not yet a fully separated engine.
- `src/simulation/pathfinding.ts` owns the transit graph snapshot and shortest-route planner.
- `src/simulation/trainMotion.ts` owns pure train-direction and next-stop calculations.
- `src/simulation/passengerDemand.ts` owns phase-aware trip weighting and injectable weighted candidate selection.
- `src/simulation/shiftPhases.ts` is the single source of truth for phase IDs, boundaries, mission copy and current-phase lookup.
- `src/simulation/passengerOperations.ts` owns pure boarding selection and arrival classification for continuing, transferring and delivered passengers.
- `src/simulation/fixedStepClock.ts` converts variable render-frame deltas into bounded, fixed-size simulation updates.
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

1. Extract the remaining simulation state and tick orchestration into a DOM-free `GameSimulation` module, using the fixed-step clock as its update boundary.
2. Split Canvas rendering from interaction and presentation; add resize-aware backing-store management and profiling before adding more visual effects.
3. Replace the static menu map's duplicated coordinate data with shared city-map metadata so future city changes cannot drift apart.
4. Separate economy, events, and progression once their state contracts are clear.
5. Add deterministic scenario tests for boarding, alighting, transfer handling, queue pressure, phase transitions, and restart behavior.

The next steps are deliberately ordered around correctness first. New cities, campaign progression, and larger passenger populations become much safer once these boundaries are in place.
