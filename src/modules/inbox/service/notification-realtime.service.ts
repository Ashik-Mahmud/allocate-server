import { Injectable, Logger } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { NotificationRealtimeGateway } from './notification-realtime.gateway';

@Injectable()
export class NotificationRealtimeService {
  private readonly logger = new Logger(NotificationRealtimeService.name);

  constructor(
    private readonly notificationGateway: NotificationRealtimeGateway,
  ) {}

  emitInAppNotification(notification: Notification) {
    try {
      this.notificationGateway.emitNotificationCreated(
        notification.user_id,
        notification,
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit real-time notification for user ${notification.user_id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
