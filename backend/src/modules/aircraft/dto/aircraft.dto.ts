import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";

export class CreateAircraftDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  icao24!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  registration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  typeIcao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  typeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  airlineName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxPassengerCapacity?: number;
}
