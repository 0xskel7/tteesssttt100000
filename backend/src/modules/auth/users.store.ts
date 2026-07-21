export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
}

/** In-memory user store (swap for Postgres repository later). */
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
}
