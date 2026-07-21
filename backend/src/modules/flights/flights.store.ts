export type FlightStatus =
  | "scheduled"
  | "boarding"
  | "departed"
  | "in_air"
  | "landed"
  | "arrived"
  | "delayed"
  | "cancelled"
  | "diverted"
  | "unknown";

export interface FlightPosition {
  latitude: number;
  longitude: number;
  altitudeFt: number | null;
  groundSpeedKts: number | null;
  headingDeg: number | null;
  onGround: boolean | null;
  recordedAt: string;
  source: string;
}

export interface FlightRecord {
  id: string;
  flightNumber: string;
  callsign: string | null;
  icao24: string | null;
  aircraftId: string | null;
  originCountry: string | null;
  status: FlightStatus;
  lastPosition: FlightPosition | null;
  updatedAt: string;
  createdAt: string;
}

export class FlightsStore {
  private readonly byId = new Map<string, FlightRecord>();
  private readonly byIcao24 = new Map<string, string>();

  upsert(flight: FlightRecord): FlightRecord {
    this.byId.set(flight.id, flight);
    if (flight.icao24) this.byIcao24.set(flight.icao24.toLowerCase(), flight.id);
    return flight;
  }

  findById(id: string): FlightRecord | undefined {
    return this.byId.get(id);
  }

  findByIcao24(icao24: string): FlightRecord | undefined {
    const id = this.byIcao24.get(icao24.toLowerCase());
    return id ? this.byId.get(id) : undefined;
  }

  list(): FlightRecord[] {
    return [...this.byId.values()];
  }
}
