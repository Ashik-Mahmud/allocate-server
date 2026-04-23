import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { BookingStatus, PaymentStatus, PlanType, Role, User } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
    buildPlanDistribution,
    buildRevenueTrend,
    startOfUtcDay,
} from './dashboard.utils';

@Injectable()
export class DashboardService {
    constructor(private prisma: PrismaService) { }

    private readonly LOW_CREDIT_THRESHOLD = 10;

    private requireOrgUser(user: User) {
        if (!user.org_id) {
            throw new BadRequestException('User does not belong to any organization');
        }
    }

    // Organization overview can include metrics relevant to the entire organization
    async getOrganizationOverview(user: User) {
        this.requireOrgUser(user);

        if (user.role !== Role.ORG_ADMIN) {
            throw new ForbiddenException('Organization overview is available for organization admins only');
        }

        const orgId = user.org_id as string;
        const now = new Date();
        const recentWindow = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 hours

        const [organization, totalStaff, totalCreditsAssigned, lowCreditUsers, recentBookings, bookingCount, upcomingBookings] =
            await Promise.all([
                this.prisma.organizations.findUnique({
                    where: { id: orgId },
                    select: { id: true, name: true, credit_pool: true },
                }),
                this.prisma.user.count({
                    where: {
                        org_id: orgId,
                        deletedAt: null,
                        role: Role.STAFF,
                    },
                }),
                this.prisma.creditTransaction.aggregate({
                    where: {
                        org_id: orgId,
                        type: { in: ['ALLOCATE', 'TOP_UP', 'ADJUSTMENT'] },
                    },
                    _sum: { amount: true },
                }),
                this.prisma.user.findMany({
                    where: {
                        org_id: orgId,
                        deletedAt: null,
                        role: Role.STAFF,
                        personal_credits: {
                            lt: this.LOW_CREDIT_THRESHOLD,
                        },
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        personal_credits: true,
                    },
                    orderBy: { personal_credits: 'asc' },
                }),
                this.prisma.bookings.findMany({
                    where: {
                        org_id: orgId,
                        deletedAt: null,
                        createdAt: {
                            gte: recentWindow,
                        },
                    },
                    select: {
                        id: true,
                        createdAt: true,
                        start_time: true,
                        end_time: true,
                        status: true,
                        user: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                        resource: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                }),
                this.prisma.bookings.count({
                    where: {
                        org_id: orgId,
                        deletedAt: null,
                    },
                }),
                this.prisma.bookings.count({
                    where: {
                        org_id: orgId,
                        deletedAt: null,
                        status: BookingStatus.PENDING,
                    },
                }),
            ]);

        const organizationCreditPool = Number(organization?.credit_pool || 0);
        const totalCreditsAssignedValue = Number(totalCreditsAssigned._sum.amount || 0);

        return {
            scope: 'organization',
            organization: {
                id: organization?.id,
                name: organization?.name,
            },
            metrics: {
                totalStaff,
                organizationCreditPool,
                totalCreditsAssigned: totalCreditsAssignedValue,
                lowCreditAlertsCount: lowCreditUsers.length,
                totalBookings: bookingCount,
                upcomingBookings,
            },
            lowCreditAlerts: lowCreditUsers.map((staff) => ({
                id: staff.id,
                name: staff.name,
                email: staff.email,
                personalCredits: Number(staff.personal_credits || 0),
            })),
            recentStaffActivity: recentBookings.map((booking) => ({
                staffId: booking.user.id,
                staffName: booking.user.name,
                resourceId: booking.resource.id,
                resourceName: booking.resource.name,
                bookingId: booking.id,
                status: booking.status,
                message: `${booking.user.name} booked ${booking.resource.name} ${this.getRelativeTimeLabel(booking.createdAt)}`,
                createdAt: booking.createdAt,
            })),
        };
    }
    // Staff overview can include metrics relevant to their bookings and activities
    async getStaffOverview(user: User) {
        this.requireOrgUser(user);

        const orgId = user.org_id as string;
        const now = new Date();

        const [latestTransactions, totalSpentAgg, bookings, recentActivity] = await Promise.all([
            this.prisma.creditTransaction.findMany({
                where: {
                    org_id: orgId,
                    user_id: user.id,
                },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                    id: true,
                    amount: true,
                    type: true,
                    description: true,
                    createdAt: true,
                    performedBy: true,
                },
            }),
            this.prisma.creditTransaction.aggregate({
                where: {
                    org_id: orgId,
                    user_id: user.id,
                    type: 'SPEND',
                },
                _sum: { amount: true },
            }),
            this.prisma.bookings.findMany({
                where: {
                    org_id: orgId,
                    user_id: user.id,
                    deletedAt: null,
                },
                select: {
                    id: true,
                    start_time: true,
                    end_time: true,
                    total_cost: true,
                    status: true,
                    resource: {
                        select: { id: true, name: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.bookings.findMany({
                where: {
                    org_id: orgId,
                    user_id: user.id,
                    deletedAt: null,
                    createdAt: {
                        gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
                    },
                },
                select: {
                    id: true,
                    createdAt: true,
                    start_time: true,
                    end_time: true,
                    status: true,
                    resource: {
                        select: { id: true, name: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
        ]);

        const totalSpent = Number(totalSpentAgg._sum.amount || 0);
        const currentBalance = Number(user.personal_credits || 0);
        const lastTransaction = latestTransactions[0]
            ? {
                amount: Number(latestTransactions[0].amount),
                date: latestTransactions[0].createdAt,
                source: latestTransactions[0].performedBy,
                type: latestTransactions[0].type,
                description: latestTransactions[0].description,
            }
            : null;

        const usageHistory = bookings.map((booking) => ({
            bookingId: booking.id,
            resourceId: booking.resource.id,
            resourceName: booking.resource.name,
            status: booking.status,
            totalCost: Number(booking.total_cost || 0),
            durationMinutes: this.getBookingDurationMinutes(booking.start_time, booking.end_time),
        }));

        return {
            scope: 'personal',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
            metrics: {
                myCurrentBalance: currentBalance,
                totalSpent,
                lastTransaction,
                usageCount: bookings.length,
            },
            recentActivity: recentActivity.map((booking) => ({
                bookingId: booking.id,
                resourceName: booking.resource.name,
                status: booking.status,
                description: `${user.name} used ${booking.resource.name} ${this.getRelativeTimeLabel(booking.createdAt)}`,
                createdAt: booking.createdAt,
            })),
            usageHistory,
        };
    }
    // Admin overview can include system-wide metrics and insights
    async getAdminOverview(user: User) {
        if (user.role !== Role.ADMIN) {
            throw new ForbiddenException('System admin overview is available for admins only');
        }

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const [
            totalOrganizations,
            totalPlatformUsers,
            globalCreditsSoldAgg,
            monthlyCreditRevenueAgg,
            subscriptionCompletedCount,
            paidSubscriptionCompletedCount,
            topUpRows,
            organizations,
            newSignups7,
            newSignups30,
            expiringSubscriptions,
            activeOrgIdsByActivity,
            errorLogs,
            failedTransactions,
            globalAnnouncementStatus,
            pendingSupportRequestsCount,
        ] = await Promise.all([
            // totalOrganizations
            this.prisma.organizations.count({ where: { deletedAt: null } }),
            //totalPlatformUsers
            this.prisma.user.count({
                where: {
                    deletedAt: null,
                    role: { in: [Role.ADMIN, Role.STAFF] },
                },
            }),
            // globalCreditsSoldAgg - lifetime
            this.prisma.creditTransaction.aggregate({
                where: { type: 'TOP_UP' },
                _sum: { price_paid: true },
            }),
            // monthlyCreditRevenueAgg - last 30 days
            this.prisma.creditTransaction.aggregate({
                where: {
                    type: 'TOP_UP',
                    createdAt: { gte: thirtyDaysAgo },
                },
                _sum: { price_paid: true },
            }),
            // subscriptionCompletedCount
            this.prisma.subscription.count({
                where: { payment_status: PaymentStatus.COMPLETED },
            }),
            // paidSubscriptionCompletedCount
            this.prisma.subscription.count({
                where: {
                    payment_status: PaymentStatus.COMPLETED,
                    plan_name: { in: [PlanType.PRO, PlanType.ENTERPRISE] },
                },
            }),
            // topUpRows
            this.prisma.creditTransaction.findMany({
                where: {
                    type: 'TOP_UP',
                    createdAt: { gte: thirtyDaysAgo },
                },
                select: { createdAt: true, amount: true },
                orderBy: { createdAt: 'asc' },
            }),
            // organizations
            this.prisma.organizations.findMany({
                where: { deletedAt: null },
                select: {
                    id: true,
                    name: true,
                    plan_type: true,
                    createdAt: true,
                    credit_pool: true,
                    _count: {
                        select: {
                            users: {
                                where: { deletedAt: null, role: Role.STAFF },
                            },
                        },
                    },
                },
            }),
            // newSignups7
            this.prisma.organizations.count({
                where: {
                    deletedAt: null,
                    createdAt: { gte: sevenDaysAgo },
                },
            }),
            // newSignups30
            this.prisma.organizations.count({
                where: {
                    deletedAt: null,
                    createdAt: { gte: thirtyDaysAgo },
                },
            }),
            // expiringSubscriptions
            this.prisma.subscription.findMany({
                where: {
                    is_active: true,
                    plan_name: { in: [PlanType.PRO, PlanType.ENTERPRISE] },
                    end_date: {
                        gte: now,
                        lte: next7Days,
                    },
                },
                select: {
                    id: true,
                    org_id: true,
                    plan_name: true,
                    end_date: true,
                    organization: {
                        select: { name: true },
                    },
                },
                orderBy: { end_date: 'asc' },
            }),
            // activeOrgIdsByActivity
            this.prisma.activityLog.findMany({
                where: { createdAt: { gte: thirtyDaysAgo } },
                select: { org_id: true },
                distinct: ['org_id'],
            }),
            // errorLogs
            this.prisma.activityLog.findMany({
                where: {
                    OR: [
                        { action: { contains: 'ERROR', mode: 'insensitive' } },
                        { action: { contains: 'FAILED', mode: 'insensitive' } },
                        { details: { contains: 'error', mode: 'insensitive' } },
                        { details: { contains: 'failed', mode: 'insensitive' } },
                    ],
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    action: true,
                    details: true,
                    createdAt: true,
                    org_id: true,
                    user_id: true,
                },
            }),
            // failedTransactions
            this.prisma.subscription.findMany({
                where: {
                    payment_status: { in: [PaymentStatus.FAILED, PaymentStatus.OVERDUE] },
                },
                orderBy: { updatedAt: 'desc' },
                take: 20,
                select: {
                    id: true,
                    org_id: true,
                    plan_name: true,
                    payment_status: true,
                    updatedAt: true,
                    organization: {
                        select: { name: true },
                    },
                },
            }),
            // supportRequests
            this.prisma.systemSettings.findUnique({
                where: { id: 'default' },
                select: {
                    id: true,
                    maintenance_mode: true,
                    global_alert_message: true,
                    updatedAt: true,
                },
            }),
            // pendingSupportRequests
            this.prisma.activityLog.count({
                where: {
                    action: { contains: 'SUPPORT_REQUEST_PENDING', mode: 'insensitive' },
                },
            }),
        ]);

        const orgIds = organizations.map((org) => org.id);
        const [orgSpendAgg, orgCreditAssignedAgg] = await Promise.all([
            this.prisma.creditTransaction.groupBy({
                by: ['org_id'],
                where: {
                    org_id: { in: orgIds },
                    type: 'SPEND',
                },
                _sum: { amount: true },
            }),
            this.prisma.creditTransaction.groupBy({
                by: ['org_id'],
                where: {
                    org_id: { in: orgIds },
                    type: { in: ['ALLOCATE', 'TOP_UP', 'ADJUSTMENT'] },
                },
                _sum: { amount: true },
            }),
        ]);

        const spendMap = new Map(orgSpendAgg.map((row) => [row.org_id, Number(row._sum.amount || 0)]));
        const assignedMap = new Map(orgCreditAssignedAgg.map((row) => [row.org_id, Number(row._sum.amount || 0)]));

        const organizationsWithStats = organizations.map((org) => ({
            id: org.id,
            name: org.name,
            planType: org.plan_type,
            createdAt: org.createdAt,
            staffCount: org._count.users,
            creditConsumption: spendMap.get(org.id) || 0,
            totalAssignedCredits: assignedMap.get(org.id) || 0,
            creditPool: Number(org.credit_pool || 0),
        }));

        const top5Organizations = [...organizationsWithStats]
            .sort((a, b) => b.creditConsumption - a.creditConsumption || b.staffCount - a.staffCount)
            .slice(0, 5);

        const planCountsMap = new Map<string, number>([
            [PlanType.FREE, 0],
            [PlanType.PRO, 0],
            [PlanType.ENTERPRISE, 0],
        ]);

        for (const org of organizationsWithStats) {
            const key = org.planType || PlanType.FREE;
            planCountsMap.set(key, (planCountsMap.get(key) || 0) + 1);
        }

        const planDistribution = buildPlanDistribution(
            Array.from(planCountsMap.entries()).map(([planType, count]) => ({ planType, count })),
        );

        const revenueTrendDaily = buildRevenueTrend(
            topUpRows.map((row) => ({ createdAt: row.createdAt, amount: Number(row.amount || 0) })),
            30,
        );

        const weeklyBuckets = new Map<string, number>();
        for (const point of revenueTrendDaily) {
            const d = new Date(`${point.date}T00:00:00.000Z`);
            const weekStart = startOfUtcDay(d);
            weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
            const key = weekStart.toISOString().slice(0, 10);
            weeklyBuckets.set(key, Number((weeklyBuckets.get(key) || 0) + point.amount));
        }

        const revenueTrendWeekly = Array.from(weeklyBuckets.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([weekStart, amount]) => ({ weekStart, amount }));

        const activeOrgIdsSet = new Set(activeOrgIdsByActivity.map((row) => row.org_id));
        const inactiveOrganizations = organizationsWithStats
            .filter((org) => !activeOrgIdsSet.has(org.id))
            .map((org) => ({
                id: org.id,
                name: org.name,
                planType: org.planType,
                staffCount: org.staffCount,
            }));

        let dbStatus: 'UP' | 'DOWN' = 'UP';
        try {
            await this.prisma.$queryRaw`SELECT 1`;
        } catch {
            dbStatus = 'DOWN';
        }

        return {
            scope: 'platform',
            platformSummary: {
                totalOrganizations,
                totalPlatformUsers,
                totalRevenue: {
                    lifetimeCreditSales: Number(globalCreditsSoldAgg._sum.price_paid || 0),
                    monthlyCreditSales: Number(monthlyCreditRevenueAgg._sum.price_paid || 0),
                    completedSubscriptionSalesCount: subscriptionCompletedCount,
                    completedPaidSubscriptionSalesCount: paidSubscriptionCompletedCount,
                },
                globalCreditsSold: Number(globalCreditsSoldAgg._sum.price_paid || 0),
            },
            revenueAndGrowth: {
                revenueTrends: {
                    daily: revenueTrendDaily,
                    weekly: revenueTrendWeekly,
                },
                planDistribution,
                newSignups: {
                    last7Days: newSignups7,
                    last30Days: newSignups30,
                },
            },
            tenantAndUsageMonitoring: {
                top5Organizations,
                expiringSubscriptions: expiringSubscriptions.map((sub) => ({
                    subscriptionId: sub.id,
                    organizationId: sub.org_id,
                    organizationName: sub.organization.name,
                    plan: sub.plan_name,
                    endingAt: sub.end_date,
                })),
                inactiveOrganizations,
            },
            systemHealthAndSecurity: {
                criticalErrorLogs: errorLogs,
                failedTransactions: failedTransactions.map((item) => ({
                    subscriptionId: item.id,
                    organizationId: item.org_id,
                    organizationName: item.organization.name,
                    plan: item.plan_name,
                    paymentStatus: item.payment_status,
                    updatedAt: item.updatedAt,
                })),
                systemStatus: {
                    database: dbStatus,
                    api: 'UP',
                    checkedAt: new Date().toISOString(),
                },
            },
            administrativeControls: {
                globalAnnouncementStatus: {
                    maintenanceMode: globalAnnouncementStatus?.maintenance_mode || false,
                    activeBanner: globalAnnouncementStatus?.global_alert_message || null,
                    updatedAt: globalAnnouncementStatus?.updatedAt || null,
                },
                pendingSupportRequests: pendingSupportRequestsCount,
            },
            dataNotes: {
                revenueComputation:
                    'Monetary revenue fields are derived from TOP_UP credit transactions; subscription model currently has no amount column.',
                supportRequestsComputation:
                    'Pending support requests are derived from ActivityLog action containing SUPPORT_REQUEST_PENDING.',
            },
        };
    }

    private getBookingDurationMinutes(startTime: Date, endTime: Date) {
        return Math.max(0, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000));
    }

    private getRelativeTimeLabel(date: Date | null | undefined) {
        const safeDate = date ? new Date(date) : new Date();
        const diffMinutes = Math.max(1, Math.floor((Date.now() - safeDate.getTime()) / 60000));

        if (diffMinutes < 60) {
            return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
        }

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) {
            return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
        }

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }
}
