# Horizon Frontend

Next.js 14 App Router + TypeScript (strict) + CesiumJS 3D globe + Framer Motion.

## Features

- Full-bleed **Cesium** globe with real altitude
- Click aircraft → **camera fly-to** + side **FlightDetailPanel** (Framer Motion)
- Flight path polyline (origin → current)
- **3D glTF** aircraft oriented by heading, with **2D canvas fallback**
- Design tokens in `src/shared/design-tokens`
- Independent route Error Boundaries: `/` vs `/track/[flightId]`

## Run

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Optional: put `public/models/aircraft.glb` or set `NEXT_PUBLIC_AIRCRAFT_MODEL_URL`.
Optional: set `NEXT_PUBLIC_CESIUM_ION_TOKEN` for Cesium Ion imagery/terrain.
