import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
} from "class-validator";

export enum NotificationChannelDto {
  in_app = "in_app",
  email = "email",
  push = "push",
}

export class CreateSubscriptionDto {
  @IsUUID()
  flightId!: string;

  @IsEnum(NotificationChannelDto)
  channel!: NotificationChannelDto;

  @IsOptional()
  @IsBoolean()
  notifyOnDelay?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnDeparture?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnArrival?: boolean;
}
