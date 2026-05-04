// scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, NotificationType, PlanType, Role, TransactionType } from '@prisma/client';
import { NotificationManager } from '../inbox/service/notification-manager.service';
import { SUBSCRIPTION_LIMITS } from 'src/shared/constant/subscription.constant';

@Injectable()
export class SchedulerService {
    private readonly logger = new Logger(SchedulerService.name);

    constructor(
        private prisma: PrismaService,
        private NotificationManager: NotificationManager

    ) { }

    // Task 1: Auto-cancel pending bookings that are past their expiration time (runs every minute)
    @Cron(CronExpression.EVERY_MINUTE)
    async autoCancelPendingBookings() {
        this.logger.log('Checking for expired pending bookings to auto-cancel...');
        try {


            const now = new Date();
            const bufferTime = new Date(now.getTime() - 10 * 60000);
            // 1. Fetch bookings that need cancellation
            const expiredBookings = await this.prisma.bookings.findMany({
                where: {
                    status: BookingStatus.PENDING,
                    start_time: {
                        lt: bufferTime
                    },
                },
                include: { user: { select: { id: true, email: true, name: true } } },
            });

            if (expiredBookings.length === 0) return;

            // 2. Perform a BATCH update (Much faster)
            await this.prisma.bookings.updateMany({
                where: {
                    id: { in: expiredBookings.map(b => b.id) }
                },
                data: { status: BookingStatus.CANCELLED },
            });

            this.logger.log(`Cancelled ${expiredBookings.length} expired bookings.`);

            // 3. Send notifications in parallel
            const notificationPromises = expiredBookings.map(booking =>
                this.NotificationManager.send({
                    userId: booking.user_id,
                    message: `Your booking with ID ${booking.id} has been cancelled due to expiration.`,
                    type: NotificationType.BOOKING_CANCELLED,
                    title: 'Booking Cancelled',
                    emailSubject: 'Booking Cancelled',
                    orgId: booking.org_id,
                    userEmail: booking.user.email,
                    userName: booking.user.name
                })
            );

            // Use allSettled so one failed email doesn't crash the whole cron task
            await Promise.allSettled(notificationPromises);
            this.logger.log(`Sent cancellation notifications for ${expiredBookings.length} bookings...`);
        } catch (error) {
            this.logger.error('Error auto-cancelling bookings:', error);
        }
    }

    // Task 2: Auto-complete confirmed bookings that are past their completion time (runs every 5 minutes)
    @Cron(CronExpression.EVERY_5_MINUTES)
    async autoCompleteConfirmedBookings() {
        this.logger.log('Checking for completed bookings to auto-complete...');
        try {


            const now = new Date();
            const completedBookings = await this.prisma.bookings.findMany({
                where: {
                    status: BookingStatus.CONFIRMED,
                    end_time: {
                        lt: now
                    },
                },
                include: { user: { select: { id: true, email: true, name: true } }, organization: { select: { name: true } } },
            });

            if (completedBookings.length === 0) return;
            await this.prisma.bookings.updateMany({
                where: {
                    id: { in: completedBookings.map(b => b.id) }
                },
                data: { status: BookingStatus.COMPLETED },
            });
            this.logger.log(`Auto-completed ${completedBookings.length} bookings.`);
            // 2. Notification (Optional but good for UX)
            const notificationPromises = completedBookings.map(booking =>
                this.NotificationManager.send({
                    userId: booking.user_id,
                    // Friendly message
                    message: `Hope you enjoyed your session at ${booking.organization.name}! Your booking is now marked as completed.`,
                    type: NotificationType.BOOKING_COMPLETED,
                    title: 'Session Completed',
                    orgId: booking.org_id,
                    userEmail: booking.user.email,
                    userName: booking.user.name
                })
            );
            await Promise.allSettled(notificationPromises);
            this.logger.log(`Sent booking completion notifications for ${completedBookings.length} bookings...`);
        } catch (error) {
            this.logger.error('Error auto-completing bookings:', error);
        }

    }

    // Task 3: Send reminders to Organizer for pending bookings to be confirmed (15 minutes before the booking)
    @Cron(CronExpression.EVERY_5_MINUTES)
    async sendBookingReminders() {
        this.logger.log('Checking for upcoming bookings to send reminders...');
        try {


            const now = Date.now();
            const windowStart = new Date(now + 15 * 60000);
            const windowEnd = new Date(now + 25 * 60000);
            const upcomingBookings = await this.prisma.bookings.findMany({
                where: {
                    status: BookingStatus.PENDING,
                    start_time: {
                        gte: windowStart,
                        lt: windowEnd,
                    },
                },
                include: {
                    user: { select: { name: true } }, // The customer's name
                    organization: {
                        include: {
                            // Assuming your Organization model has a relation to its Admins/Users
                            users: {
                                where: { role: Role.ORG_ADMIN }, // Filter for admins only
                                select: { id: true, email: true, name: true }
                            }
                        }
                    }
                },
            });

            if (upcomingBookings.length === 0) return;
            const notificationPromises: Promise<unknown>[] = [];

            for (const booking of upcomingBookings) {
                const admins = booking.organization.users;
                const customerName = booking.user.name;

                // Send a reminder to every admin in that organization
                admins.forEach(admin => {
                    notificationPromises.push(
                        this.NotificationManager.send({
                            userId: admin.id,
                            message: `Action Required: ${customerName} has a pending booking starting soon (${booking.start_time.toLocaleTimeString()}). Please confirm or decline it.`,
                            type: NotificationType.BOOKING_REMINDER,
                            title: 'Urgent: Pending Booking Reminder',
                            orgId: booking.org_id,
                            userEmail: admin.email, // Admin's Email
                            userName: admin.name
                        })
                    );
                });
            }

            await Promise.allSettled(notificationPromises);
            this.logger.log(`Sent booking reminders for ${upcomingBookings.length} upcoming bookings...`);
        } catch (error) {
            this.logger.error('Error sending booking reminders:', error);
        }
    }

    // Task 4: Send follow-up notifications to Staff before their scheduled bookings (15 minutes before the booking)
    @Cron(CronExpression.EVERY_5_MINUTES)
    async sendStaffFollowUps() {
        this.logger.log('Checking for upcoming staff bookings to send follow-ups...');
        try {


            const now = Date.now();
            const windowStart = new Date(now + 15 * 60000);
            const windowEnd = new Date(now + 25 * 60000);
            const staffBookings = await this.prisma.bookings.findMany({
                where: {
                    status: BookingStatus.CONFIRMED,
                    start_time: {
                        gte: windowStart,
                        lt: windowEnd,
                    },
                },
                include: {
                    user: { select: { name: true } }, // Customer Name
                    organization: {
                        include: {
                            // Fetch users linked to this organization who have STAFF or ADMIN roles
                            users: {
                                where: {
                                    role: { in: [Role.ORG_ADMIN, Role.STAFF] } // Adjust based on your Role enum
                                },
                                select: { id: true, email: true, name: true }
                            }
                        }
                    },
                    resource: { select: { name: true } } // Resource Name (e.g., "Room 101")
                },
            });

            if (staffBookings.length === 0) return;

            const notificationPromises: Promise<unknown>[] = [];

            for (const booking of staffBookings) {
                const staffMembers = booking.organization.users;

                const localTime = booking.start_time.toLocaleTimeString('en-US', {
                    timeZone: (booking.organization).timezone || 'UTC',
                    hour: '2-digit',
                    minute: '2-digit',
                });

                staffMembers.forEach(staff => notificationPromises.push(
                    this.NotificationManager.send({
                        userId: staff.id,
                        message: `Upcoming session: ${booking.user.name} has booked ${booking.resource.name} at ${localTime}.`,
                        type: NotificationType.BOOKING_REMINDER,
                        title: 'Upcoming Resource Usage',
                        orgId: booking.org_id,
                        userEmail: staff.email,
                        userName: staff.name
                    })
                ));
            }

            await Promise.allSettled(notificationPromises);
            this.logger.log(`Sent staff follow-up notifications to ${staffBookings.length} bookings...`);
        } catch (error) {
            this.logger.error('Error sending staff follow-ups:', error);
        }
    }

    // Task 5: Send Subscription Renewal Reminders every day to org admin with the day left for subscription expiry
    @Cron(CronExpression.EVERY_HOUR)
    async sendSubscriptionRenewalReminders() {
        this.logger.log('Checking for upcoming subscription expirations to send renewal reminders...');
        try {


            // 1. Get the current date in UTC and set to start of day (00:00:00.000)
            const now = new Date();
            const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60000);

            const expiringSubscriptions = await this.prisma.subscription.findMany({
                where: {
                    plan_name: { not: PlanType.FREE }, // Only paid plans
                    end_date: {
                        lt: sevenDaysFromNow,
                        gte: now,
                    },
                    OR: [
                        { last_reminder_sent: null },
                        { last_reminder_sent: { lt: new Date(now.getTime() - 24 * 60 * 60000) } } // Ensure we only send one reminder per day
                    ]
                },
                include: {
                    organization: {
                        include: {
                            users: {
                                where: { role: Role.ORG_ADMIN }, // Filter for organization admins only
                                select: { id: true, email: true, name: true }
                            }
                        }
                    }
                },
            });

            if (expiringSubscriptions.length === 0) return;
            const notificationPromises: Promise<unknown>[] = [];

            for (const subscription of expiringSubscriptions) {
                const admins = subscription.organization.users;
                const orgName = subscription.organization.name;

                await this.prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { last_reminder_sent: new Date() }
                });

                // Calculate days left for the subscription to expire
                const diffInTime = subscription.end_date ? (subscription.end_date.getTime() - now.getTime()) : 0;
                const daysLeft = subscription.end_date ? Math.ceil(diffInTime / (1000 * 3600 * 24)) : 0;

                // Format the end date in a user-friendly way (e.g., "15th August 2024")
                const formattedDate = subscription.end_date?.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    timeZone: (subscription.organization).timezone || 'Asia/Dhaka'
                });
                const broadMessage = `Important: Your subscription for "${orgName}" will expire in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} (on ${formattedDate}). Please renew your plan to ensure uninterrupted access to your dashboard and services. Note: If you do not renew, your subscription will automatically downgrade to the Free Tier upon expiration.`;

                admins.forEach(admin => {
                    notificationPromises.push(
                        this.NotificationManager.send({
                            userId: admin.id,
                            message: broadMessage,
                            type: NotificationType.SUBSCRIPTION_EXPIRING,
                            title: `Subscription Expiring Soon: ${orgName}`,
                            orgId: subscription.org_id,
                            userEmail: admin.email,
                            userName: admin.name
                        })
                    );
                });
            }

            await Promise.allSettled(notificationPromises);
            this.logger.log(`Sent subscription expiration notifications to ${expiringSubscriptions.length} organizations...`);
        } catch (error) {
            this.logger.error('Error sending subscription renewal reminders:', error);
        }
    }

    // Task 6: Send Expired Subscription Notifications every day to org admin if the subscription is expired
    @Cron(CronExpression.EVERY_HOUR)
    async sendExpiredSubscriptionNotifications() {
        this.logger.log('Checking for expired subscriptions to send notifications...');

        try {
            const now = new Date();
            const expiredSubscriptions = await this.prisma.subscription.findMany({
                where: {
                    plan_name: { not: PlanType.FREE }, // Only paid plans
                    end_date: {
                        lt: now,
                    },
                    OR: [
                        { last_reminder_sent: null },
                        { last_reminder_sent: { lt: new Date(now.getTime() - 24 * 60 * 60000) } } // Ensure we only send one reminder per day
                    ],
                    is_active: true // Only consider active subscriptions to avoid notifying about already handled expired ones
                },
                include: {
                    organization: {
                        include: {
                            users: {
                                where: { role: Role.ORG_ADMIN }, // Filter for organization admins only
                                select: { id: true, email: true, name: true }
                            }
                        }
                    }
                },
            });

            if (expiredSubscriptions.length === 0) return;
            const notificationPromises: Promise<unknown>[] = [];

            for (const subscription of expiredSubscriptions) {
                const admins = subscription?.organization?.users;
                const orgName = subscription?.organization?.name;
                const orgId = subscription?.organization?.id;
                const expiredPlanName = subscription?.plan_name;

                const currentPool = Number(subscription.organization.credit_pool || 0);
                const freeLimit = SUBSCRIPTION_LIMITS.FREE.INITIAL_CREDITS;
                const excessCredits = currentPool > freeLimit ? currentPool - freeLimit : 0;
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

                // Downgrade subscription to Free plan and adjust credits in a transaction to maintain data integrity
                await this.prisma.$transaction([
                    this.prisma.subscription.update({
                        where: { id: subscription.id },
                        data: {
                            plan_name: PlanType.FREE,
                            last_reminder_sent: now,
                            end_date: thirtyDaysFromNow,
                        }
                    }),
                    this.prisma.organizations.update({
                        where: { id: orgId },
                        data: {
                            credit_pool: freeLimit,
                            frozen_credits: { increment: excessCredits }
                        }
                    })
                ]);


                const broadMessage = `Your "${orgName}" ${expiredPlanName} plan has expired. Your excess ${excessCredits} credits are frozen and your account is moved to the Free Tier. Don't worry, your remaining ${excessCredits} credits will be restored immediately once you upgrade back to Pro!. `;
                admins.forEach(admin => {
                    notificationPromises.push(
                        this.NotificationManager.send({
                            userId: admin.id,
                            message: broadMessage,
                            type: NotificationType.SUBSCRIPTION_EXPIRED,
                            title: `${expiredPlanName} Plan Expired: ${orgName}`,
                            orgId: subscription.org_id,
                            userEmail: admin.email,
                            userName: admin.name
                        })
                    );
                });
            }

            await Promise.allSettled(notificationPromises);
            this.logger.log(`Sent expired subscription notifications to ${expiredSubscriptions.length} organizations...`);
        } catch (error) {
            this.logger.error('Error sending expired subscription notifications:', error);
        }
    }

    // Task 7: Send Free user Notification to upgrade Paid plan with the features and others stuff in every 15 days
    @Cron('0 0 1,16 * *') // Runs at 00:00 on the 1st and 16th of every month
    async sendFreeUserUpgradeNotifications() {
        this.logger.log('Checking for free users to send notifications...');
        try {

            const now = new Date();
            const freeUsers = await this.prisma.subscription.findMany({
                where: {
                    plan_name: PlanType.FREE,
                    is_active: true,
                    // Only target users who have been on the free plan for more than 7 days to avoid spamming new sign-ups
                    createdAt: {
                        // lt: new Date(now.getTime() - 7 * 24 * 60 * 60000)
                    },
                    OR: [
                        { last_reminder_sent: null },
                        { last_reminder_sent: { lt: new Date(now.getTime() - 24 * 60 * 60000) } }
                    ]
                },
                include: {
                    organization: {
                        include: {
                            users: {
                                where: { role: Role.ORG_ADMIN },
                                select: { id: true, email: true, name: true }
                            }
                        }
                    }
                }
            });

            if (freeUsers?.length === 0) return;

            const notificationPromises: Promise<unknown>[] = [];

            for (const sub of freeUsers) {
                const admins = sub?.organization?.users || [];
                const orgName = sub?.organization?.name || 'your organization';


                const upgradeMessage = `Unlock the full power of ${orgName}! 🚀 Upgrade to our Pro Plan to get advanced analytics, unlimited team members, and priority support. Don't let your growth slow down.`;

                await this.prisma.subscription.update({
                    where: { id: sub.id },
                    data: { last_reminder_sent: now }
                });

                admins.forEach(admin => {
                    notificationPromises.push(
                        this.NotificationManager.send({
                            userId: admin.id,
                            message: upgradeMessage,
                            type: NotificationType.UPGRADE_PLAN_REMINDER,
                            title: `Boost your workflow with Pro Features! ✨`,
                            orgId: sub.org_id,
                            userEmail: admin.email,
                            userName: admin.name,
                            emailTemplateId: 'upgrade_plan_reminder', // You can create a specific email template for this
                            metadata: {
                                orgName: orgName,
                                frozenCredits: sub.organization?.frozen_credits,
                            }
                        })
                    );
                });
            }

            await Promise.allSettled(notificationPromises);
            this.logger.log(`Sent upgrade notifications to ${freeUsers.length} organizations...`);
        } catch (error) {
            this.logger.error('Error sending free user upgrade notifications:', error);
        }
    }

    // Task 8: Reset free users credits every month on the 1st day of the month
    @Cron('0 0 1 * *') // Runs at 00:00 on the 1st of every month
    async resetFreeUserCredits() {
        this.logger.log('Resetting credits for free users...');
        try {
            const freeLimit = SUBSCRIPTION_LIMITS.FREE.INITIAL_CREDITS;
            const freeSubscriptions = await this.prisma.subscription.findMany({
                where: {
                    plan_name: PlanType.FREE,
                    is_active: true,
                },
                include: {
                    organization: {
                        include: {
                            users: {
                                where: { role: Role.ORG_ADMIN },
                                select: { id: true, email: true, name: true }
                            }
                        }
                    }
                }
            });

            if (freeSubscriptions?.length === 0) return;

            // find all organizations that have free subscriptions and reset their credit pool to the free limit
            const orgIds = freeSubscriptions.map(sub => sub.org_id);
            await this.prisma.organizations.updateMany({
                where: { id: { in: orgIds } },
                data: { credit_pool: freeLimit }
            });

            // Send notification and transactions to org admins about the credit reset
            const notificationPromises: Promise<unknown>[] = [];
            const transactionPromises: Promise<unknown>[] = [];
            for (const sub of freeSubscriptions) {

                const org = sub.organization;
                const admins = org.users;

                // Create a credit transaction record for the reset (Optional but good for tracking)
                transactionPromises.push(
                    this.prisma.creditTransaction.create({
                        data: {
                            org_id: org.id,
                            amount: freeLimit,
                            type: TransactionType.FREE_ALLOCATION, // বা আপনার Enum অনুযায়ী 'MONTHLY_RESET'
                            description: `Monthly credit refill for Free Tier`,
                            previousBalance: Number(org.credit_pool),
                            currentBalance: freeLimit,
                            user_id: admins[0]?.id,
                            performedBy: 'system', // Indicate this was done by the system
                        }
                    })
                );
                // Send notification to org admins about the credit reset   
                const message = `Good news! Your monthly credits have been reset to ${freeLimit} for ${org.name}. Keep innovating and making the most out of our platform!`;

                admins.forEach(admin => {
                    notificationPromises.push(
                        this.NotificationManager.send({
                            userId: admin.id,
                            message: message,
                            type: NotificationType.CREDIT_RESET,
                            title: `Monthly Credits Reset ✅`,
                            orgId: sub.org_id,
                            userEmail: admin.email,
                            userName: admin.name,
                            emailTemplateId: 'credit_reset',
                            metadata: {
                                orgName: org.name,
                                newCreditLimit: freeLimit,
                                frozenCredits: org.frozen_credits,
                            }
                        })
                    );
                });
            }
            await Promise.all(transactionPromises);
            await Promise.allSettled(notificationPromises);
            this.logger.log(`Reset credits for ${freeSubscriptions.length} free users...`);
        } catch (error) {
            this.logger.error('Error resetting free user credits:', error);
        }
    }


    // Task 9: Clean up old notifications and logs (e.g., older than 90 days) to keep the database optimized
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async cleanUpOldData() {
        this.logger.log('Cleaning up old notifications and logs...');
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90);

            // delete notification
            const deletedNotifications = await this.prisma.notification.deleteMany({
                where: {
                    createdAt: { lt: cutoffDate },
                    is_read: true // Only delete read notifications to avoid losing important unread ones 
                },
            });

            // delete activity logs
            const deletedLogs = await this.prisma.activityLog.deleteMany({
                where: {
                    createdAt: { lt: cutoffDate },
                },
            });

            this.logger.log(
                `Cleanup successful: ${deletedNotifications?.count} notifications and ${deletedLogs?.count} logs removed.`
            );

        } catch (error) {
            this.logger.error('Error cleaning up old notifications and logs:', error);
        }
    }

}