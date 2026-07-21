import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AircraftStore, type AircraftRecord } from "./aircraft.store";
import { CreateAircraftDto } from "./dto/aircraft.dto";

@Injectable()
export class AircraftService {
  constructor(private readonly store: AircraftStore) {}

  list() {
    return { items: this.store.list().map(toPublic) };
  }

  getById(id: string) {
    const row = this.store.findById(id);
    if (!row) throw new NotFoundException(`Aircraft ${id} not found`);
    return toPublic(row);
  }

  getByIcao24(icao24: string) {
    const row = this.store.findByIcao24(icao24);
    if (!row) throw new NotFoundException(`Aircraft icao24=${icao24} not found`);
    return toPublic(row);
  }

  create(dto: CreateAircraftDto) {
    const existing = this.store.findByIcao24(dto.icao24);
    if (existing) {
      const updated = this.store.upsert({
        ...existing,
        registration: dto.registration ?? existing.registration,
        typeIcao: dto.typeIcao ?? existing.typeIcao,
        typeName: dto.typeName ?? existing.typeName,
        airlineName: dto.airlineName ?? existing.airlineName,
        maxPassengerCapacity:
          dto.maxPassengerCapacity ?? existing.maxPassengerCapacity,
        updatedAt: new Date().toISOString(),
      });
      return toPublic(updated);
    }

    const created = this.store.upsert({
      id: randomUUID(),
      icao24: dto.icao24.toLowerCase(),
      registration: dto.registration ?? null,
      typeIcao: dto.typeIcao ?? null,
      typeName: dto.typeName ?? null,
      airlineName: dto.airlineName ?? null,
      maxPassengerCapacity: dto.maxPassengerCapacity ?? null,
      updatedAt: new Date().toISOString(),
    });
    return toPublic(created);
  }

  /** Used by ingestion — never throws for a single bad aircraft. */
  ensureFromIcao24(icao24: string): AircraftRecord {
    const existing = this.store.findByIcao24(icao24);
    if (existing) return existing;
    return this.store.upsert({
      id: randomUUID(),
      icao24: icao24.toLowerCase(),
      registration: null,
      typeIcao: null,
      typeName: null,
      airlineName: null,
      maxPassengerCapacity: null,
      updatedAt: new Date().toISOString(),
    });
  }
}

function toPublic(a: AircraftRecord) {
  return {
    id: a.id,
    icao24: a.icao24,
    registration: a.registration,
    typeIcao: a.typeIcao,
    typeName: a.typeName,
    airlineName: a.airlineName,
    maxPassengerCapacity: a.maxPassengerCapacity,
    updatedAt: a.updatedAt,
  };
}
