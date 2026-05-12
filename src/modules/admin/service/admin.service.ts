import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType, Prisma, Role, TransactionType, User } from "@prisma/client";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { BroadcastAnnouncementDto, OrganizationCreditTopUpDto, OrganizationFilterDto, RevenueAnalyticsFilterDto, SubscriptionTransactionFilterDto, UpdateOrganizationDto, UpdateSystemSettingsDto, UserActivityLogFilterDto } from "../dto/admin.dto";
import { SharedService } from "src/shared/services/shared.service";
import { EmailService } from "src/modules/inbox/service/email.service";
import { Response } from "express";
import { NotificationManager } from "src/modules/inbox/service/notification-manager.service";
import { CryptoUtils } from "src/modules/auth/utils/crypto";
import { getDateKeyInTimezone, getEndOfDayUtc, getMonthKeyInTimezone, getStartOfDayUtc, getWeekKeyInTimezone, resolveUserTimezone } from "src/shared/utils/timezone.util";
import { InboxService } from "src/modules/inbox/service/inbox.service";

// Write admin service code
@Injectable()
export class AdminService {
    constructor(
        private prisma: PrismaService,
        private shared: SharedService,
        private emailService: EmailService,
        private notificationManager: NotificationManager,
        private inboxService: InboxService,
    ) {
        // Initialize any necessary properties or dependencies here
    }

    // Get system settings
    async getSystemSettings(user: User) {
        const isLoggedInUser = user?.id && user?.role !== Role.ADMIN ? true : false;
        const settings = await this.prisma.systemSettings.findUnique({
            where: { id: 'default' },
            select: {
                id: true,
                features_flags: isLoggedInUser ? true : false,
                global_alert_message: true,
                maintenance_mode: true,
                support_email: true,
                createdAt: true,
                updatedAt: true,

            }
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

        const { title, message, orgIds, type, metadata, receiverType } = announcementData;
        const targetRole = {
            'ORG': Role.ORG_ADMIN,
            'STAFF': Role.STAFF,
            'ALL': null,
            'INDIVIDUAL': null,
        }[receiverType];
        const targetUsers = await this.prisma.user.findMany({
            where: {
                deletedAt: null,
                org_id: { not: null },
                // If orgIds are provided, pull users from those specific orgs
                ...(orgIds?.length ? { org_id: { in: orgIds } } : {}),
                // Narrow by role if needed (e.g., only send to Staff of selected orgs)
                ...(targetRole ? { role: targetRole } : {}),
            },
            select: {
                id: true,
                org_id: true
            },
        });

        if (targetUsers.length === 0) {
            return {
                count: 0,
                message: 'No users found in the selected organizations'
            };
        }

        const chunkSize = 50;
        let successCount = 0;

        for (let i = 0; i < targetUsers.length; i += chunkSize) {
            const chunk = targetUsers.slice(i, i + chunkSize);
            const tasks = chunk.map(targetUser =>
                this.inboxService.createNotification({
                    userId: targetUser.id,
                    orgId: targetUser.org_id as string,
                    type: type || NotificationType.SYSTEM_ALERT,
                    title,
                    message,
                    metadata: { ...metadata, broadcastBy: user.id, receiverType: receiverType },
                }).catch(err => {
                    console.error(`Failed for user ${targetUser.id}:`, err);
                    return null;
                })
            );
            const results = await Promise.all(tasks);
            successCount += results.filter(r => r !== null).length;
        }

        return {
            count: successCount,
            totalAttempted: targetUsers.length,
            message: 'Broadcast completed',
        };
    }

    // Get all organizations for admin
    async getAllOrganizations(user: User, query: OrganizationFilterDto) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }
        const { organizationId, name, verified, page, limit, search, showDeletedOrg, planType } = query;
        const pageNumber = Number(page) || 1;
        const pageSize = Number(limit) || 10;

        const whereClause: any = {
            ...(organizationId ? { id: organizationId } : {}),
            ...(name ? { name: { contains: name, mode: 'insensitive' } } : {}),
            ...(verified !== undefined ? { isVerified: verified } : {}),
            ...(showDeletedOrg === false ? { deletedAt: null } : { deletedAt: { not: null } }),
            ...(search ? {
                users: {
                    some: {
                        OR: [{ email: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }]
                    }
                }
            } : {}),
            ...(planType ? { plan_type: planType } : {}),
        };
        const skip = (pageNumber - 1) * pageSize;
        const [organizations, total] = await this.prisma.$transaction([
            this.prisma.organizations.findMany({
                where: whereClause,
                skip,
                take: pageSize,
                include: {
                    _count: {
                        select: { users: true }
                    }
                },
                orderBy: { createdAt: 'desc' },

            }),
            this.prisma.organizations.count({ where: whereClause }),
        ]);
        return {
            items: organizations,
            total,
            page: pageNumber,
            limit: pageSize,
            totalPages: Math.ceil(total / pageSize)
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
                users: {
                    select: { id: true, name: true, email: true, role: true, createdAt: true, personal_credits: true, last_login: true, },
                    take: 5,
                },
                subscription: true,
            },
        });
        return organization;
    }

    // Update organization verification status
    async updateOrganization(user: User, orgId: string, data: UpdateOrganizationDto, response: Response) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }
        if (!orgId) {
            throw new Error('Organization ID is required');
        }

        try {
            const updatedOrg = await this.prisma.organizations.update({
                where: { id: orgId },
                data: {
                    ...data,
                    updatedAt: new Date(),
                },
                include: {
                    users: {
                        where: { role: Role.ORG_ADMIN },
                    },
                },
            });

            // log activity
            if (data?.isVerified !== undefined) {
                await this.shared.logActivity(this.prisma, {
                    orgId: orgId,
                    userId: updatedOrg?.users?.[0]?.id || user.id,
                    action: updatedOrg.isVerified ? 'ORG_VERIFIED' : 'ORG_UNVERIFIED',
                    details: `Organization ${updatedOrg.name} verification status set to ${updatedOrg.isVerified}`,
                    ipAddress: response.req.ip || '',
                    userAgent: response.get('User-Agent') || '',
                    metadata: { org_id: orgId, role: user.role },
                });

                this.notificationManager.send({
                    userId: updatedOrg?.users?.[0]?.id || user.id,
                    orgId: orgId,
                    type: NotificationType.SYSTEM_ALERT,
                    title: updatedOrg.isVerified ? 'Organization Verified' : 'Organization Unverified',
                    message: `Organization ${updatedOrg.name} is now ${updatedOrg.isVerified ? 'verified' : 'unverified'}`,
                    metadata: { org_id: orgId, role: user.role },
                    userEmail: user.email,
                    userName: user.name,
                });
            }

            return {
                success: true,
                message: `Organization updated successfully`,
            };
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new NotFoundException('Organization not found');
            }
        }
    }

    // Delete organization by ID
    async deleteOrganization(user: User, orgId: string, response: Response) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }
        if (!orgId) {
            throw new Error('Organization ID is required');
        }
        try {

            // Fetch users BEFORE starting the transaction to keep the TX fast
            const targetUsers = await this.prisma.user.findMany({
                where: { org_id: orgId },
                select: { id: true, name: true, email: true, role: true },
            });

            await this.prisma.$transaction(async (tx) => {
                // 2. Soft Delete Organization
                const deletedOrg = await tx.organizations.update({
                    where: { id: orgId },
                    data: {
                        deletedAt: new Date(),
                        is_active: false,
                        is_verified: false,
                        
                    },
                });

                // 3. Soft Delete All Users
                await tx.user.updateMany({
                    where: { org_id: orgId },
                    data: { 
                        deletedAt: new Date(),
                        personal_credits: 0, 
                        is_verified: false,

                     },
                });

                // 4. Hard Delete Old Notifications (Clean up db)
                await tx.notification.deleteMany({
                    where: { org_id: orgId }
                });

                // 5. Activity Logging (using the transaction client tx)
                await this.shared.logActivity(tx, {
                    orgId: orgId,
                    userId: user.id, // Admin who performed the action
                    action: 'ORG_DELETED',
                    details: `Organization ${deletedOrg.name} deleted and ${targetUsers.length} users suspended.`,
                    ipAddress: response.req.ip || '',
                    userAgent: response.get('User-Agent') || '',
                    metadata: { org_id: orgId, admin_id: user.id },
                });
                return deletedOrg;
            });
            if (targetUsers.length > 0) {
                targetUsers.forEach(u => {
                    this.emailService.sendGlobalEmail({
                        name: u.name,
                        to: u.email,
                        subject: 'Organization Deleted',
                        htmlContent: `Your organization has been deleted by the administrator. Your account has been suspended. If you have any questions, please contact support.`,
                    }).catch(err => console.error(`Email failed for ${u.email}`, err));
                });
            }

            return {
                success: true,
                message: `Organization and its ${targetUsers.length} users have been suspended.`,
            };
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new NotFoundException('Organization not found');
            }
        }
    }

    // Restore deleted organization by ID
    async restoreOrganization(user: User, orgId: string, response: Response) {
        // 1. Authorization Guard
        if (user.role !== Role.ADMIN) {
            throw new ForbiddenException('Unauthorized: System Admin access required');
        }
        if (!orgId) {
            throw new BadRequestException('Organization ID is required');
        }

        try {
            // Get accociated users by orgId
            const targetUsers = await this.prisma.user.findMany({
                where: { org_id: orgId },
                select: { id: true, email: true },
            });

            const { organization, usersSkipped } = await this.prisma.$transaction(async (tx) => {
                // restore organization
                const org = await tx.organizations.update({
                    where: { id: orgId },
                    data: {
                        deletedAt: null,
                        is_active: true
                    },
                });

                //Check if any user is in other org
                const usersInOtherOrg = await tx.user.findMany({
                    where: {
                        email: { in: targetUsers.map(u => u.email) },
                        org_id: { not: orgId },
                        deletedAt: null
                    },
                    select: { email: true },
                });

                const skippedEmails = usersInOtherOrg.map(u => u.email);

                // restore others users who are not in other org
                await tx.user.updateMany({
                    where: {
                        org_id: orgId,
                        email: { notIn: skippedEmails.length > 0 ? skippedEmails : [''] }
                    },
                    data: { deletedAt: null },
                });

                return { organization: org, usersSkipped: skippedEmails };
            });

            // log activity for org restore with skipped users info
            await this.shared.logActivity(this.prisma, {
                orgId: orgId,
                userId: user.id, // Admin id who performed the restore
                action: 'ORG_RESTORED',
                details: `Organization ${organization.name} restored. ${usersSkipped.length} users skipped as they joined other orgs.`,
                ipAddress: response.req.ip || '',
                userAgent: response.get('User-Agent') || '',
                metadata: { org_id: orgId, skippedUsers: usersSkipped },
            });

            // Send notification to restored users
            const restoredUsers = await this.prisma.user.findMany({
                where: { org_id: orgId, deletedAt: null }
            });

            restoredUsers.forEach(u => {
                this.notificationManager.send({
                    userId: u.id,
                    orgId: orgId,
                    type: NotificationType.SYSTEM_ALERT,
                    title: 'Account Restored',
                    message: `The organization ${organization.name} and your account have been restored. Welcome back!`,
                    metadata: { restoredBy: user.id },
                    userEmail: u.email,
                    userName: u.name,
                }).catch(e => console.error(`Failed to send restore notification to ${u.email}`));
            });

            return {
                success: true,
                message: `Organization restored successfully. ${usersSkipped.length} users were skipped.`,
                data: { organization, skippedCount: usersSkipped.length }
            };

        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new NotFoundException('Organization not found');
            }
            throw error;
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
        const timezone = resolveUserTimezone(user as any);
        const dateFilter: any = {};
        if (startDate) dateFilter.gte = getStartOfDayUtc(startDate, timezone);
        if (endDate) dateFilter.lte = getEndOfDayUtc(endDate, timezone);
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
        const timezone = resolveUserTimezone(user as any);

        const dateFilter: Prisma.DateTimeFilter = {};
        if (startDate) dateFilter.gte = getStartOfDayUtc(startDate, timezone);
        if (endDate) dateFilter.lte = getEndOfDayUtc(endDate, timezone);

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
                orderBy: {
                    org_id: 'asc'
                }
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

        const getBucketKey = (date: Date) => {
            if (normalizedGroupBy === 'day') {
                return getDateKeyInTimezone(date, timezone);
            }
            if (normalizedGroupBy === 'week') {
                return getWeekKeyInTimezone(date, timezone);
            }
            return getMonthKeyInTimezone(date, timezone);
        };

        const groupedMap = new Map<string, {
            period: string;
            revenue: number;
            transactionCount: number;
            activeOrganizations: Set<string>;
            revenueByPlan: { free: number; pro: number; enterprise: number };
        }>();

        for (const row of revenueRows) {
            const key = getBucketKey(row.createdAt);
            const amount = Number(row.price_paid || 0);
            const planType = row.organization?.plan_type || 'FREE';

            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    period: key,
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
            .sort((a, b) => a.period.localeCompare(b.period))
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
        const timezone = resolveUserTimezone(user as any);
        const dateFilter: Prisma.DateTimeFilter = {};
        if (startDate) dateFilter.gte = getStartOfDayUtc(startDate, timezone);
        if (endDate) dateFilter.lte = getEndOfDayUtc(endDate, timezone);
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