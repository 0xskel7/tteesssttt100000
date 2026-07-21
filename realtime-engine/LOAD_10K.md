# Handling 10,000 Concurrent WebSocket Users

## Goal

Keep the map interactive for ~10k simultaneous clients without collapsing Auth/API or melting a single Node process.

## Core idea: do not broadcast the firehose

```text
Ingest → Redis Pub/Sub channel (flight:positions)
              │
              ▼
     Realtime Engine nodes (N replicas)
              │
              ▼
   Socket.io rooms: flight:{id}
              │
              ▼
   Only clients who subscribed to that flight
```

Each user typically watches a handful of flights (or the viewport set). They **never** receive every aircraft on earth. That alone is the difference between ~10k × 2 events/s targeted vs millions of wasted messages.

## Horizontal scale (required at 10k)

| Layer | Approach |
|-------|----------|
| Engine replicas | Run **3–N** `realtime-engine` pods behind a load balancer |
| Socket.io adapter | `@socket.io/redis-adapter` so emit-to-room works across nodes |
| Sticky sessions | Prefer Redis adapter (stateless enough); if using memory rooms only, enable LB sticky cookies |
| Redis | Dedicated Redis (or Redis Cluster) for Pub/Sub + rate-limit counters + snapshots |
| CPU | ~2–4k idle sockets per Node process is a safe planning number; 10k ⇒ **at least 3–5 nodes** |

Rough capacity planning:

- 10,000 sockets ÷ 2,500 sockets/process ≈ **4 engine instances**
- Add 1–2 instances for spike headroom and rolling deploys

## Reduce work per message

1. **Room fan-out** — `io.to(flight:{id}).emit(...)` only.
2. **Viewport subscribe** — Frontend subscribes to flights in map bounds; unsubscribes when they leave (already rate-limited).
3. **Throttle ingest** — Cap provider updates (e.g. 1–2 Hz per flight) before publish.
4. **Binary/compact payloads** later if needed; start with small JSON.
5. **Continuous aggregates / snapshots** — On reconnect, send Redis snapshot once, then deltas.

## Protect the process (already in code)

- Max connections **per IP** (multi-tab / abuse)
- Max subscribe ops / minute
- Max client events / second
- `maxHttpBufferSize` capped on Socket.io
- Internal HTTP token so the public never hits snapshot admin routes

## Isolate failure (Circuit Breaker + Fallback)

```text
Frontend map ──WS──▶ Realtime Engine ──Redis──▶ positions
                │
Backend API ──HTTP──▶ Engine /v1/positions/latest
                │         │
                │    Circuit open?
                ▼         ▼
         PostgreSQL last row in flight_positions (TimescaleDB)
```

- If the engine or Redis dies: **login, flights CRUD, subscriptions keep working**.
- Map shows **last known position** (Redis snapshot first, then DB) with a “live degraded” badge.
- Circuit breaker stops the backend from stampeding a dead engine.

## What would make 10k collapse (avoid these)

- Emitting every position to `io.emit` (global broadcast)
- One giant Node process with no Redis adapter
- Storing full history over WebSocket instead of DB/Timescale
- Unbounded reconnect storms without jitter/backoff (frontend uses exponential backoff)
- Putting Auth sessions and telemetry on the same overloaded Redis DB without memory limits

## Suggested production topology

```text
                 ┌────────────┐
  Clients ──────▶│  LB / CDN  │
                 └─────┬──────┘
           ┌───────────┼───────────┐
           ▼           ▼           ▼
        engine-1    engine-2    engine-3     ← Socket.io + Redis adapter
           └───────────┼───────────┘
                       ▼
                 Redis (Pub/Sub + snapshots + rate limits)
                       ▲
                       │
                   ingest workers
                       │
                       ▼
              PostgreSQL + TimescaleDB (durable history)
```

With room-based Pub/Sub, 4–5 engine replicas, Redis, and circuit-breaker fallbacks, **10k concurrent watchers is a capacity planning problem — not a single-server heroics problem.**
