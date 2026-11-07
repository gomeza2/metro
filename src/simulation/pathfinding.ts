/**
 * Builds an immutable route-planning snapshot for the active metro network.
 *
 * A planner is intentionally short-lived: recreate it when routes change. That
 * lets passenger spawning reuse adjacency and cached shortest paths between
 * network edits without allowing passengers to mutate cached route arrays.
 */
export type StationNode = { readonly id: string };
export type MetroRoute = { readonly stations: readonly string[] };

export interface RoutePlanner {
  findRoute(start: string, destination: string): readonly string[] | null;
}

export function createRoutePlanner(
  stations: readonly StationNode[],
  lines: readonly MetroRoute[],
): RoutePlanner {
  const adjacency = new Map<string, Set<string>>();

  for (const station of stations) {
    if (!adjacency.has(station.id)) adjacency.set(station.id, new Set());
  }

  for (const line of lines) {
    for (let index = 0; index < line.stations.length - 1; index += 1) {
      const from = line.stations[index];
      const to = line.stations[index + 1];
      if (!from || !to || from === to) continue;

      const fromEdges = adjacency.get(from);
      const toEdges = adjacency.get(to);
      if (!fromEdges || !toEdges) continue;

      fromEdges.add(to);
      toEdges.add(from);
    }
  }

  // Cache both successful and unsuccessful searches for this network snapshot.
  const routeCache = new Map<string, readonly string[] | null>();

  function findRoute(start: string, destination: string): readonly string[] | null {
    if (!adjacency.has(start) || !adjacency.has(destination)) return null;
    if (start === destination) return Object.freeze([start]);

    const cacheKey = JSON.stringify([start, destination]);
    if (routeCache.has(cacheKey)) {
      return routeCache.get(cacheKey) ?? null;
    }

    const previous = new Map<string, string | null>([[start, null]]);
    const queue: string[] = [start];
    let head = 0;
    let route: readonly string[] | null = null;

    // A head index avoids the repeated array shifting cost of Array.shift().
    while (head < queue.length) {
      const current = queue[head++];
      if (!current) continue;

      for (const neighbour of adjacency.get(current) ?? []) {
        if (previous.has(neighbour)) continue;
        previous.set(neighbour, current);

        if (neighbour === destination) {
          const reversed = [destination];
          let cursor: string | null = current;
          while (cursor !== null) {
            reversed.push(cursor);
            cursor = previous.get(cursor) ?? null;
          }
          route = Object.freeze(reversed.reverse());
          queue.length = 0;
          break;
        }

        queue.push(neighbour);
      }
    }

    routeCache.set(cacheKey, route);
    return route;
  }

  return Object.freeze({ findRoute });
}
