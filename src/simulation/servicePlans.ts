export const SERVICE_PLANS = {
  standard: { name: 'Turno urbano', demand: 1, overloadSeconds: 17, startingCredits: 28, ranked: true, description: 'Cinco fases para construir y adaptar la red. Con ciudad progresiva empiezas con poco.' },
  relaxed: { name: 'Turno tranquilo', demand: 0.7, overloadSeconds: 25, startingCredits: 40, ranked: true, description: 'Menos demanda, más tiempo para pensar y $40 iniciales.' },
  rush: { name: 'Hora pico', demand: 1.5, overloadSeconds: 12, startingCredits: 28, ranked: true, description: '50% más demanda. Solo 12 segundos para resolver una cola crítica.' },
  challenge: { name: 'Certificación de red', demand: 1, overloadSeconds: 17, startingCredits: 32, ranked: true, description: 'Antes de 320 segundos: transporta 30 personas, conecta 8 estaciones y completa 2 contratos. Empiezas con $32.' },
  sandbox: { name: 'Modo libre', demand: 0.7, overloadSeconds: Infinity, startingCredits: 150, ranked: false, description: 'Sin derrota por congestión. $150 para experimentar; sin clasificación.' },
} as const;
export type ServicePlanId = keyof typeof SERVICE_PLANS;

export type DistrictEvent = { id: string; name: string; stationId: string; start: number; end: number; description: string };
const EVENT_LOCATIONS = [
  { name: 'Noche de museos', stationId: 'museum', description: 'Llegan visitantes al Museo Central. Prepara un servicio directo al distrito cultural.' },
  { name: 'Llega el ferry', stationId: 'harbor', description: 'Los pasajeros salen de Puerto Viejo. Conecta la costa con el resto de la ciudad.' },
  { name: 'Jornada universitaria', stationId: 'university', description: 'La Universidad recibe más visitantes. Otra conexión puede repartir la demanda.' },
] as const;
/** Seeded schedule avoids overlapping the established stadium phases. */
export function districtEventAt(elapsed: number, seed: number): DistrictEvent | null {
  if (!Number.isFinite(elapsed) || elapsed < 30) return null;
  const cycle = elapsed < 70 ? 0 : elapsed >= 220 ? 1 + Math.floor((elapsed - 220) / 100) : -1;
  if (cycle < 0) return null;
  const start = cycle === 0 ? 30 : 220 + (cycle - 1) * 100;
  if (elapsed >= start + 40) return null;
  const location = EVENT_LOCATIONS[((seed >>> 0) + cycle) % EVENT_LOCATIONS.length]!;
  return { ...location, id: `${cycle}-${location.stationId}`, start, end: start + 40 };
}
