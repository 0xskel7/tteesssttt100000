/**
 * Shared position payload published on Redis and broadcast over Socket.io.
 * Keep this contract stable — backend fallback + frontend types depend on it.
 */
export interface FlightPositionUpdate {
  flightId: string;
  latitude: number;
  longitude: number;
  altitudeFt: number | null;
  groundSpeedKts: number | null;
  headingDeg: number | null;
  onGround: boolean | null;
  recordedAt: string; // ISO-8601
  source: string;
}

export interface SubscribePayload {
  flightIds: string[];
}

export interface UnsubscribePayload {
  flightIds: string[];
}

export const SOCKET_EVENTS = {
  // client → server
  SUBSCRIBE_FLIGHTS: "subscribe:flights",
  UNSUBSCRIBE_FLIGHTS: "unsubscribe:flights",
  PING: "client:ping",
  // server → client
  POSITION_UPDATE: "flight:position",
  SUBSCRIBED: "subscribe:ack",
  UNSUBSCRIBED: "unsubscribe:ack",
  ERROR: "server:error",
  PONG: "server:pong",
  SNAPSHOT: "flight:snapshot",
} as const;

export function flightRoom(flightId: string): string {
  return `flight:${flightId}`;
}
