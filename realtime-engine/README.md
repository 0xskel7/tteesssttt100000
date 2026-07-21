# Real-Time Tracking Engine

Independent service that ingests flight positions, stores last-known snapshots in Redis,
and fans out updates over **Socket.io** only to clients subscribed to specific flights.

## Run (local)

```bash
# Redis required
docker run -d --name flight-redis -p 6379:6379 redis:7-alpine

cd realtime-engine
cp .env.example .env
npm install
npm run dev

# optional: fake ADS-B stream
npm run simulate:ingest
```

- HTTP (internal): `http://localhost:4100/health`
- WebSocket: `http://localhost:4100/ws` (Socket.io path)

## Client contract

| Event | Direction | Purpose |
|-------|-----------|---------|
| `subscribe:flights` | C→S | `{ flightIds: uuid[] }` join rooms |
| `unsubscribe:flights` | C→S | leave rooms |
| `flight:snapshot` | S→C | last-known positions on subscribe/reconnect |
| `flight:position` | S→C | live update for a subscribed flight |
| `server:error` | S→C | rate limit / validation |

## Scale notes

See `LOAD_10K.md` for the 10,000 concurrent users design.
