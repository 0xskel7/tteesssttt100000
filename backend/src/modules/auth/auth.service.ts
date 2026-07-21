import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { LoginDto, RegisterDto } from "./dto/auth.dto";
import { UsersStore } from "./users.store";

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersStore,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (this.users.findByEmail(dto.email)) {
      throw new ConflictException("Email already registered");
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.users.upsert({
      id: randomUUID(),
      email: dto.email.toLowerCase(),
      passwordHash,
      displayName: dto.displayName,
      createdAt: new Date().toISOString(),
    });
    return this.tokenResponse(user.id, user.email, user.displayName);
  }

  async login(dto: LoginDto) {
    const user = this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException("Invalid credentials");
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    return this.tokenResponse(user.id, user.email, user.displayName);
  }

  me(userId: string) {
    const user = this.users.findById(userId);
    if (!user) throw new UnauthorizedException("User not found");
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    };
  }

  private tokenResponse(userId: string, email: string, displayName: string) {
    const accessToken = this.jwt.sign({ sub: userId, email });
    return {
      accessToken,
      tokenType: "Bearer",
      user: { id: userId, email, displayName },
    };
  }
}
