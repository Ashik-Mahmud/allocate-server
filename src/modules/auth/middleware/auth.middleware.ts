import { Injectable, NestMiddleware, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JWTUtils, JWTPayload } from '../utils/jwt';
import { PrismaService } from 'src/modules/prisma/prisma.service';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const token = JWTUtils.extractToken(req.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = JWTUtils.verifyToken(token);

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Verify user still exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, role: true, deletedAt: true, },
      });

      if (!user || user.deletedAt) {
        throw new UnauthorizedException('User not found or inactive');
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    next();
  };
}

@Injectable()
export class OptionalAuthMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const token = JWTUtils.extractToken(req.headers.authorization);

    if (token) {
      try {
        const payload = JWTUtils.verifyToken(token);

        if (payload.type === 'access') {
          const user = await this.prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, email: true, role: true, deletedAt: true },
          });

          if (user && user.deletedAt) {
            req.user = {
              id: user.id,
              email: user.email,
              role: user.role,
            };
          }
        }
      } catch (error) {
        // Ignore auth errors for optional auth
      }
    }

    next();
  }
}