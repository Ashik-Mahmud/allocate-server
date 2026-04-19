import { PlanType } from "@prisma/client";


export const SUBSCRIPTION_LIMITS = {
    [PlanType.FREE]: {
        MAX_USERS: 5,
        MAX_RESOURCES: 2,
        INITIAL_CREDITS: 100,
        BOOKING_WINDOW_DAYS: 7, // কতদিন আগে বুক করতে পারবে
        FEATURES: {
            AI_INSIGHTS: false,
            ADVANCED_RULES: false,
            PRIORITY_SUPPORT: false,
        },
    },
    [PlanType.PRO]: {
        MAX_USERS: 50,
        MAX_RESOURCES: 20,
        INITIAL_CREDITS: 1000,
        BOOKING_WINDOW_DAYS: 30,
        FEATURES: {
            AI_INSIGHTS: true,
            ADVANCED_RULES: true,
            PRIORITY_SUPPORT: true,
        },
    },
    [PlanType.ENTERPRISE]: {
        MAX_USERS: 9999, // Unlimited
        MAX_RESOURCES: 9999,
        INITIAL_CREDITS: 5000,
        BOOKING_WINDOW_DAYS: 90,
        FEATURES: {
            AI_INSIGHTS: true,
            ADVANCED_RULES: true,
            PRIORITY_SUPPORT: true,
        },
    },
};

export type SubscriptionLimitKey = keyof (typeof SUBSCRIPTION_LIMITS)[PlanType];

export const SUBSCRIPTION_PLAN_METADATA_KEY = 'subscription_plans';

export const SUBSCRIPTION_PLAN_LABELS: Record<PlanType, string> = {
    [PlanType.FREE]: 'Free',
    [PlanType.PRO]: 'Pro',
    [PlanType.ENTERPRISE]: 'Enterprise',
};

export const getSubscriptionPlanLabel = (plan?: PlanType | null) => {
    if (!plan) {
        return 'an active plan';
    }

    return SUBSCRIPTION_PLAN_LABELS[plan] ?? plan;
};

export const formatSubscriptionPlans = (plans: PlanType[]) => {
    const labels = plans.map(getSubscriptionPlanLabel);

    if (labels.length === 0) {
        return 'a supported plan';
    }

    if (labels.length === 1) {
        return labels[0];
    }

    if (labels.length === 2) {
        return `${labels[0]} or ${labels[1]}`;
    }

    return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`;
};

export const buildSubscriptionAccessMessage = (
    currentPlan: PlanType | null | undefined,
    allowedPlans: PlanType[],
) => {
    const allowedPlanLabel = formatSubscriptionPlans(allowedPlans);
    const currentPlanLabel = getSubscriptionPlanLabel(currentPlan);

    if (!currentPlan) {
        return `Your organization does not have an active subscription plan. This action requires ${allowedPlanLabel}.`;
    }

    return `Your current plan is ${currentPlanLabel}. This action requires ${allowedPlanLabel}. Please upgrade to continue.`;
};

export const getSubscriptionLimits = (plan?: PlanType | null) => {
    const resolvedPlan = plan ?? PlanType.FREE;
    return SUBSCRIPTION_LIMITS[resolvedPlan] ?? SUBSCRIPTION_LIMITS[PlanType.FREE];
};

export const buildSubscriptionLimitMessage = (
    currentPlan: PlanType | null | undefined,
    limitName: 'users' | 'resources',
    limitValue: number,
) => {
    const currentPlanLabel = getSubscriptionPlanLabel(currentPlan);
    return `Your current plan is ${currentPlanLabel}. You can create up to ${limitValue} ${limitName}. Please upgrade to increase this limit.`;
};

export const isSubscriptionLimitReached = (
    currentPlan: PlanType | null | undefined,
    limitName: SubscriptionLimitKey,
    currentCount: number,
): boolean => {
    const limits = getSubscriptionLimits(currentPlan);
    const limitValue = limits[limitName];

    if (typeof limitValue !== 'number') {
        return false;
    }

    return currentCount >= limitValue;
};

// For FREE user we will not allow to access of FEATURES that are behind subscription wall
export const isFeatureAccessible = (
    currentPlan: PlanType | null | undefined,
    feature: keyof typeof SUBSCRIPTION_LIMITS[PlanType]['FEATURES'],
): boolean => {
    const limits = getSubscriptionLimits(currentPlan);
    return limits.FEATURES[feature] ?? false;
}

// BUILT A error Message for subscription access
export const buildSubscriptionAccessErrorMessage = (
    currentPlan: PlanType | null | undefined,
    allowedPlans: PlanType[],
) => {
    const allowedPlanLabel = formatSubscriptionPlans(allowedPlans);
    const currentPlanLabel = getSubscriptionPlanLabel(currentPlan);
    return `Your current plan is ${currentPlanLabel}. This action requires ${allowedPlanLabel}. Please upgrade to continue.`;
}