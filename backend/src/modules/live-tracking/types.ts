export interface FlightPositionDto {
  flightId: string;
  latitude: number;
  longitude: number;
  altitudeFt: number | null;
  groundSpeedKts: number | null;
  headingDeg: number | null;
  onGround: boolean | null;
  recordedAt: string;
  source: string;
}

export interface LatestPositionsResult {
  positions: FlightPositionDto[];

  degraded: boolean;
  source: "realtime-engine" | "database-fallback";
}
