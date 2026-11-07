import './style.css';
import { FixedStepClock } from './simulation/fixedStepClock';
import { drawCityOverlay } from './visuals';
import { createRoutePlanner } from './simulation/pathfinding';
import { directionForStation, nextStopIndex } from './simulation/trainMotion';
import { selectPassengerTrip, type PassengerDistrictKind, type PassengerTripCandidate } from './simulation/passengerDemand';
import { getShiftPhase, getShiftPhaseIndex, SHIFT_PHASES } from './simulation/shiftPhases';
import {
  resolvePassengersAtStation,
  selectPassengersForBoarding,
} from './simulation/passengerOperations';

type StationKind = PassengerDistrictKind;
type Passenger = { id: number; origin: string; destination: string; route: string[] };
type Station = {
  id: string; name: string; x: number; y: number; kind: StationKind;
  queue: Passenger[]; overload: number;
};
type Train = {
  id: number; lastStationId: string; stationIndex: number; direction: 1 | -1; progress: number;
  dwell: number; passengers: Passenger[];
};
type MetroLine = {
  id: number; name: string; color: string; stations: string[]; trains: Train[]; fleetSize: number;
};
const WORLD_W = 1200;
const WORLD_H = 760;
const COLORS = ['#e47762', '#5d92bd', '#6a9c81', '#d5a14e'];
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const ctx = canvas.getContext('2d')!;
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

const stations: Station[] = [
  { id: 'harbor', name: 'Old Harbor', x: 145, y: 355, kind: 'commerce', queue: [], overload: 0 },
  { id: 'gardens', name: 'West Gardens', x: 250, y: 205, kind: 'leisure', queue: [], overload: 0 },
  { id: 'north', name: 'North Quarter', x: 420, y: 130, kind: 'residential', queue: [], overload: 0 },
  { id: 'museum', name: 'Museum Mile', x: 530, y: 285, kind: 'culture', queue: [], overload: 0 },
  { id: 'market', name: 'Central Market', x: 390, y: 440, kind: 'commerce', queue: [], overload: 0 },
  { id: 'civic', name: 'Civic Square', x: 650, y: 445, kind: 'civic', queue: [], overload: 0 },
  { id: 'east', name: 'Eastbank', x: 865, y: 350, kind: 'residential', queue: [], overload: 0 },
  { id: 'university', name: 'University', x: 780, y: 175, kind: 'culture', queue: [], overload: 0 },
  { id: 'stadium', name: 'Grand Stadium', x: 1040, y: 235, kind: 'leisure', queue: [], overload: 0 },
  { id: 'heights', name: 'Hillview', x: 1035, y: 510, kind: 'residential', queue: [], overload: 0 },
  { id: 'clinic', name: 'Riverside Clinic', x: 850, y: 610, kind: 'civic', queue: [], overload: 0 },
  { id: 'south', name: 'South Pier', x: 540, y: 620, kind: 'commerce', queue: [], overload: 0 },
  { id: 'orchard', name: 'Orchard Lane', x: 270, y: 590, kind: 'residential', queue: [], overload: 0 },
  { id: 'airport', name: 'Airfield', x: 1090, y: 100, kind: 'commerce', queue: [], overload: 0 },
];

const lines: MetroLine[] = COLORS.map((color, index) => ({
  id: index, name: `Line ${index + 1}`, color, stations: [], trains: [], fleetSize: 1,
}));

// Rebuilt only when a route changes; passenger spawning reuses the same graph snapshot.
let routePlanner = createRoutePlanner(stations, lines);

let selectedLine = 0;
let focusedStation: Station | null = null;
let passengerId = 1;
let trainSequence = 1;
let elapsed = 0;
let demandClock = 0;
let score = 0;
let credits = 28;
let stadiumArrivalsDelivered = 0;
let stadiumDeparturesDelivered = 0;
const completedPhaseObjectives = new Set<number>();
const BEST_SCORE_KEY = 'cityflow.bestScore.v1';
function readBestScore(): number {
  try {
    const stored = Number(localStorage.getItem(BEST_SCORE_KEY) ?? 0);
    return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0;
  } catch {
    return 0;
  }
}
let bestScore = readBestScore();
const PHASE_REWARD = 8;
let paused = false;
let simulationSpeed = 1;
let capacityLevel = 1;
let expressLevel = 1;
let gameOver = false;
let gameStarted = false;
let routeEditMode = true;
let hintDismissed = false;
let soundOn = false;
let soundStep = 0;
let soundTimer: number | null = null;
let hoveredStation: Station | null = null;
const simulationClock = new FixedStepClock({
  stepSeconds: 1 / 60,
  maxFrameDeltaSeconds: 0.05,
  maxStepsPerFrame: 12,
});
let lastFrame = 0;
let hudClock = 0;
let soundContext: AudioContext | null = null;
let soundMaster: GainNode | null = null;

const stationById = (id: string) => stations.find((station) => station.id === id)!;
const totalWaiting = () => stations.reduce((sum, station) => sum + station.queue.length, 0);
const totalOnTrains = () => lines.reduce((sum, line) => sum + line.trains.reduce((fleet, train) => fleet + train.passengers.length, 0), 0);
const activeLines = () => lines.filter((line) => line.stations.length >= 2).length;
const cityHour = () => Math.floor((8 * 60 + Math.floor(elapsed * 2.2)) / 60) % 24;
const capacityCost = () => 12 + (capacityLevel - 1) * 14;
const expressCost = () => 10 + (expressLevel - 1) * 12;
const dispatchCost = (line: MetroLine) => 18 + Math.max(0, line.fleetSize - 1) * 16;

function normalizeTrainDirection(line: MetroLine, train: Train): void {
  train.direction = directionForStation(train.stationIndex, train.direction, line.stations.length);
}

function nextTrainStop(line: MetroLine, train: Train): Station | null {
  const targetIndex = nextStopIndex(train.stationIndex, train.direction, line.stations.length);
  const id = targetIndex === null ? undefined : line.stations[targetIndex];
  return id ? stationById(id) : null;
}

function createTrain(line: MetroLine, stationIndex: number, direction: 1 | -1, dwell = 0.7): Train {
  const stationId = line.stations[stationIndex];
  if (!stationId) throw new Error('Cannot dispatch a train without a valid station.');
  return {
    id: trainSequence++,
    lastStationId: stationId,
    stationIndex,
    direction,
    progress: 0,
    dwell,
    passengers: [],
  };
}

function createSpacedTrain(line: MetroLine): Train {
  // Place each vehicle at the route position with the most space from the existing fleet.
  let bestIndex = line.trains.length % 2 === 1 ? line.stations.length - 1 : 0;
  let bestSpacing = -1;
  for (let candidate = 0; candidate < line.stations.length; candidate += 1) {
    const spacing = line.trains.length
      ? Math.min(...line.trains.map((train) => Math.abs(candidate - (train.stationIndex + train.direction * train.progress))))
      : line.stations.length;
    if (spacing > bestSpacing) {
      bestSpacing = spacing;
      bestIndex = candidate;
    }
  }
  const direction: 1 | -1 = line.trains.length % 2 === 0 ? -1 : 1;
  return createTrain(line, bestIndex, direction, 1.1);
}

function resetFleet(line: MetroLine): void {
  for (const train of line.trains) {
    const returnStation = stations.find((station) => station.id === train.lastStationId);
    returnStation?.queue.push(...train.passengers);
  }
  line.trains = [];
  if (line.stations.length >= 2) {
    line.trains.push(createTrain(line, 0, 1));
    while (line.trains.length < line.fleetSize) line.trains.push(createSpacedTrain(line));
  }
}

function dispatchTrain(line: MetroLine): void {
  if (line.stations.length < 2 || line.fleetSize >= 3 || gameOver) return;
  line.trains.push(createSpacedTrain(line));
  line.fleetSize += 1;
  $('#map-status').textContent = `${line.name.toUpperCase()} · ADDITIONAL TRAIN DISPATCHED`;
  updateHUD();
}

function replanWaitingPassengers(): void {
  for (const station of stations) {
    for (const passenger of station.queue) {
      passenger.route = [...(routePlanner.findRoute(station.id, passenger.destination) ?? [])];
    }
  }
}

function rebuildRoute(line: MetroLine): void {
  const seen = new Set<string>();
  line.stations = line.stations.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  resetFleet(line);
  routePlanner = createRoutePlanner(stations, lines);
  replanWaitingPassengers();
  updateHUD();
}

function updateStartHint(): void {
  const hint = $('#start-hint');
  const line = lines[selectedLine];
  if (!line || hintDismissed || line.stations.length >= 2) {
    hint.classList.add('hidden');
    return;
  }
  hint.classList.remove('hidden');
  const number = hint.querySelector<HTMLElement>('.hint-number');
  const title = hint.querySelector<HTMLElement>('strong');
  const detail = hint.querySelector<HTMLElement>('small');
  if (!number || !title || !detail) return;
  if (line.stations.length === 1) {
    const firstStation = stationById(line.stations[0]!);
    number.textContent = '02';
    title.textContent = 'Choose a second station';
    detail.textContent = `Connect ${firstStation.name} to another stop to start service.`;
  } else {
    number.textContent = '01';
    title.textContent = selectedLine === 0 ? 'Start your first line' : `Start ${line.name}`;
    detail.textContent = 'Choose a color, then select two stations. The clock waits for your first connection.';
  }
}

function addStationToSelectedLine(station: Station): void {
  if (!routeEditMode) {
    focusedStation = station;
    updateStationInspector();
    $('#map-status').textContent = `${station.name.toUpperCase()} · STATION INSPECTION`;
    return;
  }
  const line = lines[selectedLine];
  if (!line || gameOver) return;
  const existingIndex = line.stations.indexOf(station.id);
  if (existingIndex >= 0) {
    line.stations = line.stations.slice(0, existingIndex + 1);
  } else {
    line.stations.push(station.id);
  }
  rebuildRoute(line);
  focusedStation = station;
  updateStationInspector();
  updateStartHint();
  $('#map-status').textContent = line.stations.length < 2
    ? 'SELECT ANOTHER STATION TO START SERVICE'
    : `${line.name.toUpperCase()} · ${line.stations.length} STATIONS CONNECTED`;
}

function undoRoute(): void {
  const line = lines[selectedLine];
  if (!line || !line.stations.length || gameOver) return;
  line.stations.pop();
  rebuildRoute(line);
  updateStartHint();
  $('#map-status').textContent = line.stations.length >= 2
    ? `${line.name.toUpperCase()} · ROUTE UPDATED`
    : 'ROUTE CLEARED · SELECT A STATION';
}

function clearRoute(): void {
  const line = lines[selectedLine];
  if (!line || gameOver || !line.stations.length) return;
  line.stations = [];
  rebuildRoute(line);
  updateStartHint();
  $('#map-status').textContent = `${line.name.toUpperCase()} · READY TO BUILD`;
}

function spawnPassenger(): void {
  const connected: PassengerTripCandidate<Station>[] = [];

  for (const from of stations) {
    if (from.queue.length >= 16) continue;

    for (const to of stations) {
      if (from.id === to.id || to.queue.length >= 16) continue;
      const route = routePlanner.findRoute(from.id, to.id);
      if (!route || route.length < 2) continue;

      connected.push({
        from: { id: from.id, kind: from.kind, queueLength: from.queue.length },
        to: { id: to.id, kind: to.kind, queueLength: to.queue.length },
        route,
        payload: from,
      });
    }
  }

  const selected = selectPassengerTrip(connected, { elapsed, hour: cityHour() });
  if (!selected) return;

  selected.payload.queue.push({
    id: passengerId++,
    origin: selected.from.id,
    destination: selected.to.id,
    route: [...selected.route],
  });
}

function boardPassengers(line: MetroLine, train: Train, station: Station): void {
  const next = nextTrainStop(line, train);
  if (!next) return;

  const availableSeats = 6 * capacityLevel - train.passengers.length;
  const result = selectPassengersForBoarding(
    station.queue,
    station.id,
    next.id,
    availableSeats,
  );
  if (!result.boarding.length) return;

  station.queue = result.waiting;
  train.passengers.push(...result.boarding);
}

function arriveAtStation(line: MetroLine, train: Train, station: Station): void {
  normalizeTrainDirection(line, train);
  const next = nextTrainStop(line, train);
  const result = resolvePassengersAtStation(
    train.passengers,
    station.id,
    next?.id ?? null,
  );

  for (const passenger of result.delivered) {
    score += 1;
    credits += 2;
    if (passenger.destination === 'stadium') stadiumArrivalsDelivered += 1;
    if (passenger.origin === 'stadium' && passenger.destination === station.id) {
      stadiumDeparturesDelivered += 1;
    }
  }

  if (result.transferring.length) station.queue.push(...result.transferring);
  train.passengers = result.continuing;
  boardPassengers(line, train, station);
}

function updateSimulation(dt: number): void {
  if (!gameStarted || paused || gameOver || activeLines() === 0) return;
  elapsed += dt;
  demandClock += dt;
  const spawnInterval = Math.max(1.7, 5.2 - elapsed / 150);
  while (demandClock >= spawnInterval) {
    demandClock -= spawnInterval;
    spawnPassenger();
    if (elapsed > 90 && Math.random() < 0.22) spawnPassenger();
  }

  for (const line of lines) {
    if (line.stations.length < 2) continue;
    for (const train of line.trains) {
      normalizeTrainDirection(line, train);
      if (train.dwell > 0) {
        train.dwell = Math.max(0, train.dwell - dt);
        if (train.dwell === 0) {
          const currentId = line.stations[train.stationIndex];
          if (currentId) boardPassengers(line, train, stationById(currentId));
        }
        continue;
      }
      const currentId = line.stations[train.stationIndex];
      const next = nextTrainStop(line, train);
      if (!currentId || !next) continue;
      const current = stationById(currentId);
      const distance = Math.hypot(next.x - current.x, next.y - current.y);
      const travelUnitsPerSecond = 105 * expressLevel;
      train.progress += (dt * travelUnitsPerSecond) / Math.max(1, distance);
      if (train.progress >= 1) {
        train.stationIndex += train.direction;
        train.lastStationId = next.id;
        train.progress = 0;
        train.dwell = 0.45;
        arriveAtStation(line, train, next);
      }
    }
  }

  for (const station of stations) {
    if (station.queue.length > 12) station.overload += dt;
    else station.overload = Math.max(0, station.overload - dt * 0.7);
    if (station.overload >= 17) endGame(station);
  }


}

function endGame(station: Station): void {
  if (gameOver) return;
  gameOver = true;
  paused = true;
  $('#game-over-copy').textContent = `${station.name} stayed overcrowded for too long. The city needs more capacity or a better connection.`;
  const newRecord = score > bestScore;
  if (newRecord) {
    bestScore = score;
    try { localStorage.setItem(BEST_SCORE_KEY, String(bestScore)); } catch { /* Score remains available for this session. */ }
  }
  $('#final-score').textContent = String(score).padStart(3, '0');
  $('#final-best').textContent = String(bestScore).padStart(3, '0');
  $('#final-phases').textContent = `${completedPhaseObjectives.size} / 5`;
  $('#record-state').textContent = newRecord ? 'NEW PERSONAL BEST' : `PERSONAL BEST · ${String(bestScore).padStart(3, '0')}`;
  $('#game-over').classList.remove('hidden');
  $('#pause-button').innerHTML = '<span>▶</span> Resume';
  $('#map-status').textContent = 'SERVICE INTERRUPTED · NETWORK OVERLOAD';
  updateHUD();
}

function drawBackground(): void {
  // The city artwork is owned by visuals.ts. The game frame only establishes
  // a stable base before the cached map layer is composited.
  ctx.fillStyle = '#edf1e8';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
}


function drawLine(line: MetroLine): void {
  if (line.stations.length < 2) return;
  const points = line.stations.map(stationById);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.shadowColor = 'rgba(30,55,41,.2)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.strokeStyle = 'rgba(255,255,250,.96)';
  ctx.lineWidth = 19;
  ctx.stroke();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = line.color;
  ctx.lineWidth = 10;
  ctx.stroke();

  if (line.id === selectedLine) {
    ctx.strokeStyle = 'rgba(255,255,255,.92)';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 9]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}


type StationLabelAnchor = 'left' | 'center' | 'right';

const STATION_LABEL_LAYOUT: Record<string, { dx: number; dy: number; anchor: StationLabelAnchor }> = {
  harbor: { dx: -18, dy: 2, anchor: 'right' },
  gardens: { dx: -17, dy: -22, anchor: 'right' },
  north: { dx: 0, dy: -31, anchor: 'center' },
  museum: { dx: 0, dy: -34, anchor: 'center' },
  market: { dx: -18, dy: 30, anchor: 'right' },
  civic: { dx: 18, dy: 29, anchor: 'left' },
  east: { dx: 22, dy: -15, anchor: 'left' },
  university: { dx: 0, dy: -30, anchor: 'center' },
  stadium: { dx: 0, dy: -53, anchor: 'center' },
  heights: { dx: 22, dy: 0, anchor: 'left' },
  clinic: { dx: 17, dy: 33, anchor: 'left' },
  south: { dx: 0, dy: 39, anchor: 'center' },
  orchard: { dx: -18, dy: 27, anchor: 'right' },
  airport: { dx: -8, dy: -32, anchor: 'center' },
};

function drawStation(station: Station): void {
  const connectedLines = lines.filter((line) => line.stations.includes(station.id));
  const selected = lines[selectedLine]?.stations.includes(station.id) ?? false;
  const focused = focusedStation?.id === station.id;
  const hovered = hoveredStation?.id === station.id;
  const palette: Record<StationKind, string> = {
    residential: '#719b7c',
    commerce: '#d19b58',
    culture: '#7b91b6',
    civic: '#579b98',
    leisure: '#bd846e',
  };
  const accent = palette[station.kind];
  const radius = connectedLines.length > 1 ? 13 : 11;

  if (station.queue.length > 0 || hovered || selected || focused) {
    const glow = ctx.createRadialGradient(station.x, station.y, 5, station.x, station.y, 42);
    glow.addColorStop(0, station.queue.length > 7 ? 'rgba(222,125,89,.27)' : 'rgba(255,255,255,.42)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(station.x, station.y, 42, 0, Math.PI * 2);
    ctx.fill();
  }

  if (hovered || selected || focused) {
    ctx.beginPath();
    ctx.arc(station.x, station.y, focused ? 27 : 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,250,.68)';
    ctx.fill();
    ctx.strokeStyle = focused ? '#294b38' : selected ? accent : '#fffefa';
    ctx.lineWidth = focused ? 2.5 : 1.8;
    ctx.stroke();
  }

  // White marker, district-color ring and dark center stay readable over every district.
  ctx.save();
  ctx.shadowColor = 'rgba(35,54,41,.22)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.arc(station.x, station.y, radius + 5, 0, Math.PI * 2);
  ctx.fillStyle = '#fffefa';
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(station.x, station.y, radius + 1, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(station.x, station.y, radius - 3, 0, Math.PI * 2);
  ctx.fillStyle = '#244334';
  ctx.fill();

  const symbols: Record<StationKind, string> = {
    residential: '⌂',
    commerce: '¤',
    culture: '✳',
    civic: '+',
    leisure: '◇',
  };
  ctx.fillStyle = '#f6f7ed';
  ctx.font = '700 10px Inter, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbols[station.kind], station.x, station.y + .5);

  if (connectedLines.length > 1) {
    connectedLines.forEach((line, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / connectedLines.length;
      ctx.beginPath();
      ctx.arc(station.x, station.y, radius + 9, angle, angle + .76);
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    });
  }

  // Queue dots sit close to the station so they read as local passenger demand.
  const visibleQueue = Math.min(station.queue.length, 5);
  for (let index = 0; index < visibleQueue; index += 1) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(visibleQueue, 1);
    const dotX = station.x + Math.cos(angle) * 23;
    const dotY = station.y + Math.sin(angle) * 23;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fffefa';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dotX, dotY, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = '#d9944e';
    ctx.fill();
  }

  if (station.overload > 0) {
    ctx.beginPath();
    ctx.arc(station.x, station.y, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(station.overload / 17, 1));
    ctx.strokeStyle = '#d66f5d';
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  // Each station has a deliberate label anchor to stop names colliding with nearby nodes.
  const label = STATION_LABEL_LAYOUT[station.id] ?? { dx: 18, dy: -16, anchor: 'left' as const };
  ctx.font = '700 12px Inter, "Segoe UI", sans-serif';
  ctx.textAlign = label.anchor;
  ctx.textBaseline = 'middle';
  const labelX = station.x + label.dx;
  const labelY = station.y + label.dy;
  const labelWidth = ctx.measureText(station.name).width;
  const showQueueCount = station.queue.length >= 4;
  const boxWidth = labelWidth + 18;
  const boxHeight = showQueueCount ? 35 : 25;
  const boxX = label.anchor === 'left'
    ? labelX - 9
    : label.anchor === 'right'
      ? labelX - labelWidth - 9
      : labelX - labelWidth / 2 - 9;
  const boxY = labelY - 13;

  ctx.save();
  ctx.shadowColor = 'rgba(35,54,41,.12)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 7);
  ctx.fillStyle = 'rgba(255,255,250,.97)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,207,190,.85)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#294538';
  ctx.font = '700 12px Inter, "Segoe UI", sans-serif';
  ctx.textAlign = label.anchor;
  ctx.fillText(station.name, labelX, labelY);
  if (showQueueCount) {
    ctx.fillStyle = station.queue.length >= 10 ? '#bb6752' : '#9a7442';
    ctx.font = '700 8px ui-monospace, monospace';
    ctx.fillText(`${station.queue.length} WAITING`, labelX, labelY + 13);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}


function drawTrain(line: MetroLine, train: Train): void {
  if (line.stations.length < 2) return;
  const currentId = line.stations[train.stationIndex];
  const current = currentId ? stationById(currentId) : null;
  const next = nextTrainStop(line, train);
  if (!current || !next) return;
  const x = current.x + (next.x - current.x) * train.progress;
  const y = current.y + (next.y - current.y) * train.progress;
  const angle = Math.atan2(next.y - current.y, next.x - current.x);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 27);
  halo.addColorStop(0, line.color + '50');
  halo.addColorStop(1, line.color + '00');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 27, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'rgba(31,47,39,.25)';
  ctx.shadowBlur = 11;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#fffdf6';
  ctx.beginPath();
  ctx.roundRect(-20, -10, 40, 20, 8);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = line.color;
  ctx.beginPath();
  ctx.roundRect(-16, -7, 32, 14, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.88)';
  ctx.beginPath();
  ctx.roundRect(-10, -4, 7, 5, 2);
  ctx.roundRect(1, -4, 7, 5, 2);
  ctx.fill();
  ctx.fillStyle = '#30463d';
  ctx.beginPath();
  ctx.arc(13, 0, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#536b5e';
  ctx.beginPath();
  ctx.arc(-11, 9, 2.5, 0, Math.PI * 2);
  ctx.arc(11, 9, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (train.passengers.length > 0) {
    ctx.fillStyle = '#3d5549';
    ctx.font = '700 8px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(train.passengers.length) + '/' + (6 * capacityLevel), x, y - 17);
  }
}

function render(): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(width / WORLD_W, 0, 0, height / WORLD_H, 0, 0);
  drawBackground();
  drawCityOverlay(ctx, elapsed);
  for (const line of lines) drawLine(line);
  for (const station of stations) drawStation(station);
  for (const line of lines) {
    for (const train of line.trains) drawTrain(line, train);
  }
}

function getPhaseGoal(index: number): { current: number; target: number } {
  switch (index) {
    case 0: return { current: score, target: 5 };
    case 1: return { current: lines.some((line) => line.stations.includes('stadium')) ? 1 : 0, target: 1 };
    case 2: return { current: stadiumArrivalsDelivered, target: 5 };
    case 3: return { current: stadiumDeparturesDelivered, target: 5 };
    default: return { current: score, target: 55 };
  }
}

function updatePhaseMission(phaseIndex: number): void {
  const phase = SHIFT_PHASES[phaseIndex]!;
  const goal = getPhaseGoal(phaseIndex);
  const completed = completedPhaseObjectives.has(phaseIndex);
  const nowComplete = goal.current >= goal.target;
  if (!completed && nowComplete && gameStarted && !gameOver) {
    completedPhaseObjectives.add(phaseIndex);
    credits += PHASE_REWARD;
    $('#map-status').textContent = `PHASE GOAL COMPLETE · +${PHASE_REWARD} REWARD`;
  }
  const claimed = completedPhaseObjectives.has(phaseIndex);
  $('#phase-name').textContent = phase.name;
  $('#phase-objective').textContent = phase.objective;
  $('#phase-goal').textContent = phase.goal;
  $('#phase-state').textContent = claimed ? 'CLEARED' : 'IN PROGRESS';
  $('#phase-state').classList.toggle('is-complete', claimed);
  $('#phase-progress').setAttribute('style', `width:${Math.min(100, (Math.max(0, elapsed - phase.start) / (phase.end - phase.start)) * 100)}%`);
  $('#phase-count').textContent = `PHASE ${String(phaseIndex + 1).padStart(2, '0')} / 05`;
  $('#mission-progress-label').textContent = `${Math.min(goal.current, goal.target)} / ${goal.target}`;
  $('#mission-progress-bar').setAttribute('style', `width:${Math.min(100, (goal.current / goal.target) * 100)}%`);
  $('#mission-reward').textContent = claimed ? 'REWARD CLAIMED' : `REWARD +${PHASE_REWARD}`;
}

type CityEventPresentation = {
  key: string;
  title: string;
  copy: string;
  state: string;
  tip?: string;
};

let lastDisplayedCityEvent: string | null = null;

function updateCityEvent(): void {
  const phase = getShiftPhase(elapsed);
  let event: CityEventPresentation;

  switch (phase.id) {
    case 'morning-network':
      event = {
        key: 'morning-commute',
        title: 'Morning commute',
        copy: 'The city is starting its day.',
        state: 'ACTIVE',
        tip: 'Tip: one well-connected interchange can be more useful than three isolated lines.',
      };
      break;
    case 'stadium-preparation':
      event = {
        key: 'stadium-preparation',
        title: 'Match starts soon',
        copy: 'Grand Stadium · prepare extra service.',
        state: 'UP NEXT',
        tip: 'A major event is approaching at Grand Stadium. Connect it early so passengers have time to arrive.',
      };
      break;
    case 'stadium-arrival':
      event = {
        key: 'stadium-arrival',
        title: 'Grand Stadium event',
        copy: 'Passenger demand is surging near the arena.',
        state: 'LIVE',
        tip: 'The stadium is attracting extra passengers. A direct connection can reduce pressure on nearby stations.',
      };
      break;
    case 'post-event-return':
      event = {
        key: 'stadium-return',
        title: 'Crowds heading home',
        copy: 'The post-match rush is moving across town.',
        state: 'RUSH HOUR',
        tip: 'Passengers are now leaving Grand Stadium. Keep a direct route toward residential districts open.',
      };
      break;
    case 'afternoon-commute':
      event = cityHour() >= 16
        ? {
            key: 'evening-commute',
            title: 'Evening commute',
            copy: 'Commuters are heading back across the city.',
            state: 'ACTIVE',
            tip: 'The evening commute is spreading across the network. Add a train or strengthen the busiest route.',
          }
        : {
            key: 'afternoon-build-up',
            title: 'Afternoon build-up',
            copy: 'Commuter demand is building before the evening peak.',
            state: 'BUILDING',
            tip: 'Use this quieter window to rebalance routes before evening departures begin.',
          };
      break;
  }

  if (event.key === lastDisplayedCityEvent) return;
  lastDisplayedCityEvent = event.key;
  $('#event-title').textContent = event.title;
  $('#event-copy').textContent = event.copy;
  $('.event-state').textContent = event.state;
  if (event.tip) $('#tip-text').textContent = event.tip;
}

function updateHUD(): void {
  $('#score').textContent = String(score).padStart(3, '0');
  $('#best-score').textContent = String(bestScore).padStart(3, '0');
  const phaseIndex = getShiftPhaseIndex(elapsed);
  updatePhaseMission(phaseIndex);
  updateCityEvent();
  $('#in-transit').textContent = String(totalOnTrains());
  $('#waiting').textContent = String(totalWaiting());
  $('#active-lines').textContent = `${activeLines()} / 4`;
  const selectedFleet = lines[selectedLine];
  $('#fleet-state').textContent = selectedFleet ? `Fleet · ${selectedFleet.fleetSize}/3 trains` : 'Fleet · 0/3 trains';
  $('#dispatch-cost').textContent = selectedFleet && selectedFleet.fleetSize < 3 ? '$' + String(dispatchCost(selectedFleet)) : 'MAX';
  $('#credits').textContent = '$' + String(credits);
  $('.capacity-cost').textContent = capacityLevel >= 3 ? 'MAX' : '$' + String(capacityCost());
  $('.express-cost').textContent = expressLevel >= 3 ? 'MAX' : '$' + String(expressCost());
  const minutes = 8 * 60 + Math.floor(elapsed * 2.2);
  $('#city-time').textContent = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const connected = activeLines() > 0;
  const queueTotal = totalWaiting();
  const flow = connected ? Math.max(8, Math.min(100, 100 - (queueTotal / Math.max(1, stations.length * 0.85)) * 100)) : 0;
  $('#flow-bar').setAttribute('style', `width:${flow}%`);
  $('#flow-label').textContent = !connected ? 'Waiting for service' : flow > 70 ? 'Smooth connections' : flow > 38 ? 'Building pressure' : 'Network under stress';
  $('#flow-note').textContent = !connected ? 'Connect stations to begin moving passengers.' : `${queueTotal} passengers are waiting across the network.`;
  $('#capacity-state').textContent = `Train capacity ×${capacityLevel}`;
  $('#express-state').textContent = `Train speed ×${expressLevel}`;
  $('#capacity-button').classList.toggle('maxed', capacityLevel >= 3 || credits < capacityCost());
  $('#speed-button').classList.toggle('maxed', expressLevel >= 3 || credits < expressCost());
  $('#dispatch-button').classList.toggle('maxed', !selectedFleet || selectedFleet.stations.length < 2 || selectedFleet.fleetSize >= 3 || credits < dispatchCost(selectedFleet));
  updateStationInspector();
  const modeButton = $('#map-mode-button');
  modeButton.classList.toggle('inspect-mode', !routeEditMode);
  modeButton.setAttribute('aria-pressed', String(!routeEditMode));
  modeButton.innerHTML = routeEditMode ? '<span class="mode-icon">⌁</span><span><b>Edit route</b><small>Tap stations to connect</small></span>' : '<span class="mode-icon">⌖</span><span><b>Inspect</b><small>Tap stations to view</small></span>';
  const picker = $('#line-picker');
  picker.querySelectorAll<HTMLButtonElement>('.line-swatch').forEach((button) => {
    button.classList.toggle('selected', Number(button.dataset.line) === selectedLine);
    const line = lines[Number(button.dataset.line)];
    button.classList.toggle('has-route', (line?.stations.length ?? 0) >= 2);
    const count = button.querySelector('span');
    if (count && line) count.textContent = String(line.stations.length).padStart(2, '0');
  });
}

function updateStationInspector(): void {
  const station = focusedStation;
  if (!station) {
    $('#station-icon').textContent = '⌖';
    $('#station-name').textContent = 'Select a station';
    $('#station-kind').textContent = 'Station overview';
    $('#station-queue').textContent = '—';
    $('#station-lines').textContent = '—';
    $('#station-pressure').textContent = 'AWAITING SELECTION';
    $('#station-advice').textContent = 'Click any station on the map to inspect its passenger queue, serving lines, and local demand.';
    return;
  }
  const labels: Record<StationKind, string> = {
    residential: 'Residential district',
    commerce: 'Commercial district',
    culture: 'Culture & education',
    civic: 'Civic services',
    leisure: 'Leisure & events',
  };
  const symbols: Record<StationKind, string> = {
    residential: '⌂', commerce: '¤', culture: '✳', civic: '+', leisure: '◇',
  };
  const servedBy = lines.filter((line) => line.stations.includes(station.id));
  const pressure = station.queue.length >= 13 ? 'CRITICAL' : station.queue.length >= 7 ? 'BUSY' : 'STABLE';
  $('#station-icon').textContent = symbols[station.kind];
  $('#station-name').textContent = station.name;
  $('#station-kind').textContent = labels[station.kind];
  $('#station-queue').textContent = String(station.queue.length);
  $('#station-lines').textContent = servedBy.length ? servedBy.map((line) => String(line.id + 1).padStart(2, '0')).join(' · ') : 'None';
  $('#station-pressure').textContent = pressure;
  $('#station-pressure').setAttribute('data-pressure', pressure.toLowerCase());
  const advice: Record<StationKind, string> = {
    residential: 'Residential trips concentrate around the morning departure and evening return. Make sure this district has useful connections in both directions.',
    commerce: 'Commercial areas attract midday and afternoon trips. Short connections to residential and civic stations can ease pressure.',
    culture: 'Education and cultural destinations create daytime demand. Interchanges can help passengers arrive from several districts.',
    civic: 'Civic services generate steady essential journeys. Avoid leaving this station isolated from the main network.',
    leisure: 'Leisure destinations can experience sharp event-driven demand. Build capacity before the crowd arrives.',
  };
  $('#station-advice').textContent = station.overload > 0
    ? `${station.queue.length} people are waiting here. Add service or connect another route before the overload timer fills.`
    : advice[station.kind];
}

function selectLine(index: number): void {
  selectedLine = index;
  updateHUD();
  updateStartHint();
  const line = lines[selectedLine];
  $('#map-status').textContent = line?.stations.length
    ? `${line.name.toUpperCase()} SELECTED · ${line.stations.length} STATIONS`
    : `${line?.name.toUpperCase()} SELECTED · CHOOSE YOUR FIRST STATION`;
}

function startGame(): void {
  gameStarted = true;
  paused = false;
  document.body.classList.remove('menu-active');
  $('#main-menu').classList.add('is-closed');
  $('#main-menu').setAttribute('aria-hidden', 'true');
  $('#map-status').textContent = 'CLOCK ON HOLD · CONNECT TWO STATIONS TO START THE SHIFT';
  lastFrame = 0;
  updateHUD();
}

function openMainMenu(): void {
  if (!gameStarted) return;
  paused = true;
  document.body.classList.add('menu-active');
  $('#main-menu').classList.remove('is-closed');
  $('#main-menu').setAttribute('aria-hidden', 'false');
  $('#start-game').querySelector('b')!.textContent = 'Resume your shift';
}

function togglePause(): void {
  if (gameOver) return;
  paused = !paused;
  $('#pause-button').innerHTML = paused ? '<span>▶</span> Resume' : '<span>Ⅱ</span> Pause';
  $('#map-status').textContent = paused ? 'SIMULATION PAUSED' : 'NETWORK RUNNING';
}

const SOUNDTRACK_PHASES = [
  { root: 196, notes: [0, 3, 5, 7, 10, 7, 5, 3], interval: 650 },
  { root: 220, notes: [0, 2, 5, 7, 9, 7, 5, 2], interval: 560 },
  { root: 247, notes: [0, 3, 7, 10, 7, 3, 5, 10], interval: 430 },
  { root: 220, notes: [7, 5, 3, 0, 3, 5, 2, 0], interval: 500 },
  { root: 196, notes: [0, 5, 7, 10, 7, 5, 3, 2], interval: 610 },
] as const;

function scheduleSoundtrackStep(): void {
  if (!soundOn || !soundContext || !soundMaster) return;

  const phaseIndex = getShiftPhaseIndex(elapsed);
  const mood = SOUNDTRACK_PHASES[phaseIndex] ?? SOUNDTRACK_PHASES[0];
  const pressure = Math.max(0, Math.min(1, totalWaiting() / 34));
  const semitone = mood.notes[soundStep % mood.notes.length] ?? 0;
  const octaveLift = pressure > 0.72 && soundStep % 4 === 2 ? 12 : 0;
  const frequency = mood.root * Math.pow(2, (semitone + octaveLift) / 12);
  const now = soundContext.currentTime;

  const oscillator = soundContext.createOscillator();
  const voiceGain = soundContext.createGain();
  const filter = soundContext.createBiquadFilter();
  oscillator.type = pressure > 0.78 ? 'sawtooth' : 'triangle';
  oscillator.frequency.setValueAtTime(frequency, now);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(720 + pressure * 1050, now);
  voiceGain.gain.setValueAtTime(0.0001, now);
  voiceGain.gain.exponentialRampToValueAtTime(0.045 + pressure * 0.012, now + 0.025);
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
  oscillator.connect(filter);
  filter.connect(voiceGain);
  voiceGain.connect(soundMaster);
  oscillator.start(now);
  oscillator.stop(now + 0.4);

  soundStep += 1;
  const nextInterval = Math.max(360, mood.interval - pressure * 100);
  soundTimer = window.setTimeout(scheduleSoundtrackStep, nextInterval);
}

function toggleSound(): void {
  if (!soundContext) {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) {
      $('#sound-button').innerHTML = '♫ <span>Audio unavailable</span>';
      return;
    }

    soundContext = new AudioContextClass();
    soundMaster = soundContext.createGain();
    soundMaster.gain.value = 0;
    soundMaster.connect(soundContext.destination);

    // A quiet original synth pad sits below the evolving eight-note CITYFLOW motif.
    const padFrequencies = [98, 146.83, 196];
    padFrequencies.forEach((frequency, index) => {
      const oscillator = soundContext!.createOscillator();
      const voiceGain = soundContext!.createGain();
      const filter = soundContext!.createBiquadFilter();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      filter.type = 'lowpass';
      filter.frequency.value = 380 + index * 140;
      voiceGain.gain.value = [0.14, 0.075, 0.04][index] ?? 0.04;
      oscillator.connect(filter);
      filter.connect(voiceGain);
      voiceGain.connect(soundMaster!);
      oscillator.start();
    });
  }

  soundOn = !soundOn;
  if (soundOn) {
    void soundContext.resume();
    soundMaster!.gain.setTargetAtTime(0.17, soundContext.currentTime, 0.7);
    if (soundTimer !== null) window.clearTimeout(soundTimer);
    scheduleSoundtrackStep();
  } else {
    if (soundTimer !== null) {
      window.clearTimeout(soundTimer);
      soundTimer = null;
    }
    soundMaster!.gain.setTargetAtTime(0, soundContext.currentTime, 0.45);
  }

  const label = soundOn ? '♫ <span>Sound on</span>' : '♫ <span>Sound off</span>';
  $('#sound-button').innerHTML = label;
  $('#sound-button').classList.toggle('active', soundOn);
  const menuSoundButton = document.querySelector<HTMLButtonElement>('#menu-sound-button');
  if (menuSoundButton) menuSoundButton.innerHTML = label;
}

function restartGame(): void {
  for (const station of stations) {
    station.queue = [];
    station.overload = 0;
  }
  for (const line of lines) {
    line.stations = [];
    line.trains = [];
    line.fleetSize = 1;
  }
  // Restarting changes the network topology just like editing a route.
  routePlanner = createRoutePlanner(stations, lines);
  selectedLine = 0;
  hintDismissed = false;
  focusedStation = null;
  passengerId = 1;
  trainSequence = 1;
  elapsed = 0;
  demandClock = 0;
  simulationClock.reset();
  score = 0;
  credits = 28;
  stadiumArrivalsDelivered = 0;
  stadiumDeparturesDelivered = 0;
  completedPhaseObjectives.clear();
  lastDisplayedCityEvent = null;
  paused = false;
  simulationSpeed = 1;
  capacityLevel = 1;
  expressLevel = 1;
  gameOver = false;
  gameStarted = true;
  routeEditMode = true;
  $('#game-over').classList.add('hidden');
  updateStartHint();
  $('#pause-button').innerHTML = '<span>Ⅱ</span> Pause';
  $('#event-title').textContent = 'Morning commute';
  $('#event-copy').textContent = 'The city is starting its day.';
  $('#phase-name').textContent = SHIFT_PHASES[0]!.name;
  $('#phase-objective').textContent = SHIFT_PHASES[0]!.objective;
  $('#phase-progress').setAttribute('style', 'width:0%');
  $('#phase-count').textContent = 'PHASE 01 / 05';
  document.querySelectorAll<HTMLButtonElement>('.speed-button').forEach((button) => button.classList.toggle('active', button.dataset.speed === '1'));
  selectLine(0);
  updateHUD();
}

function gameLoop(timestamp: number): void {
  const frameDelta = lastFrame ? Math.max(0, (timestamp - lastFrame) / 1000) : 0;
  lastFrame = timestamp;
  simulationClock.advance(frameDelta, simulationSpeed, (stepSeconds) => {
    updateSimulation(stepSeconds);
  });
  render();

  // Canvas remains smooth at display refresh rate; DOM-heavy HUD work runs at ~7 Hz.
  hudClock += Math.min(frameDelta, 0.05);
  if (hudClock >= 0.14) {
    updateHUD();
    hudClock = 0;
  }
  requestAnimationFrame(gameLoop);
}

function pointerPosition(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WORLD_W,
    y: ((event.clientY - rect.top) / rect.height) * WORLD_H,
  };
}

function findStationAt(x: number, y: number): Station | null {
  return stations.find((station) => Math.hypot(station.x - x, station.y - y) < 24) ?? null;
}

canvas.addEventListener('pointermove', (event) => {
  const point = pointerPosition(event);
  hoveredStation = findStationAt(point.x, point.y);
  canvas.style.cursor = hoveredStation ? 'pointer' : 'crosshair';
});
canvas.addEventListener('pointerleave', () => { hoveredStation = null; });
canvas.addEventListener('pointerdown', (event) => {
  const point = pointerPosition(event);
  const station = findStationAt(point.x, point.y);
  if (station) addStationToSelectedLine(station);
});

$('#map-mode-button').addEventListener('click', () => {
  routeEditMode = !routeEditMode;
  $('#map-status').textContent = routeEditMode ? 'ROUTE EDITING · SELECT STATIONS TO CONNECT' : 'INSPECTION MODE · SELECT A STATION TO VIEW';
  updateHUD();
});
document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'i' && !event.repeat && !['INPUT','TEXTAREA'].includes((event.target as HTMLElement).tagName)) {
    routeEditMode = !routeEditMode;
    $('#map-status').textContent = routeEditMode ? 'ROUTE EDITING · SELECT STATIONS TO CONNECT' : 'INSPECTION MODE · SELECT A STATION TO VIEW';
    updateHUD();
  }
});
$('#line-picker').addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-line]');
  if (target) selectLine(Number(target.dataset.line));
});
$('#undo-button').addEventListener('click', undoRoute);
$('#clear-button').addEventListener('click', clearRoute);
$('#pause-button').addEventListener('click', togglePause);
$('#sound-button').addEventListener('click', toggleSound);
$('#capacity-button').addEventListener('click', () => {
  if (capacityLevel < 3 && credits >= capacityCost()) {
    credits -= capacityCost();
    capacityLevel += 1;
    $('#map-status').textContent = 'FLEET UPGRADED · MORE PASSENGER CAPACITY';
  }
  updateHUD();
});
$('#speed-button').addEventListener('click', () => {
  if (expressLevel < 3 && credits >= expressCost()) {
    credits -= expressCost();
    expressLevel += 1;
    $('#map-status').textContent = 'EXPRESS SERVICE INSTALLED · FASTER TRAINS';
  }
  updateHUD();
});
$('#dispatch-button').addEventListener('click', () => {
  const line = lines[selectedLine];
  if (!line || line.stations.length < 2 || line.fleetSize >= 3) return;
  const cost = dispatchCost(line);
  if (credits < cost) return;
  credits -= cost;
  dispatchTrain(line);
});
document.querySelectorAll<HTMLButtonElement>('.speed-button').forEach((button) => {
  button.addEventListener('click', () => {
    simulationSpeed = Number(button.dataset.speed) || 1;
    document.querySelectorAll('.speed-button').forEach((item) => item.classList.toggle('active', item === button));
  });
});
$('#start-game').addEventListener('click', () => {
  startGame();
  $('#start-game').querySelector('b')!.textContent = 'Resume your shift';
});
$('#menu-sound-button').addEventListener('click', () => {
  toggleSound();
  $('#menu-sound-button').innerHTML = soundOn ? '♫ <span>Sound on</span>' : '♫ <span>Sound off</span>';
});
$('#help-button').addEventListener('click', () => $('#help-popover').classList.remove('hidden'));
$('#close-help').addEventListener('click', () => $('#help-popover').classList.add('hidden'));
$('#dismiss-hint').addEventListener('click', () => { hintDismissed = true; $('#start-hint').classList.add('hidden'); });
$('#restart-button').addEventListener('click', restartGame);
$('.brand').addEventListener('click', (event) => { event.preventDefault(); openMainMenu(); });
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement)) {
    event.preventDefault();
    togglePause();
  }
  if (event.key === 'Escape') $('#help-popover').classList.add('hidden');
});

selectLine(0);
updateStartHint();
updateHUD();
requestAnimationFrame(gameLoop);
window.dispatchEvent(new Event('cityflow:ready'));
