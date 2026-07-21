import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { UsersStore } from "../../modules/auth/users.store";

export interface JwtAccessPayload {
  sub: string;
  email: string;
  typ: "access";
  tv: number;
  jti: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly users: UsersStore,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: { userId: string; email: string };
    }>();

    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing Bearer token");
    }

    const token = header.slice("Bearer ".length).trim();
    try {
      const payload = this.jwt.verify<JwtAccessPayload>(token, {
        algorithms: ["HS256"],
        issuer: "flight-platform",
        audience: "api",
      });

      if (payload.typ !== "access") {
        throw new UnauthorizedException("Invalid token type");
      }

      // Broken Access Control: reject deleted/disabled users immediately
      const user = this.users.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException("User session revoked");
      }
      if (user.tokenVersion !== payload.tv) {
        throw new UnauthorizedException("Token revoked");
      }

      req.user = { userId: payload.sub, email: payload.email };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
