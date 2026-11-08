## Current release — v0.16.0 — DOM-free simulation engine

- Extracted the live gameplay tick into `src/simulation/gameSimulation.ts`, a module with no DOM, Canvas, browser storage or presentation imports.
- The engine now owns passenger spawning, train movement, dwell and boarding, station arrivals, transfers, delivery rewards, stadium journey counters and overload detection.
- The presentation layer supplies the current network snapshot, read/write run-state contract, upgrade levels and a single overload callback. Route edits remain visible through the current route-planner snapshot.
- Moved the shared passenger, station, train and line types into `src/simulation/gameTypes.ts`.
- Added deterministic simulation tests for run gating, invalid time, connected passenger creation, boarding, delivery, stadium journeys and overload pressure.

## Previous release — v0.15.0 — Visual clarity and map redesign

- Rebuilt the interface around a consistent high-contrast dark transit-console theme with a bright, readable map.
- Replaced the loose city illustration with a more coherent Port Azure map: coastline, parks, main roads, a smaller set of landmarks and clearer district labels.
- Gave every station a deliberate label position so nearby names are less likely to overlap. Station markers now have a consistent white marker, district ring and dark center.
- The menu map now uses the same city geography and fourteen station positions as the playable map, with one clearly marked sample service instead of four unrelated decorative routes.
- Removed the static passenger-demand chart because it was decorative rather than connected to live simulation data.
- Reworked the opening hint and control labels so a new player can understand the first route: choose a line, select two station markers, then watch the train run.

## Previous release — v0.14.0 — Fixed-step simulation

- Gameplay advances in 1/60-second simulation updates instead of applying one variable delta per rendered frame.
- The 1x, 2x and 3x controls scale accumulated simulation time while preserving a consistent update size.
- Long frame gaps remain capped at 50 ms, and a 12-step per-frame limit prevents excessive catch-up work.
- The clock carries fractional time between frames and resets when a new run starts.
- Rendering and HUD refresh remain independent; train-position interpolation is a later rendering task.

## Previous release — v0.13.0 — Passenger boarding and transfers

- Boarding only selects passengers whose next route edge is served by the arriving train, and available capacity is an explicit input.
- Eligible passengers retain FIFO order.
- At each stop, passengers are classified as continuing on the train, transferring at the station, or delivered to their destination.
- Passenger route progress uses per-passenger copies; this prevents route mutation from leaking into cached or shared route data.
- Economy rewards and mission counters stay in the game coordinator for now so this change preserves the existing scoring balance.

## Previous release — v0.12.0 — Unified shift phase model

- All five phase IDs, timing boundaries, display names, objectives and mission goals now come from one shared configuration.
- Passenger demand, HUD missions, event presentation and the adaptive soundtrack use the same phase lookup.
- Phase start times are inclusive and end times are exclusive. The last phase remains active for the remainder of an endless run.
- The existing weights and time windows are retained. Difficulty balancing will be tuned separately after scenario playtests.

## Previous release — v0.11.0 — Passenger demand system

- Passenger trip weighting is separated from passenger creation and accepts elapsed shift time and city hour as explicit inputs.
- The five shift phases modify passenger origins and destinations, while the selector prioritizes lower-pressure origins when alternatives are available.
- Randomness is injectable for deterministic tests; live gameplay continues to use the browser's standard random source.
- Existing demand factors are preserved during extraction. Tuning is treated as a separate balancing task so architecture changes do not silently change game difficulty.

## Previous release — v0.10.0 — Route engine and rendering foundations

- Shortest-path planning now lives in a standalone simulation module with an immutable network snapshot and per-pair route cache.
- Rebuild the route planner only after route edits; passengers receive their own path arrays so route progression cannot mutate cached paths.
- The city illustration is drawn to an offscreen canvas once per page load. The live frame paints that cached layer plus a small animated river detail.
- Node's native test runner covers routing, disconnected networks, cycles, independent cached paths, and snapshot behavior.
- GitHub Actions must pass simulation tests, strict TypeScript checking, and the Vite production build before a change is integrated.

## Current release — v0.9.0 — Better first launch, phase identity and adaptive audio

- Startup progress remains visible until the TypeScript game module signals that the city, controls, and first render are ready.
- The five phases now use distinct passenger-flow profiles: residential departures, stadium preparation, inbound stadium demand, outbound return demand, and the wider afternoon commute.
- The optional Web Audio soundtrack uses an original synth motif whose notes and tempo respond to phase and network pressure.
- Spotify is an optional external listening shortcut. The game does not require Spotify login, autoplay, or an external music service.
- HUD DOM updates are throttled independently from Canvas rendering.
- Train route lookups used by rendering are read-only; direction changes happen during simulation updates.

## Current release — v0.8.0 — Interface and phase presentation

- Reworked the menu and in-game visual hierarchy for more comfortable reading and clearer actions.
- Added a five-stage overview to the start screen, matching the in-game shift progression.
- Increased map prominence and improved contrast and spacing across controls, dashboard cards, and mission tracking.
- Refined responsive layouts for desktop, tablet, and mobile widths.

# CITYFLOW — Game Design Document

## Product vision

CITYFLOW is an original, minimalist urban-transit strategy game. The player designs a public-transport network for a growing city. The game should be approachable in seconds but reward planning, adaptation, and system-level thinking.

The design takes broad inspiration from the readability of minimalist route-planning games, but its mechanics, code, presentation, setting, and assets are original.

## Design pillars

1. **Readable pressure:** players can see where demand forms and understand why.
2. **Meaningful trade-offs:** capacity, speed, coverage, and transfers should compete for limited resources.
3. **Emergent city patterns:** time, district types, and special events should change passenger demand.
4. **Calm presentation, interesting decisions:** clean typography, restrained colors, gentle animation, and responsive sound.
5. **Fast replay:** a session should create a recognizable story and invite a better attempt.

## Core loop

Observe demand → draw or adjust routes → move passengers → detect bottlenecks → invest in improvements → respond to changing city patterns → review the shift.

## First playable prototype (v0.1)

- One fictional coastal city map.
- Four editable metro lines.
- Stations with different visual identities.
- A train automatically runs each connected line.
- Passengers are generated between connected stations.
- Passengers select a shortest route across the network.
- Interchange transfers are supported.
- Queues build when service is insufficient.
- Prolonged overcrowding ends the session.
- Pause and 1× / 2× / 3× simulation speed.
- Capacity and express-service upgrades.
- Optional original synthesized ambient audio (no Spotify dependency).
- Responsive interface and keyboard pause control.

## Current release — v0.7.0 — Phase objectives and session records

- Every shift phase now has a measurable goal, live progress, and a one-time $8 reward.
- Goals cover first deliveries, connecting the stadium, stadium arrivals, stadium departures, and a total delivery target.
- Passengers retain their origin station so return trips can be counted correctly after route transfers.
- The end-of-shift report shows goals completed, current score, and personal best.
- Personal best is stored locally in the browser; no account or server is required.

## Previous release — v0.4.1 — Safer map interaction

- Added explicit Edit route and Inspect modes to prevent accidental route edits while checking stations.
- Inspection mode selects a station and updates the station inspector without changing any line.
- Keyboard shortcut `I` toggles the map interaction mode.
- Mode control has distinct visual states and responsive mobile layout.

## Previous release — v0.4 — First impressions and presentation

- Dedicated main menu shown before the simulation starts.
- Original illustrated Port Azure network preview with four route colors and station markers.
- Clear start/resume action, city overview, and short explanation of the core loop.
- Optional ambient audio can be enabled from the start screen.
- Simulation time does not advance behind the menu.
- Stronger visual hierarchy in the in-game performance panel and refined responsive layouts.

## Planned systems

### v0.2 — Strategic core and visual identity
- Passenger demand shifts with morning and evening commute patterns.
- Grand Stadium event is announced before its demand spike.
- Passenger delivery earns operating funds.
- Capacity and express upgrades have escalating prices.
- Detailed coastal map overlay: street hierarchy, parks, bridge, stadium, campus, harbor, airfield, and district labels.
- Stations have distinct colors, transfer rings, queue counts, and overload indicators.
- Trains use layered bodywork, windows, directional lights, shadows, and passenger-capacity labels.

### v0.3 — Fleet management and station intelligence
- Up to three trains per metro line.
- Additional trains are purchased using operating funds, with escalating costs.
- New vehicles are dispatched at route positions that maximize spacing from the existing fleet.
- Station inspector shows passenger queue, connected lines, pressure, and district-specific advice.
- Selected stations are highlighted on the map and inspected continuously as queues change.

### Future — City variety
- Multiple maps with rivers, bridges, hills, and different station layouts.
- Distinct district behaviors: residential, business, education, culture, health, and leisure.
- Daily/weekly demand cycles.
- Weather and special events.
- Map modifiers that change strategic priorities.

### Future — Modes and progression
- Endless score mode.
- Curated campaign with objectives.
- Daily seed challenge.
- Sandbox.
- Unlockable maps, visual themes, and vehicle styles.
- Run history and local high scores.

### Future — Audio and polish
- Expand the original adaptive soundtrack with more musical layers and optional intensity controls.
- Station, vehicle, interchange, and UI sound effects.
- Accessibility: color-safe palette, reduced motion, volume controls, clear status labels.
- Performance profiling and device testing.

## Audio direction

Build an original ambient/electronic identity. Music should be layered and adaptive: sparse at low demand, subtly more rhythmic as the city grows, and tense only when the player is under real pressure. The prototype now uses Web Audio synthesis for a quiet, original phase-aware synth motif. Spotify is an optional external listening shortcut; the game does not embed copyrighted tracks or rely on Spotify playback for its core audio. Later soundtrack layers can use commissioned or properly licensed original recordings.

Spotify should be treated as an optional external listening destination, not a required game audio engine. The game must remain fully playable when Spotify is unavailable.

## Technical direction

- Vite + TypeScript.
- Canvas 2D for the map and moving vehicles.
- HTML/CSS for accessible interface controls.
- Simulation state changes remain independent from rendering.
- Shortest-path routing over a graph assembled from active line segments.
- Local storage for settings and high scores.
- No account system or backend until online features genuinely require them.

## Quality gates

- A first-time player can create a route without instructions.
- Passengers only spawn when a valid path exists.
- A player can explain why a station is overloaded.
- Pausing freezes simulation state.
- Changing simulation speed does not change route correctness.
- Route editing never corrupts passenger or train state.
- The map remains usable at laptop and mobile widths.
- Audio is opt-in and respects browser autoplay restrictions.
- The loading screen stays until startup reports ready, and startup errors offer a retry.
- The Spotify shortcut is optional and never blocks the game from starting.
- No third-party proprietary game assets are used.
