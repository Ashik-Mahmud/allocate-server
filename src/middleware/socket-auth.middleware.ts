import { Socket } from 'socket.io';
import { JWTUtils, JWTPayload } from 'src/modules/auth/utils/jwt';
import { Logger } from '@nestjs/common';

export type AuthenticatedSocket = Socket & {
    data: {
        userId?: string;
        orgId?: string;
        user?: JWTPayload;
    };
};

const logger = new Logger('SocketAuthMiddleware');

/**
 * Socket.IO authentication middleware
 * Verifies JWT token from handshake and attaches user data to socket
 * Can be reused by any WebSocket gateway
 *
 * Usage in gateway:
 * constructor(private server: Server) {
 *   this.server.use(socketAuthMiddleware);
 * }
 */
export const socketAuthMiddleware = (
    socket: AuthenticatedSocket,
    next: (err?: Error) => void,
) => {
    const token = extractToken(socket);

    if (!token) {
        next(new Error('No token provided'));
        return;
    }

    try {
        const payload = JWTUtils.verifyToken(token);

        if (payload.type !== 'access') {
            next(new Error('Invalid token type'));
            return;
        }

        // Attach user data to socket for use in handlers
        socket.data.userId = payload.userId;
        socket.data.orgId = payload.orgId;
        socket.data.user = payload;

        logger.debug(`Socket authenticated for user ${payload.userId}`);
        next();
    } catch (error) {
        logger.warn(
            `Socket authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        next(new Error('Invalid token'));
    }
};

/**
 * Helper function to extract JWT from socket handshake
 * Supports token in auth.token or Authorization header
 */
export function extractToken(socket: Socket): string | null {
    const handshakeToken = socket.handshake.auth?.token;

    if (typeof handshakeToken === 'string' && handshakeToken.length > 0) {
        return handshakeToken.startsWith('Bearer ')
            ? handshakeToken.substring(7)
            : handshakeToken;
    }

    const authHeader = socket.handshake.headers.authorization;
    if (typeof authHeader === 'string') {
        return JWTUtils.extractToken(authHeader);
    }

    return null;
}
