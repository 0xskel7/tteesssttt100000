import {
  CircuitBreaker,
  CircuitOpenError,
} from "./circuit-breaker";
import type { PositionFallbackRepository } from "./fallback-repository";
import type { FlightPositionDto, LatestPositionsResult } from "./types";

export interface LiveTrackingClientOptions {
  engineBaseUrl: string;
  internalToken: string;
  timeoutMs?: number;
}

/**
 * Backend → Realtime Engine client.
 * Circuit Breaker ensures engine outages do not cascade into Auth / Flights APIs.
 */
export class LiveTrackingService {
  private readonly breaker: CircuitBreaker;
  private readonly timeoutMs: number;

  constructor(
    private readonly opts: LiveTrackingClientOptions,
    private readonly fallback: PositionFallbackRepository,
  ) {
    this.timeoutMs = opts.timeoutMs ?? 2000;
    this.breaker = new CircuitBreaker({
      name: "realtime-engine",
      failureThreshold: 3,
      successThreshold: 2,
      openMs: 15_000,
    });
  }

  getCircuitState() {
    return this.breaker.getState();
  }

  async getLatestPositions(flightIds: string[]): Promise<LatestPositionsResult> {
    try {
      const positions = await this.breaker.exec(() =>
        this.fetchFromEngine(flightIds),
      );
      return {
        positions,
        degraded: false,
        source: "realtime-engine",
      };
    } catch (err) {
      const fromDb = await this.fallback.getLatestPositions(flightIds);
      const reason =
        err instanceof CircuitOpenError ? "circuit_open" : "engine_error";
      console.warn(
        `[live-tracking] degraded (${reason}); serving ${fromDb.length} fallback rows`,
      );
      return {
        positions: fromDb,
        degraded: true,
        source: "database-fallback",
      };
    }
  }

  private async fetchFromEngine(flightIds: string[]): Promise<FlightPositionDto[]> {
    const url = new URL("/v1/positions/latest", this.opts.engineBaseUrl);
    url.searchParams.set("flightIds", flightIds.join(","));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        headers: { "x-internal-token": this.opts.internalToken },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`engine HTTP ${res.status}`);
      }

      const body = (await res.json()) as {
        degraded?: boolean;
        positions?: FlightPositionDto[];
      };

      if (body.degraded) {
        throw new Error("engine degraded");
      }

      return body.positions ?? [];
    } finally {
      clearTimeout(timer);
    }
  }
}
