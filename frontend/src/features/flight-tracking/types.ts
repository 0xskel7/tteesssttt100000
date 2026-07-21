export interface AirportRef {
  code: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
}

export interface FlightAircraftInfo {
  registration: string;
  typeIcao: string;
  typeName: string;
  airlineName: string;
}

export interface SimulatedPassengerEstimate {
  estimatedPassengers: number;
  maxCapacity: number;
  loadFactor: number;
  isSimulated: true;
  note: string;
}

export interface LiveFlight {
  id: string;
  callsign: string;
  flightNumber: string;
  status: "in_air" | "scheduled" | "landed" | "delayed";
  origin: AirportRef;
  destination: AirportRef;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  groundSpeedKts: number;
  headingDeg: number;
  verticalRateFpm: number;
  etaIso: string;
  aircraft: FlightAircraftInfo;
  passengerEstimate: SimulatedPassengerEstimate;

  path: Array<{ lat: number; lon: number; altFt: number }>;
}

export interface MapSelection {
  flightId: string | null;
}
