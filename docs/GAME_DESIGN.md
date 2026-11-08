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

## v0.18 — Network control presentation

The map is the primary workspace, with line selection above it and playback next to the city title. The warmer paper map contrasts with a navy operations desk. Larger typography and touch controls replace tiny decorative labels. Zoom/pan and a keyboard station selector preserve access to all fourteen stations at small widths. Preview routes show the next hovered connection before editing.


## v0.18 — service plans, district events and grants

Difficulty is a service-plan decision before a shift. Gentle shifts offer time and budget to learn; rush hour increases pressure; free build removes overload defeat while retaining passengers, economy and upgrades. Select New shift to change plans; resuming keeps the current plan. Ranked records are isolated by plan so gentler rules cannot overwrite the original record.

City grants create optional decisions without taking away the original phase goals. Reliable service pays $18 for ten **new** deliveries within 75 simulation seconds. Citywide access pays $14 for one eight-station component within 60 seconds. Transfer hub pays $12 for three active lines at one station within 60 seconds. One grant may be active; each has one attempt per shift. No entry cost or penalty is charged. Pausing stops deadlines. There are no permanent unlocks yet.

Museum openings, ferry arrivals and university open days vary the focus of a shift. They change relative trip weights by 5× at the relevant connected district, not global volume. An advance notice lets players prepare, and an amber ring marks the affected station. The stadium's established arrival/return sequence is preserved.

## Development roadmap after v0.18

- [x] Build identity and readable recovery when stylesheet loading fails.
- [x] Map-led interface, shared menu geography and mobile panel navigation.
- [x] Uniform viewport, DPR, zoom/pan, preview segment and keyboard station access.
- [x] Optional timed grants, district events and selectable service plans.
- [x] Shared run counter object and deterministic five-phase network scenario.
- [ ] Verify the actual Pages publication once the environment permits the host; compare its version and asset responses.
- [x] Move route edits, fleet dispatch, phase rewards and upgrades behind explicit tested engine commands.
- [ ] Extract dynamic Canvas rendering and profile long sessions on real mobile hardware.
- [ ] Playtest grant deadlines and the rush-hour curve with human players; tune using outcomes.
- [ ] Add curated victory scenarios, seeded replay, local run history and persistent unlocks before new cities.

No campaign, second city, daily challenge or permanent progression is advertised as implemented in this release.


## v0.19 — trustworthy loading and edits during service

- The loading card identifies estimated progress, shows a real ready state and keeps the menu inert until startup succeeds. A failed download or 20-second timeout gives one clear retry. Missing entry JavaScript and missing CSS are covered independently of the game engine.
- Selecting the current line endpoint is now a no-op for the fleet, so inspecting or repeating the last tap cannot reset service.
- Removing a transfer no longer strands onboard riders on obsolete instructions. They replan at arrival, wait if disconnected and resume when a useful connection returns. Edits preserve passengers and delivery accounting.
- Route/fleet editing and reset have moved behind tested network commands. The next architecture milestone is moving upgrade and phase-reward accounting out of the HUD, followed by curated victory scenarios and persistent run history. New cities and permanent unlocks remain future content.

### Validation and remaining publication check

See `QA_0.19.md`. The user explicitly requested integration into GitHub main after validation. This does not establish that the Pages deployment completed: direct Pages and API checks remain blocked by the environment's egress policy.


## v0.20 — certification and actionable station information

Network certification is the first optional victory scenario: 30 passengers delivered, eight stations in one connected component and two completed city grants, all before 320 simulation seconds. It uses the existing Port Azure map, standard demand/rescue tuning, $32 opening funds and mode-specific best scores. Both a late deadline and overload can end the challenge. Building routes while paused is supported; the player must resume to earn a grant or advance the certification check. All original modes remain available.

The inspector now lists up to three destinations by queued passenger count. This gives route decisions a concrete basis instead of showing only an aggregate queue. Disconnected riders explicitly request a restored connection. Capacity buttons display the current and next number of seats; express buttons display the next speed multiplier.

Loading starts at zero, shows real seconds and counts completed startup checks. A fast load reveals the menu immediately, with its duration retained. A slow load keeps time without inventing download progress. Recovery remains independent of the engine.

### Next milestones

- [x] Real startup timing, zero reset and no artificial minimum wait.
- [x] Engine-owned purchases and one-time phase grants.
- [x] Optional timed victory scenario with tested victory, deadline and restart.
- [x] Actual destination information and disconnected-passenger advice.
- [ ] Keyboard/focus management for the final report and further screen-reader playtesting.
- [x] Persistent run history with completion reasons and scenario-specific records (v0.23).
- [ ] Extract the dynamic Canvas renderer and profile actual mobile hardware.
- [ ] Human playtesting of the certification curve before additional scenarios/cities.

A campaign, permanent unlocks, daily challenges and additional cities are still future work.


## v0.21 — enter first, connect controls without a blocking screen

The user reported repeated 20-second startup failures and explicitly requested entry without a loading screen. The menu now appears immediately. The sole temporary restriction is the Start button while controls initialize; late downloads recover automatically. Failures stay within an inline notice with Retry, preserving the menu and service-plan explanations.

Publication now supports main/root directly with compiled assets, as well as the Actions build. The entry gate is not reintroduced as a timer, progress animation or stylesheet readiness condition.

Following the accessibility milestone, keyboard focus now moves into map controls on start and to Restart on a final report; playback labels and pressed states match the actual simulation state after returning from the menu. Persistent run history, full rendering extraction and human balancing remain next.


## v0.22 — aprender con una ciudad pequeña

La experiencia recomendada arranca con Barrio Norte, Museo Central y Mercado Central, una línea y un tutorial omisible. A los 30 segundos se abren Puerto Viejo, Jardines del Oeste y Los Manzanos; a los 60, Plaza Cívica, Ribera Este, Universidad y Gran Estadio; a los 150, Clínica del Río, Muelle Sur, Las Colinas y Aeropuerto. El reloj usa tiempo de simulación y la pausa permite planificar sin presión. La ciudad completa se puede elegir desde el menú y sigue siendo el inicio de los modos especializados.

El tutorial enseña con hechos, no con diálogos obligatorios: crear una ruta, transportar a alguien, pausar e inspeccionar. El mapa tiene prioridad; la planificación avanzada aparece tras el primer viaje o al omitir la ayuda. Las cinco fases y el evento del estadio siguen presentes y se muestran en español.

Las políticas no son mejoras estrictamente superiores: local cambia velocidad por asientos; rápido cambia asientos por velocidad y paradas cortas. El cambio cuesta fondos y se adopta en estaciones para evitar alternar gratis a mitad de un tramo. Las estimaciones ayudan a comparar, pero la cola y ocupación real siguen siendo la evidencia principal.

La ampliación de un andén da margen local y compite por fondos con un tren, una mejora global o un cambio de servicio. No aumenta la capacidad de transporte por sí sola. No se añadieron costes recurrentes ni nuevas derrotas al modo libre.

### Hoja de ruta actualizada

- [x] Acceso directo y publicación compilada para main/root.
- [x] Español en interfaz, eventos, estaciones, fases y reportes.
- [x] Inicio de 3 estaciones/1 línea, crecimiento y tutorial breve omisible.
- [x] Servicio por línea con ventajas y costes; comparaciones antes de aplicar.
- [x] Inversión en andenes y presión coherente con el tamaño de estación.
- [x] Media velocidad, atajos, etiquetas legibles y pausa segura en el menú.
- [ ] Probar el equilibrio con personas: políticas, plazos y ritmo de expansión.
- [x] Historial persistente de partidas (v0.23).
- [ ] Escenarios adicionales después de probar el equilibrio.
- [ ] Separar el renderizador dinámico y perfilar móviles reales.
- [ ] Campaña, desbloqueos permanentes y nuevas ciudades, sin anticiparlos en la interfaz.


## v0.23 — decisiones con tiempo para pensar

Planificar permite probar una alternativa sin reiniciar trenes durante cada toque. La vista previa expone alcance y pasajeros sin ruta; aplicar sigue teniendo el coste operativo de recolocar la flota editada según las reglas previas. No se descuentan fondos por dibujar y no se elimina a ningún pasajero. La pausa permanece después de aplicar para revisar transbordos antes de continuar.

Las incidencias introducen una elección temporal entre reforzar una línea, mejorarla o desviar su trazado. No cierran estaciones ni crean nuevas derrotas. Se anuncian, duran poco y son opcionales en los modos tranquilos; Hora pico las incorpora como parte de su desafío. La estación rota con la semilla, pero el calendario es explícito y reproducible. No se promete que cada turno sea un escenario completamente nuevo.

El historial ayuda a comparar modos y resultados sin progreso obligatorio. Las incidencias y la ciudad progresiva quedan identificadas para no mezclar récords de condiciones distintas.

### Siguiente etapa

- [x] Borrador reversible, comparación de conectividad y aplicación atómica.
- [x] Incidencias anunciadas, opcionales y cubiertas por pruebas del motor.
- [x] Historial local de ocho turnos con desenlace.
- [x] Acceso móvil a pausa y avisos desde el mapa.
- [ ] Pruebas con jugadores para equilibrar señales lentas, políticas y ritmo de crecimiento.
- [ ] Extraer el renderizador dinámico y medir rendimiento/memoria en teléfonos reales.
- [ ] Nuevos escenarios con objetivos propios, después de validar los actuales.
- [ ] Guardado reanudable, campaña, ciudades y desbloqueos permanentes siguen pendientes.


## v0.24 — redistribuir recursos en vez de acumularlos

Una incidencia o el regreso del estadio puede hacer más útil un refuerzo en otra línea. Reasignarlo cuesta $4 y reduce la frecuencia de origen mientras mejora la del destino; no aumenta la flota total. El tren menos ocupado devuelve a sus pasajeros a su última parada y se coloca vacío en destino. El aviso previo permite evaluar esa interrupción. La pausa posterior ayuda a revisar el resultado antes de continuar. La línea conserva una unidad base y puede recuperar reservas de una ruta vaciada.

La lectura de línea separa estimaciones de ciclo/frecuencia y observaciones reales de carga/colas. La estación prioritaria ofrece un punto de inspección, no una orden de construcción ni una solución garantizada. Las cifras de estaciones compartidas se identifican para no confundir demanda local con demanda exclusiva de una línea.

### Avance de fases y próximos límites

- [x] Fases de estabilidad/interacción: se conserva acceso directo, crecimiento, tutorial y borradores.
- [x] Jugabilidad/economía: reasignación de refuerzos sin perder pasajeros ni reiniciar la red.
- [x] Controles: inspección accesible desde recorrido y estación prioritaria, también en móvil.
- [x] Arquitectura: lectura de línea aislada y escenario de conservación con traslados sucesivos.
- [ ] Equilibrio con jugadores: coste de reasignación frente a compras por línea y políticas.
- [ ] Separación del renderizador y medición en dispositivos reales.
- [ ] Nuevos escenarios, guardado reanudable y campaña continúan pendientes.
