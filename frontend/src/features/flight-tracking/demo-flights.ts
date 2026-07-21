import type { AirportRef, LiveFlight } from "./types";

const AIRPORTS = {
  RUH: airport("RUH", "King Khalid International", "Riyadh", 24.9576, 46.6988),
  JED: airport("JED", "King Abdulaziz International", "Jeddah", 21.6796, 39.1565),
  DXB: airport("DXB", "Dubai International", "Dubai", 25.2532, 55.3657),
  LHR: airport("LHR", "London Heathrow", "London", 51.47, -0.4543),
  SIN: airport("SIN", "Singapore Changi", "Singapore", 1.3644, 103.9915),
  DOH: airport("DOH", "Hamad International", "Doha", 25.2731, 51.6081),
  FCO: airport("FCO", "Leonardo da Vinci", "Rome", 41.8003, 12.2389),
  IST: airport("IST", "Istanbul Airport", "Istanbul", 41.2753, 28.7519),
  CAI: airport("CAI", "Cairo International", "Cairo", 30.1219, 31.4056),
  DMM: airport("DMM", "King Fahd International", "Dammam", 26.4712, 49.7979),
  MCT: airport("MCT", "Muscat International", "Muscat", 23.5933, 58.2844),
  BAH: airport("BAH", "Bahrain International", "Manama", 26.2708, 50.6336),
  AUH: airport("AUH", "Zayed International", "Abu Dhabi", 24.433, 54.6511),
  AMM: airport("AMM", "Queen Alia International", "Amman", 31.7226, 35.9932),
  KWI: airport("KWI", "Kuwait International", "Kuwait City", 29.2266, 47.9689),
} as const;

type AirportCode = keyof typeof AIRPORTS;

interface FlightSeed {
  id: string;
  flightNumber: string;
  callsign: string;
  from: AirportCode;
  to: AirportCode;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  groundSpeedKts: number;
  airline: string;
  aircraft: string;
  registration: string;
  capacity: number;
  occupancy: number;
}

const SEEDS: FlightSeed[] = [
  seed("001", "SV123", "SVA123", "RUH", "JED", 23.4, 43.2, 37_000, 478, "Saudia", "Boeing 777-300ER", "HZ-AK28", 400, 328),
  seed("002", "EK451", "UAE451", "DXB", "LHR", 31.5, 42.1, 39_000, 505, "Emirates", "Airbus A380-800", "A6-EVQ", 615, 489),
  seed("003", "BA17", "BAW017", "LHR", "SIN", 29.2, 55.4, 40_000, 492, "British Airways", "Boeing 787-9", "G-ZBLH", 298, 246),
  seed("004", "QR115", "QTR115", "DOH", "FCO", 30.2, 41.8, 38_000, 486, "Qatar Airways", "Airbus A350-900", "A7-ALM", 283, 231),
  seed("005", "TK145", "THY145", "IST", "RUH", 33.1, 40.6, 36_000, 462, "Turkish Airlines", "Airbus A321neo", "TC-LSN", 220, 177),
  seed("006", "FZ845", "FDB845", "DXB", "RUH", 24.8, 51.9, 34_000, 438, "flydubai", "Boeing 737 MAX 8", "A6-FMF", 172, 139),
  seed("007", "MS649", "MSR649", "CAI", "RUH", 26.4, 39.2, 35_000, 445, "EgyptAir", "Airbus A320neo", "SU-GFL", 142, 116),
  seed("008", "WY681", "OMA681", "MCT", "RUH", 23.8, 53.2, 33_000, 431, "Oman Air", "Boeing 737-800", "A4O-BM", 162, 128),
  seed("009", "GF167", "GFA167", "BAH", "JED", 24.1, 45.2, 34_000, 442, "Gulf Air", "Airbus A320neo", "A9C-TC", 136, 108),
  seed("010", "SV102", "SVA102", "LHR", "JED", 28.8, 34.7, 39_000, 498, "Saudia", "Boeing 787-10", "HZ-AR25", 357, 289),
  seed("011", "EK817", "UAE817", "DXB", "RUH", 24.7, 52.4, 35_000, 447, "Emirates", "Boeing 777-300ER", "A6-EPS", 360, 301),
  seed("012", "XY214", "KNE214", "JED", "DMM", 23.5, 44.1, 32_000, 421, "flynas", "Airbus A320neo", "HZ-NS44", 174, 142),
  seed("013", "SV573", "SVA573", "AUH", "RUH", 24.5, 51.6, 31_000, 425, "Saudia", "Airbus A320", "HZ-AS66", 144, 117),
  seed("014", "RJ734", "RJA734", "AMM", "RUH", 27.2, 41.4, 34_000, 439, "Royal Jordanian", "Embraer E195-E2", "JY-REB", 120, 91),
  seed("015", "KU773", "KAC773", "KWI", "RUH", 27.4, 45.3, 30_000, 418, "Kuwait Airways", "Airbus A320neo", "9K-AKL", 134, 107),
];

export const DEMO_FLIGHTS: LiveFlight[] = SEEDS.map((item) => {
  const origin = AIRPORTS[item.from];
  const destination = AIRPORTS[item.to];
  return {
    id: `a0000000-0000-4000-8000-000000000${item.id}`,
    callsign: item.callsign,
    flightNumber: item.flightNumber,
    status: "in_air",
    origin,
    destination,
    latitude: item.latitude,
    longitude: item.longitude,
    altitudeFt: item.altitudeFt,
    groundSpeedKts: item.groundSpeedKts,
    headingDeg: heading(item.latitude, item.longitude, destination.latitude, destination.longitude),
    verticalRateFpm: 0,
    etaIso: new Date(Date.now() + 90 * 60_000).toISOString(),
    aircraft: {
      registration: item.registration,
      typeIcao: item.aircraft,
      typeName: item.aircraft,
      airlineName: item.airline,
    },
    passengerEstimate: {
      estimatedPassengers: item.occupancy,
      maxCapacity: item.capacity,
      loadFactor: item.occupancy / item.capacity,
      isSimulated: true,
      note: "Approximate occupancy",
    },
    path: [
      { lat: origin.latitude, lon: origin.longitude, altFt: 0 },
      { lat: item.latitude, lon: item.longitude, altFt: item.altitudeFt },
    ],
  };
});

function airport(
  code: string,
  name: string,
  city: string,
  latitude: number,
  longitude: number,
): AirportRef {
  return { code, name, city, latitude, longitude };
}

function seed(
  id: string,
  flightNumber: string,
  callsign: string,
  from: AirportCode,
  to: AirportCode,
  latitude: number,
  longitude: number,
  altitudeFt: number,
  groundSpeedKts: number,
  airline: string,
  aircraft: string,
  registration: string,
  capacity: number,
  occupancy: number,
): FlightSeed {
  return {
    id,
    flightNumber,
    callsign,
    from,
    to,
    latitude,
    longitude,
    altitudeFt,
    groundSpeedKts,
    airline,
    aircraft,
    registration,
    capacity,
    occupancy,
  };
}

function heading(
  latitude: number,
  longitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
): number {
  const y = Math.sin(rad(destinationLongitude - longitude)) * Math.cos(rad(destinationLatitude));
  const x =
    Math.cos(rad(latitude)) * Math.sin(rad(destinationLatitude)) -
    Math.sin(rad(latitude)) *
      Math.cos(rad(destinationLatitude)) *
      Math.cos(rad(destinationLongitude - longitude));
  return (((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

function rad(value: number): number {
  return (value * Math.PI) / 180;
}
