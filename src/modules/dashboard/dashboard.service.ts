import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { BookingStatus, PaymentStatus, PlanType, Role, TransactionType, User } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
    buildPlanDistribution,
    buildRevenueTrend,
} from './dashboard.utils';
import { getDateKeyInTimezone, getStartOfDayUtc, getWeekKeyInTimezone, resolveUserTimezone } from 'src/shared/utils/timezone.util';
import { CurrentUserType } from 'src/shared/decorators/user.decorator';

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
    async getOrganizationOverview(user: User & CurrentUserType) {
        this.requireOrgUser(user);

        if (user.role !== Role.ORG_ADMIN) {
            throw new ForbiddenException('Organization overview is available for organization admins only');
        }

        const orgId = user.org_id as string;
        const now = new Date();
        const recentWindow = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 hours

        const [organization, totalStaff, totalCreditsAssigned, lowCreditUsers, recentBookings, bookingCount, upcomingBookings, resourceUsage] =
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
                        type: { in: [TransactionType.ALLOCATE, TransactionType.TOP_UP, TransactionType.ADJUSTMENT] },
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
                // resource usage
                this.prisma.bookings.groupBy({
                    by: ['resource_id'],
                    where: {
                        org_id: orgId,
                        deletedAt: null,
                    },
                    _count: { _all: true },
                    orderBy: {
                        _count: {
                            resource_id: 'desc',
                        },
                    },
                    take: 10,
                }),
            ]);


        const organizationCreditPool = Number(organization?.credit_pool || 0);
        const totalCreditsAssignedValue = Number(totalCreditsAssigned._sum.amount || 0);

        const resourceIds = resourceUsage.map((row) => row.resource_id).filter(Boolean) as string[];
        const resources = resourceIds.length
            ? await this.prisma.resources.findMany({
                where: { id: { in: resourceIds } },
                select: { id: true, name: true, type: true, photo: true },
            })
            : [];
        const resourceMap = new Map(resources.map((resource) => [resource.id, { name: resource.name, type: resource.type, photo: resource.photo }]));
        const resourceAnalytics = resourceUsage.map((row) => {
            const resource = resourceMap.get(row.resource_id);
            return {
                name: resource?.name || 'Unknown Resource',
                type: resource?.type || 'Unknown Type',
                photo: resource?.photo || null,
                bookings: row._count._all,
            };
        });

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
            resourceAnalytics
        };
    }

    // Organization overview v2: strategic summary for organization admins
    async getOrganizationOverviewV2(user: User & CurrentUserType) {
        this.requireOrgUser(user);

        if (user.role !== Role.ORG_ADMIN) {
            throw new ForbiddenException('Organization overview is available for organization admins only');
        }

        const orgId = user.org_id as string;

        const timezone = resolveUserTimezone(user as User & CurrentUserType);
        const now = new Date();
        const monthKey = getDateKeyInTimezone(now, timezone).slice(0, 7);
        const monthStart = getStartOfDayUtc(`${monthKey}-01`, timezone);
        const [
            organization,
            totalStaff,
            totalCreditsAssignedAgg,
            totalCreditsSpentThisMonthAgg,
            lowCreditUsers,
            allBookingsCount,
            upcomingBookingsCount,
            cancelledBookingsCount,
            activeStaffThisMonth,
            bookingStatusDistribution,
            resourceUsage,
            topSpenders,
            recentStaffActivity,
        ] = await Promise.all([
            // organization details
            this.prisma.organizations.findUnique({
                where: { id: orgId },
                select: { id: true, name: true, credit_pool: true },
            }),
            // total staff count
            this.prisma.user.count({
                where: {
                    org_id: orgId,
                    deletedAt: null,
                    role: Role.STAFF,
                },
            }),
            // total credits assigned
            this.prisma.creditTransaction.aggregate({
                where: {
                    org_id: orgId,
                    type: { in: [TransactionType.ALLOCATE, TransactionType.TOP_UP, TransactionType.ADJUSTMENT] },
                },
                _sum: { amount: true },
            }),
            // total credits spent this month
            this.prisma.creditTransaction.aggregate({
                where: {
                    org_id: orgId,
                    type: TransactionType.SPEND,
                    createdAt: { gte: monthStart },
                },
                _sum: { amount: true },
            }),
            // low credit users
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
            // total bookings
            this.prisma.bookings.count({
                where: {
                    org_id: orgId,
                    deletedAt: null,
                },
            }),
            // upcoming bookings
            this.prisma.bookings.count({
                where: {
                    org_id: orgId,
                    deletedAt: null,
                    status: BookingStatus.PENDING,
                },
            }),
            // cancelled bookings
            this.prisma.bookings.count({
                where: {
                    org_id: orgId,
                    deletedAt: null,
                    status: BookingStatus.CANCELLED,
                },
            }),
            // active staff this month
            this.prisma.bookings.groupBy({
                by: ['user_id'],
                where: {
                    org_id: orgId,
                    deletedAt: null,
                    createdAt: { gte: monthStart },
                },
                _count: { _all: true },
            }),
            // booking status distribution
            this.prisma.bookings.groupBy({
                by: ['status'],
                where: {
                    org_id: orgId,
                    deletedAt: null,
                },
                _count: { _all: true },
            }),
            // resource usage
            this.prisma.bookings.groupBy({
                by: ['resource_id'],
                where: {
                    org_id: orgId,
                    deletedAt: null,
                },
                _count: { _all: true },
                orderBy: {
                    _count: {
                        resource_id: 'desc',
                    },
                },
                take: 10,
            }),
            // top spenders this month
            this.prisma.creditTransaction.groupBy({
                by: ['user_id'],
                where: {
                    org_id: orgId,
                    type: TransactionType.SPEND,
                    createdAt: { gte: monthStart },
                },
                _sum: { amount: true },
                orderBy: {
                    _sum: {
                        amount: 'desc',
                    },
                },
                take: 5,
            }),
            // recent staff activity
            this.prisma.bookings.findMany({
                where: {
                    org_id: orgId,
                    deletedAt: null,
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
                take: 20,
            }),
        ]);

        const organizationCreditPool = Number(organization?.credit_pool || 0);
        const totalCreditsAssigned = Number(totalCreditsAssignedAgg._sum.amount || 0);
        const totalCreditsSpentThisMonth = Number(totalCreditsSpentThisMonthAgg._sum.amount || 0);
        const activeStaffThisMonthCount = activeStaffThisMonth.length;
        const utilizationRate = totalStaff > 0 ? Math.round((activeStaffThisMonthCount / totalStaff) * 100) : 0;

        const statusCountMap = new Map(
            bookingStatusDistribution.map((row) => [row.status, row._count._all]),
        );

        const resourceIds = resourceUsage.map((row) => row.resource_id).filter(Boolean) as string[];
        const resources = resourceIds.length
            ? await this.prisma.resources.findMany({
                where: { id: { in: resourceIds } },
                select: { id: true, name: true },
            })
            : [];
        const resourceNameMap = new Map(resources.map((resource) => [resource.id, resource.name]));

        const resourceAnalytics = resourceUsage.map((row) => {
            const bookingRows = recentStaffActivity.filter((activity) => activity.resource.id === row.resource_id);
            const totalHours = bookingRows.reduce((sum, activity) => {
                if (!activity.start_time || !activity.end_time) {
                    return sum;
                }

                return sum + this.getBookingDurationMinutes(activity.start_time, activity.end_time) / 60;
            }, 0);

            return {
                name: resourceNameMap.get(row.resource_id) || 'Unknown Resource',
                bookings: row._count._all,
                totalHours: Number(totalHours.toFixed(2)),
            };
        });

        const userIdsForSpenders = topSpenders.map((row) => row.user_id).filter(Boolean) as string[];
        const spenderUsers = userIdsForSpenders.length
            ? await this.prisma.user.findMany({
                where: { id: { in: userIdsForSpenders } },
                select: { id: true, name: true },
            })
            : [];
        const spenderNameMap = new Map(spenderUsers.map((entry) => [entry.id, entry.name]));

        const topSpendersList = topSpenders.map((row) => ({
            name: spenderNameMap.get(row.user_id) || 'Unknown User',
            creditsSpent: Number(row._sum.amount || 0),
        }));

        const lowCreditAtZero = lowCreditUsers.filter((staff) => Number(staff.personal_credits || 0) === 0);
        const lowCreditSeverityRatio = totalStaff > 0 ? (lowCreditUsers.length / totalStaff) : 0;
        const creditCoverageRatio = totalCreditsAssigned > 0 ? (organizationCreditPool / totalCreditsAssigned) : 0;

        const mostUsedResource = resourceAnalytics.length > 0 ? resourceAnalytics[0].name : null;

        const activeStaffRankingMap = new Map<string, number>();
        for (const activity of recentStaffActivity) {
            const current = activeStaffRankingMap.get(activity.user.id) || 0;
            activeStaffRankingMap.set(activity.user.id, current + 1);
        }

        const mostActiveStaff = Array.from(activeStaffRankingMap.entries())
            .map(([staffId, count]) => {
                const match = recentStaffActivity.find((item) => item.user.id === staffId);
                return {
                    staffId,
                    staffName: match?.user.name || 'Unknown User',
                    recentBookings: count,
                };
            })
            .sort((a, b) => b.recentBookings - a.recentBookings)
            .slice(0, 5);

        const executiveSummary = [
            `${organization?.name || 'Organization'} has ${totalStaff} staff with ${activeStaffThisMonthCount} active this month (${utilizationRate}% utilization), and ${allBookingsCount} total bookings with ${upcomingBookingsCount} upcoming bookings.`,
            `Credit coverage is ${creditCoverageRatio.toFixed(2)}x (pool ${organizationCreditPool} vs assigned ${totalCreditsAssigned}), while ${lowCreditUsers.length} staff are below ${this.LOW_CREDIT_THRESHOLD} credits, including ${lowCreditAtZero.length} at zero.`,
            `${mostUsedResource ? `${mostUsedResource} is the highest-demand resource currently` : 'No dominant resource trend detected yet'}, and pending/cancelled bookings are ${statusCountMap.get(BookingStatus.PENDING) || 0}/${statusCountMap.get(BookingStatus.CANCELLED) || 0}.`,
        ].join(' ');

        const criticalAlerts = lowCreditAtZero.map((staff) => ({
            id: staff.id,
            name: staff.name,
            email: staff.email,
            personalCredits: Number(staff.personal_credits || 0),
            reason: 'Out of credits and at immediate risk of booking disruption',
        }));

        const activityInsights = {
            bookingAndResourcePatterns: {
                totalBookings: allBookingsCount,
                upcomingBookings: upcomingBookingsCount,
                bookingStatusDistribution: {
                    confirmed: statusCountMap.get(BookingStatus.CONFIRMED) || 0,
                    completed: statusCountMap.get(BookingStatus.COMPLETED) || 0,
                    pending: statusCountMap.get(BookingStatus.PENDING) || 0,
                    cancelled: statusCountMap.get(BookingStatus.CANCELLED) || 0,
                },
                mostUsedResource,
                resourceAnalytics,
            },
            staffEngagement: {
                totalStaff,
                activeStaffThisMonth: activeStaffThisMonthCount,
                mostActiveStaff,
                lowCreditAlerts: lowCreditUsers.map((staff) => ({
                    id: staff.id,
                    name: staff.name,
                    email: staff.email,
                    personalCredits: Number(staff.personal_credits || 0),
                })),
            },
            financialOverview: {
                organizationCreditPool,
                totalCreditsAssigned,
                creditCoverageRatio: Number(creditCoverageRatio.toFixed(2)),
                lowCreditAlertsCount: lowCreditUsers.length,
                lowCreditSeverity: lowCreditSeverityRatio >= 0.4 ? 'HIGH' : lowCreditSeverityRatio >= 0.2 ? 'MEDIUM' : 'LOW',
                totalCreditsSpentThisMonth,
                topSpenders: topSpendersList,
            },
        };

        const adminRecommendations = [
            `Urgent: allocate credits immediately to ${lowCreditAtZero.length} zero-credit staff (${lowCreditAtZero.map((u) => u.name).join(', ') || 'none'}) to prevent booking interruptions.`,
            `Efficiency: ${mostUsedResource ? `${mostUsedResource} demand is concentrated` : 'resource demand is fragmented'}; rebalance availability and monitor pending bookings (${upcomingBookingsCount}) to avoid scheduling bottlenecks.`,
            `Growth: with a ${creditCoverageRatio.toFixed(2)}x pool-to-assigned ratio and ${allBookingsCount} bookings so far, ${creditCoverageRatio < 0.15 ? 'increase the org credit pool now for sustained growth' : 'current pool is acceptable short term, but trend monthly spend versus top-up cadence.'}`,
        ];

        return {
            scope: 'organization-v2',
            organization: {
                id: organization?.id,
                name: organization?.name,
            },
            timezone,
            executiveSummary,
            criticalAlerts,
            activityInsights,
            adminRecommendations,
        };
    }
    // Staff overview can include metrics relevant to their bookings and activities
    async getStaffOverview(user: User & CurrentUserType) {
        this.requireOrgUser(user);

        const orgId = user.org_id as string;
        const now = new Date();

        const [availableCredits, latestTransactions, totalSpentAgg, bookings, recentActivity, mostUsedResource, currentMonthCredits] = await Promise.all([
            this.prisma.user.findUnique({
                where: { id: user.id, org_id: orgId },
                select: { personal_credits: true },
            }),
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
                    type: TransactionType.SPEND,
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
                take: 5,
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
                take: 4,
            }),
            //find the most used resource by the user in the organization
            await this.prisma.resources.findMany({
                where: {
                    org_id: orgId,
                    deletedAt: null,
                    bookings: {
                        some: {
                            user_id: user.id,
                            deletedAt: null,
                        },
                    },
                },
                select: {
                    id: true,
                    name: true,
                    type: true,
                    photo: true,
                    is_occupied: true,
                    _count: {
                        select: {
                            bookings: {
                                where: {
                                    user_id: user.id,
                                    deletedAt: null,
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    bookings: {
                        _count: 'desc',
                    },
                },
                take: 5,
            }),
            this.prisma.creditTransaction.aggregate({
                where: {
                    org_id: orgId,
                    user_id: user.id,
                    type: TransactionType.SPEND,
                    createdAt: {
                        gte: new Date(now.getFullYear(), now.getMonth(), 1),
                    },
                },
                _sum: { amount: true },
            }),
        ]);

        const totalSpent = Number(totalSpentAgg._sum.amount || 0);
        const currentBalance = Number(availableCredits?.personal_credits || 0);
        const currentMonthSpent = Number(currentMonthCredits._sum.amount || 0);
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

        const mostUsedResources = mostUsedResource?.map((res) => ({
            id: res.id,
            name: res.name,
            type: res.type,
            image: res.photo,
            isOccupied: res.is_occupied,
            usageCount: res._count.bookings,
        })) || [];
        /* **
          1. Also update the plan of Organization when pro user rollback to free
          2. 
         */

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
                currentMonthSpent
            },
            recentActivity: recentActivity.map((booking) => ({
                bookingId: booking.id,
                resourceName: booking.resource.name,
                status: booking.status,
                description: `${user?.name} used ${booking.resource.name} ${this.getRelativeTimeLabel(booking.createdAt)}`,
                createdAt: booking.createdAt,
            })),
            mostUsedResources,
            usageHistory,
        };
    }
    // Admin overview can include system-wide metrics and insights
    async getAdminOverview(user: User) {
        if (user.role !== Role.ADMIN) {
            throw new ForbiddenException('System admin overview is available for admins only');
        }

        const timezone = resolveUserTimezone(user as any);

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
                where: { type: TransactionType.TOP_UP },
                _sum: { price_paid: true },
            }),
            // monthlyCreditRevenueAgg - last 30 days
            this.prisma.creditTransaction.aggregate({
                where: {
                    type: TransactionType.TOP_UP,
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
                    type: TransactionType.TOP_UP,
                    createdAt: { gte: thirtyDaysAgo },
                },
                select: { createdAt: true, amount: true, price_paid: true },
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
                    isVerified: true,
                    is_active: true,
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
                    metadata: true,
                    user: {
                        select: { name: true, role: true, id: true },
                    },
                    organization: {
                        select: { name: true },
                    },
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

        ]);

        const orgIds = organizations.map((org) => org.id);
        const [orgSpendAgg, orgCreditAssignedAgg] = await Promise.all([
            this.prisma.creditTransaction.groupBy({
                by: ['org_id'],
                where: {
                    org_id: { in: orgIds },
                    type: TransactionType.SPEND,
                },
                _sum: { amount: true },
            }),
            this.prisma.creditTransaction.groupBy({
                by: ['org_id'],
                where: {
                    org_id: { in: orgIds },
                    type: { in: [TransactionType.ALLOCATE, TransactionType.TOP_UP, TransactionType.ADJUSTMENT] },
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
            is_active: org.is_active,
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
            topUpRows.map((row) => ({ createdAt: row.createdAt, amount: Number(row.price_paid || 0) })),
            30,
            timezone,
        );

        const weeklyBuckets = new Map<string, number>();
        for (const point of revenueTrendDaily) {
            const key = getWeekKeyInTimezone(point.date, timezone);
            weeklyBuckets.set(key, Number((weeklyBuckets.get(key) || 0) + point.amount));
        }

        const revenueTrendWeekly = Array.from(weeklyBuckets.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([weekKey, amount]) => ({ weekKey, amount }));

        const inactiveOrganizations = organizationsWithStats
            .filter((org) => !org?.is_active)
            .map((org) => ({
                id: org.id,
                name: org.name,
                planType: org.planType,
                staffCount: org.staffCount,
            }));

        // data health
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
