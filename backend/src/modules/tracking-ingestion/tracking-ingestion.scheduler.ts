import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import { TrackingIngestionService } from "./tracking-ingestion.service";

@Injectable()
export class TrackingIngestionScheduler {
  private readonly logger = new Logger(TrackingIngestionScheduler.name);
  private readonly intervalMs: number;

  constructor(
    private readonly ingestion: TrackingIngestionService,
    config: ConfigService,
  ) {
    this.intervalMs = config.get<number>("OPENSKY_POLL_INTERVAL_MS", 15_000);
    this.logger.log(`OpenSky poll interval: ${this.intervalMs}ms`);
  }

  private lastStartedAt = 0;

  @Interval(5_000)
  async tick(): Promise<void> {
    const now = Date.now();
    if (now - this.lastStartedAt < this.intervalMs) return;
    this.lastStartedAt = now;
    try {
      await this.ingestion.runCycle();
    } catch (err) {

      this.logger.error(
        `Unhandled ingestion error (suppressed): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
