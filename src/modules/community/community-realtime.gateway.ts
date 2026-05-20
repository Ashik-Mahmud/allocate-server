import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { CommunityHub } from '@prisma/client';
import { Server } from 'socket.io';
import {
  AuthenticatedSocket,
  socketAuthMiddleware,
} from 'src/middleware/socket-auth.middleware';
import { REALTIME_NAMESPACE } from 'src/shared/constant';
import { REALTIME_EVENTS } from 'src/shared/constant/realtime-events';
import { TPostComment } from './community.interface';

@WebSocketGateway({
  namespace: `/${REALTIME_NAMESPACE.COMMUNITY}`,
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class CommunityRealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(CommunityRealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor() {
    // Apply shared socket auth middleware
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
    if (!client.data.orgId) {
      client.disconnect(true);
      return;
    }

    await client.join(this.userRoom(client.data.orgId));
    this.logger.debug(
      `Notifications socket connected for organization ${client.data.orgId}`,
    );
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.data?.orgId) {
      this.logger.debug(
        `Notifications socket disconnected for organization ${client.data.orgId}`,
      );
    }
  }

  emitCommunityPostCreated(orgId: string, post: CommunityHub) {
    if (!this.server) {
      return;
    }

    this.server
      .to(this.userRoom(orgId))
      .emit(REALTIME_EVENTS.COMMUNITY_POST_NEW, post);
  }

  emitCommunityPostCreatedNotification(orgId: string, payload: unknown) {
    if (!this.server) {
      return;
    }

    this.server
      .to(this.userRoom(orgId))
      .emit(REALTIME_EVENTS.NOTIFICATION_NEW, payload);
  }

  // COMMENTING
  @SubscribeMessage(REALTIME_EVENTS.JOIN_POST_ROOM)
  handleJoinPostRoom(client: AuthenticatedSocket, postId: string) {
    client.join(this.postRoom(postId));
    this.logger.debug(`Socket ${client.id} joined room for post ${postId}`);
  }

  @SubscribeMessage(REALTIME_EVENTS.LEAVE_POST_ROOM)
  handleLeavePost(client: AuthenticatedSocket, postId: string) {
    client.leave(this.postRoom(postId));
    this.logger.debug(`Socket ${client.id} left room for post ${postId}`);
  }
  emitCommunityCommentUpdated(postId: string, comment: TPostComment) {
    if (!this.server) {
      return;
    }
    this.server
      .to(this.postRoom(postId))
      .emit(REALTIME_EVENTS.COMMUNITY_COMMENT_NEW, comment);
  }

  private userRoom(orgId: string): string {
    return `org:${orgId}`;
  }
  private postRoom(postId: string): string {
    return `post:${postId}`;
  }
}
