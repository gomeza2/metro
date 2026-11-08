import { RouteDraft, routeImpact } from './simulation/routeDraft';
import { incidentAt, approachingIncident } from './simulation/operatingIncidents';
import { HISTORY_KEY, parseRunHistory, appendRun, type RunOutcome, type RunRecord } from './runHistory';
import { cityGrowthAt, tutorialStep } from './simulation/cityGrowth';
import { OPERATING_POLICIES, POLICY_CHANGE_COST, serviceEstimate, trainSeats, type OperatingPolicyId } from './simulation/operatingPolicies';
import { platformLevel, platformCost, stationQueueLimit } from './simulation/stationCapacity';
import { serviceChallengeStatus } from './simulation/serviceChallenge';
import { RunEconomy, PHASE_REWARD, phaseGoal } from './simulation/runEconomy';
import { RunState } from './simulation/runState';
import { CONTRACTS, ServiceContracts, connectedStationCount, type ContractId } from './simulation/serviceContracts';
import { SERVICE_PLANS, districtEventAt, type ServicePlanId } from './simulation/servicePlans';
import { MapViewport } from './mapViewport';
import { createCityStations, CITY_STATIONS } from './cityMap';
import { FixedStepClock } from './simulation/fixedStepClock';
import { drawCityOverlay } from './visuals';
import { NetworkCommands, dispatchCost } from './simulation/networkCommands';
import { nextStopIndex } from './simulation/trainMotion';
import { GameSimulation } from './simulation/gameSimulation';
import type { MetroLine, Station, StationKind, Train } from './simulation/gameTypes';
import { getShiftPhase, getShiftPhaseIndex, SHIFT_PHASES } from './simulation/shiftPhases';

const WORLD_W = 1200;
const WORLD_H = 760;
const COLORS = ['#e47762', '#5d92bd', '#6a9c81', '#d5a14e'];
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const ctx = canvas.getContext('2d')!;
const viewport = new MapViewport();
let currentDpr = 0;
function resizeMap(): void {
  const rect = canvas.getBoundingClientRect();
  viewport.width = rect.width;
  viewport.height = rect.height;
  currentDpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * currentDpr));
  canvas.height = Math.max(1, Math.round(rect.height * currentDpr));
  compactMapLayout = rect.width < 620 && viewport.zoom < 1.5;
  render();
}
new ResizeObserver(resizeMap).observe(canvas);

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

const stations = createCityStations();

const lines: MetroLine[] = COLORS.map((color, index) => ({
  id: index, name: `Línea ${index + 1}`, color, stations: [], trains: [], fleetSize: 1,
}));

// Rebuilt only when a route changes; passenger spawning reuses the same graph snapshot.
const network = new NetworkCommands(stations, lines);

let selectedLine = 0;
let progressiveCity = true;
let unlockedLines = 1;
let growthKey = '';
let tutorialPaused = false;
let tutorialCompleted = false;
let tutorialInspected = false;
let policyPreview: OperatingPolicyId | null = null;
let routeDraft: RouteDraft | null = null;
let incidentsEnabled = false;
let incidentPreference = false;
let history: RunRecord[] = [];
try { history = parseRunHistory(localStorage.getItem(HISTORY_KEY)); } catch { /* History is optional. */ }
let focusedStation: Station | null = null;
const simulationState = new RunState();
const economy = new RunEconomy();
const completedPhaseObjectives = economy.completedPhases;
let servicePlan: ServicePlanId = 'standard';
let eventSeed = Math.floor(Math.random() * 0x100000000);
const contracts = new ServiceContracts();
const bestScoreKey = () => servicePlan === 'standard' && !progressiveCity && !incidentsEnabled ? 'cityflow.bestScore.v1' : `cityflow.bestScore.${servicePlan}${progressiveCity ? '.growth' : ''}${incidentsEnabled ? '.incidents' : ''}.v1`;
function readBestScore(): number {
  try {
    const stored = Number(localStorage.getItem(bestScoreKey()) ?? 0);
    return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0;
  } catch {
    return 0;
  }
}
let bestScore = readBestScore();
let paused = false;
let simulationSpeed = 1;
let gameOver = false;
let runResult: 'running' | 'won' | 'lost' = 'running';
let gameStarted = false;
let routeEditMode = true;
let hintDismissed = false;
let soundOn = false;
let soundStep = 0;
let soundTimer: number | null = null;
let hoveredStation: Station | null = null;
let compactMapLayout = false;
const simulationClock = new FixedStepClock({
  stepSeconds: 1 / 60,
  maxFrameDeltaSeconds: 0.05,
  maxStepsPerFrame: 12,
});
let lastFrame = 0;
let hudClock = 0;
let soundContext: AudioContext | null = null;
let soundMaster: GainNode | null = null;


const gameSimulation = new GameSimulation({
  stations,
  lines,
  state: simulationState,
  getRoutePlanner: () => network.planner,
  isRunning: () => gameStarted && !paused && !routeDraft && !gameOver && !document.body.classList.contains('menu-active'),
  getCapacityLevel: () => economy.capacityLevel,
  getExpressLevel: () => economy.expressLevel,
  onOverload: endGame,
  getServicePlan: () => servicePlan,
  getEventSeed: () => eventSeed,
  getIncidentsEnabled: () => incidentsEnabled,
  economy,
  onPhaseReward: reward => { $('#map-status').textContent = `OBJETIVO COMPLETADO · +$${reward} DE PREMIO`; },
});

const stationById = (id: string) => stations.find((station) => station.id === id)!;
const totalWaiting = () => stations.reduce((sum, station) => sum + station.queue.length, 0);
const totalOnTrains = () => lines.reduce((sum, line) => sum + line.trains.reduce((fleet, train) => fleet + train.passengers.length, 0), 0);
const activeLines = () => lines.filter((line) => line.stations.length >= 2).length;
const cityHour = () => Math.floor((8 * 60 + Math.floor(simulationState.elapsed * 2.2)) / 60) % 24;
const capacityCost = () => economy.cost('capacity');
const expressCost = () => economy.cost('express');


function nextTrainStop(line: MetroLine, train: Train): Station | null {
  const targetIndex = nextStopIndex(train.stationIndex, train.direction, line.stations.length);
  const id = targetIndex === null ? undefined : line.stations[targetIndex];
  return id ? stationById(id) : null;
}

function syncGrowth(notify = false): void {
  const stage = cityGrowthAt(simulationState.elapsed, progressiveCity);
  const key = stage.ids.join(',');
  unlockedLines = stage.lines;
  if (growthKey === key) return;
  const opened = stations.filter(station => station.active === false && stage.ids.includes(station.id));
  for (const station of stations) station.active = stage.ids.includes(station.id);
  const select = $<HTMLSelectElement>('#station-access');
  select.innerHTML = '<option value="">Elige una estación…</option>' + stations.filter(station => station.active).map(station => `<option value="${station.id}">${station.name}</option>`).join('');
  growthKey = key;
  if (notify && opened.length) $('#map-status').textContent = `NUEVAS ESTACIONES · ${opened.map(station => station.name).join(' · ')} · Usa «Ver ciudad» para encontrarlas`;
}
function updateStartHint(): void {
  const step = tutorialStep({ connected: activeLines() > 0, delivered: simulationState.score, pausedOnce: tutorialPaused, inspected: tutorialInspected });
  const enabled = $<HTMLInputElement>('#tutorial-enabled').checked;
  if (step === 'done') tutorialCompleted = true;
  const hint = $('#start-hint');
  hint.classList.toggle('hidden', hintDismissed || !enabled || tutorialCompleted);
  const copy = {
    connect: ['01 / 04', 'Tu primera línea', progressiveCity ? 'Toca Barrio Norte y después Museo Central. El tren saldrá solo; el reloj espera esta conexión.' : 'Elige una línea y toca dos estaciones. El primer tren sale automáticamente.'],
    observe: ['02 / 04', 'Observa el primer viaje', 'Los puntos son personas esperando. Deja que el tren recoja y entregue a la primera; puedes usar ½× para mirar con calma.'],
    plan: ['03 / 04', 'Pausa y piensa', 'Pulsa Pausa o Espacio. Puedes modificar rutas, comparar servicios y comprar mejoras sin que avance el tiempo.'],
    inspect: ['04 / 04', 'Mira antes de invertir', 'Activa Inspeccionar y toca una estación, o usa el selector. Mira los destinos y la cola antes de ampliar el servicio.'],
    done: ['', '', ''],
  }[step];
  hint.querySelector('.hint-number')!.textContent = copy[0]!;
  hint.querySelector('strong')!.textContent = copy[1]!;
  hint.querySelector('small')!.textContent = copy[2]!;
}

function addStationToSelectedLine(station: Station): void {
  if (!routeEditMode) {
    focusedStation = station;
    tutorialInspected = true;
    updateStationInspector();
    $('#map-status').textContent = `${station.name.toUpperCase()} · INSPECCIÓN DE ESTACIÓN`;
    return;
  }
  const line = lines[selectedLine];
  if (!line || gameOver) return;
  if (routeDraft) {
    routeDraft.select(station.id); focusedStation = station; updateHUD();
    $('#map-status').textContent = 'BORRADOR · La ruta real no cambia hasta aplicar.'; return;
  }
  const result = network.selectStation(line.id, station.id);
  if (result === 'invalid') {
    $('#map-status').textContent = 'RUTA NO DISPONIBLE · ELIGE UNA ESTACIÓN HABILITADA';
    return;
  }
  updateHUD();
  focusedStation = station;
  updateStationInspector();
  updateStartHint();
  $('#map-status').textContent = line.stations.length < 2
    ? 'ELIGE OTRA ESTACIÓN PARA INICIAR EL SERVICIO'
    : `${line.name.toUpperCase()} · ${line.stations.length} ESTACIONES CONECTADAS`;
}

function undoRoute(): void {
  if (routeDraft) { routeDraft.undo(); updateHUD(); return; }
  const line = lines[selectedLine];
  if (!line || !line.stations.length || gameOver) return;
  network.undo(line.id);
  updateHUD();
  updateStartHint();
  $('#map-status').textContent = line.stations.length >= 2
    ? `${line.name.toUpperCase()} · RUTA ACTUALIZADA`
    : 'LÍNEA VACÍA · ELIGE UNA ESTACIÓN';
}

function clearRoute(): void {
  if (routeDraft) { routeDraft.clear(); updateHUD(); return; }
  const line = lines[selectedLine];
  if (!line || gameOver || !line.stations.length) return;
  network.clear(line.id);
  updateHUD();
  updateStartHint();
  $('#map-status').textContent = `${line.name.toUpperCase()} · LISTA PARA CONECTAR`;
}

function contractSnapshot() { return { elapsed: simulationState.elapsed, score: simulationState.score, stations, lines, planner: network.planner }; }
function updateSimulation(dt: number): void {
  gameSimulation.step(dt);
  if (gameStarted && !paused && !gameOver) syncGrowth(true);
  if (gameStarted && !paused && !gameOver) {
    simulationState.credits += contracts.step(contractSnapshot());
    if (servicePlan === 'challenge') {
      const status = challengeStatus();
      if (status.outcome !== 'running') finishRun(status.outcome === 'won', status.outcome === 'won'
        ? '¡Port Azure está certificada! Completaste 30 viajes, conectaste ocho estaciones y cumpliste dos contratos.'
        : 'Se acabó el plazo. Conecta ocho estaciones, completa dos contratos y transporta 30 personas antes de los 320 segundos.', status.outcome === 'won' ? 'certified' : 'deadline');
    }
  }
}

function endGame(station: Station): void {
  finishRun(false, `${station.name} estuvo saturada demasiado tiempo. La ciudad necesita más capacidad o una conexión mejor.`);
}
function finishRun(success: boolean, copy: string, reason: RunOutcome = success ? 'certified' : 'overload'): void {
  if (gameOver) return;
  saveRun(reason);
  routeDraft = null;
  gameOver = true;
  runResult = success ? 'won' : 'lost';
  paused = true;
  $('#game-over-copy').textContent = copy;
  $('#report-heading').innerHTML = success ? 'Una ciudad<br/><em>conectada.</em>' : 'Tu red<br/><em>puede mejorar.</em>';
  $('#report-outcome').textContent = success ? 'RED CERTIFICADA' : 'INFORME DEL TURNO';
  const newRecord = SERVICE_PLANS[servicePlan].ranked && simulationState.score > bestScore;
  if (newRecord) {
    bestScore = simulationState.score;
    try { localStorage.setItem(bestScoreKey(), String(bestScore)); } catch { /* Score remains available for this session. */ }
  }
  $('#final-score').textContent = String(simulationState.score).padStart(3, '0');
  $('#final-best').textContent = String(bestScore).padStart(3, '0');
  $('#final-phases').textContent = `${completedPhaseObjectives.size} / 5`;
  $('#record-state').textContent = newRecord ? 'NUEVO RÉCORD PERSONAL' : `RÉCORD PERSONAL · ${String(bestScore).padStart(3, '0')}`;
  $('#game-over').classList.remove('hidden');
  $('#restart-button').focus();
  $('#pause-button').innerHTML = '<span>▶</span> Continuar';
  $('#map-status').textContent = success ? 'RED CERTIFICADA · DESAFÍO COMPLETADO' : 'TURNO TERMINADO · REVISA TU RED';
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
  if (routeDraft && routeDraft.lineId === line.id) ctx.globalAlpha = 0.3;
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

function drawStation(station: Station, eventTarget = false, incidentTarget = false): void {
  const connectedLines = lines.filter((line) => line.stations.includes(station.id));
  const selected = (routeDraft?.stations ?? lines[selectedLine]?.stations ?? []).includes(station.id);
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
  const markerScale = Math.max(1, 0.85 / Math.max(0.01, viewport.scale));
  const radius = (connectedLines.length > 1 ? 13 : 11) * markerScale;

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

  if (eventTarget) {
    ctx.save(); ctx.beginPath(); ctx.arc(station.x, station.y, radius + 18, 0, Math.PI * 2);
    ctx.strokeStyle = '#b97a2c'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.restore();
  }
  if (incidentTarget) {
    ctx.save();ctx.strokeStyle = '#af4d31';ctx.lineWidth = 4;ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(station.x,station.y,radius+20,0,Math.PI*2);ctx.stroke();ctx.restore();
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
  ctx.font = `700 ${10 * markerScale}px Inter, "Segoe UI", sans-serif`;
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
    ctx.arc(station.x, station.y, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(station.overload / SERVICE_PLANS[servicePlan].overloadSeconds, 1));
    ctx.strokeStyle = '#d66f5d';
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  // Small screens keep the network uncluttered; the selected station name appears on focus.
  if (compactMapLayout && stations.filter(item => item.active !== false).length > 6 && !focused && !hovered) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    return;
  }

  // Each station has a deliberate label anchor to stop names colliding with nearby nodes.
  const label = STATION_LABEL_LAYOUT[station.id] ?? { dx: 18, dy: -16, anchor: 'left' as const };
  const labelFontSize = Math.max(14, 11 / Math.max(0.01, viewport.scale));
  ctx.font = `700 ${labelFontSize}px Inter, "Segoe UI", sans-serif`;
  ctx.textAlign = label.anchor;
  ctx.textBaseline = 'middle';
  const rawX = station.x + label.dx;
  const margin = ctx.measureText(station.name).width;
  const labelX = Math.max(label.anchor === 'right' ? margin + 12 : label.anchor === 'center' ? margin / 2 + 12 : 12,
    Math.min(WORLD_W - (label.anchor === 'left' ? margin + 12 : label.anchor === 'center' ? margin / 2 + 12 : 12), rawX));
  const labelY = station.y + label.dy;
  const labelWidth = ctx.measureText(station.name).width;
  const showQueueCount = station.queue.length >= 4;
  const boxWidth = labelWidth + 18;
  const boxHeight = labelFontSize + (showQueueCount ? 30 : 12);
  const boxX = label.anchor === 'left'
    ? labelX - 9
    : label.anchor === 'right'
      ? labelX - labelWidth - 9
      : labelX - labelWidth / 2 - 9;
  const boxY = labelY - labelFontSize / 2 - 6;

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
  ctx.font = `700 ${labelFontSize}px Inter, "Segoe UI", sans-serif`;
  ctx.textAlign = label.anchor;
  ctx.fillText(station.name, labelX, labelY);
  if (showQueueCount) {
    ctx.fillStyle = station.queue.length > stationQueueLimit(station) ? '#bb6752' : '#9a7442';
    ctx.font = `700 ${compactMapLayout ? 18 : 8}px ui-monospace, monospace`;
    ctx.fillText(`Cola: ${station.queue.length}`, labelX, labelY + labelFontSize / 2 + 12);
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
    ctx.fillText(String(train.passengers.length) + '/' + trainSeats(economy.capacityLevel, train.policy ?? line.policy ?? 'balanced'), x, y - 17);
  }
}

function render(): void {
  if (currentDpr !== Math.min(window.devicePixelRatio || 1, 2)) { resizeMap(); return; }
  const dpr = currentDpr;
  compactMapLayout = viewport.width < 620 && viewport.zoom < 1.5;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#dce7e4';
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  const scale = viewport.scale;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale,
    dpr * (viewport.width / 2 - viewport.x * scale), dpr * (viewport.height / 2 - viewport.y * scale));
  drawBackground();
  drawCityOverlay(ctx, simulationState.elapsed);
  for (const line of lines) drawLine(line);
  if (routeDraft && routeDraft.stations.length >= 2) {
    ctx.save();ctx.lineWidth = 6;ctx.lineCap = 'round';ctx.lineJoin = 'round';ctx.strokeStyle = lines[selectedLine]!.color;ctx.setLineDash([12,8]);ctx.beginPath();
    routeDraft.stations.forEach((id,index) => { const station = stationById(id);if(index === 0)ctx.moveTo(station.x,station.y);else ctx.lineTo(station.x,station.y); });ctx.stroke();ctx.restore();
  }
  const endpoint = (routeDraft?.stations ?? lines[selectedLine]?.stations)?.at(-1);
  if (routeEditMode && hoveredStation && endpoint && endpoint !== hoveredStation.id) {
    const from = stationById(endpoint);
    ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = lines[selectedLine]!.color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(hoveredStation.x, hoveredStation.y); ctx.stroke(); ctx.restore();
  }
  const districtEvent = districtEventAt(simulationState.elapsed, eventSeed);
  const incident = incidentAt(simulationState.elapsed, eventSeed, incidentsEnabled);
  for (const station of stations) if (station.active !== false) drawStation(station, districtEvent?.stationId === station.id, incident?.stationId === station.id);
  for (const line of lines) {
    for (const train of line.trains) drawTrain(line, train);
  }
}

function updatePhaseMission(phaseIndex: number): void {
  const phase = SHIFT_PHASES[phaseIndex]!;
  const goal = phaseGoal(phaseIndex, simulationState, lines);
  const claimed = completedPhaseObjectives.has(phaseIndex);
  $('#phase-name').textContent = phase.name;
  $('#phase-objective').textContent = phase.objective;
  $('#phase-goal').textContent = phase.goal;
  $('#phase-state').textContent = claimed ? 'COMPLETADO' : 'EN CURSO';
  $('#phase-state').classList.toggle('is-complete', claimed);
  $('#phase-progress').setAttribute('style', `width:${Math.min(100, (Math.max(0, simulationState.elapsed - phase.start) / (phase.end - phase.start)) * 100)}%`);
  $('#phase-count').textContent = `FASE ${String(phaseIndex + 1).padStart(2, '0')} / 05`;
  $('#mission-progress-label').textContent = `${Math.min(goal.current, goal.target)} / ${goal.target}`;
  $('#mission-progress-bar').setAttribute('style', `width:${Math.min(100, (goal.current / goal.target) * 100)}%`);
  $('#mission-reward').textContent = claimed ? 'PREMIO RECIBIDO' : `PREMIO +${PHASE_REWARD}`;
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
  const phase = getShiftPhase(simulationState.elapsed);
  let event: CityEventPresentation;

  switch (phase.id) {
    case 'morning-network':
      event = {
        key: 'morning-commute',
        title: 'Primeros viajes',
        copy: 'La ciudad comienza a despertar.',
        state: 'ACTIVO',
        tip: 'Consejo: un buen transbordo puede ser más útil que tres líneas aisladas.',
      };
      break;
    case 'stadium-preparation':
      event = {
        key: 'stadium-preparation',
        title: 'El partido se acerca',
        copy: 'Gran Estadio: prepara servicio adicional.',
        state: 'PRÓXIMAMENTE',
        tip: 'Pronto habrá un evento en el Gran Estadio. Conéctalo con tiempo para que el público pueda llegar.',
      };
      break;
    case 'stadium-arrival':
      event = {
        key: 'stadium-arrival',
        title: 'Evento del Gran Estadio',
        copy: 'La demanda aumenta alrededor del estadio.',
        state: 'EN CURSO',
        tip: 'El estadio atrae más pasajeros. Una conexión directa reduce la presión en las estaciones cercanas.',
      };
      break;
    case 'post-event-return':
      event = {
        key: 'stadium-return',
        title: 'El público vuelve a casa',
        copy: 'Los viajes de regreso se reparten por la ciudad.',
        state: 'HORA PICO',
        tip: 'El público sale del Gran Estadio. Mantén conexiones hacia los barrios residenciales.',
      };
      break;
    case 'afternoon-commute':
      event = cityHour() >= 16
        ? {
            key: 'evening-commute',
            title: 'Regreso a casa',
            copy: 'Los pasajeros vuelven a sus barrios.',
            state: 'ACTIVO',
            tip: 'La demanda se extiende por la red. Añade un tren o refuerza la línea más ocupada.',
          }
        : {
            key: 'afternoon-build-up',
            title: 'Preparar la tarde',
            copy: 'La demanda empieza a subir antes del regreso de la tarde.',
            state: 'EN AUMENTO',
            tip: 'Aprovecha este momento tranquilo para equilibrar la red antes del regreso.',
          };
      break;
  }

  const districtEvent = districtEventAt(simulationState.elapsed, eventSeed);
  const nextDistrictEvent = districtEventAt(simulationState.elapsed + 15, eventSeed);
  if (districtEvent) {
    event = { key: `${districtEvent.id}-${Math.ceil(districtEvent.end - simulationState.elapsed)}`, title: districtEvent.name,
      copy: districtEvent.description, state: `${Math.ceil(districtEvent.end - simulationState.elapsed)} s RESTANTES`, tip: 'La demanda aparece en viajes conectados. Un servicio directo o un transbordo puede ayudar.' };
  } else if (nextDistrictEvent && simulationState.elapsed < nextDistrictEvent.start) {
    event = { key: `soon-${nextDistrictEvent.id}-${Math.ceil(nextDistrictEvent.start - simulationState.elapsed)}`, title: `Próximo: ${nextDistrictEvent.name}`, copy: nextDistrictEvent.description, state: `${Math.ceil(nextDistrictEvent.start - simulationState.elapsed)} s PARA EMPEZAR`, tip: 'Prepara el servicio antes de que empiece el evento.' };
  }
  if (event.key === lastDisplayedCityEvent) return;
  lastDisplayedCityEvent = event.key;
  $('#event-title').textContent = event.title;
  $('#event-copy').textContent = event.copy;
  $('.event-state').textContent = event.state;
  if (event.tip) $('#tip-text').textContent = event.tip;
}

function updateHUD(): void {
  updateDraft();
  updateIncident();
  updateStartHint();
  const guidedOpening = progressiveCity && !hintDismissed && $<HTMLInputElement>('#tutorial-enabled').checked && simulationState.score < 1;
  $('#line-operations').hidden = guidedOpening;
  $('.upgrade-strip').hidden = guidedOpening;
  $('.contract-card').hidden = progressiveCity && !hintDismissed && simulationState.elapsed < 30;
  $('.station-card').hidden = guidedOpening && routeEditMode;
  updateLineOperations();
  const growth = cityGrowthAt(simulationState.elapsed, progressiveCity);
  $('#growth-fit').hidden = !progressiveCity || growth.ids.length <= 3;
  $('#growth-state').textContent = progressiveCity ? `${growth.ids.length} / 14 estaciones · ${growth.lines} / 4 líneas · ${growth.nextAt === null ? 'Ciudad completa' : `Expansión en ${Math.max(0, Math.ceil(growth.nextAt - simulationState.elapsed))} s`}` : 'Ciudad completa · 14 estaciones · 4 líneas';
  $('.status-pill').innerHTML = `<i></i> ${runResult === 'won' ? 'CERTIFICADA' : runResult === 'lost' ? 'FINALIZADO' : paused ? 'EN PAUSA' : 'EN SERVICIO'}`;
  $<HTMLButtonElement>('#pause-button').disabled = gameOver || !!routeDraft;
  document.querySelectorAll<HTMLButtonElement>('.speed-button').forEach(button => { button.disabled = gameOver || !!routeDraft; button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === simulationSpeed)); });
  $('#pause-button').innerHTML = gameOver ? 'Finalizado' : paused ? '<span aria-hidden="true">▶</span> Continuar' : '<span aria-hidden="true">II</span> Pausa';
  $('#pause-button').setAttribute('aria-pressed', String(paused));
  $('#quick-pause').hidden = !gameStarted || gameOver || !!routeDraft;
  $('#quick-pause').textContent = `${$('#quick-pause').dataset.incident === 'true' ? '⚠ ' : ''}${paused ? '▶ Continuar turno' : 'II Pausa para pensar'}`;
  $('#quick-pause').setAttribute('aria-pressed', String(paused));
  $('#network-summary').textContent = `$${simulationState.credits} en fondos · ${simulationState.score} viajes · ${totalWaiting()} esperando`;
  updateContracts();
  updateChallenge();
  $('#service-plan-label').textContent = SERVICE_PLANS[servicePlan].name;
  $('#score').textContent = String(simulationState.score).padStart(3, '0');
  $('#best-score').textContent = SERVICE_PLANS[servicePlan].ranked ? String(bestScore).padStart(3, '0') : 'LIBRE';
  const phaseIndex = getShiftPhaseIndex(simulationState.elapsed);
  updatePhaseMission(phaseIndex);
  updateCityEvent();
  $('#in-transit').textContent = String(totalOnTrains());
  $('#waiting').textContent = String(totalWaiting());
  $('#active-lines').textContent = `${activeLines()} / ${unlockedLines}`;
  const selectedFleet = lines[selectedLine];
  $('#fleet-state').textContent = selectedFleet ? `Flota · ${selectedFleet.fleetSize}/3 trenes` : 'Flota · 0/3 trenes';
  $('#dispatch-cost').textContent = selectedFleet && selectedFleet.fleetSize < 3 ? '$' + String(dispatchCost(selectedFleet)) : 'MÁX';
  $('#credits').textContent = '$' + String(simulationState.credits);
  $('.capacity-cost').textContent = economy.capacityLevel >= 3 ? 'MÁX' : '$' + String(capacityCost());
  $('.express-cost').textContent = economy.expressLevel >= 3 ? 'MÁX' : '$' + String(expressCost());
  const minutes = 8 * 60 + Math.floor(simulationState.elapsed * 2.2);
  $('#city-time').textContent = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const connected = activeLines() > 0;
  const queueTotal = totalWaiting();
  const flow = connected ? Math.max(8, Math.min(100, 100 - (queueTotal / Math.max(1, stations.length * 0.85)) * 100)) : 0;
  $('#flow-bar').setAttribute('style', `width:${flow}%`);
  $('#flow-label').textContent = !connected ? 'Esperando la primera conexión' : flow > 70 ? 'Red fluida' : flow > 38 ? 'Presión en aumento' : 'Red bajo presión';
  $('#flow-note').textContent = !connected ? 'Conecta dos estaciones para empezar a transportar pasajeros.' : `${queueTotal} personas esperan en la red.`;
  $('#capacity-state').textContent = economy.capacityLevel >= 3 ? '18 asientos · máximo' : `${6 * economy.capacityLevel} → ${6 * (economy.capacityLevel + 1)} asientos / tren`;
  $('#express-state').textContent = economy.expressLevel >= 3 ? 'Velocidad ×3 · máximo' : `Velocidad ×${economy.expressLevel} → ×${economy.expressLevel + 1}`;
  $<HTMLButtonElement>('#capacity-button').disabled = gameOver || economy.capacityLevel >= 3 || simulationState.credits < capacityCost();
  $<HTMLButtonElement>('#speed-button').disabled = gameOver || economy.expressLevel >= 3 || simulationState.credits < expressCost();
  $<HTMLButtonElement>('#dispatch-button').disabled = gameOver || !selectedFleet || selectedFleet.stations.length < 2 || selectedFleet.fleetSize >= 3 || simulationState.credits < dispatchCost(selectedFleet);
  $('#capacity-button').classList.toggle('maxed', economy.capacityLevel >= 3 || simulationState.credits < capacityCost());
  $('#speed-button').classList.toggle('maxed', economy.expressLevel >= 3 || simulationState.credits < expressCost());
  $('#dispatch-button').classList.toggle('maxed', !selectedFleet || selectedFleet.stations.length < 2 || selectedFleet.fleetSize >= 3 || simulationState.credits < dispatchCost(selectedFleet));
  updateStationInspector();
  const modeButton = $('#map-mode-button');
  modeButton.classList.toggle('inspect-mode', !routeEditMode);
  modeButton.setAttribute('aria-pressed', String(!routeEditMode));
  modeButton.innerHTML = routeEditMode ? '<span class="mode-icon">⌁</span><span><b>Editar ruta</b><small>Toca estaciones para conectar</small></span>' : '<span class="mode-icon">⌖</span><span><b>Inspeccionar</b><small>Toca una estación para verla</small></span>';
  const picker = $('#line-picker');
  picker.querySelectorAll<HTMLButtonElement>('.line-swatch').forEach((button) => {
    button.disabled = Number(button.dataset.line) >= unlockedLines || gameOver || (!!routeDraft && Number(button.dataset.line) !== selectedLine);
    button.classList.toggle('selected', Number(button.dataset.line) === selectedLine);
    const line = lines[Number(button.dataset.line)];
    button.classList.toggle('has-route', (line?.stations.length ?? 0) >= 2);
    const count = button.querySelector('span');
    if (line) button.setAttribute('aria-label', `${line.name}, ${line.stations.length} estaciones`);
    if (count && line) count.textContent = `${String(line.id + 1).padStart(2, '0')} · ${line.stations.length}`;
  });
}

function passengerDestinations(station: Station): string {
  const counts = new Map<string, number>();
  for (const passenger of station.queue) counts.set(passenger.destination, (counts.get(passenger.destination) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return top.length ? `Destinos: ${top.map(([id, count]) => `${stationById(id).name} (${count})`).join(' · ')}` : 'No hay personas esperando aquí.';
}

function updateStationInspector(): void {
  const station = focusedStation;
  const platform = $<HTMLButtonElement>('#platform-button');
  platform.disabled = !station || gameOver || platformLevel(station) >= 2 || simulationState.credits < platformCost(station);
  platform.textContent = !station ? 'Selecciona una estación para ampliar' : platformLevel(station) >= 2 ? 'Andén ampliado al máximo' : `Ampliar andén: ${stationQueueLimit(station)} → ${stationQueueLimit(station) + 6} plazas · $${platformCost(station)}`;
  $<HTMLSelectElement>('#station-access').value = station?.id ?? '';
  $('#station-connect').textContent = routeEditMode ? 'Añadir a la línea actual' : 'Inspeccionar estación';
  $<HTMLButtonElement>('#station-connect').disabled = !station || !gameStarted || gameOver;
  if (!station) {
    $('#station-icon').textContent = '⌖';
    $('#station-name').textContent = 'Elige una estación';
    $('#station-kind').textContent = 'Información de la estación';
    $('#station-queue').textContent = '—';
    $('#station-lines').textContent = '—';
    $('#station-pressure').textContent = 'ELIGE UNA ESTACIÓN';
    $('#station-destinations').textContent = 'Verás los destinos cuando haya personas esperando.';
    $('#station-advice').textContent = 'Selecciona una estación para ver su cola, sus conexiones y los destinos de sus pasajeros.';
    return;
  }
  const labels: Record<StationKind, string> = {
    residential: 'Barrio residencial',
    commerce: 'Distrito comercial',
    culture: 'Cultura y educación',
    civic: 'Servicios públicos',
    leisure: 'Ocio y eventos',
  };
  const symbols: Record<StationKind, string> = {
    residential: '⌂', commerce: '¤', culture: '✳', civic: '+', leisure: '◇',
  };
  const servedBy = lines.filter((line) => line.stations.includes(station.id));
  const pressure = station.queue.length > stationQueueLimit(station) ? 'CRÍTICA' : station.queue.length >= Math.ceil(stationQueueLimit(station) * 0.6) ? 'OCUPADA' : 'ESTABLE';
  $('#station-icon').textContent = symbols[station.kind];
  $('#station-name').textContent = station.name;
  $('#station-kind').textContent = labels[station.kind];
  $('#station-queue').textContent = `${station.queue.length} / ${stationQueueLimit(station)}`;
  $('#station-lines').textContent = servedBy.length ? servedBy.map((line) => String(line.id + 1).padStart(2, '0')).join(' · ') : 'Ninguna';
  $('#station-pressure').textContent = station.overload > 0 && SERVICE_PLANS[servicePlan].ranked ? `${pressure} · ${Math.max(0, Math.ceil(SERVICE_PLANS[servicePlan].overloadSeconds - station.overload))} s PARA RESOLVER` : pressure;
  $('#station-pressure').setAttribute('data-pressure', station.queue.length > stationQueueLimit(station) ? 'critical' : station.queue.length >= Math.ceil(stationQueueLimit(station) * 0.6) ? 'busy' : 'stable');
  const advice: Record<StationKind, string> = {
    residential: 'Los viajes residenciales se concentran al salir por la mañana y al volver por la tarde. Ofrece conexiones útiles en ambas direcciones.',
    commerce: 'El comercio atrae viajes al mediodía y por la tarde. Las conexiones cortas con viviendas y servicios reducen la presión.',
    culture: 'La educación y la cultura generan viajes diurnos. Un transbordo facilita la llegada desde varios barrios.',
    civic: 'Los servicios públicos generan viajes constantes. Evita dejar esta estación aislada.',
    leisure: 'El ocio puede producir picos de demanda. Prepara capacidad antes de que llegue la gente.',
  };
  const stranded = station.queue.filter(passenger => passenger.route.length < 2 && passenger.destination !== station.id).length;
  $('#station-destinations').textContent = passengerDestinations(station);
  $('#station-advice').textContent = stranded ? `${stranded} personas no tienen camino a su destino. Recupera una conexión o un transbordo para que continúen.` : station.overload > 0
    ? `${station.queue.length} personas esperan aquí. Añade servicio o conecta otra ruta antes de que se agote el margen de congestión.`
    : advice[station.kind];
}

function selectLine(index: number): void {
  if (routeDraft && index !== selectedLine) { $('#map-status').textContent = 'Aplica o descarta el borrador antes de cambiar de línea.'; return; }
  if (index >= unlockedLines || index < 0) { $('#map-status').textContent = 'Esta línea se habilita con la próxima expansión.'; return; }
  policyPreview = null;
  selectedLine = index;
  document.querySelectorAll<HTMLButtonElement>('[data-line]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.line) === index)));
  updateHUD();
  updateStartHint();
  const line = lines[selectedLine];
  $('#map-status').textContent = line?.stations.length
    ? `${line.name.toUpperCase()} SELECCIONADA · ${line.stations.length} ESTACIONES`
    : `${line?.name.toUpperCase()} SELECCIONADA · ELIGE TU PRIMERA ESTACIÓN`;
}

function startGame(): void {
  gameStarted = true;
  $<HTMLInputElement>('#incidents-enabled').disabled = true;
  $<HTMLSelectElement>('#service-plan').disabled = true;
  $<HTMLInputElement>('#progressive-city').disabled = true;
  $<HTMLInputElement>('#tutorial-enabled').disabled = true;
  paused = !!routeDraft;
  document.body.classList.remove('menu-active');
  $('#main-menu').classList.add('is-closed');
  $('#main-menu').setAttribute('aria-hidden', 'true');
  $('#main-menu').setAttribute('inert', '');
  $('.layout').removeAttribute('inert');
  $('.topbar').removeAttribute('inert');
  $('#map-status').textContent = 'EL RELOJ ESPERA · CONECTA DOS ESTACIONES';
  if (progressiveCity && simulationState.elapsed === 0 && activeLines() === 0) {
    viewport.reset(); viewport.zoomAt(1.5);
    viewport.pan(140 * viewport.scale, 70 * viewport.scale);
  }
  lastFrame = 0;
  updateHUD();
  $('#map-mode-button').focus();
}

function openMainMenu(): void {
  if (!gameStarted) return;
  paused = true;
  document.body.classList.add('menu-active');
  $('#main-menu').classList.remove('is-closed');
  $('#main-menu').setAttribute('aria-hidden', 'false');
  $('#main-menu').removeAttribute('inert');
  $('.layout').setAttribute('inert', '');
  $('.topbar').setAttribute('inert', '');
  $('#start-game').querySelector('b')!.textContent = 'Continuar mi turno';
}

function togglePause(): void {
  if (routeDraft) { $('#map-status').textContent = 'Aplica o descarta el borrador para continuar.'; return; }
  if (!gameStarted || gameOver || document.body.classList.contains('menu-active')) return;
  paused = !paused;
  if (paused) tutorialPaused = true;
  $('#pause-button').innerHTML = paused ? '<span>▶</span> Continuar' : '<span aria-hidden="true">II</span> Pausa';
  $('#map-status').textContent = paused ? 'SIMULACIÓN EN PAUSA' : 'RED EN MARCHA';
  updateHUD();
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

  const phaseIndex = getShiftPhaseIndex(simulationState.elapsed);
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
      $('#sound-button').innerHTML = '♫ <span>Audio no disponible</span>';
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

  const label = soundOn ? '♫ <span>Sonido encendido</span>' : '♫ <span>Sonido apagado</span>';
  $('#sound-button').innerHTML = label;
  $('#sound-button').classList.toggle('active', soundOn);
  const menuSoundButton = document.querySelector<HTMLButtonElement>('#menu-sound-button');
  if (menuSoundButton) menuSoundButton.innerHTML = label;
}

function restartGame(): void {
  routeDraft = null;
  network.reset();
  selectedLine = 0;
  hintDismissed = false;
  focusedStation = null;
  simulationClock.reset();
  viewport.reset();
  simulationState.reset(SERVICE_PLANS[servicePlan].startingCredits);
  tutorialPaused = false; tutorialCompleted = false; tutorialInspected = false; policyPreview = null; growthKey = '';
  syncGrowth();
  contracts.reset();
  eventSeed = Math.floor(Math.random() * 0x100000000);
  lastDisplayedCityEvent = null;
  paused = false;
  simulationSpeed = 1;
  economy.reset();
  gameOver = false;
  runResult = 'running';
  gameStarted = true;
  routeEditMode = true;
  $('#game-over').classList.add('hidden');
  startGame();
  updateStartHint();
  $('#pause-button').innerHTML = '<span aria-hidden="true">II</span> Pausa';
  $('#event-title').textContent = 'Primeros viajes';
  $('#event-copy').textContent = 'La ciudad comienza a despertar.';
  $('#phase-name').textContent = SHIFT_PHASES[0]!.name;
  $('#phase-objective').textContent = SHIFT_PHASES[0]!.objective;
  $('#phase-progress').setAttribute('style', 'width:0%');
  $('#phase-count').textContent = 'FASE 01 / 05';
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
  if (!document.body.classList.contains('menu-active')) render();

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
  return viewport.world({ x: event.clientX - rect.left, y: event.clientY - rect.top });
}
function findStationAt(x: number, y: number): Station | null {
  const radius = Math.max(20, 22 / viewport.scale);
  return stations.filter(station => station.active !== false).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
    .find(station => Math.hypot(station.x - x, station.y - y) <= radius) ?? null;
}
let drag: { id: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null = null;
canvas.addEventListener('pointerdown', event => {
  if (!gameStarted || gameOver || drag || event.button !== 0) return;
  canvas.setPointerCapture(event.pointerId);
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
});
canvas.addEventListener('pointermove', event => {
  if (drag && event.pointerId === drag.id) {
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) drag.moved = true;
    if (drag.moved) viewport.pan(event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX; drag.y = event.clientY;
  }
  const point = pointerPosition(event);
  hoveredStation = findStationAt(point.x, point.y);
  canvas.style.cursor = drag?.moved ? 'grabbing' : hoveredStation ? 'pointer' : viewport.zoom > 1 ? 'grab' : 'crosshair';
});
canvas.addEventListener('pointerup', event => {
  if (!drag || drag.id !== event.pointerId) return;
  if (!drag.moved) {
    const point = pointerPosition(event);
    const station = findStationAt(point.x, point.y);
    if (station) addStationToSelectedLine(station);
    else $('#map-status').textContent = 'TOCA UNA ESTACIÓN · ARRASTRA PARA DESPLAZAR EL MAPA CON ZOOM';
  }
  drag = null;
});
canvas.addEventListener('pointercancel', () => { drag = null; });
canvas.addEventListener('lostpointercapture', () => { drag = null; });
canvas.addEventListener('pointerleave', () => { hoveredStation = null; });
canvas.addEventListener('wheel', event => {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  viewport.zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, { x: event.clientX - rect.left, y: event.clientY - rect.top });
}, { passive: false });
$('#zoom-in').addEventListener('click', () => viewport.zoomAt(1.3));
$('#zoom-out').addEventListener('click', () => viewport.zoomAt(1 / 1.3));
$('#zoom-reset').addEventListener('click', () => viewport.reset());
$('#growth-fit').addEventListener('click', () => viewport.reset());
$('#station-access').addEventListener('change', () => {
  const id = $<HTMLSelectElement>('#station-access').value;
  focusedStation = stations.find(station => station.id === id && station.active !== false) ?? null;
  if (focusedStation) tutorialInspected = true;
  updateStationInspector();
});
$('#station-connect').addEventListener('click', () => {
  if (focusedStation) addStationToSelectedLine(focusedStation);
});

document.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(button => button.addEventListener('click', () => {
  $('.side-panel').dataset.mobilePanel = button.dataset.panel;
  document.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
}));
$('#service-plan').addEventListener('change', () => {
  if (gameStarted) return;
  const selected = $<HTMLSelectElement>('#service-plan').value as ServicePlanId;
  if (!(selected in SERVICE_PLANS)) return;
  servicePlan = selected;
  incidentsEnabled = servicePlan === 'rush' || incidentPreference;
  $<HTMLInputElement>('#incidents-enabled').checked = incidentsEnabled;
  configureGrowth();
  simulationState.credits = SERVICE_PLANS[servicePlan].startingCredits;
  bestScore = readBestScore();
  $('#service-plan-description').textContent = SERVICE_PLANS[servicePlan].description;
  updateHUD();
});
$('#new-shift').addEventListener('click', () => {
  if (gameStarted && !gameOver && !window.confirm('¿Terminar este turno y elegir otro modo? Se reiniciarán las rutas y el progreso.')) return;
  if (!gameOver && simulationState.elapsed > 0) saveRun('abandoned');
  restartGame();
  gameStarted = false;
  paused = true;
  $<HTMLSelectElement>('#service-plan').disabled = false;
  $<HTMLInputElement>('#incidents-enabled').disabled = servicePlan === 'rush';
  $<HTMLInputElement>('#progressive-city').disabled = !['standard','relaxed'].includes(servicePlan);
  $<HTMLInputElement>('#incidents-enabled').disabled = gameStarted || servicePlan === 'rush';
  $<HTMLInputElement>('#tutorial-enabled').disabled = false;
  document.body.classList.add('menu-active');
  $('#main-menu').classList.remove('is-closed');
  $('#main-menu').setAttribute('aria-hidden', 'false');
  $('#main-menu').removeAttribute('inert');
  $('.layout').setAttribute('inert', '');
  $('.topbar').setAttribute('inert', '');
  $('#main-menu').removeAttribute('inert');
  $('.layout').setAttribute('inert', '');
  $('.topbar').setAttribute('inert', '');
  $('#start-game').querySelector('b')!.textContent = 'Empezar otro turno';
});
$('#contract-offers').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-contract]');
  if (button && gameStarted && !gameOver) { contracts.accept(button.dataset.contract as ContractId, contractSnapshot()); updateContracts(); }
});
function challengeStatus() {
  return serviceChallengeStatus({ elapsed: simulationState.elapsed, score: simulationState.score,
    coverage: connectedStationCount(stations, network.planner), grants: contracts.completed.size });
}
function updateChallenge(): void {
  $('#challenge-panel').hidden = servicePlan !== 'challenge';
  if (servicePlan !== 'challenge') return;
  const status = challengeStatus();
  $('#challenge-clock').textContent = `${Math.ceil(status.remaining)} s restantes`;
  document.querySelectorAll<HTMLElement>('[data-challenge-goal]').forEach((item, index) => {
    const goal = status.goals[index]!;
    item.textContent = `${goal.current >= goal.target ? '✓' : '○'} ${goal.label} · ${Math.min(goal.current, goal.target)} / ${goal.target}`;
    item.classList.toggle('is-complete', goal.current >= goal.target);
  });
}
function updateContracts(): void {
  const active = contracts.active;
  const contract = CONTRACTS.find(item => item.id === active?.id);
  $('#contract-status').textContent = active && contract
    ? `${contract.title} · ${Math.min(contracts.progress(contractSnapshot()), contract.target)} / ${contract.target} · ${Math.max(0, Math.ceil(active.started + contract.seconds - simulationState.elapsed))} s restantes`
    : contracts.lastResult;
  $('#grant-count').textContent = `${contracts.completed.size} / ${CONTRACTS.length} COMPLETADOS`;
  document.querySelectorAll<HTMLButtonElement>('[data-contract]').forEach(button => {
    const id = button.dataset.contract as ContractId;
    button.disabled = !gameStarted || gameOver || !!active || contracts.attempted.has(id);
    button.classList.toggle('is-complete', contracts.completed.has(id));
  });
}
function configureGrowth(): void {
  progressiveCity = ['standard','relaxed'].includes(servicePlan) && $<HTMLInputElement>('#progressive-city').checked;
  $<HTMLInputElement>('#progressive-city').disabled = !['standard','relaxed'].includes(servicePlan);
  $<HTMLInputElement>('#incidents-enabled').disabled = gameStarted || servicePlan === 'rush';
  growthKey = '';
  syncGrowth();
}
$('#progressive-city').addEventListener('change', () => { if (!gameStarted) { configureGrowth(); bestScore = readBestScore(); updateHUD(); } });
$('#incidents-enabled').addEventListener('change', () => {
  if (gameStarted) return;
  incidentPreference = $<HTMLInputElement>('#incidents-enabled').checked;
  incidentsEnabled = servicePlan === 'rush' || incidentPreference;
  bestScore = readBestScore(); updateHUD();
});
function beginDraft(): void {
  if (!gameStarted || gameOver || routeDraft) return;
  paused = true; tutorialPaused = true; routeEditMode = true;
  routeDraft = new RouteDraft(selectedLine, lines[selectedLine]!.stations, new Set(stations.filter(station => station.active !== false).map(station => station.id)));
  $('#map-status').textContent = 'BORRADOR · Toca estaciones, compara y aplica. El tiempo está detenido.';
  updateHUD();
  $('#game-canvas').focus();
}
function discardDraft(): void {
  routeDraft = null;
  $('#map-status').textContent = 'Borrador descartado. La ruta original sigue intacta; continúas en pausa.';
  updateHUD();
}
$('#plan-route').addEventListener('click', beginDraft);
$('#discard-draft').addEventListener('click', discardDraft);
$('#apply-draft').addEventListener('click', () => {
  if (!routeDraft || gameOver) return;
  const result = network.replaceRoute(routeDraft.lineId, routeDraft.stations);
  if (result === 'invalid') { $('#map-status').textContent = 'No se puede aplicar: hay una estación no disponible.'; return; }
  routeDraft = null;
  $('#map-status').textContent = 'Ruta aplicada. Continúas en pausa para revisar tu red.';
  updateHUD();
});
function updateDraft(): void {
  $('#draft-panel').hidden = !routeDraft;
  $<HTMLButtonElement>('#plan-route').disabled = !gameStarted || gameOver || !!routeDraft;
  $('#draft-summary').textContent = routeDraft ? `${lines[selectedLine]!.name} · ${routeDraft.stations.length} estaciones propuestas` : '';
  if (!routeDraft) return;
  const impact = routeImpact(stations, lines, routeDraft);
  $('#draft-impact').textContent = `Red conectada: ${impact.before} → ${impact.after} estaciones. ${impact.disconnected} personas quedarían esperando sin ruta. No se eliminan pasajeros.`;
  $('#draft-panel').classList.toggle('has-warning', impact.disconnected > 0);
  $<HTMLButtonElement>('#apply-draft').disabled = !routeDraft.changed;
}
function updateIncident(): void {
  const active = incidentAt(simulationState.elapsed,eventSeed,incidentsEnabled);
  const upcoming = approachingIncident(simulationState.elapsed,eventSeed,incidentsEnabled);
  const incident = active ?? upcoming;
  $('#incident-panel').hidden = !incident;
  $('#operating-alert').hidden = !incident;
  $('#quick-pause').dataset.incident = String(!!active);
  if (!incident) return;
  const name = stationById(incident.stationId).name;
  const alert = `${active ? '⚠ Señal lenta' : 'Próxima incidencia'} · ${name} · Ver detalles`;
  if ($('#operating-alert').textContent !== alert) $('#operating-alert').textContent = alert;
  $('#incident-title').textContent = active ? `Señal lenta en ${name}` : `Preparar: señal lenta en ${name}`;
  $('#incident-time').textContent = active ? `${Math.ceil(incident.end - simulationState.elapsed)} s restantes` : `En ${Math.ceil(incident.start - simulationState.elapsed)} s`;
  $('#incident-copy').textContent = 'Durante 30 s, los tramos que tocan esta estación circulan al 65% de su velocidad. Puedes planificar un desvío o reforzar el servicio; la estación sigue abierta.';
}
$('#operating-alert').addEventListener('click', () => {
  $('.side-panel').dataset.mobilePanel = 'missions';
  document.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.panel === 'missions')));
  $('#incident-panel').scrollIntoView({ block:'center' });
  $('#incident-title').focus();
});
function saveRun(outcome: RunOutcome): void {
  history = appendRun(history,{mode:servicePlan,outcome,score:simulationState.score,elapsed:simulationState.elapsed,phases:completedPhaseObjectives.size,grants:contracts.completed.size,progressive:progressiveCity,incidents:incidentsEnabled});
  try { localStorage.setItem(HISTORY_KEY,JSON.stringify(history)); } catch { /* Keep the current session's history in memory. */ }
  renderHistory();
}
function renderHistory(): void {
  const list = $('#run-history');list.replaceChildren();
  if (!history.length) { const item = document.createElement('li');item.textContent = 'Tus turnos terminados aparecerán aquí. Solo se guardan en este navegador.';list.append(item);return; }
  const outcomes = {certified:'Certificada',overload:'Congestión',deadline:'Plazo vencido',abandoned:'Interrumpido'};
  for (const record of history) {
    const item = document.createElement('li');
    const minutes = Math.floor(record.elapsed / 60), seconds = Math.floor(record.elapsed % 60);
    item.textContent = `${SERVICE_PLANS[record.mode].name} · ${record.score} viajes · ${minutes}:${String(seconds).padStart(2,'0')} · ${outcomes[record.outcome]} · ${record.grants}/3 contratos${record.progressive ? ' · Ciudad progresiva' : ''}${record.incidents ? ' · Con incidencias' : ''}`;
    list.append(item);
  }
}
$('#platform-button').addEventListener('click', () => {
  if (!focusedStation || gameOver || !gameStarted) return;
  const result = economy.expandPlatform(focusedStation, simulationState);
  if (result.ok) $('#map-status').textContent = `${focusedStation.name} · ANDÉN AMPLIADO · −$${result.cost}`;
  updateHUD();
});
$('#line-policy').addEventListener('change', () => { policyPreview = $<HTMLSelectElement>('#line-policy').value as OperatingPolicyId; updateLineOperations(); });
$('#apply-policy').addEventListener('click', () => {
  if (!policyPreview || gameOver || !gameStarted) return;
  if (network.setPolicy(selectedLine, policyPreview, simulationState)) $('#map-status').textContent = 'Servicio actualizado. Cada tren lo adopta en su próxima parada.';
  policyPreview = null; updateHUD();
});
let routeMarkupKey = '';
function updateLineOperations(): void {
  const line = lines[selectedLine]!;
  const policy = policyPreview ?? line.policy ?? 'balanced';
  const cost = line.stations.length >= 2 ? POLICY_CHANGE_COST : 0;
  $('#line-operations-title').textContent = `${line.name} · planificación del servicio`;
  const select = $<HTMLSelectElement>('#line-policy');
  if (select.value !== policy) select.value = policy;
  $('#policy-description').textContent = OPERATING_POLICIES[policy].description;
  const plannedStops = routeDraft?.stations ?? line.stations;
  const estimate = serviceEstimate(plannedStops.map(stationById), line.fleetSize, economy.capacityLevel, economy.expressLevel, policy);
  $('#policy-seats').textContent = `${estimate.seats} por tren`;
  $('#policy-cycle').textContent = estimate.roundTrip ? `${estimate.roundTrip.toFixed(1)} s` : 'Conecta 2 estaciones';
  $('#policy-headway').textContent = estimate.headway ? `≈ ${estimate.headway.toFixed(1)} s` : '—';
  const apply = $<HTMLButtonElement>('#apply-policy');
  const unchanged = (line.policy ?? 'balanced') === policy;
  apply.disabled = unchanged || gameOver || !gameStarted || simulationState.credits < cost;
  apply.textContent = unchanged ? 'Servicio actual' : cost ? `Aplicar · $${cost}` : 'Aplicar gratis';
  const key = `${selectedLine}:${plannedStops.join(',')}`;
  if (key !== routeMarkupKey) {
    $('#line-route').innerHTML = plannedStops.length ? plannedStops.map(id => `<button type="button" data-inspect-station="${id}">${stationById(id).name}</button>`).join('<span aria-hidden="true">→</span>') : '<span>Elige dos estaciones en el mapa para empezar.</span>';
    routeMarkupKey = key;
  }
}
$('#line-route').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-inspect-station]');
  if (button) { focusedStation = stationById(button.dataset.inspectStation!); tutorialInspected = true; updateStationInspector(); }
});
window.addEventListener('keydown', event => {
  if (!gameStarted || gameOver || event.repeat || event.ctrlKey || event.metaKey || event.altKey || ['INPUT','TEXTAREA','SELECT'].includes((event.target as HTMLElement).tagName)) return;
  if (/^[1-4]$/.test(event.key)) selectLine(Number(event.key) - 1);
  if (event.key === '+' || event.key === '=') { event.preventDefault(); viewport.zoomAt(1.3); }
  if (event.key === '-') { event.preventDefault(); viewport.zoomAt(1 / 1.3); }
  if (event.key === '0') viewport.reset();
  if (event.key.toLowerCase() === 'z') { event.preventDefault(); undoRoute(); }
});
$('#map-mode-button').addEventListener('click', () => {
  routeEditMode = !routeEditMode;
  $('#map-status').textContent = routeEditMode ? 'EDITAR RUTA · TOCA ESTACIONES PARA CONECTAR' : 'INSPECCIÓN · ELIGE UNA ESTACIÓN';
  updateHUD();
});
document.addEventListener('keydown', (event) => {
  if (gameStarted && !gameOver && !document.body.classList.contains('menu-active') && event.key.toLowerCase() === 'i' && !event.repeat && !['INPUT','TEXTAREA','SELECT'].includes((event.target as HTMLElement).tagName)) {
    routeEditMode = !routeEditMode;
    $('#map-status').textContent = routeEditMode ? 'EDITAR RUTA · TOCA ESTACIONES PARA CONECTAR' : 'INSPECCIÓN · ELIGE UNA ESTACIÓN';
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
$('#quick-pause').addEventListener('click', togglePause);
$('#sound-button').addEventListener('click', toggleSound);
$('#capacity-button').addEventListener('click', () => {
  if (!gameStarted || gameOver) return;
  const result = economy.buy('capacity', simulationState);
  if (result.ok) $('#map-status').textContent = `CAPACIDAD MEJORADA · ${6 * result.level} ASIENTOS POR TREN · −$${result.cost}`;
  updateHUD();
});
$('#speed-button').addEventListener('click', () => {
  if (!gameStarted || gameOver) return;
  const result = economy.buy('express', simulationState);
  if (result.ok) $('#map-status').textContent = `VELOCIDAD MEJORADA · VELOCIDAD ×${result.level} · −$${result.cost}`;
  updateHUD();
});
$('#dispatch-button').addEventListener('click', () => {
  const line = lines[selectedLine];
  if (!line || line.stations.length < 2 || line.fleetSize >= 3) return;
  if (gameOver || !network.dispatch(line.id, simulationState)) return;
  $('#map-status').textContent = `${line.name.toUpperCase()} · TREN AÑADIDO`;
  updateHUD();
});
document.querySelectorAll<HTMLButtonElement>('.speed-button').forEach((button) => {
  button.addEventListener('click', () => {
    simulationSpeed = Number(button.dataset.speed) || 1;
    document.querySelectorAll('.speed-button').forEach((item) => item.classList.toggle('active', item === button));
  });
});
$('#start-game').addEventListener('click', () => {
  startGame();
  $('#start-game').querySelector('b')!.textContent = 'Continuar mi turno';
});
$('#menu-sound-button').addEventListener('click', () => {
  toggleSound();
  $('#menu-sound-button').innerHTML = soundOn ? '♫ <span>Sonido encendido</span>' : '♫ <span>Sonido apagado</span>';
});
$('#help-button').addEventListener('click', () => $('#help-popover').classList.remove('hidden'));
$('#close-help').addEventListener('click', () => $('#help-popover').classList.add('hidden'));
$('#dismiss-hint').addEventListener('click', () => { hintDismissed = true; $('#start-hint').classList.add('hidden'); });
$('#restart-button').addEventListener('click', restartGame);
$('.brand').addEventListener('click', (event) => { event.preventDefault(); openMainMenu(); });
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && gameStarted && !['BUTTON','INPUT','TEXTAREA','SELECT','A'].includes((event.target as HTMLElement).tagName)) {
    event.preventDefault();
    togglePause();
  }
  if (event.key === 'Escape') { $('#help-popover').classList.add('hidden'); if (routeDraft) discardDraft(); }
});

const overview = $<HTMLCanvasElement>('#menu-city-map');
const overviewContext = overview.getContext('2d')!;
overview.width = WORLD_W; overview.height = WORLD_H;
drawCityOverlay(overviewContext, 0);
overviewContext.lineWidth = 9; overviewContext.lineCap = 'round'; overviewContext.strokeStyle = COLORS[0]!;
overviewContext.beginPath();
['harbor', 'gardens', 'north', 'museum', 'market'].forEach((id, index) => {
  const station = stationById(id);
  if (index === 0) overviewContext.moveTo(station.x, station.y); else overviewContext.lineTo(station.x, station.y);
});
overviewContext.stroke();
for (const station of CITY_STATIONS) {
  overviewContext.beginPath(); overviewContext.arc(station.x, station.y, 10, 0, Math.PI * 2);
  overviewContext.fillStyle = '#fffef7'; overviewContext.fill(); overviewContext.strokeStyle = '#284e53'; overviewContext.lineWidth = 3; overviewContext.stroke();
}
renderHistory();
syncGrowth();
$<HTMLDetailsElement>('#line-operations').open = window.innerWidth > 620;
selectLine(0);
updateStartHint();
updateHUD();
requestAnimationFrame(gameLoop);
window.dispatchEvent(new Event('cityflow:ready'));
