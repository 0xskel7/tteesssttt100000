import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ValidationPipe } from "@nestjs/common";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { SanitizeResponseInterceptor } from "./common/interceptors/sanitize.interceptor";
import { AircraftModule } from "./modules/aircraft/aircraft.module";
import { AuthModule } from "./modules/auth/auth.module";
import { FlightsModule } from "./modules/flights/flights.module";
import { HealthModule } from "./modules/health/health.module";
import { LiveTrackingModule } from "./modules/live-tracking/live-tracking.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { TrackingIngestionModule } from "./modules/tracking-ingestion/tracking-ingestion.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>("THROTTLE_TTL_MS", 60_000),
          limit: config.get<number>("THROTTLE_LIMIT", 120),
        },
      ],
    }),
    AuthModule,
    FlightsModule,
    AircraftModule,
    NotificationsModule,
    TrackingIngestionModule,
    LiveTrackingModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: SanitizeResponseInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
