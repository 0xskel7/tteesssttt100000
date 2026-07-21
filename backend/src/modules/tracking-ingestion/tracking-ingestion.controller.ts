import { Controller, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../common/decorators/public.decorator";
import { InternalTokenGuard } from "../../common/guards/internal-token.guard";
import { TrackingIngestionService } from "./tracking-ingestion.service";

@Controller("tracking-ingestion")
export class TrackingIngestionController {
  constructor(private readonly ingestion: TrackingIngestionService) {}

  @Public()
  @UseGuards(InternalTokenGuard)
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  @Post("run-once")
  runOnce() {
    return this.ingestion.runCycle();
  }
}
