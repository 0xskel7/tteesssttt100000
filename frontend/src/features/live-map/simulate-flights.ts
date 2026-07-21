import type { LiveFlight } from "@/features/flight-tracking/types";

export function advanceFlights(flights: LiveFlight[]): LiveFlight[] {
  return flights.map((flight) => advanceFlight(flight));
}

function advanceFlight(flight: LiveFlight): LiveFlight {
  const remainingKm = distanceKm(
    flight.latitude,
    flight.longitude,
    flight.destination.latitude,
    flight.destination.longitude,
  );

  if (remainingKm < 35) {
    const altitudeFt = 34_000 + Math.round(Math.random() * 5_000);
    return {
      ...flight,
      latitude: flight.origin.latitude,
      longitude: flight.origin.longitude,
      altitudeFt,
      headingDeg: bearing(
        flight.origin.latitude,
        flight.origin.longitude,
        flight.destination.latitude,
        flight.destination.longitude,
      ),
      path: [
        {
          lat: flight.origin.latitude,
          lon: flight.origin.longitude,
          altFt: 0,
        },
      ],
    };
  }

  const step = Math.min(0.018, Math.max(0.004, 24 / remainingKm));
  const latitude =
    flight.latitude +
    (flight.destination.latitude - flight.latitude) * step;
  const longitude =
    flight.longitude +
    (flight.destination.longitude - flight.longitude) * step;
  const headingDeg = bearing(
    latitude,
    longitude,
    flight.destination.latitude,
    flight.destination.longitude,
  );
  const altitudeFt =
    remainingKm < 450
      ? Math.max(4_000, flight.altitudeFt - 650)
      : Math.min(41_000, flight.altitudeFt + (flight.altitudeFt < 34_000 ? 500 : 0));
  const hoursRemaining =
    remainingKm / Math.max(200, flight.groundSpeedKts * 1.852);
  const point = { lat: latitude, lon: longitude, altFt: altitudeFt };

  return {
    ...flight,
    latitude,
    longitude,
    headingDeg,
    altitudeFt,
    etaIso: new Date(Date.now() + hoursRemaining * 3_600_000).toISOString(),
    path: [...flight.path, point].slice(-120),
  };
}

function bearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const a = toRad(lat1);
  const b = toRad(lat2);
  const delta = toRad(lon2 - lon1);
  const y = Math.sin(delta) * Math.cos(b);
  const x =
    Math.cos(a) * Math.sin(b) -
    Math.sin(a) * Math.cos(b) * Math.cos(delta);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const radius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function toDeg(value: number): number {
  return (value * 180) / Math.PI;
}
