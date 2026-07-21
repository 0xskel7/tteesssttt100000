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

  // Nest Schedule Interval decorator needs a static-ish value;
  // we gate inside using configured interval via last-run check.
  private lastStartedAt = 0;

  @Interval(5_000)
  async tick(): Promise<void> {
    const now = Date.now();
    if (now - this.lastStartedAt < this.intervalMs) return;
    this.lastStartedAt = now;
    try {
      await this.ingestion.runCycle();
    } catch (err) {
      // Belt-and-suspenders: never let scheduler exceptions escape
      this.logger.error(
        `Unhandled ingestion error (suppressed): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
