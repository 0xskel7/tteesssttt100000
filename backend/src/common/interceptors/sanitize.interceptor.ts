import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, map } from "rxjs";

/**
 * Sanitized Output step: strip undefined, never leak stack/internal fields.
 * Controllers should already return DTOs; this is a last-line safety net.
 */
@Injectable()
export class SanitizeResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => sanitize(data)));
  }
}

function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (["password", "passwordHash", "stack", "internal"].includes(k)) continue;
    out[k] = sanitize(v);
  }
  return out;
}
