import { Logger } from "@nestjs/common";

const DANGEROUS = /[<>"'`\\]/g;
const CONTROL = /[\u0000-\u001F\u007F]/g;

export function sanitizeUntrustedText(
  input: string | null | undefined,
  maxLen = 80,
): string | null {
  if (input == null) return null;
  const cleaned = input.replace(CONTROL, "").replace(DANGEROUS, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLen);
}

export function assertSafeProductionSecrets(env: NodeJS.ProcessEnv): void {
  const logger = new Logger("SecurityBootstrap");
  const nodeEnv = env.NODE_ENV ?? "development";
  const secret = env.JWT_SECRET ?? "";
  const weak =
    secret.length < 32 ||
    secret === "dev-jwt-secret-change-me-in-production";

  if (nodeEnv === "production" && weak) {
    throw new Error(
      "Refusing to start: JWT_SECRET must be a strong unique secret in production (>=32 chars)",
    );
  }
  if (weak) {
    logger.warn("JWT_SECRET is weak/default — acceptable only for local development");
  }
}

export function resolveCorsOrigins(env: NodeJS.ProcessEnv): string[] | false {
  const raw = (env.CORS_ORIGINS ?? "http://localhost:3000").trim();
  if (raw === "*") {
    if (env.NODE_ENV === "production") {
      throw new Error("CORS_ORIGINS=* is forbidden in production with credentials");
    }
    return false;
  }
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((o) => o.startsWith("http://") || o.startsWith("https://"));

  if (list.length === 0) {
    if (env.NODE_ENV === "production") {
      throw new Error("CORS_ORIGINS must be a non-empty allowlist in production");
    }
    return ["http://localhost:3000"];
  }
  return list;
}
