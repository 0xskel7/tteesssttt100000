import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`Backend API listening on http://0.0.0.0:${port}/api`, "Bootstrap");
}

bootstrap().catch((err) => {
  console.error("Fatal bootstrap error", err);
  process.exit(1);
});
