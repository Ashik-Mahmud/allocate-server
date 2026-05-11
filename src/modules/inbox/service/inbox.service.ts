import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { EmailService } from "./email.service";
import { BookingStatus, NotificationType, User } from "@prisma/client";
import { formatInTimezone, resolveUserTimezone } from "src/shared/utils/timezone.util";
import { CurrentUserType } from "src/shared/decorators/user.decorator";
import { NotificationManager } from "./notification-manager.service";
import { SharedService } from "src/shared/services/shared.service";
import { Response } from "express";
import { NotificationRealtimeService } from "./notification-realtime.service";

// Write inbox service code
@Injectable()
export class InboxService {
    constructor(
        private prisma: PrismaService,
        private emailService: EmailService,
        private notificationManager: NotificationManager,
        private sharedService: SharedService,
        private notificationRealtimeService: NotificationRealtimeService,

    ) {
        // Initialize any necessary properties or dependencies here
    }
    // create notification for user
    async createNotification(data: {
        userId: string;
        orgId: string;
        type: NotificationType;
        title: string;
        message: string;
        refId?: string;
        metadata?: Record<string, any>;
    }) {
        const notification = await this.prisma.notification.create({
            data: {
                user_id: data.userId,
                org_id: data.orgId,
                type: data.type,
                title: data.title,
                message: data.message,
                reference_id: data.refId,
                metadata: data.metadata
            },
        });

        this.notificationRealtimeService.emitInAppNotification(notification);

        return notification;
    }

    // Method to send reminder email to a user
    async sendManualReminder(currentUser: User & CurrentUserType, bookingId: string, response: Response) {

        const booking = await this.prisma.bookings.findUnique({
            where: {
                id: bookingId,
                org_id: currentUser.org_id,
                deletedAt: null
            },
            include: { user: true, resource: true }
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }


        if (booking.status !== BookingStatus.CONFIRMED) {
            throw new BadRequestException('Reminders can only be sent for confirmed bookings');
        }


        /*
        if (booking.last_reminder_sent && isTooSoon(booking.last_reminder_sent)) {
            throw new BadRequestException('Please wait before sending another reminder');
        }
        */


        const timezone = resolveUserTimezone(currentUser as any);
        const startTimeFormatted = formatInTimezone(booking.start_time, timezone, { timeStyle: 'short' });

        await this.notificationManager.send({
            userId: booking.user_id,
            type: NotificationType.BOOKING_REMINDER,
            title: 'Reminder: Your Upcoming Booking',
            message: `Reminder: Your booking for ${booking.resource.name} is scheduled at ${startTimeFormatted}. We look forward to seeing you!`,
            orgId: booking.org_id,
            userEmail: booking.user.email,
            userName: booking.user.name,
        });

        const ipAddress = response.req.ip || response.req.headers['x-forwarded-for'] || response.req.connection.remoteAddress;
        const userAgent = response.req.headers['user-agent'] || 'Unknown';

        await this.sharedService.logActivity(this.prisma, {
            action: 'REMINDER_SENT_MANUALLY',
            details: `Manual reminder sent to ${booking.user.name} for booking #${booking.id}`,
            orgId: booking.org_id,
            userId: currentUser.id,
            ipAddress: ipAddress as string,
            userAgent: userAgent,
        });

        return { success: true, message: 'Reminder sent successfully' };
    }
    // Method to get inbox messages for a user
    async getInboxMessages(userId: string) {
        // Implement logic to retrieve inbox messages for the user from the database
        // You can use PrismaService to query the database and return the messages
        return await this.prisma.notification.findMany({
            where: {
                user_id: userId,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}