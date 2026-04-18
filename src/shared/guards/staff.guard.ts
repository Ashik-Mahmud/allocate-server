import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * StaffGuard - Restricts access to STAFF role only
 * Used for staff-specific operations and management tasks
 * 
 * @decorator @UseGuards(StaffGuard)
 * @note Requires AuthGuard to be applied first
 */
@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (user.role !== 'STAFF') {
      throw new ForbiddenException('This action is only available for staff members');
    }

    return true;
  }
}
