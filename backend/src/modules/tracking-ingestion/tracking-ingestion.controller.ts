import { Controller, Post } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { TrackingIngestionService } from "./tracking-ingestion.service";

@Controller("tracking-ingestion")
export class TrackingIngestionController {
  constructor(private readonly ingestion: TrackingIngestionService) {}

  /** Manual trigger for ops/dev — still rate-limited globally. */
  @Public()
  @Post("run-once")
  runOnce() {
    return this.ingestion.runCycle();
  }
}
