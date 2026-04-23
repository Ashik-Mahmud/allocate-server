import { Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType, Prisma, Role, TransactionType, User } from "@prisma/client";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { BroadcastAnnouncementDto, OrganizationCreditTopUpDto, OrganizationFilterDto, RevenueAnalyticsFilterDto, SubscriptionTransactionFilterDto, UpdateSystemSettingsDto, UserActivityLogFilterDto } from "../dto/admin.dto";
import { SharedService } from "src/shared/services/shared.service";
import { EmailService } from "src/modules/inbox/service/email.service";
import { Response } from "express";
import { NotificationManager } from "src/modules/inbox/service/notification-manager.service";
import { CryptoUtils } from "src/modules/auth/utils/crypto";

// Write admin service code
@Injectable()
export class AdminService {
    constructor(private prisma: PrismaService, private shared: SharedService, private emailService: EmailService, private notificationManager: NotificationManager) {
        // Initialize any necessary properties or dependencies here
    }

    // Get system settings
    async getSystemSettings(user: User) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }
        const settings = await this.prisma.systemSettings.findUnique({
            where: { id: 'default' },
        });
        return settings;
    }

    // Update system settings
    async updateSystemSettings(user: User, data: UpdateSystemSettingsDto) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }
        const updated = await this.prisma.systemSettings.update({
            where: { id: 'default' },
            data,
        });
        return updated;
    }

    // Broadcast announcement to all organizations/users
    async broadcastAnnouncement(user: User, announcementData: BroadcastAnnouncementDto) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }

        const { title, message, userIds, type, metadata, receiverType } = announcementData;
        const targetRole =
            receiverType === 'ORG'
                ? Role.ORG_ADMIN
                : receiverType === 'STAFF'
                    ? Role.STAFF
                    : undefined;

        const users = await this.prisma.user.findMany({
            where: {
                ...(userIds && userIds.length > 0 ? { id: { in: userIds } } : {}),
                ...(targetRole ? { role: targetRole } : {}),
                deletedAt: null,
            },
            select: {
                id: true,
                org_id: true,
            },
        });

        if (users.length === 0) {
            return { count: 0, message: 'No users matched the announcement target' };
        }

        const notificationType = type || NotificationType.SYSTEM_ALERT;
        const announcementRows = users
            .filter((targetUser) => Boolean(targetUser.org_id))
            .map((targetUser) => ({
                user_id: targetUser.id,
                org_id: targetUser.org_id as string,
                type: notificationType,
                title,
                message,
                reference_id: null,
                metadata: {
                    ...(metadata || {}),
                    receiverType,
                    broadcastBy: user.id,
                    broadcastRole: user.role,
                },
            }));

        if (announcementRows.length === 0) {
            return { count: 0, message: 'No valid organization users were found for broadcast' };
        }

        const result = await this.prisma.notification.createMany({
            data: announcementRows,
        });

        return {
            count: result.count,
            message: 'Announcement broadcasted successfully',
            targetUsers: announcementRows.length,
        };
    }

    // Get all organizations for admin
    async getAllOrganizations(user: User, query: OrganizationFilterDto) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }
        const { organizationId, name, verified, page, limit, search } = query;
        const whereClause: any = {
            ...(organizationId ? { id: organizationId } : {}),
            ...(name ? { name: { contains: name, mode: 'insensitive' } } : {}),
            ...(verified !== undefined ? { isVerified: verified } : {}),
            ...(search ? { users: { OR: [{ email: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }] } } : {}),
        };
        const skip = (page - 1) * limit;
        const [organizations, total] = await this.prisma.$transaction([
            this.prisma.organizations.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    users: true,
                },
            }),
            this.prisma.organizations.count({ where: whereClause }),
        ]);
        return {
            items: organizations,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }


    // Get organization details by ID for admin
    async getOrganizationDetails(user: User, orgId: string) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }
        if (!orgId) {
            throw new Error('Organization ID is required');
        }
        const organization = await this.prisma.organizations.findUnique({
            where: { id: orgId },
            include: {
                users: true,
            },
        });
        return organization;
    }

    // Update organization verification status
    async updateOrganizationVerificationStatus(user: User, orgId: string, verified: boolean, response: Response) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }
        if (!orgId) {
            throw new Error('Organization ID is required');
        }

        try {
            // check if organization exists and update
            const updatedOrg = await this.prisma.organizations.update({
                where: { id: orgId },
                data: { isVerified: verified },
            });

            // log activity
            await this.shared.logActivity(this.prisma, {
                orgId: orgId,
                userId: user.id,
                action: verified ? 'ORG_VERIFIED' : 'ORG_UNVERIFIED',
                details: `Organization ${updatedOrg.name} verification status set to ${verified}`,
                ipAddress: response.req.ip || '',
                userAgent: response.get('User-Agent') || '',
                metadata: { org_id: orgId, role: user.role },
            });

            this.notificationManager.createNotification({
                userId: user.id,
                orgId: orgId,
                type: NotificationType.SYSTEM_ALERT,
                title: verified ? 'Organization Verified' : 'Organization Unverified',
                message: `Organization ${updatedOrg.name} is now ${verified ? 'verified' : 'unverified'}`,
                metadata: { org_id: orgId, role: user.role },
            });

            return {
                success: true,
                message: `Organization is now ${verified ? 'verified' : 'unverified'}`
            };
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new NotFoundException('Organization not found');
            }
        }
    }

    // Top up organization credits
    async topUpOrganizationCredits(user: User, orgId: string, data: OrganizationCreditTopUpDto, response: Response) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }
        if (!orgId) {
            throw new Error('Organization ID is required');
        }
        const organization = await this.prisma.organizations.findUnique({
            where: { id: orgId },
        });
        if (!organization) {
            throw new NotFoundException('Organization not found');
        }
        const prevBalance = Number(organization.credit_pool || 0);
        const topUpAmount = Number(data.amount || 0);
        const newBalance = prevBalance + topUpAmount;

        const result = await this.prisma.$transaction(async (tx) => {
            await tx.organizations.update({
                where: { id: orgId },
                data: { credit_pool: newBalance },
            });
            // Log credit transaction
            await this.shared.createCreditTransaction(tx, {
                orgId: orgId,
                amount: topUpAmount,
                type: TransactionType.TOP_UP,
                prevBalance,
                currBalance: newBalance,
                performedBy: user.id,
                description: `Admin top up of ${topUpAmount} credits to organization ${organization.name}`,
                refId: orgId,
                userId: user.id,
                price_paid: data.price || 0,
            });
            await this.shared.logActivity(tx, {
                orgId: orgId,
                userId: user.id,
                action: 'CREDIT_TOPUP',
                details: `Organization ${organization.name} top up of ${topUpAmount} credits`,
                ipAddress: response.req.ip || '',
                userAgent: response.get('User-Agent') || '',
                metadata: { org_id: orgId, role: user.role, prevBalance, newBalance, price: data.price || 0 },
            });
            this.notificationManager.createNotification({
                userId: user.id,
                orgId: orgId,
                type: NotificationType.SYSTEM_ALERT,
                title: 'Credits Added Successfully',
                message: `Your organization has been credited with ${topUpAmount} credits.`,
                metadata: { org_id: orgId, role: user.role, newBalance },
            }).catch(err => console.error('Notification failed', err));;
            return {
                success: true,
                message: `Organization credits topped up successfully`,
                data: {
                    prevBalance,
                    newBalance,
                    topUpAmount,
                    price: data.price || 0,
                }
            };
        });
        return result;
    }



    // Service for get all users for admin with filters and pagination
    async getAllUsers(user: User, query: any) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }
        const { organizationId, name, email, role, page = 1, limit = 10, search } = query;
        const whereClause: any = {
            ...(organizationId ? { org_id: organizationId } : {}),
            ...(name ? { name: { contains: name, mode: 'insensitive' } } : {}),
            ...(email ? { email: { contains: email, mode: 'insensitive' } } : {}),
            ...(role ? { role: role } : {}),
            ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}),
        };
        const skip = (Number(page) - 1) * Number(limit);
        const [users, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    createdAt: true,
                    org_id: true,
                    organization: {
                        select: {
                            name: true,
                            photo: true,
                            tagline: true,
                            isVerified: true,
                        }
                    }
                }
            }),
            this.prisma.user.count({ where: whereClause }),
        ]);
        return {
            items: users,
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / limit),
        };
    }


    // Service for resetting user password by admin
    async resetUserPassword(user: User, userId: string, response: Response) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }
        const userToUpdate = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, org_id: true, role: true } });
        if (!userToUpdate || !userToUpdate.org_id) {
            throw new NotFoundException('User not found or inactive');
        }
        const newPassword = this.shared.generatePassword(8);
        const hashedPassword = await CryptoUtils.hashPassword(newPassword);
        const result = await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { password: hashedPassword },
            });
            await this.shared.logActivity(tx, {
                orgId: userToUpdate?.org_id || 'SYSTEM',
                userId: user.id,
                action: 'PASSWORD_RESET',
                details: `Admin reset password for user ${userToUpdate.name}`,
                ipAddress: response.req.ip || '',
                userAgent: response.get('User-Agent') || '',
                metadata: { org_id: userToUpdate.org_id, role: userToUpdate.role, targeted_user_id: userToUpdate.id },
            });

            return {
                success: true,
                message: `Password reset for user ${userToUpdate.name} successfully`,
                data: {
                    name: userToUpdate.name,
                    email: userToUpdate.email,
                    newPassword,
                }
            };
        });
        await this.emailService.sendGlobalEmail({
            to: userToUpdate.email,
            name: userToUpdate.name,
            subject: 'Your password has been reset',
            htmlContent: `
                    <p>Dear ${userToUpdate.name},</p>
                    <p>This is to inform you that your password has been reset. Your new password is: <strong>${newPassword}</strong></p>
                    <p>If you did not request this, please contact support immediately.</p>
                `,
        }).catch(err => console.error('Failed to send reset email:', err));;
        return result;
    }


    // Get all subscription transaction history  for admin dashboard
    async getOrganizationSubscriptionHistory(user: User, query: SubscriptionTransactionFilterDto, metadata: { ip: string, userAgent: string }) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }
        const { organizationId, startDate, endDate, page = 1, limit = 10, type } = query;
        const dateFilter: any = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(endDate);
        const whereClause: any = {
            ...(type ? { type } : { type: TransactionType.TOP_UP }),
            ...(organizationId ? { org_id: organizationId } : {}),
            ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        };

        const skip = (Number(page) - 1) * Number(limit);

        const [transactions, total] = await this.prisma.$transaction([
            this.prisma.creditTransaction.findMany({
                where: whereClause,
                skip,
                take: Number(limit),
                include: {
                    organization: {
                        select: {
                            name: true, id: true,
                        }
                    },
                    user: {
                        select: { name: true, email: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.creditTransaction.count({ where: whereClause }),
        ]);

        // total revnewue calculation
        const totalAmount = await this.prisma.creditTransaction.aggregate({
            where: whereClause,
            _sum: { price_paid: true }
        });
        return {
            items: [
                {
                    transactions,
                    totalRevenue: totalAmount._sum.price_paid || 0,
                }
            ],
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / limit),
        };
    }

    // Get revenue analytics for admin dashboard
    async getRevenueAnalytics(user: User, query: RevenueAnalyticsFilterDto) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }
        const { startDate, endDate, groupBy = 'month', organizationId } = query;
        const normalizedGroupBy = groupBy === 'day' || groupBy === 'week' || groupBy === 'month' ? groupBy : 'month';

        const dateFilter: Prisma.DateTimeFilter = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(endDate);

        const revenueWhere: Prisma.CreditTransactionWhereInput = {
            type: TransactionType.TOP_UP,
            price_paid: { gt: 0 },
            ...(organizationId ? { org_id: organizationId } : {}),
            ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        };

        const organizationWhere: Prisma.OrganizationsWhereInput = {
            deletedAt: null,
            ...(organizationId ? { id: organizationId } : {}),
        };

        const [summaryAggregate, uniquePayingOrgs, totalOrganizations, freeSubscribers, proSubscribers, enterpriseSubscribers, revenueRows] = await this.prisma.$transaction([
            this.prisma.creditTransaction.aggregate({
                where: revenueWhere,
                _sum: { price_paid: true },
                _avg: { price_paid: true },
                _count: { id: true },
            }),
            this.prisma.creditTransaction.groupBy({
                by: ['org_id'],
                where: revenueWhere,
            }),
            this.prisma.organizations.count({
                where: organizationWhere,
            }),
            this.prisma.organizations.count({
                where: { ...organizationWhere, plan_type: 'FREE' },
            }),
            this.prisma.organizations.count({
                where: { ...organizationWhere, plan_type: 'PRO' },
            }),
            this.prisma.organizations.count({
                where: { ...organizationWhere, plan_type: 'ENTERPRISE' },
            }),
            this.prisma.creditTransaction.findMany({
                where: revenueWhere,
                select: {
                    id: true,
                    org_id: true,
                    createdAt: true,
                    price_paid: true,
                    organization: {
                        select: {
                            plan_type: true,
                        },
                    },
                },
                orderBy: { createdAt: 'asc' },
            }),
        ]);

        const getBucketStart = (date: Date) => {
            const d = new Date(date);
            if (normalizedGroupBy === 'day') {
                return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
            }
            if (normalizedGroupBy === 'week') {
                const day = d.getUTCDay();
                const diffToMonday = (day + 6) % 7;
                return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffToMonday));
            }
            return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
        };

        const groupedMap = new Map<string, {
            period: Date;
            revenue: number;
            transactionCount: number;
            activeOrganizations: Set<string>;
            revenueByPlan: { free: number; pro: number; enterprise: number };
        }>();

        for (const row of revenueRows) {
            const bucketDate = getBucketStart(row.createdAt);
            const key = bucketDate.toISOString();
            const amount = Number(row.price_paid || 0);
            const planType = row.organization?.plan_type || 'FREE';

            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    period: bucketDate,
                    revenue: 0,
                    transactionCount: 0,
                    activeOrganizations: new Set<string>(),
                    revenueByPlan: { free: 0, pro: 0, enterprise: 0 },
                });
            }

            const bucket = groupedMap.get(key)!;
            bucket.revenue += amount;
            bucket.transactionCount += 1;
            bucket.activeOrganizations.add(row.org_id);

            if (planType === 'PRO') {
                bucket.revenueByPlan.pro += amount;
            } else if (planType === 'ENTERPRISE') {
                bucket.revenueByPlan.enterprise += amount;
            } else {
                bucket.revenueByPlan.free += amount;
            }
        }

        const grouped = Array.from(groupedMap.values())
            .sort((a, b) => a.period.getTime() - b.period.getTime())
            .map((bucket) => ({
                period: bucket.period,
                revenue: bucket.revenue,
                transactionCount: bucket.transactionCount,
                activeOrganizations: bucket.activeOrganizations.size,
                revenueByPlan: bucket.revenueByPlan,
            }));

        const paidSubscribers = proSubscribers + enterpriseSubscribers;
        const totalRevenue = Number(summaryAggregate._sum.price_paid || 0);
        const activePayingOrganizations = uniquePayingOrgs.length;

        return {
            filters: {
                startDate: startDate || null,
                endDate: endDate || null,
                organizationId: organizationId || null,
                groupBy: normalizedGroupBy,
            },
            summary: {
                totalRevenue,
                totalTransactions: Number(summaryAggregate._count.id || 0),
                activePayingOrganizations,
                avgTransactionValue: Number(summaryAggregate._avg.price_paid || 0),
                avgRevenuePerPayingOrganization: activePayingOrganizations
                    ? totalRevenue / activePayingOrganizations
                    : 0,
            },
            subscribers: {
                totalOrganizations: Number(totalOrganizations || 0),
                free: Number(freeSubscribers || 0),
                pro: Number(proSubscribers || 0),
                enterprise: Number(enterpriseSubscribers || 0),
                paid: Number(paidSubscribers || 0),
            },
            grouped,
        };
    }


    // Get user activity logs for admin dashboard
    async getUserActivityLogs(user: User, userId: string, query: UserActivityLogFilterDto) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }
        const { startDate, endDate, page = 1, limit = 10 } = query;
        const dateFilter: Prisma.DateTimeFilter = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(endDate);
        const whereClause: Prisma.ActivityLogWhereInput = {
            user_id: userId,
            ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        };
        const skip = (Number(page) - 1) * Number(limit);
        const [logs, total] = await this.prisma.$transaction([
            this.prisma.activityLog.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                skip: skip,
                take: Number(limit),
            }),
            this.prisma.activityLog.count({ where: whereClause }),
        ]);
        return {
            items: logs,
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / limit),
        };
    }

}