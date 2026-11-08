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


## v0.21 — direct entry and both Pages publication modes

Supersedes the startup gates described in earlier release notes. There is no loading overlay or hard startup deadline. The static menu is immediately available; `boot.ts` only connects its controls. Missing scripts produce an inline retry, and a late module can still complete automatically after the six-second informational notice. CSS loads through normal stylesheets. It is not polled or treated as a gate for module initialization.

Editable HTML moved to `src/index.html`; Vite now serves `src` and builds to `dist`. Root `index.html` and `assets/` are explicitly generated with `npm run publish:root` and committed for GitHub Pages main/root. This supports branch-based publication without serving raw TypeScript. `.nojekyll` keeps the root publication static. Actions still builds and deploys `dist` as before. The synchronization command is explicit so a normal build does not overwrite tracked root files during environment setup. CI verifies the committed root entry and asset/version consistency; AGENTS.md instructs future edits to refresh the root publication.

Entry checks run on both plain-static routes. Delaying either entry or engine beyond 20 seconds cannot lock out the menu, and releasing the resource enables Start without a reload. The game still uses a real ready signal to enable controls; it never advertises an uninitialized engine as playable.

Playback labels and aria-pressed now derive from actual pause/speed state, including resume from the main menu. Starting moves keyboard focus to map controls; a final report is a labelled region and focuses its restart action. Further screen-reader and real-device usability testing remains outstanding.


## v0.22 — crecimiento, tutorial y decisiones de servicio

`cityGrowthAt` define las etapas 0/30/60/150: 3/6/10/14 estaciones y 1/2/3/4 líneas. El coordinador sincroniza `Station.active`; `NetworkCommands` rechaza estaciones cerradas y el generador de demanda las excluye. No se destruyen estaciones, pasajeros ni aristas existentes al crecer. Los modos de mapa completo conservan sus reglas; la opción progresiva solo se ofrece para urbano y tranquilo. Los récords de crecimiento usan una clave distinta.

`tutorialStep` deriva el siguiente consejo de acciones reales. La presentación conserva su finalización durante el turno y la reinicia al empezar otro. Omitir nunca modifica la simulación ni bloquea funciones. El acceso directo de 0.21 se mantiene, sin puertas de carga.

`operatingPolicies.ts` define velocidad, asientos y parada de cada servicio. Una política de línea se adopta en el tren al embarcar en una estación; el tramo ya iniciado mantiene su política capturada. Las reducciones de capacidad impiden nuevos embarques cuando corresponde y no descartan personas. `NetworkCommands.setPolicy` aplica el coste atómico ($6 en servicio, gratis sin ruta), sin reiniciar la flota. `serviceEstimate` muestra un ciclo e intervalo medio teóricos, sin prometer separación real de vehículos.

`stationCapacity.ts` centraliza nivel, umbral y coste del andén. `RunEconomy.expandPlatform` valida fondos y máximo de dos ampliaciones. El motor usa el mismo umbral al generar demanda y acumular presión; el inspector y el dibujo lo leen también. Reiniciar la red restaura andenes y políticas.

El coordinador renderiza una vez al redimensionar el Canvas, además del ciclo normal, para no dejar un lienzo borrado esperando otro frame. Marcadores y fuentes tienen un tamaño visual mínimo. Las listas de recorrido se reconstruyen solo cuando cambia la topología, conservando el foco de los controles durante actualizaciones del HUD.

La interfaz está traducida directamente en sus fuentes, sin observadores que reescriban el DOM ni dependencias de traducción. IDs de estaciones, modos, fases y almacenamiento siguen estables. Los atajos respetan campos de edición y el menú mantiene pausada la simulación.


## v0.23 — borradores, incidencias e historial

`RouteDraft` conserva una copia de la ruta original y solo permite estaciones habilitadas al abrir el borrador. No modifica el planificador ni la flota. `routeImpact` compara componentes conectados y comprueba destinos de pasajeros en espera y de la flota afectada que volverían a sus últimas paradas. La estimación no equivale a viajes futuros ni garantiza frecuencia. El coordinador pausa y bloquea la reproducción hasta aplicar o descartar, incluso al volver del menú.

`NetworkCommands.replaceRoute` valida todos los IDs y su unicidad antes de mutar. Una ruta idéntica conserva el planificador y los trenes; una edición válida reconstruye una sola vez usando las reglas existentes de conservación y replanificación de pasajeros. La edición directa original permanece disponible.

`operatingIncidents` deriva ventanas temporales y estación a partir del tiempo y la semilla del turno. `GameSimulation` aplica el factor de velocidad únicamente en tramos con un extremo en la estación afectada. Su getter opcional desactivado conserva las reglas anteriores. No sustituye los eventos de demanda ni el estadio. El aviso anticipado es presentación; no modifica la simulación. Las políticas de tren siguen adoptándose en estaciones.

`runHistory` valida JSON, limita entrada y resultados, rechaza modos/desenlaces/números inválidos y reconstruye solo campos conocidos. El coordinador guarda resultados una vez al terminar, o al interrumpir explícitamente un turno con tiempo transcurrido. El historial no contiene una partida reanudable; fallar localStorage no impide jugar. El DOM presenta los datos mediante textContent. Las claves de récord distinguen incidencias sin alterar las antiguas claves sin ellas.

El aviso de mapa abre la pestaña móvil del turno y enfoca su título. La pausa flotante comparte el mismo comando que teclado y barra superior. El HUD se actualiza inmediatamente al pausar para congelar contadores visibles con el motor; durante el juego conserva su frecuencia limitada.


## v0.24 — flota reasignable y observaciones de línea

`NetworkCommands.reassignmentPreview` valida origen/destino y elige el tren menos ocupado sin mutar. `reassign` vuelve a validar y exige fondos finitos para el coste único de $4. La línea de origen conserva al menos una unidad de flota; el destino necesita una ruta activa y no puede superar tres unidades. Un refuerzo sin recorrido se puede recuperar desde la reserva. Los viajeros del tren retirado vuelven a su última estación registrada, con caminos actualizados mediante el planificador existente. Se conserva la identidad del tren trasladado, colocado vacío y espaciado en el destino con su política. Los otros trenes y el planificador conservan identidad y posiciones. No se reconstruye la topología ni se suman entregas.

El coordinador bloquea reasignaciones durante borradores y termina una operación válida en pausa, actualizando inmediatamente todos los controles. Las opciones del selector se regeneran solo cuando cambian origen disponible, flota o destino, conservando la selección cuando sigue siendo válida. El comando de compra también rechaza presupuestos no finitos.

`lineTelemetry` es una lectura sin DOM: suma pasajeros y asientos según la política capturada de cada tren, colas de estaciones activas de la ruta y pasajeros sin camino. No confunde una política previsualizada con la adoptada. La estación prioritaria se ordena por sobrecarga acumulada y luego por proporción de ocupación del andén. Devuelve referencias solo para inspeccionar; no cambia el orden de estaciones ni las colas. Los recuentos no atribuyen automáticamente todos los viajeros de una estación compartida a una línea.

Inspeccionar desde recorrido o prioridad abre la pestaña de estación en móvil y mueve el foco al nombre, manteniendo el recorrido. El nuevo control de refuerzos se agrupa en un desplegable dentro del panel avanzado existente; el inicio progresivo y el tutorial conservan su composición inicial.


## v0.25 — pantalla de juego y presupuesto de construcción

`workspace.css` define la partida como un viewport con mapa flexible y barra de controles siempre presente. Los controles existentes de línea y compras se trasladan al centro de control, conservando IDs, listeners y responsabilidades. Cada pestaña muestra un sistema; el panel tiene scroll propio. Abrir gestión pausa; cerrarla no reanuda. El menú conserva desplazamiento independiente y oculta el espacio de juego para evitar desbordamientos de controles fuera de pantalla.

El Canvas se mide sincrónicamente al entrar, antes de calcular el encuadre inicial: el tamaño del mapa detrás del menú no representa el área jugable. ResizeObserver ignora medidas nulas cuando la partida está oculta. Se conservan la transformación uniforme, backing store según DPR y render al redimensionar. La apertura de barrios restablece la vista general. `stationArt` dibuja iconos vectoriales originales, sin recursos externos. La caché de ciudad sube de resolución cuando hace falta, hasta 2×, y se reutiliza sin reducirla al alejar; se mantiene una sola capa y el tamaño del mundo permanece estable. La guía inicial usa un trazo auxiliar, nunca una conexión real del grafo. Los puntos de cola usan la clase de destino real de cada pasajero.

`ConstructionBudget` posee las compras de material y su reinicio. La capacidad deriva de estaciones abiertas y paquetes comprados; cada tramo de cada línea consume ceil(distancia / 80), mínimo uno. El material es reutilizable, no un segundo saldo monetario que pueda desincronizarse. `constructionQuote` calcula el consumo de una red propuesta y el máximo de seis paradas por línea sin mutar. Capacidad Infinity desactiva ambas restricciones para construcción clásica.

`NetworkCommands` admite un validador de construcción opcional. Extender, recortar mediante selección y reemplazar calculan y validan la ruta completa antes de mutar topología o flota. Los comandos sin validador conservan compatibilidad. Deshacer y vaciar liberan recursos por derivación; nunca eliminan pasajeros. El borrador puede ensayar una ruta excedida, pero Apply queda deshabilitado y el comando vuelve a validar. `RunEconomy` mantiene el resto de compras.

El ajuste de vía se bloquea al comenzar y restaura su preferencia al salir de modos sin restricciones. Los récords añaden el sufijo .track, conservando claves antiguas. El historial acepta el campo opcional limitado y reconstruye solo limitedTrack:true cuando corresponde; los registros anteriores conservan su forma y lectura.

Las suites de navegador utilizan `control-room.mjs` para abrir pestañas con controles visibles y reanudar explícitamente, según las nuevas reglas de pausa. `workspace-smoke.mjs` añade las comprobaciones de viewport completo y presupuesto. No se ha extraído todavía todo el renderizador ni toda la presentación de main.ts.
