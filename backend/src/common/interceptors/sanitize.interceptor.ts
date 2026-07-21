import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, map } from "rxjs";
import { sanitizeUntrustedText } from "../security/hardening";

@Injectable()
export class SanitizeResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => sanitize(data, 0)));
  }
}

const SECRET_KEYS = new Set([
  "password",
  "passwordHash",
  "stack",
  "internal",
  "refreshTokenHash",
  "tokenHash",
]);

function sanitize(value: unknown, depth: number): unknown {
  if (depth > 8) return null;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {

    if (/[<>"'`]/.test(value) || /[\u0000-\u001F]/.test(value)) {
      return sanitizeUntrustedText(value, 500) ?? "";
    }
    return value.length > 2000 ? value.slice(0, 2000) : value;
  }
  if (typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (SECRET_KEYS.has(k)) continue;
    out[k] = sanitize(v, depth + 1);
  }
  return out;
}
