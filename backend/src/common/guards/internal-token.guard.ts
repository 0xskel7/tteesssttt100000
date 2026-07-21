import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { timingSafeEqual } from "crypto";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>("INTERNAL_API_TOKEN", "");
    if (!expected || expected.length < 16) {
      throw new ForbiddenException("Internal API token not configured");
    }
    const req = context.switchToHttp().getRequest<{
      headers: { "x-internal-token"?: string };
    }>();
    const provided = req.headers["x-internal-token"] ?? "";
    if (!timingSafeStringEqual(provided, expected)) {
      throw new UnauthorizedException("Invalid internal token");
    }
    return true;
  }
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
