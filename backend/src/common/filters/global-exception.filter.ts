import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

/**
 * Global error envelope — never leak stacks to clients.
 * Partial domain failures should use Result DTOs instead of throwing when possible.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR";
    let message = "Unexpected server error";
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else if (body && typeof body === "object") {
        const b = body as Record<string, unknown>;
        message = String(b.message ?? message);
        code = String(b.error ?? exception.name);
        details = b.message;
      }
      code = httpCode(status, code);
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      message = "Unexpected server error";
    }

    res.status(status).json({
      ok: false,
      error: {
        code,
        message: Array.isArray(details) ? details : message,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
}

function httpCode(status: number, fallback: string): string {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 429:
      return "RATE_LIMITED";
    default:
      return fallback.toUpperCase().replace(/\s+/g, "_");
  }
}
