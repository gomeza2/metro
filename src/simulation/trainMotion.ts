export type TrainDirection = 1 | -1;

/**
 * Returns a direction that points back into the route when a train is at
 * either endpoint. The input state is never modified.
 */
export function directionForStation(
  stationIndex: number,
  direction: TrainDirection,
  stationCount: number,
): TrainDirection {
  if (stationCount < 2) return direction;
  if (stationIndex <= 0 && direction === -1) return 1;
  if (stationIndex >= stationCount - 1 && direction === 1) return -1;
  return direction;
}

/**
 * Gets the index of the next stop without mutating train state. This is safe
 * for both simulation updates and rendering.
 */
export function nextStopIndex(
  stationIndex: number,
  direction: TrainDirection,
  stationCount: number,
): number | null {
  if (!Number.isInteger(stationIndex) || stationCount < 2) return null;
  if (stationIndex < 0 || stationIndex >= stationCount) return null;

  const normalized = directionForStation(stationIndex, direction, stationCount);
  const target = stationIndex + normalized;
  return target >= 0 && target < stationCount ? target : null;
}
