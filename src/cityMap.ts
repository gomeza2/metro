import type { Station } from './simulation/gameTypes';

export const CITY_STATIONS = [
  { id: 'harbor', name: 'Puerto Viejo', x: 145, y: 355, kind: 'commerce' },
  { id: 'gardens', name: 'Jardines del Oeste', x: 250, y: 205, kind: 'leisure' },
  { id: 'north', name: 'Barrio Norte', x: 420, y: 130, kind: 'residential' },
  { id: 'museum', name: 'Museo Central', x: 530, y: 285, kind: 'culture' },
  { id: 'market', name: 'Mercado Central', x: 390, y: 440, kind: 'commerce' },
  { id: 'civic', name: 'Plaza Cívica', x: 650, y: 445, kind: 'civic' },
  { id: 'east', name: 'Ribera Este', x: 865, y: 350, kind: 'residential' },
  { id: 'university', name: 'Universidad', x: 780, y: 175, kind: 'culture' },
  { id: 'stadium', name: 'Gran Estadio', x: 1040, y: 235, kind: 'leisure' },
  { id: 'heights', name: 'Las Colinas', x: 1035, y: 510, kind: 'residential' },
  { id: 'clinic', name: 'Clínica del Río', x: 850, y: 610, kind: 'civic' },
  { id: 'south', name: 'Muelle Sur', x: 540, y: 620, kind: 'commerce' },
  { id: 'orchard', name: 'Los Manzanos', x: 270, y: 590, kind: 'residential' },
  { id: 'airport', name: 'Aeropuerto', x: 1090, y: 100, kind: 'commerce' },
];

export function createCityStations(): Station[] {
  return CITY_STATIONS.map(station => ({ ...station, kind: station.kind as Station['kind'], queue: [], overload: 0 }));
}
