import type { FlightPositionDto } from "./types";

/**
 * Fallback store: last known positions from PostgreSQL/TimescaleDB.
 * Swap implementation later with real repository; this keeps API up when engine is down.
 */
export interface PositionFallbackRepository {
  getLatestPositions(flightIds: string[]): Promise<FlightPositionDto[]>;
}

/** In-memory stub for local demos / unit tests */
export class InMemoryPositionFallback implements PositionFallbackRepository {
  constructor(private readonly rows = new Map<string, FlightPositionDto>()) {}

  seed(positions: FlightPositionDto[]): void {
    for (const p of positions) this.rows.set(p.flightId, p);
  }

  async getLatestPositions(flightIds: string[]): Promise<FlightPositionDto[]> {
    return flightIds
      .map((id) => this.rows.get(id))
      .filter((p): p is FlightPositionDto => Boolean(p));
  }
}
