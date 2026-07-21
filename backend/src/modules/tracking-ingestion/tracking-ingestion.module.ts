import { Module } from "@nestjs/common";
import { AircraftModule } from "../aircraft/aircraft.module";
import { FlightsModule } from "../flights/flights.module";
import { OpenSkyClient } from "./opensky.client";
import { PositionsPublisher } from "./positions.publisher";
import { TrackingIngestionController } from "./tracking-ingestion.controller";
import { TrackingIngestionScheduler } from "./tracking-ingestion.scheduler";
import { TrackingIngestionService } from "./tracking-ingestion.service";

@Module({
  imports: [FlightsModule, AircraftModule],
  controllers: [TrackingIngestionController],
  providers: [
    OpenSkyClient,
    PositionsPublisher,
    TrackingIngestionService,
    TrackingIngestionScheduler,
  ],
  exports: [TrackingIngestionService, OpenSkyClient, PositionsPublisher],
})
export class TrackingIngestionModule {}
