import type Redis from "ioredis";
import type { AppConfig } from "../config/env";
import type { FlightPositionUpdate } from "../types/position";

export class PositionSnapshotStore {
  constructor(
    private readonly redis: Redis,
    private readonly config: AppConfig,
  ) {}

  private key(flightId: string): string {
    return `${this.config.REDIS_SNAPSHOT_PREFIX}${flightId}`;
  }

  async save(update: FlightPositionUpdate): Promise<void> {
    await this.redis.set(
      this.key(update.flightId),
      JSON.stringify(update),
      "EX",
      this.config.POSITION_SNAPSHOT_TTL_SECONDS,
    );
  }

  async get(flightId: string): Promise<FlightPositionUpdate | null> {
    const raw = await this.redis.get(this.key(flightId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as FlightPositionUpdate;
    } catch {
      return null;
    }
  }

  async getMany(flightIds: string[]): Promise<FlightPositionUpdate[]> {
    if (flightIds.length === 0) return [];
    const keys = flightIds.map((id) => this.key(id));
    const rows = await this.redis.mget(...keys);
    const out: FlightPositionUpdate[] = [];
    for (const raw of rows) {
      if (!raw) continue;
      try {
        out.push(JSON.parse(raw) as FlightPositionUpdate);
      } catch {

      }
    }
    return out;
  }
}
