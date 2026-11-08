import type { Station } from './simulation/gameTypes';

export const CITY_STATIONS = [
  { id: 'harbor', name: 'Old Harbor', x: 145, y: 355, kind: 'commerce' },
  { id: 'gardens', name: 'West Gardens', x: 250, y: 205, kind: 'leisure' },
  { id: 'north', name: 'North Quarter', x: 420, y: 130, kind: 'residential' },
  { id: 'museum', name: 'Museum Mile', x: 530, y: 285, kind: 'culture' },
  { id: 'market', name: 'Central Market', x: 390, y: 440, kind: 'commerce' },
  { id: 'civic', name: 'Civic Square', x: 650, y: 445, kind: 'civic' },
  { id: 'east', name: 'Eastbank', x: 865, y: 350, kind: 'residential' },
  { id: 'university', name: 'University', x: 780, y: 175, kind: 'culture' },
  { id: 'stadium', name: 'Grand Stadium', x: 1040, y: 235, kind: 'leisure' },
  { id: 'heights', name: 'Hillview', x: 1035, y: 510, kind: 'residential' },
  { id: 'clinic', name: 'Riverside Clinic', x: 850, y: 610, kind: 'civic' },
  { id: 'south', name: 'South Pier', x: 540, y: 620, kind: 'commerce' },
  { id: 'orchard', name: 'Orchard Lane', x: 270, y: 590, kind: 'residential' },
  { id: 'airport', name: 'Airfield', x: 1090, y: 100, kind: 'commerce' },
];

export function createCityStations(): Station[] {
  return CITY_STATIONS.map(station => ({ ...station, kind: station.kind as Station['kind'], queue: [], overload: 0 }));
}
