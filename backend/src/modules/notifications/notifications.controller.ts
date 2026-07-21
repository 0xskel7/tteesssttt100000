import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../../common/decorators/current-user.decorator";
import { CreateSubscriptionDto } from "./dto/notifications.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("subscriptions")
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.listForUser(user.userId);
  }

  @Post("subscriptions")
  subscribe(@CurrentUser() user: AuthUser, @Body() dto: CreateSubscriptionDto) {
    return this.notifications.subscribe(user.userId, dto);
  }

  @Delete("subscriptions/:id")
  unsubscribe(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.notifications.unsubscribe(user.userId, id);
  }
}
