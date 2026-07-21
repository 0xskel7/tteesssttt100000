import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { UsersStore } from "./users.store";

/** Optional bootstrap admin from env (local/ops only). */
@Injectable()
export class AuthBootstrap implements OnModuleInit {
  constructor(
    private readonly users: UsersStore,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.config.get<string>("BOOTSTRAP_ADMIN_EMAIL");
    const password = this.config.get<string>("BOOTSTRAP_ADMIN_PASSWORD");
    if (!email || !password) return;
    if (this.users.findByEmail(email)) return;

    const passwordHash = await bcrypt.hash(password, 12);
    this.users.upsert({
      id: randomUUID(),
      email: email.toLowerCase(),
      passwordHash,
      displayName: "Admin",
      role: "admin",
      isActive: true,
      tokenVersion: 1,
      createdAt: new Date().toISOString(),
    });
  }
}
