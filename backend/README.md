# Backend API (NestJS)

Professional flight-tracking API with isolated domain modules.

## Modules

| Module | Path | Role |
|--------|------|------|
| Auth | `/api/auth` | Register / login / me (JWT) |
| Flights | `/api/flights` | Map feed + flight by id (partial-success list) |
| Aircraft | `/api/aircraft` | Aircraft registry |
| Notifications | `/api/notifications` | Flight subscriptions |
| Tracking-Ingestion | scheduled + `/api/tracking-ingestion/run-once` | OpenSky → clean → Redis Pub/Sub |
| Live-Tracking | `/api/live-tracking/latest` | Circuit Breaker client to realtime-engine |
| Health | `/api/health`, `/api/health/{api,opensky,redis,realtime-engine}` | Per-service checks |

## Request pipeline (every endpoint)

1. **Input Validation** — global `ValidationPipe` (`class-validator` DTOs)
2. **Auth** — global `JwtAuthGuard` (`@Public()` to opt out)
3. **Rate Limiting** — global `ThrottlerGuard` (+ tighter limits on auth)
4. **Business Logic** — module services
5. **Sanitized Output** — `SanitizeResponseInterceptor` strips secrets/undefined

## Resilience

- OpenSky calls use **retry + exponential backoff + jitter**
- Ingestion errors are swallowed by the scheduler — Auth/Flights keep serving
- `GET /api/flights` returns `{ items, meta.degraded, meta.errors }` so one bad row never blanks the map
- Redis publish failures skip that aircraft but keep the rest

## Run

```bash
cp .env.example .env
# Redis should be up (same as realtime-engine)
npm install
npm run dev
```

Manual ingest: `POST /api/tracking-ingestion/run-once`
