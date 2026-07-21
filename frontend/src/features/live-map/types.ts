export interface FlightPositionUpdate {
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

export const SOCKET_EVENTS = {
  SUBSCRIBE_FLIGHTS: "subscribe:flights",
  UNSUBSCRIBE_FLIGHTS: "unsubscribe:flights",
  PING: "client:ping",
  POSITION_UPDATE: "flight:position",
  SUBSCRIBED: "subscribe:ack",
  UNSUBSCRIBED: "unsubscribe:ack",
  ERROR: "server:error",
  PONG: "server:pong",
  SNAPSHOT: "flight:snapshot",
} as const;

/** Persisted so a WS drop does not reset the user's map camera. */
export interface MapViewState {
  center: { lat: number; lng: number };
  zoom: number;
  bearing?: number;
  pitch?: number;
}

export const MAP_VIEW_STORAGE_KEY = "flight-platform:map-view";
