# CITYFLOW

Un juego original de estrategia de transporte urbano: construye líneas, conecta barrios y adapta el servicio a la demanda de Port Azure.

## Versión actual — 0.24.0 · Refuerza donde hace falta

La planificación de línea incorpora **reasignación de flota**: mueve un tren adicional desde otra línea por **$4**, en lugar de comprar otro. Cada línea conserva un tren base y el destino necesita una ruta de al menos dos estaciones y espacio dentro del máximo de tres trenes. Se retira el tren menos ocupado; antes de confirmar ves cuántos pasajeros volverán a su última estación. Allí esperan y recalculan su camino; no se eliminan. Los demás trenes mantienen posición y pasajeros. La operación deja el turno en pausa.

También puedes recuperar un refuerzo de una línea cuyo recorrido vaciaste. El panel muestra el cambio de flota de origen y destino. No se permiten traslados mientras haya un borrador de ruta abierto.

**Lo que pasa ahora** muestra ocupación/asientos reales de la flota, personas esperando en sus estaciones y viajeros sin camino al destino. Estos datos corresponden a la red actual, aunque estés previsualizando otra ruta o política. Una estación compartida cuenta en cada línea; su cola puede esperar diferentes servicios. Un botón abre la estación con mayor presión para inspeccionarla sin cambiar el recorrido, también desde móvil.

Jugar: https://gomeza2.github.io/metro/ · [Validación de esta versión](docs/QA_0.24.md)

## Planificar, anticipar y aprender

- **Planificar:** el botón de lápiz detiene el tiempo y permite ensayar una ruta discontinua. Compara la mayor red conectada y cuántas personas quedarían sin camino. Aplicar cambia la ruta una sola vez; Descartar o Escape conserva la original. Ambas acciones mantienen la pausa. La edición directa sigue disponible.
- **Incidencias anunciadas:** opcionales desde el menú, activadas siempre en Hora pico. Una señal lenta se anuncia con 15 segundos de anticipación, dura 30 y reduce al 65% la velocidad de los tramos que tocan la estación indicada. Puedes reforzar o desviar el servicio. La primera comienza a los 100 segundos de simulación y se repite cada 120; pausar también detiene estos plazos. Urbano y tranquilo empiezan sin incidencias; sus récords se separan cuando las activas.
- **Controles móviles:** aviso junto al mapa que abre los detalles del incidente y botón flotante para pausar o continuar desde cualquier panel.
- **Últimos turnos:** el menú guarda hasta ocho resultados en este navegador, con viajes, duración de simulación, contratos y motivo de finalización. Incluye turnos interrumpidos al elegir otro modo. Es un resumen local; la partida en curso todavía no se guarda.

Jugar: https://gomeza2.github.io/metro/ · [Validación de la etapa de planificación](docs/QA_0.23.md)

## Una ciudad que crece contigo

CITYFLOW está en español: menú, estaciones, tutorial, fases, contratos, eventos, controles y reportes.

El **turno urbano** y el **turno tranquilo** comienzan, por defecto, con **3 estaciones y 1 línea**. La ciudad crece según el tiempo de simulación:

| Momento | Estaciones disponibles | Líneas disponibles |
| --- | --- | --- |
| Inicio | 3: Barrio Norte, Museo Central y Mercado Central | 1 |
| 30 segundos | 6 | 2 |
| 60 segundos | 10, incluido el Gran Estadio | 3 |
| 150 segundos | Las 14 | Las 4 |

El reloj espera la primera conexión y se detiene al pausar. El estadio abre antes de su fase de preparación. Puedes desactivar «Ciudad progresiva» para jugar con el mapa completo; libre, hora pico y certificación siempre empiezan con toda la ciudad. Los récords progresivos se guardan aparte de los de ciudad completa.

El tutorial se integra a la partida: conectar, observar una entrega, pausar e inspeccionar. Se puede omitir y no bloquea acciones. Las inversiones y la planificación avanzada aparecen después del primer viaje; omitir el tutorial las muestra desde el inicio. No hay pantalla de carga ni bloqueo de 20 segundos.

### Más decisiones de operación

- **Equilibrada:** 6 asientos por tren y la velocidad original.
- **Servicio local:** 9 asientos de base, velocidad ×0,82 y paradas más largas. Útil para trayectos cortos con colas grandes.
- **Servicio rápido:** 4 asientos de base, velocidad ×1,28 y paradas más cortas. Útil para conexiones largas con menos pasajeros.
- Cambiar una política cuesta **$6** con una ruta activa; antes es gratis. Cada tren adopta el cambio en su próxima parada. Los pasajeros a bordo no se eliminan si baja la capacidad.
- El panel de línea permite comparar asientos, ida y vuelta e intervalo medio **estimados** antes de aplicar. Sus botones de estación inspeccionan sin recortar la ruta.
- Un **andén** puede pasar de 12 a 18 plazas por $16 y de 18 a 24 por $34. Da margen ante las colas; no reemplaza la frecuencia de los trenes. Las mejoras globales y la flota original se conservan.

### Controles y calma

½× / 1× / 2× / 3×; Espacio para pausar; 1–4 para elegir una línea habilitada; I para inspeccionar; Z para deshacer; + / − para zoom y 0 para ver toda la ciudad. El selector de estaciones sigue siendo una alternativa al mapa. Las etiquetas y marcadores se ajustan a la escala, y el tutorial queda fuera del área de dibujo.

Se conservan los cinco modos, las cinco fases, los transbordos, los contratos, el estadio, la certificación, la música opcional y el acceso directo. Ambos modos de publicación de Pages siguen soportados: Actions usa `dist/`; `main / root` sirve el HTML y los recursos compilados incluidos en la raíz.

[Validación de la etapa de crecimiento](docs/QA_0.22.md)

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

For **GitHub Actions**, `.github/workflows/deploy.yml` builds the source and publishes `dist/` on pushes to `main`.

For **Deploy from a branch → main → / (root)**, the repository root already contains the compiled site and `.nojekyll`. After changing application source, synchronize the committed static site before delivery:

```bash
npm test
npm run publish:root
```

Commit the changed source together with root `index.html` and generated `assets/`. Normal `npm run build` only writes `dist/`. Do not edit generated root HTML/JS by hand. `AGENTS.md` records this workflow, and CI checks that root assets exist, are relative and match the package version.

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

Start Vite before that command. Pass a different base URL as the first argument to test a static build served under `/metro/`. The check covers four viewports, asset responses, real canvas taps, grants, purchases, inspection, zoom/pan, DPR, restart and CSS failure recovery. Screenshots default to `/tmp/cityflow-qa`. See [latest QA notes](docs/QA_0.21.md) for observed results and limits.

The startup failure suite targets a production build served under `/metro/`:

```bash
PLAYWRIGHT_MODULE=/tmp/cityflow-qa-tools/node_modules/playwright-core/index.mjs node scripts/startup-smoke.mjs http://127.0.0.1:4173/metro/
```

It tests direct menu entry at four sizes, scripts delayed beyond 20 seconds with automatic recovery, missing scripts/styles and retry. Run it against both the Actions build and the committed repository root with a plain static HTTP server.

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
- `src/index.html`: editable accessible application shell.
- Root `index.html` and `assets/`: generated static site for branch-based Pages; refresh with `npm run publish:root`.
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
