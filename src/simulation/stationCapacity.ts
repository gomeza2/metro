import type { Station } from './gameTypes.js';
export function platformLevel(station: Pick<Station, 'platformLevel'>): number {
  const value = station.platformLevel ?? 0;
  return Number.isFinite(value) ? Math.max(0, Math.min(2, Math.floor(value))) : 0;
}
export const stationQueueLimit = (station: Pick<Station, 'platformLevel'>): number => 12 + platformLevel(station) * 6;
export const platformCost = (station: Pick<Station, 'platformLevel'>): number => 16 + platformLevel(station) * 18;
