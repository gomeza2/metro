import type { MetroLine, Station } from './gameTypes.js';
import { trainSeats } from './operatingPolicies.js';
import { stationQueueLimit } from './stationCapacity.js';

/** Observations of the live network, never of a draft or policy preview. */
export function lineTelemetry(line: MetroLine, stations: readonly Station[], capacityLevel: number) {
  const stops = stations.filter(station => station.active !== false && line.stations.includes(station.id));
  const onboard = line.trains.reduce((sum, train) => sum + train.passengers.length, 0);
  const seats = line.trains.reduce((sum, train) => sum + trainSeats(capacityLevel, train.policy ?? 'balanced'), 0);
  const waiting = stops.reduce((sum, station) => sum + station.queue.length, 0);
  const disconnected = stops.reduce((sum, station) => sum + station.queue.filter(passenger => passenger.route.length < 2).length, 0);
  // Overload is urgent; otherwise compare how full the actual platforms are.
  const priority = stops.filter(station => station.queue.length > 0).sort((a, b) =>
    b.overload - a.overload || b.queue.length / stationQueueLimit(b) - a.queue.length / stationQueueLimit(a) || b.queue.length - a.queue.length)[0] ?? null;
  return { onboard, seats, waiting, disconnected, priority };
}
