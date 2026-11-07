# CITYFLOW architecture notes

This document records the current boundaries and the order in which the original prototype is being separated. The project is intentionally being refactored in small, verifiable steps instead of replacing the working game all at once.

## Current runtime

- `src/boot.ts` loads the application module, reports startup progress, and displays a retry state if startup fails.
- `src/main.ts` is still the application composition root. It currently owns the live game state, simulation update loop, DOM interaction, HUD coordination, and Canvas render orchestration. It is smaller than before, but it is not yet a fully separated engine.
- `src/simulation/pathfinding.ts` owns the transit graph snapshot and shortest-route planner.
- `src/simulation/trainMotion.ts` owns pure train-direction and next-stop calculations.
- `src/simulation/passengerDemand.ts` owns phase-aware trip weighting and injectable weighted candidate selection.
- `src/simulation/shiftPhases.ts` is the single source of truth for phase IDs, boundaries, mission copy and current-phase lookup.
- `src/visuals.ts` owns the fixed Port Azure illustration and its animated river highlights.
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

### Train movement

Train movement helpers are pure functions. They calculate the direction appropriate for an endpoint and the next valid station index without changing a train object. The simulation update remains responsible for applying a direction change. Rendering may ask for the next stop without mutating gameplay state.

### Rendering

Port Azure's roads, parks, trees, buildings, bridges, and landmarks do not change during a run. `drawCityOverlay` now paints this static artwork into an offscreen canvas once, then composites the cached image on later frames. Only river glints are redrawn as animated scenery. If the offscreen context cannot be created, the renderer falls back to drawing the static layer directly.

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

1. Move the remaining passenger lifecycle and boarding/alighting state into a testable passenger system.
2. Move the simulation state and `updateSimulation` into a `GameSimulation` module that has no DOM or Canvas access.
3. Use a fixed simulation step with an accumulator so 1x, 2x, and 3x speeds change simulation time without tying gameplay rules to the display refresh rate.
4. Split Canvas rendering from interaction and presentation; add resize-aware backing-store management and profiling before adding more visual effects.
5. Separate economy, events, and progression once their state contracts are clear.
6. Add deterministic scenario tests for boarding, alighting, transfer handling, queue pressure, phase transitions, and restart behavior.

The next steps are deliberately ordered around correctness first. New cities, campaign progression, and larger passenger populations become much safer once these boundaries are in place.
