import type { AppRole } from "../../common/decorators/roles.decorator";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: AppRole;
  isActive: boolean;

  tokenVersion: number;
  createdAt: string;
}

export class UsersStore {
  private readonly byEmail = new Map<string, UserRecord>();
  private readonly byId = new Map<string, UserRecord>();

  upsert(user: UserRecord): UserRecord {
    this.byEmail.set(user.email.toLowerCase(), user);
    this.byId.set(user.id, user);
    return user;
  }

  findByEmail(email: string): UserRecord | undefined {
    return this.byEmail.get(email.toLowerCase());
  }

  findById(id: string): UserRecord | undefined {
    return this.byId.get(id);
  }

  bumpTokenVersion(userId: string): UserRecord | undefined {
    const user = this.byId.get(userId);
    if (!user) return undefined;
    user.tokenVersion += 1;
    this.upsert(user);
    return user;
  }
}
