/**
 * Atomic Redis-backed WebSocket rate limits (multi-instance safe).
 * Addresses CWE-400: connection storms, subscribe floods, event floods.
 */
import type { Redis } from "ioredis";
import type { AppConfig } from "../config/env";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: string };

const ACQUIRE_LUA = `
local key = KEYS[1]
local member = ARGV[1]
local max = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local count = redis.call('SCARD', key)
if count >= max then
  return 0
end
redis.call('SADD', key, member)
redis.call('EXPIRE', key, ttl)
return 1
`;

export class WsRateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly config: AppConfig,
  ) {}

  async tryAcquireConnection(ip: string, socketId: string): Promise<RateLimitResult> {
    const key = `ws:conn:${ip}`;
    const ok = await this.redis.eval(
      ACQUIRE_LUA,
      1,
      key,
      socketId,
      String(this.config.WS_MAX_CONNECTIONS_PER_IP),
      "3600",
    );
    if (ok !== 1) {
      return {
        allowed: false,
        reason: `Too many connections from this IP (max ${this.config.WS_MAX_CONNECTIONS_PER_IP})`,
      };
    }
    return { allowed: true };
  }

  async releaseConnection(ip: string, socketId: string): Promise<void> {
    await this.redis.srem(`ws:conn:${ip}`, socketId);
  }

  async allowSubscribe(socketId: string, flightCount: number): Promise<RateLimitResult> {
    if (flightCount > this.config.WS_SUBSCRIBE_BURST) {
      return {
        allowed: false,
        reason: `Too many flights in one subscribe call (max ${this.config.WS_SUBSCRIBE_BURST})`,
      };
    }
    const key = `ws:sub:${socketId}`;
    const current = await this.redis.incrby(key, flightCount);
    if (current === flightCount) await this.redis.expire(key, 60);
    if (current > this.config.WS_MAX_SUBSCRIBE_PER_MINUTE) {
      return {
        allowed: false,
        reason: `Subscribe rate exceeded (max ${this.config.WS_MAX_SUBSCRIBE_PER_MINUTE}/min)`,
      };
    }
    return { allowed: true };
  }

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
