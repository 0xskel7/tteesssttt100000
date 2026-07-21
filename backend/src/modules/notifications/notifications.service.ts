import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { FlightsStore } from "../flights/flights.store";
import {
  CreateSubscriptionDto,
  NotificationChannelDto,
} from "./dto/notifications.dto";

export interface SubscriptionRecord {
  id: string;
  userId: string;
  flightId: string;
  channel: NotificationChannelDto;
  notifyOnDelay: boolean;
  notifyOnDeparture: boolean;
  notifyOnArrival: boolean;
  isActive: boolean;
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  private readonly subs: SubscriptionRecord[] = [];

  constructor(private readonly flights: FlightsStore) {}

  listForUser(userId: string): { items: SubscriptionRecord[] } {
    return {
      items: this.subs.filter((s) => s.userId === userId && s.isActive),
    };
  }

  subscribe(userId: string, dto: CreateSubscriptionDto): SubscriptionRecord {
    if (!this.flights.findById(dto.flightId)) {
      throw new NotFoundException(`Flight ${dto.flightId} not found`);
    }
    const existing = this.subs.find(
      (s) =>
        s.userId === userId &&
        s.flightId === dto.flightId &&
        s.channel === dto.channel &&
        s.isActive,
    );
    if (existing) return existing;

    const row: SubscriptionRecord = {
      id: randomUUID(),
      userId,
      flightId: dto.flightId,
      channel: dto.channel,
      notifyOnDelay: dto.notifyOnDelay ?? true,
      notifyOnDeparture: dto.notifyOnDeparture ?? true,
      notifyOnArrival: dto.notifyOnArrival ?? true,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.subs.push(row);
    return row;
  }

  unsubscribe(userId: string, subscriptionId: string): { ok: true } {
    const row = this.subs.find((s) => s.id === subscriptionId && s.userId === userId);
    if (!row) throw new NotFoundException("Subscription not found");
    row.isActive = false;
    return { ok: true };
  }
}
