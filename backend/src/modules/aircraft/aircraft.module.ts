import { Module } from "@nestjs/common";
import { AircraftController } from "./aircraft.controller";
import { AircraftService } from "./aircraft.service";
import { AircraftStore } from "./aircraft.store";

@Module({
  controllers: [AircraftController],
  providers: [AircraftService, AircraftStore],
  exports: [AircraftService, AircraftStore],
})
export class AircraftModule {}
