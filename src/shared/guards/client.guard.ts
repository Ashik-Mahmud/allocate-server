import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * ClientGuard - Restricts access to ORG_ADMIN role only
 * Used for client-specific actions like organization management
 * 
 * @decorator @UseGuards(ClientGuard)
 * @note Requires AuthGuard to be applied first
 */
@Injectable()
export class ClientGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (user.role !== Role.ORG_ADMIN) {
      throw new ForbiddenException('This action is only available for ORG_ADMIN users');
    }

    return true;
  }
}
