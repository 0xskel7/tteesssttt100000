import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { collectPartial } from "../../common/utils/partial";
import {
  FlightsStore,
  type FlightPosition,
  type FlightRecord,
  type FlightStatus,
} from "./flights.store";

export interface UpsertLiveFlightInput {
  icao24: string;
  callsign: string | null;
  originCountry: string | null;
  position: FlightPosition;
  aircraftId?: string | null;
}

@Injectable()
export class FlightsService {
  private readonly logger = new Logger(FlightsService.name);

  constructor(private readonly store: FlightsStore) {}

  /**
   * Map payload: return all flights that serialize cleanly.
   * One corrupt record must NOT blank the whole map.
   */
  listForMap(status?: string) {
    const rows = this.store.list().filter((f) =>
      status ? f.status === status : true,
    );

    const results = rows.map((row) => {
      try {
        return { ok: true as const, value: this.toPublic(row) };
      } catch (err) {
        const message = err instanceof Error ? err.message : "serialize_failed";
        this.logger.warn(`Skipping flight ${row.id}: ${message}`);
        return { ok: false as const, id: row.id, message };
      }
    });

    const partial = collectPartial(results);
    return {
      items: partial.items,
      meta: {
        total: partial.items.length,
        skipped: partial.errors.length,
        degraded: partial.degraded,
        errors: partial.errors,
      },
    };
  }

  getById(id: string) {
    const row = this.store.findById(id);
    if (!row) throw new NotFoundException(`Flight ${id} not found`);
    try {
      return this.toPublic(row);
    } catch (err) {
      this.logger.error(`Flight ${id} corrupt`, err instanceof Error ? err.stack : undefined);
      throw new NotFoundException(`Flight ${id} unavailable`);
    }
  }

  /**
   * Per-state upsert from ingestion — isolated try/catch at caller.
   */
  upsertFromLive(input: UpsertLiveFlightInput): FlightRecord {
    const existing = this.store.findByIcao24(input.icao24);
    const now = new Date().toISOString();
    const status: FlightStatus = input.position.onGround ? "landed" : "in_air";

    if (existing) {
      return this.store.upsert({
        ...existing,
        callsign: input.callsign ?? existing.callsign,
        originCountry: input.originCountry ?? existing.originCountry,
        aircraftId: input.aircraftId ?? existing.aircraftId,
        status,
        lastPosition: input.position,
        updatedAt: now,
      });
    }

    const callsign = input.callsign?.trim() || null;
    return this.store.upsert({
      id: randomUUID(),
      flightNumber: callsign?.replace(/\s+/g, "") || input.icao24.toUpperCase(),
      callsign,
      icao24: input.icao24.toLowerCase(),
      aircraftId: input.aircraftId ?? null,
      originCountry: input.originCountry,
      status,
      lastPosition: input.position,
      createdAt: now,
      updatedAt: now,
    });
  }

  private toPublic(f: FlightRecord) {
    if (!f.id || !f.flightNumber) {
      throw new Error("invalid_flight_record");
    }
    return {
      id: f.id,
      flightNumber: f.flightNumber,
      callsign: f.callsign,
      icao24: f.icao24,
      aircraftId: f.aircraftId,
      originCountry: f.originCountry,
      status: f.status,
      lastPosition: f.lastPosition,
      updatedAt: f.updatedAt,
      createdAt: f.createdAt,
    };
  }
}
