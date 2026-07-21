import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import type { FlightStatus } from "../flights.store";

const FLIGHT_STATUSES = [
  "scheduled",
  "boarding",
  "departed",
  "in_air",
  "landed",
  "arrived",
  "delayed",
  "cancelled",
  "diverted",
  "unknown",
] as const satisfies readonly FlightStatus[];

export class ListFlightsQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(FLIGHT_STATUSES)
  status?: FlightStatus;
}

/** Injection-safe: only UUID-shaped ids, capped length. */
export class LatestFlightIdsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(3700)
  flightIds?: string;
}
