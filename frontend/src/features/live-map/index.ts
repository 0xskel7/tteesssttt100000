export { FlightSocketClient } from "./flight-socket-client";
export type { ConnectionStatus, FlightSocketClientOptions } from "./flight-socket-client";
export {
  saveMapView,
  loadMapView,
  clearMapView,
} from "./map-view-persistence";
export { SOCKET_EVENTS } from "./types";
export type { FlightPositionUpdate, MapViewState } from "./types";

/**
 * Feature: live-map
 * -----------------
 * WebSocket client is isolated here. Map camera persistence is separate from
 * socket lifecycle so reconnect never resets pan/zoom.
 */
