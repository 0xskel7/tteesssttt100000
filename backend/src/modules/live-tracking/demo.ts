/**
 * Tiny demo: proves Circuit Breaker + Fallback without NestJS yet.
 * Run: npm run dev:live-tracking-demo
 */
import {
  InMemoryPositionFallback,
  LiveTrackingService,
} from "./index";

async function main() {
  const fallback = new InMemoryPositionFallback();
  fallback.seed([
    {
      flightId: "11111111-1111-1111-1111-111111111111",
      latitude: 24.71,
      longitude: 46.67,
      altitudeFt: 0,
      groundSpeedKts: 0,
      headingDeg: 0,
      onGround: true,
      recordedAt: new Date().toISOString(),
      source: "database-fallback",
    },
  ]);

  const service = new LiveTrackingService(
    {
      engineBaseUrl: process.env.REALTIME_ENGINE_URL ?? "http://127.0.0.1:4100",
      internalToken: process.env.INTERNAL_API_TOKEN ?? "dev-internal-token-change-me",
      timeoutMs: 800,
    },
    fallback,
  );

  const result = await service.getLatestPositions([
    "11111111-1111-1111-1111-111111111111",
  ]);

  console.log(JSON.stringify({ circuit: service.getCircuitState(), result }, null, 2));
}

main().catch(console.error);
