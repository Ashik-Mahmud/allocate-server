import {
    PlanType,
    PrismaClient
} from '@prisma/client';

export async function checkCommunityTrial(prisma: PrismaClient, orgId: string) {
  if (!orgId) {
    return { isExpired: false, isFree: false };
  }
  const org = await prisma?.organizations?.findUnique({
    where: { id: orgId },
    select: { createdAt: true, plan_type: true },
  });
  if (!org) return { isExpired: false, isFree: false };

  const ONE_MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;

  // For testing purposes, we can set the trial period to 1 minute (60,000 ms)
  // const ONE_MONTH_IN_MS = 60 * 1000; // 1 minute in milliseconds

  const isExpired = org?.createdAt
    ? Date.now() - new Date(org.createdAt).getTime() > ONE_MONTH_IN_MS
    : false;
  const isFree = org.plan_type === PlanType.FREE;

  return {
    isExpired: isFree && isExpired,
    isFree,
    trialEndDate:
      isFree && org.createdAt
        ? new Date(new Date(org.createdAt).getTime() + ONE_MONTH_IN_MS)
        : null,
  };
}
