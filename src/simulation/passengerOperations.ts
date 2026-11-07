export interface RoutedPassenger {
  readonly id: number;
  readonly origin: string;
  readonly destination: string;
  readonly route: readonly string[];
}

export interface BoardingResult<TPassenger> {
  readonly waiting: TPassenger[];
  readonly boarding: TPassenger[];
}

export interface ArrivalResult<TPassenger> {
  readonly continuing: TPassenger[];
  readonly transferring: TPassenger[];
  readonly delivered: TPassenger[];
}

/**
 * Selects passengers whose next route edge matches the train's next stop.
 * Boarding is FIFO among eligible passengers, and all other queue order is
 * preserved. This function does not mutate the source queue or passengers.
 */
export function selectPassengersForBoarding<TPassenger extends RoutedPassenger>(
  queue: readonly TPassenger[],
  stationId: string,
  nextStationId: string,
  availableSeats: number,
): BoardingResult<TPassenger> {
  const seats = Number.isFinite(availableSeats)
    ? Math.max(0, Math.floor(availableSeats))
    : 0;
  const waiting: TPassenger[] = [];
  const boarding: TPassenger[] = [];

  for (const passenger of queue) {
    const matchesNextEdge =
      passenger.route[0] === stationId &&
      passenger.route[1] === nextStationId;

    if (matchesNextEdge && boarding.length < seats) {
      boarding.push(passenger);
    } else {
      waiting.push(passenger);
    }
  }

  return { waiting, boarding };
}

/**
 * Resolves an arriving train's passengers without changing the input objects.
 *
 * A passenger's route advances only when its next route station is the
 * station just reached. A passenger whose next edge is not served by this
 * train is transferred to the station queue; a passenger at their destination
 * (or with no remaining route) is marked delivered.
 */
export function resolvePassengersAtStation<TPassenger extends RoutedPassenger>(
  onboard: readonly TPassenger[],
  stationId: string,
  nextStationId: string | null,
): ArrivalResult<TPassenger> {
  const continuing: TPassenger[] = [];
  const transferring: TPassenger[] = [];
  const delivered: TPassenger[] = [];

  for (const passenger of onboard) {
    const route = passenger.route[1] === stationId
      ? passenger.route.slice(1)
      : [...passenger.route];

    if (passenger.destination === stationId || route.length <= 1) {
      delivered.push(passenger);
      continue;
    }

    // Preserve extra passenger fields while giving the in-game passenger its
    // own progressed route. Shared or cached route arrays remain untouched.
    const progressed = { ...passenger, route } as TPassenger;

    if (nextStationId !== route[1]) {
      transferring.push(progressed);
    } else {
      continuing.push(progressed);
    }
  }

  return { continuing, transferring, delivered };
}
