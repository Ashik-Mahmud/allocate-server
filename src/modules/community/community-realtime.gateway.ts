import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { CommunityHub } from '@prisma/client';
import { Server } from 'socket.io';
import { AuthenticatedSocket, socketAuthMiddleware } from 'src/middleware/socket-auth.middleware';

@WebSocketGateway({
  namespace: '/community',
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],

})
export class CommunityRealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {

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
    this.logger.log('Socket auth middleware registered for notifications gateway');
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

    this.server.to(this.userRoom(orgId)).emit('community:post:created', post);
  }


  emitCommunityPostCreatedNotification(orgId: string, payload: unknown) {
    if (!this.server) {
      return;
    }

    this.server.to(this.userRoom(orgId)).emit('notification:new', payload);
  }

  private userRoom(orgId: string): string {
    return `org:${orgId}`;
  }
}
