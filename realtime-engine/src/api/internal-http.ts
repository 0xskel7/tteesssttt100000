import express from "express";
import { timingSafeTokenEqual } from "../security/jwt";
import type { AppConfig } from "../config/env";
import type { PositionSnapshotStore } from "../state/snapshot-store";
import { CircuitBreaker, CircuitOpenError } from "../resilience/circuit-breaker";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createInternalApi(
  config: AppConfig,
  snapshots: PositionSnapshotStore,
  engineHealth: { ingestOk: boolean },
) {
  const app = express();
  app.use(express.json({ limit: "32kb" }));

  const breaker = new CircuitBreaker({
    name: "realtime-snapshot",
    failureThreshold: 5,
    successThreshold: 2,
    openMs: 10_000,
  });

  app.use((req, res, next) => {
    const token = req.header("x-internal-token") ?? "";
    if (!timingSafeTokenEqual(token, config.INTERNAL_API_TOKEN)) {
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
    if (idsParam.length > 3700) {
      res.status(400).json({ error: "flightIds too long" });
      return;
    }
    const flightIds = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (flightIds.length === 0 || flightIds.length > 100) {
      res.status(400).json({ error: "Provide 1–100 flightIds" });
      return;
    }
    if (!flightIds.every((id) => UUID_RE.test(id))) {
      res.status(400).json({ error: "flightIds must be UUIDs" });
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
