import http from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { loadConfig } from "./config/env";
import { createRedisClients } from "./config/redis";
import { PositionSnapshotStore } from "./state/snapshot-store";
import { PositionPubSub } from "./streaming/pubsub";
import { WsRateLimiter } from "./resilience/ws-rate-limiter";
import { registerSocketGateway } from "./streaming/socket-gateway";
import { createInternalApi } from "./api/internal-http";

async function bootstrap() {
  const config = loadConfig();
  const redis = createRedisClients(config);
  const snapshots = new PositionSnapshotStore(redis.commands, config);
  const rateLimiter = new WsRateLimiter(redis.commands, config);

  const engineHealth = { ingestOk: true };

  const internalApp = createInternalApi(config, snapshots, engineHealth);
  const server = http.createServer(internalApp);

  const io = new Server(server, {
    path: "/ws",
    cors: {
      origin: config.corsOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Tuned for many idle map watchers
    pingInterval: 25_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 1e5,
  });

  // Multi-instance fan-out: any engine node can emit to rooms on others
  io.adapter(createAdapter(redis.publisher.duplicate(), redis.subscriber.duplicate()));

  const pubsub = new PositionPubSub(
    config,
    redis.publisher,
    redis.subscriber,
    io,
    snapshots,
  );
  await pubsub.start();

  registerSocketGateway(io, rateLimiter, snapshots, config);

  // Expose publisher for ingest simulator / future provider adapters
  (global as unknown as { __flightPubSub?: PositionPubSub }).__flightPubSub = pubsub;

  server.listen(config.PORT, config.HOST, () => {
    console.info(
      `[realtime-engine] listening on ${config.HOST}:${config.PORT} (ws path /ws)`,
    );
  });

  const shutdown = async (signal: string) => {
    console.info(`[realtime-engine] ${signal} — shutting down`);
    engineHealth.ingestOk = false;
    io.close();
    server.close();
    redis.publisher.disconnect();
    redis.subscriber.disconnect();
    redis.commands.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  console.error("[realtime-engine] fatal", err);
  process.exit(1);
});
