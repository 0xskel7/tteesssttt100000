import type { Redis } from "ioredis";
import type { Server } from "socket.io";
import type { AppConfig } from "../config/env";
import {
  SOCKET_EVENTS,
  flightRoom,
  type FlightPositionUpdate,
} from "../types/position";
import type { PositionSnapshotStore } from "../state/snapshot-store";

/**
 * Pub/Sub hub:
 * - Publishers (ingest pipeline / other engine instances) → Redis channel
 * - This process SUBSCRIBEs and fans out only to Socket.io rooms for that flight
 *
 * Clients never receive the full firehose — they join `flight:{id}` rooms only.
 */
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

  /** Ingest / simulator / other services call this to publish a position. */
  async publish(update: FlightPositionUpdate): Promise<void> {
    await this.snapshots.save(update);
    await this.publisher.publish(
      this.config.REDIS_POSITIONS_CHANNEL,
      JSON.stringify(update),
    );
  }

  private async onMessage(message: string): Promise<void> {
    let update: FlightPositionUpdate;
    try {
      update = JSON.parse(message) as FlightPositionUpdate;
    } catch {
      console.warn("[pubsub] invalid JSON payload");
      return;
    }
    if (!update?.flightId) return;

    // Persist snapshot even if this instance didn't publish (multi-node)
    await this.snapshots.save(update);

    // Targeted fan-out: only sockets that subscribed to this flight
    this.io
      .to(flightRoom(update.flightId))
      .emit(SOCKET_EVENTS.POSITION_UPDATE, update);
  }
}
