import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  type HealthIndicatorResult,
} from "@nestjs/terminus";
import { Public } from "../../common/decorators/public.decorator";
import { OpenSkyClient } from "../tracking-ingestion/opensky.client";
import { PositionsPublisher } from "../tracking-ingestion/positions.publisher";
import { TrackingIngestionService } from "../tracking-ingestion/tracking-ingestion.service";
import { LiveTrackingService } from "../live-tracking/live-tracking.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly opensky: OpenSkyClient,
    private readonly publisher: PositionsPublisher,
    private readonly ingestion: TrackingIngestionService,
    private readonly liveTracking: LiveTrackingService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => ({
        api: { status: "up" },
      }),
      async (): Promise<HealthIndicatorResult> => {
        const h = this.opensky.health;
        return {
          opensky: {
            status: h.ok ? "up" : "down",
            consecutiveFailures: h.consecutiveFailures,
          },
        };
      },
      async (): Promise<HealthIndicatorResult> => {
        const h = this.publisher.health;
        return {
          redis_pubsub: {
            status: h.ok ? "up" : "down",
            redisStatus: h.redisStatus,
            publishErrors: h.publishErrors,
          },
        };
      },
      async (): Promise<HealthIndicatorResult> => {
        const circuit = this.liveTracking.getCircuitState();
        return {
          realtime_engine_circuit: {
            status: circuit === "open" ? "down" : "up",
            circuit,
          },
        };
      },
    ]);
  }

  @Public()
  @Get("api")
  apiOnly() {
    return {
      service: "api",
      status: "up",
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get("opensky")
  openskyOnly() {
    return {
      service: "opensky-ingestion",
      ...this.opensky.health,
      lastCycle: this.ingestion.getLastCycle(),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get("redis")
  redisOnly() {
    return {
      service: "redis-pubsub",
      ...this.publisher.health,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get("realtime-engine")
  realtimeOnly() {
    return {
      service: "realtime-engine-client",
      circuit: this.liveTracking.getCircuitState(),
      timestamp: new Date().toISOString(),
    };
  }
}
