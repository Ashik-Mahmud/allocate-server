import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JWTUtils } from 'src/modules/auth/utils/jwt';

type AuthenticatedSocket = Socket & {
    data: {
        userId?: string;
        orgId?: string;
    };
};

@WebSocketGateway({
    namespace: '/notifications',
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

    async handleConnection(client: AuthenticatedSocket) { 
        const token = this.extractToken(client);

        if (!token) {
            client.disconnect(true);
            return;
        }

        try {
            const payload = JWTUtils.verifyToken(token);

            if (payload.type !== 'access') {
                client.disconnect(true);
                return;
            }

            client.data.userId = payload.userId;
            client.data.orgId = payload.orgId;

            await client.join(this.userRoom(payload.userId));
        } catch (error) {
            this.logger.warn('Socket connection rejected due to invalid token');
            client.disconnect(true);
        }
    }

    handleDisconnect(client: AuthenticatedSocket) {
        if (client.data?.userId) {
            this.logger.debug(`Notifications socket disconnected for user ${client.data.userId}`);
        }
    }

    emitNotificationCreated(userId: string, payload: unknown) {
        if (!this.server) {
            return;
        }

        this.server.to(this.userRoom(userId)).emit('notification:new', payload);
    }

    private userRoom(userId: string): string {
        return `user:${userId}`;
    }

    private extractToken(client: Socket): string | null {
        const handshakeToken = client.handshake.auth?.token;

        if (typeof handshakeToken === 'string' && handshakeToken.length > 0) {
            return handshakeToken.startsWith('Bearer ')
                ? handshakeToken.substring(7)
                : handshakeToken;
        }

        const authHeader = client.handshake.headers.authorization;
        if (typeof authHeader === 'string') {
            return JWTUtils.extractToken(authHeader);
        }

        return null;
    }
}
