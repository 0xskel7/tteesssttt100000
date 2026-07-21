import type { Redis } from "ioredis";
import type { Server } from "socket.io";
import { z } from "zod";
import type { AppConfig } from "../config/env";
import {
  SOCKET_EVENTS,
  flightRoom,
  type FlightPositionUpdate,
} from "../types/position";
import type { PositionSnapshotStore } from "../state/snapshot-store";

const positionSchema = z.object({
  flightId: z.string().uuid(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  altitudeFt: z.number().finite().nullable(),
  groundSpeedKts: z.number().finite().nullable(),
  headingDeg: z.number().finite().min(0).max(360).nullable(),
  onGround: z.boolean().nullable(),
  recordedAt: z.string().min(10).max(40),
  source: z.string().min(1).max(32),
});

export class PositionPubSub {
  constructor(
    private readonly config: AppConfig,
    private readonly publisher: Redis,
    private readonly subscriber: Redis,
    private readonly io: Server,
    private readonly snapshots: PositionSnapshotStore,
  ) {}

  async start(): Promise<void> {
    await this.subscriber.subscribe(this.config.REDIS_POSITIONS_CHANNEL);
    this.subscriber.on("message", (channel, message) => {
      if (channel !== this.config.REDIS_POSITIONS_CHANNEL) return;
      void this.onMessage(message);
    });
    console.info(
      `[pubsub] subscribed to ${this.config.REDIS_POSITIONS_CHANNEL}`,
    );
  }

  async publish(update: FlightPositionUpdate): Promise<void> {
    const parsed = positionSchema.parse(update);
    await this.snapshots.save(parsed);
    await this.publisher.publish(
      this.config.REDIS_POSITIONS_CHANNEL,
      JSON.stringify(parsed),
    );
  }

  private async onMessage(message: string): Promise<void> {
    if (message.length > 4096) {
      console.warn("[pubsub] payload too large — dropped");
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(message);
    } catch {
      console.warn("[pubsub] invalid JSON payload");
      return;
    }
    const parsed = positionSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn("[pubsub] schema validation failed");
      return;
    }
    const update = parsed.data;
    await this.snapshots.save(update);
    this.io
      .to(flightRoom(update.flightId))
      .emit(SOCKET_EVENTS.POSITION_UPDATE, update);
  }
}
