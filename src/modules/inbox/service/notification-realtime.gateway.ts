import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  AuthenticatedSocket,
  socketAuthMiddleware,
} from 'src/middleware/socket-auth.middleware';
import { REALTIME_EVENTS, REALTIME_NAMESPACE } from 'src/shared/constant';

@WebSocketGateway({
  namespace: `/${REALTIME_NAMESPACE.NOTIFICATIONS}`,
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class NotificationRealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationRealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor() {
    // Apply shared socket auth middleware
    // This will be called by the gateway after instantiation
  }

  /**
   * Called after server is initialized
   * Register the shared auth middleware here
   */
  afterInit(server: Server) {
    server.use(socketAuthMiddleware);
    this.logger.log(
      'Socket auth middleware registered for notifications gateway',
    );
  }

  async handleConnection(client: AuthenticatedSocket) {
    if (!client.data.userId) {
      client.disconnect(true);
      return;
    }

    await client.join(this.userRoom(client.data.userId));
    this.logger.debug(
      `Notifications socket connected for user ${client.data.userId}`,
    );
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.data?.userId) {
      this.logger.debug(
        `Notifications socket disconnected for user ${client.data.userId}`,
      );
    }
  }

  emitNotificationCreated(userId: string, payload: unknown) {
    if (!this.server) {
      return;
    }

    this.server
      .to(this.userRoom(userId))
      .emit(REALTIME_EVENTS.NOTIFICATION_NEW, payload);
  }

  @SubscribeMessage(REALTIME_EVENTS.NOTIFICATION_ACKNOWLEDGE)
  handleNotificationAcknowledgement(
    client: any,
    payload: { message: string; notificationId: string },
  ) {
    this.logger.debug(
      `Received notification acknowledgement from user ${client.data?.userId}: ${payload.message} (ID: ${payload.notificationId})`,
    );
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
