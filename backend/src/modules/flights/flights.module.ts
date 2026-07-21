import { Module } from "@nestjs/common";
import { FlightsController } from "./flights.controller";
import { FlightsService } from "./flights.service";
import { FlightsStore } from "./flights.store";

@Module({
  controllers: [FlightsController],
  providers: [FlightsService, FlightsStore],
  exports: [FlightsService, FlightsStore],
})
export class FlightsModule {}
