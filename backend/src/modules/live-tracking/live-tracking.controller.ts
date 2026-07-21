import { Controller, Get, Query } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { Public } from "../../common/decorators/public.decorator";
import { LiveTrackingService } from "./live-tracking.service";

class LatestQueryDto {
  @IsOptional()
  @IsString()
  flightIds?: string;
}

@Controller("live-tracking")
export class LiveTrackingController {
  constructor(private readonly live: LiveTrackingService) {}

  @Public()
  @Get("latest")
  latest(@Query() query: LatestQueryDto) {
    const ids = (query.flightIds ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100);
    return this.live.getLatestPositions(ids);
  }
}
