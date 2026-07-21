import express from "express";
import type { AppConfig } from "../config/env";
import type { PositionSnapshotStore } from "../state/snapshot-store";
import { CircuitBreaker, CircuitOpenError } from "../resilience/circuit-breaker";

/**
 * Internal HTTP API consumed by Backend Live-Tracking module.
 * Protected by INTERNAL_API_TOKEN — not exposed publicly.
 */
export function createInternalApi(
  config: AppConfig,
  snapshots: PositionSnapshotStore,
  engineHealth: { ingestOk: boolean },
) {
  const app = express();
  app.use(express.json());

  // Breaker around snapshot reads if Redis/engine path is unhealthy
  const breaker = new CircuitBreaker({
    name: "realtime-snapshot",
    failureThreshold: 5,
    successThreshold: 2,
    openMs: 10_000,
  });

  app.use((req, res, next) => {
    const token = req.header("x-internal-token");
    if (token !== config.INTERNAL_API_TOKEN) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  });

  app.get("/health", (_req, res) => {
    const state = breaker.getState();
    const ok = engineHealth.ingestOk && state !== "open";
    res.status(ok ? 200 : 503).json({
      service: "realtime-engine",
      ok,
      ingestOk: engineHealth.ingestOk,
      circuit: state,
      ts: new Date().toISOString(),
    });
  });

  app.get("/v1/positions/latest", async (req, res) => {
    const idsParam = String(req.query.flightIds ?? "");
    const flightIds = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (flightIds.length === 0 || flightIds.length > 100) {
      res.status(400).json({ error: "Provide 1–100 flightIds" });
      return;
    }

    try {
      const positions = await breaker.exec(() => snapshots.getMany(flightIds));
      res.json({
        source: "realtime-engine",
        degraded: false,
        positions,
      });
    } catch (err) {
      if (err instanceof CircuitOpenError) {
        // Explicit degraded signal — backend should serve its own DB fallback
        res.status(503).json({
          source: "realtime-engine",
          degraded: true,
          error: "circuit_open",
          message: "Realtime path unavailable; use last-known DB snapshot",
        });
        return;
      }
      res.status(500).json({ error: "snapshot_failed" });
    }
  });

  return app;
}
