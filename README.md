# CITYFLOW

A small, original urban-transit strategy game prototype. Build metro lines, connect stations, move passengers, manage capacity, and keep the network flowing.

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

## Current scope — v0.7.0

The shift now has five phase goals with progress tracking and an $8 reward for each completed goal. Objectives include starting passenger service, connecting Grand Stadium, delivering passengers to and from the venue, and reaching a total delivery target. The session report shows completed goals and a locally saved personal best score. The stadium return phase tracks passengers from their original station through transfers.

The map has two interaction modes: Edit route changes the selected line, while Inspect selects stations and reads live queues and connections without changing the network. The mode can also be toggled with the `I` key.

## Previous scope — v0.4

The opening experience now has a dedicated start screen with an original illustrated city map, a clear entry into the first session, a quick explanation of the game loop, and optional ambient audio. The in-game interface has a stronger visual hierarchy and a redesigned performance panel. The simulation remains paused until the player starts or resumes a shift.

## Previous scope — v0.3

The first playable city now includes a detailed coastal map, streets and landmarks, animated metro vehicles, up to three trains per line, route connections, passenger pathfinding and transfers, station queues, station inspection, overload conditions, adaptive time-of-day passenger patterns, an announced stadium event, an operating-funds system, paid capacity/speed upgrades, simulation controls, and synthesized ambient audio.

Passengers earn operating funds when delivered. Capacity and express upgrades have explicit prices. Players can also purchase additional trains for the selected line, with escalating costs and a three-train fleet limit. The station inspector shows queue size, connected lines, pressure, and district-specific guidance.

The project deliberately starts without accounts, a backend, or external music services. The game should first prove that its core loop is fun and understandable.

## Project structure

- `src/main.ts`: simulation, rendering, input, and audio.
- `src/style.css`: game interface and responsive layout.
- `index.html`: application shell.
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
