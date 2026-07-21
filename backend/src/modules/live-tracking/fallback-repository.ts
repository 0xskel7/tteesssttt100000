import type { FlightPositionDto } from "./types";

export interface PositionFallbackRepository {
  getLatestPositions(flightIds: string[]): Promise<FlightPositionDto[]>;
}

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
