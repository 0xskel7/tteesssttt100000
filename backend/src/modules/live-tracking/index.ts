export { CircuitBreaker, CircuitOpenError } from "./circuit-breaker";
export { LiveTrackingService } from "./live-tracking.service";
export {
  InMemoryPositionFallback,
  type PositionFallbackRepository,
} from "./fallback-repository";
export type {
  FlightPositionDto,
  LatestPositionsResult,
} from "./types";

/**
 * Domain module: Live-Tracking
 * --------------------------------
 * Independent from Auth / Flights / Notifications.
 * Only this module talks to realtime-engine.
 * On failure → Circuit Breaker opens → Fallback to last known DB positions.
 * Rest of API continues normally.
 */
export const LIVE_TRACKING_MODULE = {
  name: "live-tracking",
  dependsOn: ["realtime-engine", "database-flight-positions"],
  isolatesFailureFrom: ["users-auth", "flights", "aircraft", "notifications"],
} as const;
