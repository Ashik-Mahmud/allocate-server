// scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, NotificationType, PlanType, Role } from '@prisma/client';
import { NotificationManager } from '../inbox/service/notification-manager.service';

@Injectable()
export class SchedulerService {
    private readonly logger = new Logger(SchedulerService.name);

    constructor(
        private prisma: PrismaService,
        private NotificationManager: NotificationManager

    ) { }

    // Task 1: Auto-cancel pending bookings that are past their expiration time (runs every minute)
    @Cron(CronExpression.EVERY_5_MINUTES)
    async autoCancelPendingBookings() {
        this.logger.log('Checking for expired pending bookings to auto-cancel...');
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

    }

    // Task 2: Auto-complete confirmed bookings that are past their completion time (runs every 5 minutes)
    @Cron(CronExpression.EVERY_5_MINUTES)
    async autoCompleteConfirmedBookings() {
        const now = new Date();
        this.logger.log('Checking for completed bookings to auto-complete...');

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


    }

    // Task 3: Send reminders to Organizer for pending bookings to be confirmed (15 minutes before the booking)
    @Cron(CronExpression.EVERY_5_MINUTES)
    async sendBookingReminders() {
        this.logger.log('Checking for upcoming bookings to send reminders...');
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
                            where: { role: 'ADMIN' }, // Filter for admins only
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

    }

    // Task 4: Send follow-up notifications to Staff before their scheduled bookings (15 minutes before the booking)
    @Cron(CronExpression.EVERY_5_MINUTES)
    async sendStaffFollowUps() {
        this.logger.log('Checking for upcoming staff bookings to send follow-ups...');
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
                                role: { in: ['ADMIN', 'STAFF'] } // Adjust based on your Role enum
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
                timeZone: (booking.organization as any).timezone || 'UTC',
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

    }

    // Task 5: Send Subscription Renewal Reminders every day to org admin with the day left for subscription expiry
    @Cron(CronExpression.EVERY_HOUR)
    async sendSubscriptionRenewalReminders() {
        this.logger.log('Checking for upcoming subscription expirations to send renewal reminders...');

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
    }

    // Task 6: Send Expired Subscription Notifications every day to org admin if the subscription is expired
    @Cron(CronExpression.EVERY_HOUR)
    async sendExpiredSubscriptionNotifications() {
        this.logger.log('Checking for expired subscriptions to send notifications...');
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
            const admins = subscription.organization.users;
            const orgName = subscription.organization.name;

            await this.prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    plan_name: PlanType.FREE, // Downgrade to free plan
                    last_reminder_sent: now
                }
            });

            const broadMessage = `Your "${orgName}" ${subscription.plan_name} plan has expired and has been moved to the Free Tier. To regain access to Pro features, please renew your subscription.`;

            admins.forEach(admin => {
                notificationPromises.push(
                    this.NotificationManager.send({
                        userId: admin.id,
                        message: broadMessage,
                        type: NotificationType.SUBSCRIPTION_EXPIRED,
                        title: `Subscription Expired & Plan Downgraded: ${orgName}`,
                        orgId: subscription.org_id,
                        userEmail: admin.email,
                        userName: admin.name
                    })
                );
            });
        }

        await Promise.allSettled(notificationPromises);
        this.logger.log(`Sent expired subscription notifications to ${expiredSubscriptions.length} organizations...`);
    }

    // Task 7: Send Free user Notification to upgrade Paid plan with the features and others stuff in every 15 days
    @Cron('0 0 1,16 * *') // Runs at 00:00 on the 1st and 16th of every month
    async sendFreeUserUpgradeNotifications() {
        this.logger.log('Checking for free users to send notifications...');
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
                        }
                    })
                );
            });
        }

        await Promise.allSettled(notificationPromises);
        this.logger.log(`Sent upgrade notifications to ${freeUsers.length} organizations...`);
    }


}