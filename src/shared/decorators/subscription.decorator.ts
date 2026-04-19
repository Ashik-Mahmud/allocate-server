import { SetMetadata } from '@nestjs/common';
import { PlanType } from '@prisma/client';
import { SUBSCRIPTION_PLAN_METADATA_KEY } from '../constant/subscription.constant';

export const SubscriptionPlans = (...plans: PlanType[]) =>
  SetMetadata(SUBSCRIPTION_PLAN_METADATA_KEY, plans);