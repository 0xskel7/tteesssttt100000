import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class GetFlightParamsDto {
  @IsUUID()
  id!: string;
}

export class ListFlightsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  status?: string;
}
