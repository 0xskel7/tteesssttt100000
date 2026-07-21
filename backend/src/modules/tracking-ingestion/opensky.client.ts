import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { withRetry } from "../../common/utils/retry";
import { parseOpenSkyState, type OpenSkyStateVector } from "./opensky.types";

@Injectable()
export class OpenSkyClient {
  private readonly logger = new Logger(OpenSkyClient.name);
  private consecutiveFailures = 0;

  constructor(private readonly config: ConfigService) {}

  get health() {
    return {
      provider: "opensky",
      consecutiveFailures: this.consecutiveFailures,
      ok: this.consecutiveFailures < 5,
    };
  }

  async fetchStates(): Promise<OpenSkyStateVector[]> {
    const base = this.config.get<string>(
      "OPENSKY_BASE_URL",
      "https://opensky-network.org/api",
    );
    const timeoutMs = this.config.get<number>("OPENSKY_TIMEOUT_MS", 8000);
    const maxRetries = this.config.get<number>("OPENSKY_MAX_RETRIES", 4);
    const baseMs = this.config.get<number>("OPENSKY_BACKOFF_BASE_MS", 500);
    const maxMs = this.config.get<number>("OPENSKY_BACKOFF_MAX_MS", 8000);
    const bbox = this.config.get<string>("OPENSKY_BBOX", "");

    const url = new URL(`${base.replace(/\/$/, "")}/states/all`);
    if (bbox) {
      const [lamin, lomin, lamax, lomax] = bbox.split(",").map((s) => s.trim());
      if (lamin && lomin && lamax && lomax) {
        url.searchParams.set("lamin", lamin);
        url.searchParams.set("lomin", lomin);
        url.searchParams.set("lamax", lamax);
        url.searchParams.set("lomax", lomax);
      }
    }

    try {
      const states = await withRetry(
        () => this.doFetch(url.toString(), timeoutMs),
        {
          maxRetries,
          baseMs,
          maxMs,
          label: "opensky",
          onRetry: (attempt, err, delayMs) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `OpenSky retry #${attempt} in ${delayMs}ms — ${msg}`,
            );
          },
        },
      );
      this.consecutiveFailures = 0;
      return states;
    } catch (err) {
      this.consecutiveFailures += 1;
      throw err;
    }
  }

  private async doFetch(url: string, timeoutMs: number): Promise<OpenSkyStateVector[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`OpenSky HTTP ${res.status}`);
      }
      const body = (await res.json()) as { states?: unknown[] | null };
      const rows = body.states ?? [];
      const out: OpenSkyStateVector[] = [];
      for (const row of rows) {
        if (!Array.isArray(row)) continue;
        const parsed = parseOpenSkyState(row);
        if (parsed) out.push(parsed);
      }
      return out;
    } finally {
      clearTimeout(timer);
    }
  }
}
