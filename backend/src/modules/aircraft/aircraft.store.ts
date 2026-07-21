export interface AircraftRecord {
  id: string;
  icao24: string;
  registration: string | null;
  typeIcao: string | null;
  typeName: string | null;
  airlineName: string | null;
  maxPassengerCapacity: number | null;
  updatedAt: string;
}

export class AircraftStore {
  private readonly byId = new Map<string, AircraftRecord>();
  private readonly byIcao24 = new Map<string, AircraftRecord>();

  upsert(aircraft: AircraftRecord): AircraftRecord {
    this.byId.set(aircraft.id, aircraft);
    this.byIcao24.set(aircraft.icao24.toLowerCase(), aircraft);
    return aircraft;
  }

  findById(id: string): AircraftRecord | undefined {
    return this.byId.get(id);
  }

  findByIcao24(icao24: string): AircraftRecord | undefined {
    return this.byIcao24.get(icao24.toLowerCase());
  }

  list(): AircraftRecord[] {
    return [...this.byId.values()];
  }
}
