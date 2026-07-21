import type { Server, Socket } from "socket.io";
import { z } from "zod";
import type { AppConfig } from "../config/env";
import {
  SOCKET_EVENTS,
  flightRoom,
  type FlightPositionUpdate,
} from "../types/position";
import type { WsRateLimiter } from "../resilience/ws-rate-limiter";
import type { PositionSnapshotStore } from "../state/snapshot-store";
import { verifyAccessToken } from "../security/jwt";

const flightIdsSchema = z.object({
  flightIds: z.array(z.string().uuid()).min(1).max(50),
});

function clientIp(socket: Socket, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = socket.handshake.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {

      return forwarded.split(",")[0]?.trim() || "unknown";
    }
  }
  return socket.handshake.address || "unknown";
}

export function registerSocketGateway(
  io: Server,
  rateLimiter: WsRateLimiter,
  snapshots: PositionSnapshotStore,
  config: AppConfig,
): void {
  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        bearerFromHeader(socket.handshake.headers.authorization);

      if (!token) {
        return next(new Error("Unauthorized: missing access token"));
      }

      const payload = verifyAccessToken(token, config);
      socket.data.userId = payload.sub;

      const ip = clientIp(socket, config.TRUST_PROXY);
      const result = await rateLimiter.tryAcquireConnection(ip, socket.id);
      if (!result.allowed) {
        return next(new Error(result.reason));
      }
      socket.data.ip = ip;
      socket.data.subscribed = new Set<string>();
      next();
    } catch (err) {
      next(new Error(err instanceof Error ? err.message : "Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const ip = socket.data.ip as string;

    socket.emit(SOCKET_EVENTS.PONG, {
      ok: true,
      serverTime: new Date().toISOString(),
    });

    socket.on(SOCKET_EVENTS.PING, async () => {
      if (!(await gate(socket, rateLimiter))) return;
      socket.emit(SOCKET_EVENTS.PONG, { serverTime: new Date().toISOString() });
    });

    socket.on(SOCKET_EVENTS.SUBSCRIBE_FLIGHTS, async (raw) => {
      if (!(await gate(socket, rateLimiter))) return;

      const parsed = flightIdsSchema.safeParse(raw);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: "BAD_SUBSCRIBE",
          message: "Invalid flightIds payload",
        });
        return;
      }

      const limit = await rateLimiter.allowSubscribe(
        socket.id,
        parsed.data.flightIds.length,
      );
      if (!limit.allowed) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: "RATE_LIMIT",
          message: limit.reason,
        });
        return;
      }

      const subscribed = socket.data.subscribed as Set<string>;

      if (
        subscribed.size + parsed.data.flightIds.length >
        config.WS_MAX_ROOMS_PER_SOCKET
      ) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: "ROOM_CAP",
          message: `Max ${config.WS_MAX_ROOMS_PER_SOCKET} flight subscriptions per connection`,
        });
        return;
      }

      for (const flightId of parsed.data.flightIds) {
        await socket.join(flightRoom(flightId));
        subscribed.add(flightId);
      }

      const latest = await snapshots.getMany(parsed.data.flightIds);
      if (latest.length > 0) {
        socket.emit(SOCKET_EVENTS.SNAPSHOT, latest satisfies FlightPositionUpdate[]);
      }

      socket.emit(SOCKET_EVENTS.SUBSCRIBED, {
        flightIds: parsed.data.flightIds,
      });
    });

    socket.on(SOCKET_EVENTS.UNSUBSCRIBE_FLIGHTS, async (raw) => {
      if (!(await gate(socket, rateLimiter))) return;
      const parsed = flightIdsSchema.safeParse(raw);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: "BAD_UNSUBSCRIBE",
          message: "Invalid flightIds payload",
        });
        return;
      }
      const subscribed = socket.data.subscribed as Set<string>;
      for (const flightId of parsed.data.flightIds) {
        await socket.leave(flightRoom(flightId));
        subscribed.delete(flightId);
      }
      socket.emit(SOCKET_EVENTS.UNSUBSCRIBED, {
        flightIds: parsed.data.flightIds,
      });
    });

    socket.on("disconnect", async () => {
      await rateLimiter.releaseConnection(ip, socket.id);
    });
  });
}

function bearerFromHeader(header: unknown): string | undefined {
  if (typeof header !== "string") return undefined;
  if (!header.startsWith("Bearer ")) return undefined;
  return header.slice(7).trim();
}

async function gate(socket: Socket, rateLimiter: WsRateLimiter): Promise<boolean> {
  const result = await rateLimiter.allowEvent(socket.id);
  if (!result.allowed) {
    socket.emit(SOCKET_EVENTS.ERROR, {
      code: "RATE_LIMIT",
      message: result.reason,
    });
    return false;
  }
  return true;
}
