import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { LiveTrackingModule } from "../live-tracking/live-tracking.module";
import { TrackingIngestionModule } from "../tracking-ingestion/tracking-ingestion.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [TerminusModule, TrackingIngestionModule, LiveTrackingModule],
  controllers: [HealthController],
})
export class HealthModule {}
