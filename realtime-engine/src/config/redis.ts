import Redis from "ioredis";
import type { AppConfig } from "../config/env";

export function createRedisClients(config: AppConfig) {
  // Separate connections: pub, sub, and commands must not share one Redis link
  // when using subscribe mode.
  const common = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  };

  const publisher = new Redis(config.REDIS_URL, common);
  const subscriber = new Redis(config.REDIS_URL, common);
  const commands = new Redis(config.REDIS_URL, common);

  for (const [name, client] of Object.entries({ publisher, subscriber, commands })) {
    client.on("error", (err) => {
      console.error(`[redis:${name}]`, err.message);
    });
  }

  return { publisher, subscriber, commands };
}

export type RedisClients = ReturnType<typeof createRedisClients>;
