# Flight Tracking Platform (monorepo)

## Packages

| Path | Role |
|------|------|
| `realtime-engine/` | Socket.io + Redis Pub/Sub tracking engine |
| `backend/` | NestJS API — Flights, Aircraft, Auth, Notifications, Tracking-Ingestion |
| `frontend/` | Next.js 14 + Cesium 3D globe (Horizon UI) |
| `infrastructure/` | DB schema, Docker, compose |

## Quick start (frontend)

```bash
cd frontend && cp .env.example .env.local && npm install && npm run dev
```

## Quick start (backend)

```bash
docker run -d --name flight-redis -p 6379:6379 redis:7-alpine
cd backend && cp .env.example .env && npm install && npm run dev
# API: http://localhost:4000/api  · Health: /api/health
```

## Quick start (realtime)

```bash
cd realtime-engine && cp .env.example .env && npm install && npm run dev
```

See `realtime-engine/LOAD_10K.md` for the 10k concurrent users design.
See `frontend/README.md` for Cesium / design-token notes.
See `backend/README.md` for module + resilience details.
