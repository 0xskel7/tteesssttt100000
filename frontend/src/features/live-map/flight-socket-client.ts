import { io, type Socket } from "socket.io-client";
import { SOCKET_EVENTS, type FlightPositionUpdate } from "./types";

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface FlightSocketClientOptions {

  url: string;

  path?: string;

  accessToken?: string;

  onPosition?: (update: FlightPositionUpdate) => void;
  onSnapshot?: (updates: FlightPositionUpdate[]) => void;
  onStatus?: (status: ConnectionStatus) => void;
  onError?: (message: string) => void;
}

export class FlightSocketClient {
  private socket: Socket | null = null;
  private watchedFlightIds = new Set<string>();
  private status: ConnectionStatus = "disconnected";

  constructor(private readonly opts: FlightSocketClientOptions) {}

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getWatchedFlightIds(): string[] {
    return [...this.watchedFlightIds];
  }

  connect(): void {
    if (this.socket) return;

    this.setStatus("connecting");

    this.socket = io(this.opts.url, {
      path: this.opts.path ?? "/ws",
      transports: ["websocket", "polling"],
      auth: this.opts.accessToken
        ? { token: this.opts.accessToken }
        : undefined,

      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 8_000,
      randomizationFactor: 0.5,
      timeout: 10_000,
      autoConnect: true,
    });

    this.socket.on("connect", () => {
      this.setStatus("connected");

      this.resubscribeAll();
    });

    this.socket.on("disconnect", () => {
      this.setStatus("disconnected");
    });

    this.socket.io.on("reconnect_attempt", () => {
      this.setStatus("reconnecting");
    });

    this.socket.io.on("reconnect", () => {
      this.setStatus("connected");
      this.resubscribeAll();
    });

    this.socket.on("connect_error", (err) => {
      this.setStatus("error");
      this.opts.onError?.(err.message);
    });

    this.socket.on(SOCKET_EVENTS.POSITION_UPDATE, (update: FlightPositionUpdate) => {
      this.opts.onPosition?.(update);
    });

    this.socket.on(SOCKET_EVENTS.SNAPSHOT, (updates: FlightPositionUpdate[]) => {
      this.opts.onSnapshot?.(updates);
      for (const u of updates) this.opts.onPosition?.(u);
    });

    this.socket.on(SOCKET_EVENTS.ERROR, (payload: { message?: string }) => {
      this.opts.onError?.(payload?.message ?? "socket error");
    });
  }

  syncSubscriptions(flightIds: string[]): void {
    const next = new Set(flightIds);
    const toAdd: string[] = [];
    const toRemove: string[] = [];

    for (const id of next) {
      if (!this.watchedFlightIds.has(id)) toAdd.push(id);
    }
    for (const id of this.watchedFlightIds) {
      if (!next.has(id)) toRemove.push(id);
    }

    this.watchedFlightIds = next;

    if (!this.socket?.connected) return;

    if (toRemove.length) {
      this.socket.emit(SOCKET_EVENTS.UNSUBSCRIBE_FLIGHTS, { flightIds: toRemove });
    }
    if (toAdd.length) {
      this.socket.emit(SOCKET_EVENTS.SUBSCRIBE_FLIGHTS, { flightIds: toAdd });
    }
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.setStatus("disconnected");
  }

  private resubscribeAll(): void {
    if (!this.socket?.connected || this.watchedFlightIds.size === 0) return;
    this.socket.emit(SOCKET_EVENTS.SUBSCRIBE_FLIGHTS, {
      flightIds: [...this.watchedFlightIds],
    });
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.opts.onStatus?.(status);
  }
}
