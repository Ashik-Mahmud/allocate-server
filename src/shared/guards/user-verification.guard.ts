import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';

/**
 * UserVerificationGuard - Ensures authenticated user has verified account.
 *
 * @decorator @UseGuards(AuthGuard, UserVerificationGuard)
 * @note Requires AuthGuard to be applied first
 */
@Injectable()
export class UserVerificationGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, deletedAt: true, is_verified: true },
    });

    if (!dbUser || dbUser.deletedAt) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (!dbUser.is_verified) {
      throw new ForbiddenException(
        'Your account is not verified. Please verify your account to continue.',
      );
    }

    return true;
  }
}
