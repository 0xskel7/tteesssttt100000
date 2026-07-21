import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { ListFlightsQueryDto } from "./dto/flights.dto";
import { FlightsService } from "./flights.service";

@Controller("flights")
export class FlightsController {
  constructor(private readonly flights: FlightsService) {}

  @Public()
  @Get()
  list(@Query() query: ListFlightsQueryDto) {
    return this.flights.listForMap(query.status);
  }

  @Public()
  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.flights.getById(id);
  }
}
