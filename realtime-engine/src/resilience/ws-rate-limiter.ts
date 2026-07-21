import type { Redis } from "ioredis";
import type { AppConfig } from "../config/env";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * WebSocket-level rate limiting backed by Redis so limits work across
 * horizontally scaled engine instances.
 */
export class WsRateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly config: AppConfig,
  ) {}

  /** Cap concurrent sockets per client IP. */
  async tryAcquireConnection(ip: string, socketId: string): Promise<RateLimitResult> {
    const key = `ws:conn:${ip}`;
    const count = await this.redis.scard(key);
    if (count >= this.config.WS_MAX_CONNECTIONS_PER_IP) {
      return {
        allowed: false,
        reason: `Too many connections from this IP (max ${this.config.WS_MAX_CONNECTIONS_PER_IP})`,
      };
    }
    await this.redis.sadd(key, socketId);
    await this.redis.expire(key, 3600);
    return { allowed: true };
  }

  async releaseConnection(ip: string, socketId: string): Promise<void> {
    const key = `ws:conn:${ip}`;
    await this.redis.srem(key, socketId);
  }

  /** Limit subscribe/unsubscribe churn per socket. */
  async allowSubscribe(socketId: string, flightCount: number): Promise<RateLimitResult> {
    const key = `ws:sub:${socketId}`;
    const current = await this.redis.incrby(key, flightCount);
    if (current === flightCount) {
      await this.redis.expire(key, 60);
    }
    if (current > this.config.WS_MAX_SUBSCRIBE_PER_MINUTE) {
      return {
        allowed: false,
        reason: `Subscribe rate exceeded (max ${this.config.WS_MAX_SUBSCRIBE_PER_MINUTE}/min)`,
      };
    }
    if (flightCount > this.config.WS_SUBSCRIBE_BURST) {
      return {
        allowed: false,
        reason: `Too many flights in one subscribe call (max ${this.config.WS_SUBSCRIBE_BURST})`,
      };
    }
    return { allowed: true };
  }

  /** Generic event flood protection (any client→server event). */
  async allowEvent(socketId: string): Promise<RateLimitResult> {
    const key = `ws:evt:${socketId}`;
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, 1);
    if (n > this.config.WS_MAX_EVENTS_PER_SECOND) {
      return {
        allowed: false,
        reason: `Event rate exceeded (max ${this.config.WS_MAX_EVENTS_PER_SECOND}/s)`,
      };
    }
    return { allowed: true };
  }
}
