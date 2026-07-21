import type { Server, Socket } from "socket.io";
import { z } from "zod";
import {
  SOCKET_EVENTS,
  flightRoom,
  type FlightPositionUpdate,
} from "../types/position";
import type { WsRateLimiter } from "../resilience/ws-rate-limiter";
import type { PositionSnapshotStore } from "../state/snapshot-store";

const flightIdsSchema = z.object({
  flightIds: z.array(z.string().uuid()).min(1).max(50),
});

function clientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return socket.handshake.address || "unknown";
}

/**
 * Socket.io gateway: subscribe-only rooms + rate limits + snapshot on join.
 */
export function registerSocketGateway(
  io: Server,
  rateLimiter: WsRateLimiter,
  snapshots: PositionSnapshotStore,
): void {
  io.use(async (socket, next) => {
    const ip = clientIp(socket);
    const result = await rateLimiter.tryAcquireConnection(ip, socket.id);
    if (!result.allowed) {
      return next(new Error(result.reason));
    }
    socket.data.ip = ip;
    socket.data.subscribed = new Set<string>();
    next();
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
      for (const flightId of parsed.data.flightIds) {
        await socket.join(flightRoom(flightId));
        subscribed.add(flightId);
      }

      // Immediate fallback: last known positions so map is never empty on join/reconnect
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
