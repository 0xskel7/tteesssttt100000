import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { NormalizedPositionEvent } from "./opensky.types";

/**
 * Publishes cleaned positions to Redis Pub/Sub for realtime-engine consumers.
 * Also writes last-known snapshot keys (same contract as realtime-engine).
 */
@Injectable()
export class PositionsPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(PositionsPublisher.name);
  private readonly redis: Redis;
  private readonly channel: string;
  private readonly snapshotPrefix: string;
  private publishErrors = 0;

  constructor(config: ConfigService) {
    this.redis = new Redis(config.get<string>("REDIS_URL", "redis://127.0.0.1:6379"), {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    this.channel = config.get<string>("REDIS_POSITIONS_CHANNEL", "flight:positions");
    this.snapshotPrefix = config.get<string>(
      "REDIS_SNAPSHOT_PREFIX",
      "flight:snapshot:",
    );

    this.redis.on("error", (err) => {
      this.logger.warn(`Redis error: ${err.message}`);
    });
  }

  get health() {
    return {
      redisStatus: this.redis.status,
      publishErrors: this.publishErrors,
      ok: this.redis.status === "ready" || this.redis.status === "connecting",
    };
  }

  async connect(): Promise<void> {
    if (this.redis.status === "wait") {
      await this.redis.connect();
    }
  }

  async publish(event: NormalizedPositionEvent): Promise<void> {
    const payload = {
      flightId: event.flightId,
      latitude: event.latitude,
      longitude: event.longitude,
      altitudeFt: event.altitudeFt,
      groundSpeedKts: event.groundSpeedKts,
      headingDeg: event.headingDeg,
      onGround: event.onGround,
      recordedAt: event.recordedAt,
      source: event.source,
    };

    try {
      await this.connect();
      const pipe = this.redis.pipeline();
      pipe.set(
        `${this.snapshotPrefix}${event.flightId}`,
        JSON.stringify(payload),
        "EX",
        3600,
      );
      pipe.publish(this.channel, JSON.stringify(payload));
      await pipe.exec();
    } catch (err) {
      this.publishErrors += 1;
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      this.redis.disconnect();
    } catch {
      /* ignore */
    }
  }
}
