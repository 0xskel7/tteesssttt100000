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
  /** true when served from DB/cache because realtime path failed */
  degraded: boolean;
  source: "realtime-engine" | "database-fallback";
}
