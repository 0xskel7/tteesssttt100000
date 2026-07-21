import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { AircraftService } from "./aircraft.service";
import { CreateAircraftDto } from "./dto/aircraft.dto";

@Controller("aircraft")
export class AircraftController {
  constructor(private readonly aircraft: AircraftService) {}

  @Get()
  list() {
    return this.aircraft.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.aircraft.getById(id);
  }

  @Post()
  create(@Body() dto: CreateAircraftDto) {
    return this.aircraft.create(dto);
  }
}
