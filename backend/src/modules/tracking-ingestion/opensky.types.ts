export interface OpenSkyStateVector {
  icao24: string;
  callsign: string | null;
  originCountry: string | null;
  longitude: number | null;
  latitude: number | null;
  baroAltitudeM: number | null;
  onGround: boolean | null;
  velocityMs: number | null;
  trueTrackDeg: number | null;
  verticalRateMs: number | null;
  lastContact: number | null;
}

export interface NormalizedPositionEvent {
  flightId: string;
  icao24: string;
  latitude: number;
  longitude: number;
  altitudeFt: number | null;
  groundSpeedKts: number | null;
  headingDeg: number | null;
  onGround: boolean | null;
  recordedAt: string;
  source: "opensky";
}

/** OpenSky `states` row indices — https://openskynetwork.github.io/opensky-api/rest.html */
export function parseOpenSkyState(row: unknown[]): OpenSkyStateVector | null {
  if (!Array.isArray(row) || row.length < 12) return null;
  const icao24 = String(row[0] ?? "").trim().toLowerCase();
  if (!icao24 || icao24.length !== 6) return null;

  return {
    icao24,
    callsign: row[1] != null ? String(row[1]).trim() || null : null,
    originCountry: row[2] != null ? String(row[2]) : null,
    longitude: num(row[5]),
    latitude: num(row[6]),
    baroAltitudeM: num(row[7]),
    onGround: typeof row[8] === "boolean" ? row[8] : null,
    velocityMs: num(row[9]),
    trueTrackDeg: num(row[10]),
    verticalRateMs: num(row[11]),
    lastContact: num(row[4]),
  };
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

export function metersToFeet(m: number): number {
  return m / 0.3048;
}

export function msToKnots(ms: number): number {
  return ms * 1.94384;
}
