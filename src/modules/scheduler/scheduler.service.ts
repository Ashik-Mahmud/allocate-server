// scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  BookingStatus,
  NotificationType,
  PaymentStatus,
  PlanType,
  Role,
  TransactionType,
} from '@prisma/client';
import { NotificationManager } from '../inbox/service/notification-manager.service';
import { SUBSCRIPTION_LIMITS } from 'src/shared/constant/subscription.constant';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private NotificationManager: NotificationManager,
  ) {}

  // Task 1: Auto-cancel pending bookings that are past their expiration time (runs every minute)
  @Cron(CronExpression.EVERY_MINUTE)
  async autoCancelPendingBookings() {
    this.logger.log('Checking for expired pending bookings to auto-cancel...');
    try {
      const now = new Date();
      // 1. Fetch bookings that need cancellation
      const expiredBookings = await this.prisma.bookings.findMany({
        where: {
          status: BookingStatus.PENDING,
          start_time: {
            lt: now,
          },
        },
        include: { user: { select: { id: true, email: true, name: true } } },
      });

      if (expiredBookings.length === 0) return;

      // 2. Perform a BATCH update (Much faster)
      await this.prisma.bookings.updateMany({
        where: {
          id: { in: expiredBookings.map((b) => b.id) },
        },
        data: { status: BookingStatus.CANCELLED },
      });

      this.logger.log(`Cancelled ${expiredBookings.length} expired bookings.`);

      // 3. Send notifications in parallel
      const notificationPromises = expiredBookings.map((booking) =>
        this.NotificationManager.send({
          userId: booking.user_id,
          message: `Your booking with ID ${booking.id} has been cancelled due to expiration.`,
          type: NotificationType.BOOKING_CANCELLED,
          title: 'Booking Cancelled',
          emailSubject: 'Booking Cancelled',
          orgId: booking.org_id,
          userEmail: booking.user.email,
          userName: booking.user.name,
        }),
      );

      // Use allSettled so one failed email doesn't crash the whole cron task
      await Promise.allSettled(notificationPromises);
      this.logger.log(
        `Sent cancellation notifications for ${expiredBookings.length} bookings...`,
      );
    } catch (error) {
      this.logger.error('Error auto-cancelling bookings:', error);
    }
  }

  // Task 2: When will be the confirmed booking start we put the status to CHECEKD_IN if the start time is passed and the status is still confirmed and send notification to the user about the check-in time
  @Cron(CronExpression.EVERY_MINUTE)
  async autoCheckInConfirmedBookings() {
    this.logger.log('Checking for confirmed bookings to auto-check-in...');
    try {
      const confirmedBookings = await this.prisma.bookings.findMany({
        where: {
          status: BookingStatus.CONFIRMED,
          start_time: { lt: new Date() },
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      });

      if (confirmedBookings.length === 0) return;
      await this.prisma.$transaction(async (tx) => {
        const idList = confirmedBookings.map((b) => b.id);

        // 1. Updated booking status to CHECKED_IN for all the bookings which are confirmed and the start time is passed
        await tx.bookings.updateMany({
          where: { id: { in: idList } },
          data: { status: BookingStatus.CHECKED_IN },
        });

        // 2. Updated resource status to occupied and added booking id to resource current booking relation
        await Promise.all(
          confirmedBookings.map((booking) =>
            tx.resources.update({
              where: { id: booking.resource_id },
              data: {
                is_occupied: true,
                currentBookingId: booking.id,
              },
            }),
          ),
        );
      });
      // 3. Notification to users about the check-in (Optional but good for UX)
      const notificationPromises = confirmedBookings.map((booking) =>
        this.NotificationManager.send({
          userId: booking.user_id,
          message: `Your booking with ID ${booking.id} has been checked in. Enjoy your session!`,
          type: NotificationType.BOOKING_CHECKED_IN,
          title: 'Booking Checked In',
          orgId: booking.org_id,
          userEmail: booking.user.email,
          userName: booking.user.name,
        }),
      );

      await Promise.allSettled(notificationPromises);

      this.logger.log(
        `Auto-checked in ${confirmedBookings.length} bookings and sent notifications.`,
      );
    } catch (error) {
      this.logger.error('Error auto-checking in bookings:', error);
    }
  }
  // Task 3: Auto-complete checkedIn bookings that are past their completion time (runs every 5 minutes)
  @Cron(CronExpression.EVERY_MINUTE)
  async autoCompleteCheckedInBookings() {
    this.logger.log('Checking for completed bookings to auto-complete...');
    try {
      const now = new Date();
      const completedBookings = await this.prisma.bookings.findMany({
        where: {
          status: BookingStatus.CHECKED_IN, // Only consider bookings that were checked in but not yet completed
          end_time: { lt: now },
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
          organization: { select: { name: true } },
        },
      });

      if (completedBookings.length === 0) return;
      await this.prisma.$transaction(async (tx) => {
        const idList = completedBookings.map((b) => b.id);

        //  Update all relevant bookings to COMPLETED in a batch for efficiency
        await tx.bookings.updateMany({
          where: { id: { in: idList } },
          data: { status: BookingStatus.COMPLETED },
        });

        // make resource unoccupied
        for (const booking of completedBookings) {
          await tx.resources.update({
            where: { id: booking.resource_id },
            data: {
              is_occupied: false,
              currentBookingId: null,
            },
          });
        }
      });

      this.logger.log(
        `Auto-completed ${completedBookings.length} bookings and released resources.`,
      );
      // 2. Notification (Optional but good for UX)
      const notificationPromises = completedBookings.map((booking) =>
        this.NotificationManager.send({
          userId: booking.user_id,
          // Friendly message
          message: `Hope you enjoyed your session at ${booking.organization.name}! Your booking is now marked as completed.`,
          type: NotificationType.BOOKING_COMPLETED,
          title: 'Session Completed',
          orgId: booking.org_id,
          userEmail: booking.user.email,
          userName: booking.user.name,
        }),
      );
      await Promise.allSettled(notificationPromises);
      this.logger.log(
        `Sent booking completion notifications for ${completedBookings.length} bookings...`,
      );
    } catch (error) {
      this.logger.error('Error auto-completing bookings:', error);
    }
  }

  // Task 4: Send reminders to Organizer for pending bookings to be confirmed (15 minutes before the booking)
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendBookingReminders() {
    this.logger.log('Checking for upcoming bookings to send reminders...');
    try {
      const now = new Date();

      const reminderThreshold = new Date(now.getTime() + 15 * 60000);
      const windowEnd = new Date(now.getTime() + 20 * 60000);
      const upcomingBookings = await this.prisma.bookings.findMany({
        where: {
          status: BookingStatus.PENDING,
          start_time: {
            gte: reminderThreshold,
            lte: windowEnd,
          },
        },
        include: {
          user: { select: { name: true } }, // The customer's name
          organization: {
            include: {
              // Assuming your Organization model has a relation to its Admins/Users
              users: {
                where: { role: Role.ORG_ADMIN }, // Filter for admins only
                select: { id: true, email: true, name: true },
              },
            },
          },
        },
      });

      if (upcomingBookings.length === 0) return;
      const notificationPromises: Promise<unknown>[] = [];

      for (const booking of upcomingBookings) {
        const admins = booking.organization.users;
        const customerName = booking.user.name;

        // Send a reminder to every admin in that organization
        admins.forEach((admin) => {
          notificationPromises.push(
            this.NotificationManager.send({
              userId: admin.id,
              message: `Action Required: ${customerName} has a pending booking starting soon (${booking.start_time.toLocaleTimeString()}). Please confirm or decline it.`,
              type: NotificationType.BOOKING_REMINDER,
              title: 'Urgent: Pending Booking Reminder',
              orgId: booking.org_id,
              userEmail: admin.email, // Admin's Email
              userName: admin.name,
            }),
          );
        });
      }

      await Promise.allSettled(notificationPromises);
      this.logger.log(
        `Sent booking reminders for ${upcomingBookings.length} upcoming bookings...`,
      );
    } catch (error) {
      this.logger.error('Error sending booking reminders:', error);
    }
  }

  // Task 5: Send follow-up notifications to Staff before their scheduled bookings (15 minutes before the booking)
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendStaffFollowUps() {
    this.logger.log(
      'Checking for upcoming staff bookings to send follow-ups...',
    );
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() + 15 * 60000);
      const windowEnd = new Date(now.getTime() + 20 * 60000);
      const staffBookings = await this.prisma.bookings.findMany({
        where: {
          status: BookingStatus.CONFIRMED,
          start_time: {
            gte: windowStart,
            lte: windowEnd,
          },
        },
        include: {
          user: { select: { id: true, name: true, email: true } }, // Customer Name
          organization: {
            select: { timezone: true },
          },
          resource: { select: { name: true } }, // Resource Name (e.g., "Room 101")
        },
      });

      if (staffBookings.length === 0) return;

      const notificationPromises: Promise<unknown>[] = [];

      for (const booking of staffBookings) {
        const staff = booking.user;
        const localTime = booking.start_time.toLocaleTimeString('en-US', {
          timeZone: booking.organization.timezone || 'UTC',
          hour: '2-digit',
          minute: '2-digit',
        });
        notificationPromises.push(
          this.NotificationManager.send({
            userId: staff.id,
            message: `Hi ${staff.name}, your session at ${booking.resource.name} starts at ${localTime}. See you soon!`,
            type: NotificationType.BOOKING_REMINDER,
            title: 'Upcoming Booking Reminder: Get Ready!',
            orgId: booking.org_id,
            userEmail: staff.email,
            userName: staff.name,
          }),
        );
      }
      await Promise.allSettled(notificationPromises);
      this.logger.log(
        `Sent staff follow-up notifications to ${staffBookings.length} bookings...`,
      );
    } catch (error) {
      this.logger.error('Error sending staff follow-ups:', error);
    }
  }

  // Task 6: Send Subscription Renewal Reminders every day to org admin with the day left for subscription expiry
  @Cron(CronExpression.EVERY_HOUR)
  async sendSubscriptionRenewalReminders() {
    this.logger.log(
      'Checking for upcoming subscription expirations to send renewal reminders...',
    );
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
            {
              last_reminder_sent: {
                lt: new Date(now.getTime() - 24 * 60 * 60000),
              },
            }, // Ensure we only send one reminder per day
          ],
        },
        include: {
          organization: {
            include: {
              users: {
                where: { role: Role.ORG_ADMIN }, // Filter for organization admins only
                select: { id: true, email: true, name: true },
              },
            },
          },
        },
      });

      if (expiringSubscriptions.length === 0) return;
      const notificationPromises: Promise<unknown>[] = [];

      for (const subscription of expiringSubscriptions) {
        const admins = subscription.organization.users;
        const orgName = subscription.organization.name;

        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { last_reminder_sent: new Date() },
        });

        // Calculate days left for the subscription to expire
        const diffInTime = subscription.end_date
          ? subscription.end_date.getTime() - now.getTime()
          : 0;
        const daysLeft = subscription.end_date
          ? Math.ceil(diffInTime / (1000 * 3600 * 24))
          : 0;

        // Format the end date in a user-friendly way (e.g., "15th August 2024")
        const formattedDate = subscription.end_date?.toLocaleDateString(
          'en-GB',
          {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: subscription.organization.timezone || 'Asia/Dhaka',
          },
        );
        const maxStaff = SUBSCRIPTION_LIMITS[PlanType.FREE].MAX_USERS;
        const maxResources = SUBSCRIPTION_LIMITS[PlanType.FREE].MAX_RESOURCES;
        const broadMessage = `
                Important: Your subscription for "${orgName}" will expire in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} (on ${formattedDate}). 
                Please renew your plan to ensure uninterrupted access to your dashboard and services. 
                If you do not renew, your subscription will automatically downgrade to the Free Tier upon expiration. 
                ACTION REQUIRED: Since the Free Tier only supports up to ${maxResources} resources and ${maxStaff} staff members, and your current usage exceeds these limits, your booking capabilities will be disabled upon downgrade. You will need to either upgrade back to Pro or reduce your resources/staff to regain access.
                Don't disrupt your workflow—Renew Now! 🚀
                 
                 `;

        admins.forEach((admin) => {
          notificationPromises.push(
            this.NotificationManager.send({
              userId: admin.id,
              message: broadMessage,
              type: NotificationType.SUBSCRIPTION_EXPIRING,
              title: `Subscription Expiring Soon: ${orgName}`,
              orgId: subscription.org_id,
              userEmail: admin.email,
              userName: admin.name,
            }),
          );
        });
      }

      await Promise.allSettled(notificationPromises);
      this.logger.log(
        `Sent subscription expiration notifications to ${expiringSubscriptions.length} organizations...`,
      );
    } catch (error) {
      this.logger.error('Error sending subscription renewal reminders:', error);
    }
  }

  // Task 7: Send Expired Subscription Notifications every day to org admin if the subscription is expired
  @Cron(CronExpression.EVERY_HOUR)
  async sendExpiredSubscriptionNotifications() {
    this.logger.log(
      'Checking for expired subscriptions to send notifications...',
    );

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
            {
              last_reminder_sent: {
                lt: new Date(now.getTime() - 24 * 60 * 60000),
              },
            }, // Ensure we only send one reminder per day
          ],
          is_active: true, // Only consider active subscriptions to avoid notifying about already handled expired ones
        },
        include: {
          organization: {
            include: {
              users: {
                where: { role: Role.ORG_ADMIN }, // Filter for organization admins only
                select: { id: true, email: true, name: true },
              },
            },
          },
        },
      });

      if (expiredSubscriptions.length === 0) return;
      const notificationPromises: Promise<unknown>[] = [];

      for (const subscription of expiredSubscriptions) {
        const isTrial = subscription.payment_status === PlanType.TRIAL;
        const planLabel = isTrial ? 'Trial' : subscription.plan_name;
        const admins = subscription?.organization?.users;
        const orgName = subscription?.organization?.name;
        const orgId = subscription?.organization?.id;
        const expiredPlanName = subscription?.plan_name;

        const currentPool = Number(subscription.organization.credit_pool || 0);
        const freeLimit = SUBSCRIPTION_LIMITS.FREE.INITIAL_CREDITS;
        const excessCredits =
          currentPool > freeLimit ? currentPool - freeLimit : 0;
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
              payment_status: PaymentStatus.COMPLETED,
            },
          }),
          this.prisma.organizations.update({
            where: { id: orgId },
            data: {
              credit_pool: freeLimit,
              plan_type: PlanType.FREE,
              weeklyReportEnabled: false,
              frozen_credits: { increment: excessCredits },
            },
          }),
          ...(excessCredits > 0
            ? [
                this.prisma.creditTransaction.create({
                  data: {
                    org_id: orgId,
                    amount: excessCredits,
                    type: TransactionType.DEDUCT,
                    previousBalance: currentPool,
                    currentBalance: freeLimit,
                    user_id: subscription.organization?.users?.[0]?.id,
                    performedBy: 'system',
                    description: `Subscription expired (${expiredPlanName}). ${excessCredits} excess credits have been frozen.`,
                    metadata: {
                      expired_plan: expiredPlanName,
                      is_trial: subscription.payment_status === PlanType.TRIAL,
                    },
                  },
                }),
              ]
            : []),
        ]);

        // const broadMessage = `Your "${orgName}" ${expiredPlanName} plan has expired. Your excess ${excessCredits} credits are frozen and your account is moved to the Free Tier. Don't worry, your remaining ${excessCredits} credits will be restored immediately once you upgrade back to Pro!. `;
        const maxStaff = SUBSCRIPTION_LIMITS[PlanType.FREE].MAX_USERS;
        const maxResources = SUBSCRIPTION_LIMITS[PlanType.FREE].MAX_RESOURCES;
        const broadMessage = isTrial
          ? `Your 7-day PRO Trial for "${orgName}" has expired. 
           Your account has been moved back to the Free Tier. 
           1. Your trial credits (${excessCredits}) are now frozen.
           2. Free Tier limits apply (Max ${maxResources} Resources & ${maxStaff} Staff). 
           Upgrade to Pro to restore your credits and keep your advanced configuration!`
          : `Your "${orgName}" ${expiredPlanName} plan has expired. \n
                                    Your account has been moved to the Free Tier. As a result: \n
                                    1. Your excess ${excessCredits} credits are now frozen (Upgrade to restore them).\n
                                    2. If your organization exceeds the Free Tier limits (Max ${maxResources} Resources & ${maxStaff} Staff) ⚠️ Booking will be DISABLED until you upgrade or reduce your usage of resources and staff.\n
                                    To resume your bookings and unlock your frozen credits, please upgrade back to the Pro Plan!`;

        admins.forEach((admin) => {
          notificationPromises.push(
            this.NotificationManager.send({
              userId: admin.id,
              message: broadMessage,
              type: NotificationType.SUBSCRIPTION_EXPIRED,
              title: `${planLabel} ${expiredPlanName} Plan Expired: ${orgName}`,
              orgId: subscription.org_id,
              userEmail: admin.email,
              userName: admin.name,
            }),
          );
        });
      }

      await Promise.allSettled(notificationPromises);
      this.logger.log(
        `Sent expired subscription notifications to ${expiredSubscriptions.length} organizations...`,
      );
    } catch (error) {
      this.logger.error(
        'Error sending expired subscription notifications:',
        error,
      );
    }
  }

  // Task 8: Send Free user Notification to upgrade Paid plan with the features and others stuff in every 15 days
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
            lt: new Date(now.getTime() - 7 * 24 * 60 * 60000),
          },
          OR: [
            { last_reminder_sent: null },
            {
              last_reminder_sent: {
                lt: new Date(now.getTime() - 24 * 60 * 60000),
              },
            },
          ],
        },
        include: {
          organization: {
            include: {
              users: {
                where: { role: Role.ORG_ADMIN },
                select: { id: true, email: true, name: true },
              },
            },
          },
        },
      });

      if (freeUsers?.length === 0) return;

      const notificationPromises: Promise<unknown>[] = [];

      for (const sub of freeUsers) {
        const admins = sub?.organization?.users || [];
        const orgName = sub?.organization?.name || 'your organization';

        // const upgradeMessage = `Unlock the full power of ${orgName}! 🚀 Upgrade to our Pro Plan to get advanced analytics, unlimited team members, and priority support. Don't let your growth slow down.`;
        const maxStaff = SUBSCRIPTION_LIMITS.FREE.MAX_USERS;
        const maxResources = SUBSCRIPTION_LIMITS.FREE.MAX_RESOURCES;
        const upgradeMessage = `Ready to take "${orgName}" to the next level? 🚀 
                    \n
                    Currently, you're on our Free Tier, which is great for getting started. But why stop there? Unlock the full potential of your organization with our Pro Plan:
                    \n
                    ✅ Unlimited Staff Members: Grow your team without worrying about the ${maxStaff}-staff limit.\n
                    ✅ Scalable Resources: Add as many resources as you need beyond the ${maxResources}-resource cap.\n
                    ✅ Smart Scheduling: Get full access to our Calendar View and Advanced Analytics to optimize your bookings.\n
                    ✅ Priority Support: We’re here for you 24/7 to ensure your operations never stop.\n
                    ✅ Credit Perks: Enjoy a much larger monthly credit pool to keep your business running smoothly.\n\n

                    Don't let plan limits slow down your growth. Upgrade today and start scaling like a pro!`;

        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { last_reminder_sent: now },
        });

        admins.forEach((admin) => {
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
              },
            }),
          );
        });
      }

      await Promise.allSettled(notificationPromises);
      this.logger.log(
        `Sent upgrade notifications to ${freeUsers.length} organizations...`,
      );
    } catch (error) {
      this.logger.error(
        'Error sending free user upgrade notifications:',
        error,
      );
    }
  }

  // Task 9: Reset free users credits every month on the 1st day of the month
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
                select: { id: true, email: true, name: true },
              },
            },
          },
        },
      });

      if (freeSubscriptions?.length === 0) return;

      // find all organizations that have free subscriptions and reset their credit pool to the free limit
      const orgIds = freeSubscriptions.map((sub) => sub.org_id);
      await this.prisma.organizations.updateMany({
        where: { id: { in: orgIds } },
        data: { credit_pool: freeLimit },
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
            },
          }),
        );
        // Send notification to org admins about the credit reset
        let message = `Good news! Your monthly credits have been reset to ${freeLimit} for ${org.name}. Keep innovating and making the most out of our platform! 🚀`;
        if (Number(org?.frozen_credits || 0) > 0) {
          message += `\n\nNote: You also have ${org.frozen_credits} credits currently frozen. Upgrade to our Pro Plan anytime to unlock and add them to your current pool! 💎`;
        }
        admins.forEach((admin) => {
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
              },
            }),
          );
        });
      }
      await Promise.all(transactionPromises);
      await Promise.allSettled(notificationPromises);
      this.logger.log(
        `Reset credits for ${freeSubscriptions.length} free users...`,
      );
    } catch (error) {
      this.logger.error('Error resetting free user credits:', error);
    }
  }

  // Task 10: Clean up old notifications and logs (e.g., older than 90 days) to keep the database optimized
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
          is_read: true, // Only delete read notifications to avoid losing important unread ones
        },
      });

      // delete activity logs
      const deletedLogs = await this.prisma.activityLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });

      this.logger.log(
        `Cleanup successful: ${deletedNotifications?.count} notifications and ${deletedLogs?.count} logs removed.`,
      );
    } catch (error) {
      this.logger.error('Error cleaning up old notifications and logs:', error);
    }
  }

  // Task 11: Send weekly reports to PRO organizations every Sunday morning at 8 AM based on their local timezone (if enabled)
  @Cron('0 * * * *') // Run every hour to check for organizations that need to receive the report at that time based on their timezone
  async sendWeeklyReports() {
    this.logger.log('Checking for organizations to send weekly reports...');
    try {
      const organizations = await this.prisma.organizations.findMany({
        where: {
          plan_type: { not: PlanType.FREE },
          is_active: true,
          weeklyReportEnabled: true,
          deletedAt: null,
        },
        include: { users: { where: { role: Role.ORG_ADMIN } } },
      });
      if (organizations.length === 0) return;
      const orgsToNotify = organizations.filter((org) => {
        const timezone = org.timezone || 'UTC';
        const orgNow = new Date(
          new Date().toLocaleString('en-US', { timeZone: timezone }),
        );

        return orgNow.getDay() === 0 && orgNow.getHours() === 8;
      });

      if (orgsToNotify.length === 0) {
        this.logger.log(
          'No organizations to notify in this hour slot. Stopping.',
        );
        return;
      }
      // Calculate the date 7 days ago from now to fetch stats for the last week
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      const notificationPromises = organizations.map(async (org) => {
        // Fetch stats
        const stats = await this.getOrganizationStats(org.id, lastWeek);
        const adminPromises = org.users.map((admin) => {
          return this.NotificationManager.send({
            userId: admin.id,
            type: NotificationType.WEEKLY_REPORT,
            title: `Your Weekly Report is Here! 📈`,
            message: `Weekly summary for ${org.name} is ready. Check it out ${admin.email}! `,
            userEmail: admin.email,
            userName: admin.name,
            emailTemplateId: 'weekly_report',
            orgId: org.id,
            metadata: {
              orgName: org.name,
              stats,
            },
          });
        });

        return Promise.all(adminPromises);
      });

      await Promise.all(notificationPromises);
      this.logger.log(
        `Sent weekly reports to ${orgsToNotify.length} organizations...`,
      );
    } catch (error) {
      this.logger.error('Error sending weekly reports:', error);
    }
  }

  // Get organization stats for the weekly report
  async getOrganizationStats(orgId: string, sinceDate: Date) {
    const [
      totalBookings,
      cancelledBookings,
      topResource,
      topUser,
      creditsUsed,
      activeStaffCount,

      bookingDays,
    ] = await Promise.all([
      // 1. Total Bookings in the last 7 days
      this.prisma.bookings.count({
        where: { org_id: orgId, createdAt: { gte: sinceDate } },
      }),

      // 2. Cancelled Bookings
      this.prisma.bookings.count({
        where: {
          org_id: orgId,
          createdAt: { gte: sinceDate },
          status: BookingStatus.CANCELLED,
        },
      }),

      // 3. Top Resource (based on bookings in the last 7 days)
      this.prisma.resources.findFirst({
        where: {
          org_id: orgId,
          bookings: { some: { createdAt: { gte: sinceDate } } },
        },
        orderBy: { bookings: { _count: 'desc' } },
        select: { name: true },
      }),

      // 4. Top User (based on bookings in the last 7 days)
      this.prisma.user.findFirst({
        where: {
          org_id: orgId,
          bookings: { some: { createdAt: { gte: sinceDate } } },
        },
        orderBy: { bookings: { _count: 'desc' } },
        select: { name: true },
      }),

      // 5. Credit Usage
      this.prisma.creditTransaction.aggregate({
        where: {
          org_id: orgId,
          createdAt: { gte: sinceDate },
          type: TransactionType.SPEND,
        },
        _sum: { amount: true },
      }),

      // 6. Active Staff
      this.prisma.user.count({
        where: { org_id: orgId, deletedAt: null },
      }),

      // 7. Busiest Day Data
      this.prisma.bookings.groupBy({
        by: ['createdAt'],
        where: { org_id: orgId, createdAt: { gte: sinceDate } },
        _count: { id: true },
      }),
    ]);

    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const countsPerDay = new Array(7).fill(0);
    bookingDays.forEach((b: any) => {
      const dayIndex = new Date(b?.createdAt).getDay();
      countsPerDay[dayIndex] += b._count.id;
    });
    const busiestDayIndex = countsPerDay.indexOf(Math.max(...countsPerDay));

    return {
      totalBookings,
      cancelledBookings,
      topResourceName: topResource?.name || 'No bookings',
      topUserName: topUser?.name || 'No active user',
      creditsUsed: creditsUsed?._sum?.amount || 0,
      activeStaffCount,
      busiestDay: totalBookings > 0 ? dayNames[busiestDayIndex] : 'N/A',
    };
  }
}
