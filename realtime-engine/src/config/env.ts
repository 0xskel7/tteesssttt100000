import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  PORT: z.coerce.number().default(4100),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  REDIS_POSITIONS_CHANNEL: z.string().default("flight:positions"),
  REDIS_SNAPSHOT_PREFIX: z.string().default("flight:snapshot:"),
  WS_MAX_CONNECTIONS_PER_IP: z.coerce.number().default(5),
  WS_MAX_SUBSCRIBE_PER_MINUTE: z.coerce.number().default(60),
  WS_MAX_EVENTS_PER_SECOND: z.coerce.number().default(20),
  WS_SUBSCRIBE_BURST: z.coerce.number().default(10),
  POSITION_SNAPSHOT_TTL_SECONDS: z.coerce.number().default(3600),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  INTERNAL_API_TOKEN: z.string().min(8),
});

export type AppConfig = z.infer<typeof envSchema> & {
  corsOrigins: string[];
};

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid realtime-engine environment configuration");
  }
  const data = parsed.data;
  return {
    ...data,
    corsOrigins: data.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
  };
}
