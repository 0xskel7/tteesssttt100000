import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthBootstrap } from "./auth.bootstrap";
import { UsersStore } from "./users.store";

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          algorithm: "HS256" as const,
          issuer: "flight-platform",
          audience: "api",
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersStore, AuthBootstrap],
  exports: [AuthService, UsersStore, JwtModule],
})
export class AuthModule {}
