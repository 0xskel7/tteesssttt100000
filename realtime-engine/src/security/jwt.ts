import { createHmac, timingSafeEqual } from "crypto";
import type { AppConfig } from "../config/env";

interface JwtPayload {
  sub: string;
  email?: string;
  typ?: string;
  tv?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

export function verifyAccessToken(
  token: string,
  config: AppConfig,
): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");
  const [h, p, s] = parts as [string, string, string];

  const expected = createHmac("sha256", config.JWT_SECRET)
    .update(`${h}.${p}`)
    .digest("base64url");

  const a = Buffer.from(s);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid JWT signature");
  }

  const header = JSON.parse(Buffer.from(h, "base64url").toString("utf8")) as {
    alg?: string;
  };
  if (header.alg !== "HS256") throw new Error("Unsupported JWT alg");

  const payload = JSON.parse(
    Buffer.from(p, "base64url").toString("utf8"),
  ) as JwtPayload;

  if (payload.typ && payload.typ !== "access") {
    throw new Error("Invalid token type");
  }
  if (payload.iss !== config.JWT_ISSUER) throw new Error("Invalid issuer");
  const aud = payload.aud;
  const audOk = Array.isArray(aud)
    ? aud.includes(config.JWT_AUDIENCE)
    : aud === config.JWT_AUDIENCE;
  if (!audOk) throw new Error("Invalid audience");
  if (payload.exp != null && payload.exp * 1000 < Date.now()) {
    throw new Error("Token expired");
  }
  if (!payload.sub) throw new Error("Missing sub");
  return payload;
}

export function timingSafeTokenEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
