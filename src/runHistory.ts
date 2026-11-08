import { SERVICE_PLANS, type ServicePlanId } from './simulation/servicePlans.js';
export type RunOutcome = 'certified' | 'overload' | 'deadline' | 'abandoned';
export type RunRecord = { mode: ServicePlanId; outcome: RunOutcome; score: number; elapsed: number; phases: number; grants: number; progressive: boolean; incidents: boolean; limitedTrack?: boolean };
export const HISTORY_KEY = 'cityflow.runHistory.v1';
const outcomes = new Set(['certified','overload','deadline','abandoned']);
export function parseRunHistory(serialized: string | null): RunRecord[] {
  if (!serialized || serialized.length > 64000) return [];
  try {
    const data: unknown = JSON.parse(serialized);
    if (!Array.isArray(data)) return [];
    const records: RunRecord[] = [];
    for (const item of data) {
      if (!item || typeof item !== 'object' || !Object.hasOwn(SERVICE_PLANS,item.mode) || !outcomes.has(item.outcome)) continue;
      if (![item.score,item.elapsed,item.phases,item.grants].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) continue;
      if (typeof item.progressive !== 'boolean' || typeof item.incidents !== 'boolean' || item.phases > 5 || item.grants > 3) continue;
      records.push({ mode:item.mode, outcome:item.outcome, score:Math.floor(item.score), elapsed:item.elapsed, phases:Math.floor(item.phases), grants:Math.floor(item.grants), progressive:item.progressive, incidents:item.incidents, ...(item.limitedTrack === true ? { limitedTrack: true } : {}) });
      if (records.length === 8) break;
    }
    return records;
  } catch { return []; }
}
export function appendRun(history: readonly RunRecord[], record: RunRecord): RunRecord[] {
  return parseRunHistory(JSON.stringify([record,...history]));
}
