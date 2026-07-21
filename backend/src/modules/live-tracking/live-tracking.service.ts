import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CircuitBreaker, CircuitOpenError } from "./circuit-breaker";
import {
  InMemoryPositionFallback,
  type PositionFallbackRepository,
} from "./fallback-repository";
import type { FlightPositionDto, LatestPositionsResult } from "./types";
import { assertAllowedInternalServiceUrl } from "../../common/security/ssrf";

@Injectable()
export class LiveTrackingService implements OnModuleInit {
  private readonly logger = new Logger(LiveTrackingService.name);
  private breaker!: CircuitBreaker;
  private fallback!: PositionFallbackRepository;
  private engineBaseUrl = "http://127.0.0.1:4100";
  private internalToken = "dev-internal-token-change-me";
  private timeoutMs = 2000;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const raw = this.config.get<string>(
      "REALTIME_ENGINE_URL",
      "http://127.0.0.1:4100",
    );
    const allow = (
      this.config.get<string>(
        "REALTIME_ENGINE_ALLOWED_HOSTS",
        "127.0.0.1,localhost,realtime-engine",
      ) ?? ""
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const url = assertAllowedInternalServiceUrl(raw, allow);
    this.engineBaseUrl = url.origin;
    this.internalToken = this.config.get<string>(
      "INTERNAL_API_TOKEN",
      "dev-internal-token-change-me",
    );
    this.timeoutMs = this.config.get<number>("LIVE_TRACKING_TIMEOUT_MS", 2000);
    this.fallback = new InMemoryPositionFallback();
    this.breaker = new CircuitBreaker({
      name: "realtime-engine",
      failureThreshold: 3,
      successThreshold: 2,
      openMs: 15_000,
    });
  }

  getCircuitState() {
    return this.breaker?.getState() ?? "closed";
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
      this.logger.warn(
        `degraded (${reason}); serving ${fromDb.length} fallback rows`,
      );
      return {
        positions: fromDb,
        degraded: true,
        source: "database-fallback",
      };
    }
  }

  private async fetchFromEngine(
    flightIds: string[],
  ): Promise<FlightPositionDto[]> {
    // Base host already allowlisted — only append encoded query
    const url = new URL("/v1/positions/latest", this.engineBaseUrl);
    url.searchParams.set("flightIds", flightIds.join(","));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        headers: { "x-internal-token": this.internalToken },
        signal: controller.signal,
        redirect: "error",
      });
      if (!res.ok) throw new Error(`engine HTTP ${res.status}`);
      const body = (await res.json()) as {
        degraded?: boolean;
        positions?: FlightPositionDto[];
      };
      if (body.degraded) throw new Error("engine degraded");
      return body.positions ?? [];
    } finally {
      clearTimeout(timer);
    }
  }
}
