import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JWTUtils } from '../utils/jwt';
import { PrismaService } from 'src/modules/prisma/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = JWTUtils.extractToken(request.headers.authorization);

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
        select: { id: true, email: true, role: true, deletedAt: true, org_id: true, organization: { select: { plan_type: true, timezone: true } } },
      });

      if (!user || user.deletedAt) {
        throw new UnauthorizedException('User not found or inactive');
      }

      request.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        org_id: user.org_id,
        plan_type: user?.organization?.plan_type,
        timezone: user?.organization?.timezone
      };

      return true;
    } catch (error: any) {
      throw new UnauthorizedException(error.message);
    }
  }
}