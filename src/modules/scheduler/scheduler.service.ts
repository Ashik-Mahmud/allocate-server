// scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, NotificationType } from '@prisma/client';
import { NotificationManager } from '../inbox/service/notification-manager.service';

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


    }

    // Task 3: Send reminders to Organizer for pending bookings to be confirmed (15 minutes before the booking)
    @Cron(CronExpression.EVERY_10_MINUTES)
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

    }

    // Task 4: Send follow-up notifications to Staff before their scheduled bookings (15 minutes before the booking)
    @Cron(CronExpression.EVERY_10_MINUTES)
    async sendStaffFollowUps() {
        const now = Date.now();
        const windowStart = new Date(now + 15 * 60000);
        const windowEnd = new Date(now + 25 * 60000);
        this.logger.log('Checking for upcoming staff bookings to send follow-ups...');
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

    }

    // Task 5: 
}