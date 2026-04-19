import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanType, Role } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { buildSubscriptionAccessMessage, SUBSCRIPTION_PLAN_METADATA_KEY } from '../constant/subscription.constant';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlans = this.reflector.getAllAndOverride<PlanType[]>(
      SUBSCRIPTION_PLAN_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPlans || requiredPlans.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (user.role === Role.ADMIN) {
      return true;
    }

    if (!user.org_id) {
      throw new ForbiddenException('User organization not found');
    }

    const organization = await this.prisma.organizations.findUnique({
      where: { id: user.org_id },
      select: { plan_type: true, is_active: true },
    });

    if (!organization || organization.is_active === false) {
      throw new ForbiddenException('Your organization is not active. Please contact support.');
    }

    const currentPlan = organization.plan_type ?? PlanType.FREE;

    if (requiredPlans.includes(currentPlan)) {
      return true;
    }

    throw new ForbiddenException(
      buildSubscriptionAccessMessage(currentPlan, requiredPlans),
    );
  }
}