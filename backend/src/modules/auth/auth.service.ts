import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "crypto";
import { sanitizeUntrustedText } from "../../common/security/hardening";
import { LoginDto, RefreshDto, RegisterDto } from "./dto/auth.dto";
import { UsersStore } from "./users.store";

interface RefreshRecord {
  userId: string;
  tokenHash: string;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  /** Opaque refresh tokens stored hashed — never persist raw tokens. */
  private readonly refreshTokens = new Map<string, RefreshRecord>();

  constructor(
    private readonly users: UsersStore,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    if (this.users.findByEmail(dto.email)) {
      throw new ConflictException("Email already registered");
    }
    const displayName = sanitizeUntrustedText(dto.displayName, 80);
    if (!displayName) {
      throw new ConflictException("Invalid display name");
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.users.upsert({
      id: randomUUID(),
      email: dto.email.toLowerCase(),
      passwordHash,
      displayName,
      role: "user",
      isActive: true,
      tokenVersion: 1,
      createdAt: new Date().toISOString(),
    });
    return this.issueSession(user.id, user.email, user.displayName, user.tokenVersion);
  }

  async login(dto: LoginDto) {
    const user = this.users.findByEmail(dto.email);
    // Constant-ish failure message (no user enumeration detail)
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    return this.issueSession(user.id, user.email, user.displayName, user.tokenVersion);
  }

  async refresh(dto: RefreshDto) {
    const hash = hashToken(dto.refreshToken);
    const row = this.refreshTokens.get(hash);
    if (!row || row.expiresAt < Date.now()) {
      this.refreshTokens.delete(hash);
      throw new UnauthorizedException("Invalid refresh token");
    }

    // Rotate: invalidate old refresh immediately (reuse detection = force re-login)
    this.refreshTokens.delete(hash);

    const user = this.users.findById(row.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException("User session revoked");
    }

    return this.issueSession(user.id, user.email, user.displayName, user.tokenVersion);
  }

  /** Logout: revoke refresh + bump tokenVersion so access JWTs die. */
  logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      this.refreshTokens.delete(hashToken(refreshToken));
    }
    // Revoke all refresh tokens for user
    for (const [key, row] of this.refreshTokens) {
      if (row.userId === userId) this.refreshTokens.delete(key);
    }
    this.users.bumpTokenVersion(userId);
    return { ok: true };
  }

  me(userId: string) {
    const user = this.users.findById(userId);
    if (!user || !user.isActive) throw new UnauthorizedException("User not found");
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  private issueSession(
    userId: string,
    email: string,
    displayName: string,
    tokenVersion: number,
  ) {
    const accessTtl = this.config.get<string>("JWT_ACCESS_EXPIRES_IN", "15m");
    const refreshDays = this.config.get<number>("JWT_REFRESH_DAYS", 7);

    const accessToken = this.jwt.sign(
      {
        sub: userId,
        email,
        typ: "access",
        tv: tokenVersion,
        jti: randomUUID(),
      },
      {
        algorithm: "HS256",
        expiresIn: accessTtl,
        issuer: "flight-platform",
        audience: "api",
      },
    );

    const refreshToken = randomBytes(48).toString("base64url");
    this.refreshTokens.set(hashToken(refreshToken), {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: Date.now() + refreshDays * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: accessTtl,
      user: { id: userId, email, displayName },
    };
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
