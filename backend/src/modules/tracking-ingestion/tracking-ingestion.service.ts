import { Injectable, Logger } from "@nestjs/common";
import { AircraftService } from "../aircraft/aircraft.service";
import { FlightsService } from "../flights/flights.service";
import { sanitizeUntrustedText } from "../../common/security/hardening";
import { OpenSkyClient } from "./opensky.client";
import {
  metersToFeet,
  msToKnots,
  type NormalizedPositionEvent,
  type OpenSkyStateVector,
} from "./opensky.types";
import { PositionsPublisher } from "./positions.publisher";

export interface IngestionCycleResult {
  fetched: number;
  accepted: number;
  skipped: number;
  published: number;
  errors: Array<{ icao24?: string; message: string }>;
  degraded: boolean;
  durationMs: number;
}

@Injectable()
export class TrackingIngestionService {
  private readonly logger = new Logger(TrackingIngestionService.name);
  private lastCycle: IngestionCycleResult | null = null;
  private running = false;

  constructor(
    private readonly opensky: OpenSkyClient,
    private readonly publisher: PositionsPublisher,
    private readonly flights: FlightsService,
    private readonly aircraft: AircraftService,
  ) {}

  getLastCycle(): IngestionCycleResult | null {
    return this.lastCycle;
  }

  async runCycle(): Promise<IngestionCycleResult> {
    if (this.running) {
      return (
        this.lastCycle ?? {
          fetched: 0,
          accepted: 0,
          skipped: 0,
          published: 0,
          errors: [{ message: "cycle_already_running" }],
          degraded: true,
          durationMs: 0,
        }
      );
    }

    this.running = true;
    const started = Date.now();
    const errors: Array<{ icao24?: string; message: string }> = [];
    let fetched = 0;
    let accepted = 0;
    let skipped = 0;
    let published = 0;

    try {
      let states: OpenSkyStateVector[] = [];
      try {
        states = await this.opensky.fetchStates();
        fetched = states.length;
      } catch (err) {
        const message = err instanceof Error ? err.message : "opensky_failed";
        this.logger.error(`OpenSky cycle failed (API continues): ${message}`);
        errors.push({ message });
        const result: IngestionCycleResult = {
          fetched: 0,
          accepted: 0,
          skipped: 0,
          published: 0,
          errors,
          degraded: true,
          durationMs: Date.now() - started,
        };
        this.lastCycle = result;
        return result;
      }

      for (const state of states) {
        try {
          const cleaned = this.cleanState(state);
          if (!cleaned) {
            skipped += 1;
            continue;
          }

          const plane = this.aircraft.ensureFromIcao24(cleaned.icao24);
          const flight = this.flights.upsertFromLive({
            icao24: cleaned.icao24,
            callsign: cleaned.callsign,
            originCountry: cleaned.originCountry,
            aircraftId: plane.id,
            position: {
              latitude: cleaned.latitude,
              longitude: cleaned.longitude,
              altitudeFt: cleaned.altitudeFt,
              groundSpeedKts: cleaned.groundSpeedKts,
              headingDeg: cleaned.headingDeg,
              onGround: cleaned.onGround,
              recordedAt: cleaned.recordedAt,
              source: "opensky",
            },
          });

          const event: NormalizedPositionEvent = {
            flightId: flight.id,
            icao24: cleaned.icao24,
            latitude: cleaned.latitude,
            longitude: cleaned.longitude,
            altitudeFt: cleaned.altitudeFt,
            groundSpeedKts: cleaned.groundSpeedKts,
            headingDeg: cleaned.headingDeg,
            onGround: cleaned.onGround,
            recordedAt: cleaned.recordedAt,
            source: "opensky",
          };

          accepted += 1;

          try {
            await this.publisher.publish(event);
            published += 1;
          } catch (pubErr) {
            const message =
              pubErr instanceof Error ? pubErr.message : "publish_failed";
            errors.push({ icao24: cleaned.icao24, message });

          }
        } catch (itemErr) {
          const message =
            itemErr instanceof Error ? itemErr.message : "state_failed";
          errors.push({ icao24: state.icao24, message });
          skipped += 1;

        }
      }
    } finally {
      this.running = false;
    }

    const result: IngestionCycleResult = {
      fetched,
      accepted,
      skipped,
      published,
      errors: errors.slice(0, 25),
      degraded: errors.length > 0,
      durationMs: Date.now() - started,
    };
    this.lastCycle = result;
    this.logger.log(
      `Ingestion cycle: fetched=${fetched} accepted=${accepted} published=${published} skipped=${skipped} errors=${errors.length}`,
    );
    return result;
  }

  private cleanState(state: OpenSkyStateVector): {
    icao24: string;
    callsign: string | null;
    originCountry: string | null;
    latitude: number;
    longitude: number;
    altitudeFt: number | null;
    groundSpeedKts: number | null;
    headingDeg: number | null;
    onGround: boolean | null;
    recordedAt: string;
  } | null {
    if (state.latitude == null || state.longitude == null) return null;
    if (state.latitude < -90 || state.latitude > 90) return null;
    if (state.longitude < -180 || state.longitude > 180) return null;

    let heading = state.trueTrackDeg;
    if (heading != null) {
      heading = ((heading % 360) + 360) % 360;
    }

    const recordedAt =
      state.lastContact != null
        ? new Date(state.lastContact * 1000).toISOString()
        : new Date().toISOString();

    return {
      icao24: state.icao24,
      callsign: sanitizeUntrustedText(state.callsign, 16),
      originCountry: sanitizeUntrustedText(state.originCountry, 64),
      latitude: state.latitude,
      longitude: state.longitude,
      altitudeFt:
        state.baroAltitudeM != null ? metersToFeet(state.baroAltitudeM) : null,
      groundSpeedKts:
        state.velocityMs != null ? msToKnots(state.velocityMs) : null,
      headingDeg: heading,
      onGround: state.onGround,
      recordedAt,
    };
  }
}
