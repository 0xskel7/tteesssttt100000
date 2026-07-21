import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AircraftService } from "./aircraft.service";
import { CreateAircraftDto } from "./dto/aircraft.dto";

@Controller("aircraft")
export class AircraftController {
  constructor(private readonly aircraft: AircraftService) {}

  @Public()
  @Get()
  list() {
    return this.aircraft.list();
  }

  @Public()
  @Get(":id")
  get(@Param("id") id: string) {
    return this.aircraft.getById(id);
  }

  @Roles("admin")
  @UseGuards(RolesGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post()
  create(@Body() dto: CreateAircraftDto) {
    return this.aircraft.create(dto);
  }
}
