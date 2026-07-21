import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import {
  assertSafeProductionSecrets,
  resolveCorsOrigins,
} from "./common/security/hardening";

async function bootstrap() {
  assertSafeProductionSecrets(process.env);

  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (k: string, v: unknown) => void;
  };
  expressApp.set("trust proxy", process.env.TRUST_PROXY === "1" ? 1 : false);

  app.setGlobalPrefix("api");

  const origins = resolveCorsOrigins(process.env);
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Internal-Token"],
  });

  Logger.log(
    "Auth transport: Authorization Bearer (CSRF not applicable to cookie-less JWT)",
    "Security",
  );

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`Backend API listening on http://0.0.0.0:${port}/api`, "Bootstrap");
}

bootstrap().catch((err) => {
  console.error("Fatal bootstrap error", err);
  process.exit(1);
});
